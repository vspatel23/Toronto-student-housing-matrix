import { useEffect, useRef, useState } from "react";
import { Routes, Route, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import "./App.css";
import "./styles/ui-cleanup.css";
import "./styles/ai-dashboard.css";
import "./styles/listing-images.css";
import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  DEFAULT_VALUE_SCORE_WEIGHTS,
  defaultFormData,
} from "./utils/constants";
import {
  getStoredAuthUser,
  clearAuthStorage,
  isValidEmail,
  isUnauthorizedError,
  apiRequest,
} from "./utils/api";
import AuthForm from "./components/AuthForm";
import Header from "./components/Header";
import StepProgress from "./components/StepProgress";
import SearchForm from "./components/SearchForm";
import BrowseResults from "./components/BrowseResults";
import CompareListings from "./components/CompareListings";
import ListingDetail from "./components/ListingDetail";
import SavedListings from "./components/SavedListings";
import Collections from "./components/Collections";
import CollectionDetail from "./components/CollectionDetail";
import CollectionPickerModal from "./components/CollectionPickerModal";
import CopyLinkButton from "./components/CopyLinkButton";
import NotFound from "./components/NotFound";
import StatusMessage from "./components/StatusMessage";
import {
  findCampusByLabel,
  getListingId,
  getListingTitle,
} from "./utils/listingFormatters";
import { getRecommendationBadgesByListingId } from "./utils/recommendationBadges";
import {
  buildResultsPath,
  createDefaultResultsFilters,
  createResultsFiltersFromSearch,
  getListingQueryParams,
  isSameSearch,
  mapAiFiltersToSearchState,
  parseSearchFromQuery,
} from "./utils/searchState";

const MAX_COMPARE_LISTINGS = 3;
const MONGO_ID_PATTERN = /^[a-f0-9]{24}$/i;

// Listing detail, search results, and comparison views show generic
// housing data (not account-specific), so they're viewable without an
// account per Issue #48 — only Saved Listings and private Collections
// stay behind the login gate. Shared collections are public via an
// opaque share token, never by the private collection ID.
const isPublicRoute = (pathname) =>
  pathname === "/results" ||
  pathname === "/compare" ||
  /^\/listings\/[^/]+$/.test(pathname) ||
  /^\/shared\/collections\/[^/]+$/.test(pathname);

const parseCompareIdsFromQuery = (searchParams) => {
  const raw = searchParams.get("ids") || "";
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => MONGO_ID_PATTERN.test(id));

  return Array.from(new Set(ids)).slice(0, MAX_COMPARE_LISTINGS);
};

const sameIdSequence = (a, b) => {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((id, index) => id === b[index]);
};

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const latestListingsRequestId = useRef(0);
  const compareListingIdsRef = useRef([]);
  const restoredResultsKeyRef = useRef("");
  const restoredListingKeyRef = useRef("");
  const restoredCompareKeyRef = useRef("");
  const restoredCollectionKeyRef = useRef("");
  const restoredCollectionsListKeyRef = useRef("");
  const restoredSharedCollectionKeyRef = useRef("");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [authUser, setAuthUser] = useState(() =>
    localStorage.getItem(AUTH_TOKEN_KEY) ? getStoredAuthUser() : null,
  );
  const [authStatus, setAuthStatus] = useState({ type: "", message: "" });
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(() =>
    Boolean(localStorage.getItem(AUTH_TOKEN_KEY)),
  );
  const [formData, setFormData] = useState(defaultFormData);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [validationErrors, setValidationErrors] = useState({});
  const [campuses, setCampuses] = useState([]);
  const [isLoadingCampuses, setIsLoadingCampuses] = useState(false);
  const [campusError, setCampusError] = useState("");
  const [listings, setListings] = useState([]);
  const [activeSearch, setActiveSearch] = useState(null);
  const [aiSearchDescription, setAiSearchDescription] = useState("");
  const [resultsFilters, setResultsFilters] = useState(
    createDefaultResultsFilters,
  );
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const [selectedListingId, setSelectedListingId] = useState("");
  const [selectedListing, setSelectedListing] = useState(null);
  const [isLoadingListing, setIsLoadingListing] = useState(false);
  const [listingError, setListingError] = useState("");
  const [directlyFetchedListings, setDirectlyFetchedListings] = useState([]);
  const [isSavingPreference, setIsSavingPreference] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isLoadingRecentSearches, setIsLoadingRecentSearches] = useState(false);
  const [savedListings, setSavedListings] = useState([]);
  const [savedListingIds, setSavedListingIds] = useState(() => new Set());
  const [savingListingIds, setSavingListingIds] = useState(() => new Set());
  const [listingActionStatus, setListingActionStatus] = useState({
    type: "",
    message: "",
  });
  const [isLoadingSavedListings, setIsLoadingSavedListings] = useState(false);
  const [savedListingsError, setSavedListingsError] = useState("");
  const [listingDetailOrigin, setListingDetailOrigin] = useState("results");
  const [compareOrigin, setCompareOrigin] = useState("results");
  const [compareListingIds, setCompareListingIds] = useState([]);
  const [compareStatus, setCompareStatus] = useState({
    type: "",
    message: "",
  });
  const [valueScoreWeights, setValueScoreWeights] = useState({
    ...DEFAULT_VALUE_SCORE_WEIGHTS,
  });
  const [collections, setCollections] = useState([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [collectionsError, setCollectionsError] = useState("");
  const [collectionActionStatus, setCollectionActionStatus] = useState({
    type: "",
    message: "",
  });
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [pendingCollectionIds, setPendingCollectionIds] = useState(
    () => new Set(),
  );
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [collectionDetail, setCollectionDetail] = useState(null);
  const [isLoadingCollectionDetail, setIsLoadingCollectionDetail] =
    useState(false);
  const [collectionDetailError, setCollectionDetailError] = useState("");
  const [removingFromCollectionIds, setRemovingFromCollectionIds] = useState(
    () => new Set(),
  );
  const [collectionPickerListingId, setCollectionPickerListingId] =
    useState("");
  const [isSubmittingCollectionPicker, setIsSubmittingCollectionPicker] =
    useState(false);
  const [isUpdatingShare, setIsUpdatingShare] = useState(false);
  const [shareActionError, setShareActionError] = useState("");
  const [selectedShareToken, setSelectedShareToken] = useState("");
  const [sharedCollection, setSharedCollection] = useState(null);
  const [isLoadingSharedCollection, setIsLoadingSharedCollection] =
    useState(false);
  const [sharedCollectionError, setSharedCollectionError] = useState("");

  const getCurrentRouteOrigin = () => {
    if (location.pathname === "/saved") {
      return "saved";
    }
    if (location.pathname.startsWith("/saved/collections/")) {
      return "collectionDetail";
    }
    if (location.pathname.startsWith("/shared/collections/")) {
      return "sharedCollection";
    }
    if (location.pathname === "/compare") {
      return "compare";
    }
    return "results";
  };

  const resetSessionState = ({ resetForm = false } = {}) => {
    setStatus({ type: "", message: "" });
    setValidationErrors({});
    setListings([]);
    setActiveSearch(null);
    setAiSearchDescription("");
    setResultsFilters(createDefaultResultsFilters());
    setResultsError("");
    setCampuses([]);
    setCampusError("");
    setIsLoadingCampuses(false);
    setSelectedListing(null);
    setSelectedListingId("");
    setListingError("");
    setDirectlyFetchedListings([]);
    setRecentSearches([]);
    setSavedListings([]);
    setSavedListingIds(new Set());
    setSavingListingIds(new Set());
    setListingActionStatus({ type: "", message: "" });
    setSavedListingsError("");
    setListingDetailOrigin("results");
    setCompareOrigin("results");
    compareListingIdsRef.current = [];
    setCompareListingIds([]);
    setCompareStatus({ type: "", message: "" });
    setValueScoreWeights({ ...DEFAULT_VALUE_SCORE_WEIGHTS });
    setCollections([]);
    setCollectionsError("");
    setCollectionActionStatus({ type: "", message: "" });
    setPendingCollectionIds(new Set());
    setSelectedCollectionId("");
    setCollectionDetail(null);
    setCollectionDetailError("");
    setRemovingFromCollectionIds(new Set());
    setCollectionPickerListingId("");
    if (resetForm) {
      setFormData(defaultFormData);
    }
  };

  const handleSessionExpired = () => {
    clearAuthStorage();
    setAuthUser(null);
    resetSessionState({ resetForm: true });
    setAuthStatus({
      type: "error",
      message: "Your saved login expired. Please log in again.",
    });
    navigate("/", { replace: true });
  };

  useEffect(() => {
    compareListingIdsRef.current = compareListingIds;
  }, [compareListingIds]);

  useEffect(() => {
    if (!compareStatus.message) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCompareStatus({ type: "", message: "" });
    }, 4500);

    return () => window.clearTimeout(timeoutId);
  }, [compareStatus.message]);

  useEffect(() => {
    if (!listingActionStatus.message) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setListingActionStatus({ type: "", message: "" });
    }, 4500);

    return () => window.clearTimeout(timeoutId);
  }, [listingActionStatus.message]);

  useEffect(() => {
    if (authStatus.type !== "success" || !authStatus.message) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setAuthStatus({ type: "", message: "" });
    }, 4500);

    return () => window.clearTimeout(timeoutId);
  }, [authStatus.message, authStatus.type]);

  useEffect(() => {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);

    if (!storedToken) {
      localStorage.removeItem(AUTH_USER_KEY);
      return;
    }

    let isMounted = true;

    const verifyCurrentUser = async () => {
      setIsAuthChecking(true);

      try {
        const data = await apiRequest("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (!isMounted) {
          return;
        }

        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        setAuthUser(data.user);
        setAuthStatus({ type: "", message: "" });
      } catch {
        if (!isMounted) {
          return;
        }

        clearAuthStorage();
        setAuthUser(null);
        setStatus({ type: "", message: "" });
        setFormData(defaultFormData);
        compareListingIdsRef.current = [];
        setCompareListingIds([]);
        setCompareStatus({ type: "", message: "" });
        setAuthStatus({
          type: "error",
          message: "Your saved login expired. Please log in again.",
        });
      } finally {
        if (isMounted) {
          setIsAuthChecking(false);
        }
      }
    };

    verifyCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const shouldLoadCampuses =
    Boolean(authUser) || isPublicRoute(location.pathname);

  useEffect(() => {
    if (!shouldLoadCampuses) {
      return;
    }

    let isMounted = true;

    const loadCampuses = async () => {
      setIsLoadingCampuses(true);
      setCampusError("");

      try {
        const data = await apiRequest("/api/campuses");
        if (isMounted) {
          setCampuses(Array.isArray(data.campuses) ? data.campuses : []);
        }
      } catch {
        if (isMounted) {
          setCampuses([]);
          setCampusError(
            "We could not load campus options right now. Please try again shortly.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingCampuses(false);
        }
      }
    };

    loadCampuses();

    return () => {
      isMounted = false;
    };
  }, [shouldLoadCampuses]);

  const loadRecentSearches = async () => {
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!authUser || !authToken) {
      return;
    }

    setIsLoadingRecentSearches(true);

    try {
      const data = await apiRequest("/api/analytics/recent", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      setRecentSearches(data.searches || []);
    } catch {
      // Recent searches are a convenience panel; a load failure should not
      // block or degrade the rest of the search experience.
    } finally {
      setIsLoadingRecentSearches(false);
    }
  };

  const loadSavedListings = async () => {
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!authUser || !authToken) {
      return;
    }

    setIsLoadingSavedListings(true);
    setSavedListingsError("");

    try {
      const data = await apiRequest("/api/saved-listings", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const nextListings = data.listings || [];
      setSavedListings(nextListings);
      setSavedListingIds(new Set(nextListings.map((listing) => listing._id)));
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired();
        return;
      }
      setSavedListingsError(
        "We could not load your saved listings right now. Please try again.",
      );
    } finally {
      setIsLoadingSavedListings(false);
    }
  };

  useEffect(() => {
    if (!authUser) {
      return;
    }

    let isMounted = true;

    const loadInitialRecentSearches = async () => {
      const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!authToken) {
        return;
      }

      setIsLoadingRecentSearches(true);

      try {
        const data = await apiRequest("/api/analytics/recent", {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (isMounted) {
          setRecentSearches(data.searches || []);
        }
      } catch {
        // Recent searches are a convenience panel; a load failure should
        // not block or degrade the rest of the search experience.
      } finally {
        if (isMounted) {
          setIsLoadingRecentSearches(false);
        }
      }
    };

    loadInitialRecentSearches();

    return () => {
      isMounted = false;
    };
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    let isMounted = true;

    const loadInitialSavedListings = async () => {
      const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!authToken) {
        return;
      }

      setIsLoadingSavedListings(true);
      setSavedListingsError("");

      try {
        const data = await apiRequest("/api/saved-listings", {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (isMounted) {
          const nextListings = data.listings || [];
          setSavedListings(nextListings);
          setSavedListingIds(
            new Set(nextListings.map((listing) => listing._id)),
          );
        }
      } catch {
        if (isMounted) {
          setSavedListingsError(
            "We could not load your saved listings right now. Please try again.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingSavedListings(false);
        }
      }
    };

    loadInitialSavedListings();

    return () => {
      isMounted = false;
    };
  }, [authUser]);

  const toggleSavedListing = async (listingId) => {
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!authUser || !authToken || !listingId) {
      return;
    }

    if (savingListingIds.has(listingId)) {
      return;
    }

    const wasSaved = savedListingIds.has(listingId);

    setListingActionStatus({ type: "", message: "" });
    setSavingListingIds((current) => new Set(current).add(listingId));
    setSavedListingIds((current) => {
      const next = new Set(current);
      if (wasSaved) {
        next.delete(listingId);
      } else {
        next.add(listingId);
      }
      return next;
    });

    try {
      if (wasSaved) {
        await apiRequest(`/api/saved-listings/${listingId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        setSavedListings((current) =>
          current.filter((listing) => listing._id !== listingId),
        );
      } else {
        await apiRequest("/api/saved-listings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ listingId }),
        });
        await loadSavedListings();
      }
      setListingActionStatus({
        type: "success",
        message: wasSaved
          ? "Listing removed from Saved Listings."
          : "Listing saved.",
      });
    } catch (error) {
      setSavedListingIds((current) => {
        const next = new Set(current);
        if (wasSaved) {
          next.add(listingId);
        } else {
          next.delete(listingId);
        }
        return next;
      });

      if (isUnauthorizedError(error)) {
        handleSessionExpired();
        return;
      }

      setListingActionStatus({
        type: "error",
        message: wasSaved
          ? "We couldn't remove this listing from your saved list. Please try again."
          : "We couldn't save this listing. Please try again.",
      });
    } finally {
      setSavingListingIds((current) => {
        const next = new Set(current);
        next.delete(listingId);
        return next;
      });
    }
  };

  const loadCollections = async () => {
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!authUser || !authToken) {
      return;
    }

    setIsLoadingCollections(true);
    setCollectionsError("");

    try {
      const data = await apiRequest("/api/collections", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      setCollections(data.collections || []);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired();
        return;
      }
      setCollectionsError(
        "We could not load your collections right now. Please try again.",
      );
    } finally {
      setIsLoadingCollections(false);
    }
  };

  const openCollections = () => {
    setCollectionActionStatus({ type: "", message: "" });
    navigate("/saved/collections");
    loadCollections();
  };

  const returnFromCollections = () => {
    navigate("/saved");
  };

  const createCollection = async ({ name, description }) => {
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!authUser || !authToken) {
      return;
    }

    setIsCreatingCollection(true);
    setCollectionActionStatus({ type: "", message: "" });

    try {
      await apiRequest("/api/collections", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, description }),
      });
      await loadCollections();
      setCollectionActionStatus({
        type: "success",
        message: "Collection created.",
      });
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired();
        return;
      }
      setCollectionActionStatus({
        type: "error",
        message: "We couldn't create that collection. Please try again.",
      });
    } finally {
      setIsCreatingCollection(false);
    }
  };

  const renameCollection = async (collectionId, { name, description }) => {
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!authUser || !authToken) {
      return;
    }

    setPendingCollectionIds((current) => new Set(current).add(collectionId));
    setCollectionActionStatus({ type: "", message: "" });

    try {
      await apiRequest(`/api/collections/${collectionId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, description }),
      });
      await loadCollections();
      setCollectionActionStatus({
        type: "success",
        message: "Collection updated.",
      });
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired();
        return;
      }
      setCollectionActionStatus({
        type: "error",
        message: "We couldn't update that collection. Please try again.",
      });
    } finally {
      setPendingCollectionIds((current) => {
        const next = new Set(current);
        next.delete(collectionId);
        return next;
      });
    }
  };

  const deleteCollection = async (collectionId) => {
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!authUser || !authToken) {
      return;
    }

    setPendingCollectionIds((current) => new Set(current).add(collectionId));
    setCollectionActionStatus({ type: "", message: "" });

    try {
      await apiRequest(`/api/collections/${collectionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      setCollections((current) =>
        current.filter((collection) => collection._id !== collectionId),
      );
      setCollectionActionStatus({
        type: "success",
        message: "Collection deleted. Its listings are still saved.",
      });
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired();
        return;
      }
      setCollectionActionStatus({
        type: "error",
        message: "We couldn't delete that collection. Please try again.",
      });
    } finally {
      setPendingCollectionIds((current) => {
        const next = new Set(current);
        next.delete(collectionId);
        return next;
      });
    }
  };

  const fetchCollectionDetail = async (collectionId) => {
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!authToken || !collectionId) {
      return;
    }

    setCollectionDetail(null);
    setCollectionDetailError("");
    setIsLoadingCollectionDetail(true);

    try {
      const data = await apiRequest(
        `/api/collections/${collectionId}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
        { campus: activeSearch?.campus },
      );
      setCollectionDetail({
        collection: data.collection,
        listings: data.listings || [],
      });
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired();
        return;
      }
      setCollectionDetailError(
        "This collection could not be loaded. Please retry or go back.",
      );
    } finally {
      setIsLoadingCollectionDetail(false);
    }
  };

  const openCollectionDetail = (collectionId) => {
    if (!collectionId) {
      return;
    }

    setSelectedCollectionId(collectionId);
    navigate(`/saved/collections/${collectionId}`);
  };

  const retryCollectionDetail = () => {
    if (selectedCollectionId) {
      fetchCollectionDetail(selectedCollectionId);
    }
  };

  const returnFromCollectionDetail = () => {
    navigate("/saved/collections");
  };

  const enableCollectionShare = async () => {
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!authUser || !authToken || !selectedCollectionId) {
      return;
    }

    setIsUpdatingShare(true);
    setShareActionError("");

    try {
      const data = await apiRequest(
        `/api/collections/${selectedCollectionId}/share`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );
      setCollectionDetail((current) =>
        current
          ? {
              ...current,
              collection: {
                ...current.collection,
                shareToken: data.shareToken,
              },
            }
          : current,
      );
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired();
        return;
      }
      setShareActionError(
        "We could not enable the public link right now. Please try again.",
      );
    } finally {
      setIsUpdatingShare(false);
    }
  };

  const disableCollectionShare = async () => {
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!authUser || !authToken || !selectedCollectionId) {
      return;
    }

    setIsUpdatingShare(true);
    setShareActionError("");

    try {
      await apiRequest(`/api/collections/${selectedCollectionId}/share`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      setCollectionDetail((current) =>
        current
          ? {
              ...current,
              collection: { ...current.collection, shareToken: null },
            }
          : current,
      );
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired();
        return;
      }
      setShareActionError(
        "We could not turn off the public link right now. Please try again.",
      );
    } finally {
      setIsUpdatingShare(false);
    }
  };

  const removeListingFromCollection = async (listingId) => {
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!authUser || !authToken || !listingId || !selectedCollectionId) {
      return;
    }

    setRemovingFromCollectionIds((current) => new Set(current).add(listingId));

    try {
      await apiRequest(
        `/api/collections/${selectedCollectionId}/listings/${listingId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );
      setCollectionDetail((current) =>
        current
          ? {
              ...current,
              listings: current.listings.filter(
                (listing) => getListingId(listing) !== listingId,
              ),
            }
          : current,
      );
      setListingActionStatus({
        type: "success",
        message: "Listing removed from collection.",
      });
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired();
        return;
      }
      setListingActionStatus({
        type: "error",
        message:
          "We couldn't remove that listing from the collection. Please try again.",
      });
    } finally {
      setRemovingFromCollectionIds((current) => {
        const next = new Set(current);
        next.delete(listingId);
        return next;
      });
    }
  };

  const openCollectionPicker = (listingId) => {
    if (!listingId) {
      return;
    }
    setListingActionStatus({ type: "", message: "" });
    setCollectionPickerListingId(listingId);
    loadCollections();
  };

  const closeCollectionPicker = () => {
    setCollectionPickerListingId("");
  };

  const addListingToCollections = async (collectionIds) => {
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const listingId = collectionPickerListingId;
    if (
      !authUser ||
      !authToken ||
      !listingId ||
      !collectionIds ||
      collectionIds.length === 0
    ) {
      return;
    }

    setIsSubmittingCollectionPicker(true);

    try {
      await Promise.all(
        collectionIds.map((collectionId) =>
          apiRequest(`/api/collections/${collectionId}/listings`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ listingId }),
          }),
        ),
      );
      await loadCollections();
      setListingActionStatus({
        type: "success",
        message: `Added to ${collectionIds.length} collection${
          collectionIds.length === 1 ? "" : "s"
        }.`,
      });
      setCollectionPickerListingId("");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired();
        return;
      }
      setListingActionStatus({
        type: "error",
        message:
          "We couldn't add this listing to all selected collections. Please try again.",
      });
    } finally {
      setIsSubmittingCollectionPicker(false);
    }
  };

  const createAndAddCollectionFromPicker = async (name) => {
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const listingId = collectionPickerListingId;
    if (!authUser || !authToken || !listingId) {
      return;
    }

    setIsSubmittingCollectionPicker(true);

    try {
      const createData = await apiRequest("/api/collections", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, description: "" }),
      });
      const newCollectionId = createData.collection._id;

      await apiRequest(`/api/collections/${newCollectionId}/listings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ listingId }),
      });
      await loadCollections();
      setListingActionStatus({
        type: "success",
        message: `Created "${name}" and added this listing.`,
      });
      setCollectionPickerListingId("");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired();
        return;
      }
      setListingActionStatus({
        type: "error",
        message: "We couldn't create that collection. Please try again.",
      });
    } finally {
      setIsSubmittingCollectionPicker(false);
    }
  };

  const updateAuthField = (field, value) => {
    setAuthStatus({ type: "", message: "" });
    setAuthForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleAuthModeChange = (nextMode) => {
    setAuthMode(nextMode);
    setAuthStatus({ type: "", message: "" });
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();

    const name = authForm.name.trim();
    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password;

    if (authMode === "register" && !name) {
      setAuthStatus({ type: "error", message: "Name is required." });
      return;
    }

    if (!email || !password) {
      setAuthStatus({
        type: "error",
        message: "Email and password are required.",
      });
      return;
    }

    if (!isValidEmail(email)) {
      setAuthStatus({
        type: "error",
        message: "Please enter a valid email address.",
      });
      return;
    }

    if (password.length < 6) {
      setAuthStatus({
        type: "error",
        message: "Password must be at least 6 characters long.",
      });
      return;
    }

    setIsAuthSubmitting(true);
    setAuthStatus({ type: "", message: "" });

    try {
      const data = await apiRequest(`/api/auth/${authMode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          authMode === "register"
            ? { name, email, password }
            : { email, password },
        ),
      });

      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      // Intentionally do not navigate here: the current URL (whatever the
      // user was trying to reach before the auth gate caught them) stays
      // active, and each route's own data-restoration effect takes it from
      // there. This is what gives us "return to intended page" on login.
      resetSessionState({ resetForm: true });
      setAuthUser(data.user);
      setAuthForm({ name: "", email: "", password: "" });
      setAuthStatus({
        type: "success",
        message:
          authMode === "register"
            ? "Registration successful. You are logged in."
            : "Login successful.",
      });
    } catch (error) {
      const authAction = authMode === "register" ? "create your account" : "log you in";
      setAuthStatus({
        type: "error",
        message: isUnauthorizedError(error)
          ? "Your email or password was not accepted. Please try again."
          : `We couldn’t ${authAction}. Please try again.`,
      });
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleLogout = () => {
    clearAuthStorage();
    setAuthUser(null);
    setAuthMode("login");
    setAuthForm({ name: "", email: "", password: "" });
    resetSessionState({ resetForm: true });
    setAuthStatus({ type: "success", message: "You’re logged out." });
    navigate("/", { replace: true });
  };

  const updateField = (field, value) => {
    setStatus({ type: "", message: "" });
    setValidationErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
    }));
  };

  const handleRentChange = (field, value) => {
    const numberValue = Number(value);

    setStatus({ type: "", message: "" });
    setValidationErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors.minRent;
      delete nextErrors.maxRent;
      return nextErrors;
    });
    setFormData((currentData) => {
      const nextData = {
        ...currentData,
        [field]: numberValue,
      };

      if (field === "minRent" && numberValue > currentData.maxRent) {
        nextData.maxRent = numberValue;
      }

      if (field === "maxRent" && numberValue < currentData.minRent) {
        nextData.minRent = numberValue;
      }

      return nextData;
    });
  };

  const clearManualSearch = () => {
    setFormData({ ...defaultFormData, amenities: [] });
    setValidationErrors({});
    setStatus({ type: "", message: "" });
  };

  const loadListingsForSearch = async (searchData) => {
    const requestId = latestListingsRequestId.current + 1;
    latestListingsRequestId.current = requestId;
    setIsLoadingResults(true);
    setResultsError("");
    setListings([]);

    try {
      const listingData = await apiRequest(
        "/api/listings",
        {},
        getListingQueryParams(searchData),
      );
      if (requestId === latestListingsRequestId.current) {
        setListings(listingData.listings || []);
        setResultsError("");
      }
      return listingData;
    } catch (error) {
      if (requestId === latestListingsRequestId.current) {
        setListings([]);
        setResultsError(
          "We could not load listings right now. Please retry or edit your search.",
        );
      }
      throw error;
    } finally {
      if (requestId === latestListingsRequestId.current) {
        setIsLoadingResults(false);
      }
    }
  };

  const recordSearchAnalytics = (searchData) => {
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!authUser || !authToken) {
      return;
    }

    apiRequest("/api/analytics/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        campus: searchData.campus,
        minRent: searchData.minRent,
        maxRent: searchData.maxRent,
        housingType: searchData.housingType,
        maxCommute: searchData.maxCommute,
      }),
    })
      .then(() => loadRecentSearches())
      .catch(() => {
        // Analytics is best-effort and must never block or degrade search.
      });
  };

  const startListingSearch = async (searchSnapshot) => {
    setResultsError("");
    compareListingIdsRef.current = [];
    setCompareListingIds([]);
    setCompareStatus({ type: "", message: "" });
    setActiveSearch(searchSnapshot);
    setResultsFilters(createResultsFiltersFromSearch(searchSnapshot));

    navigate(buildResultsPath(searchSnapshot));
    const listingRequest = loadListingsForSearch(searchSnapshot);
    recordSearchAnalytics(searchSnapshot);

    try {
      const listingData = await listingRequest;
      return { listingData, listingLoadFailed: false };
    } catch {
      return { listingData: { count: 0 }, listingLoadFailed: true };
    }
  };

  const validateSearchForm = () => {
    const errors = {};
    const minRent = Number(formData.minRent);
    const maxRent = Number(formData.maxRent);

    if (!formData.campus) {
      errors.campus = "Please select a campus.";
    }

    if (!Number.isFinite(maxRent)) {
      errors.maxRent = "Please enter a valid maximum monthly rent.";
    } else if (maxRent <= 0) {
      errors.maxRent = "Maximum rent must be greater than zero.";
    } else if (Number.isFinite(minRent) && maxRent < minRent) {
      errors.maxRent = "Maximum rent must be greater than or equal to minimum rent.";
    }

    return errors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSavingPreference || isLoadingResults) {
      return;
    }

    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!authUser || !authToken) {
      setStatus({
        type: "error",
        message: "Please log in to save your preferences.",
      });
      return;
    }

    const errors = validateSearchForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setStatus({ type: "", message: "" });
      const firstInvalidField = Object.keys(errors)[0];
      window.setTimeout(() => {
        document.getElementById(firstInvalidField)?.focus();
      }, 0);
      return;
    }

    setIsSavingPreference(true);
    setStatus({ type: "", message: "" });
    setValidationErrors({});

    const searchSnapshot = { ...formData };

    try {
      await apiRequest("/api/preferences", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      setIsSavingPreference(false);
      setAiSearchDescription("");
      const { listingData, listingLoadFailed } =
        await startListingSearch(searchSnapshot);

      setStatus({
        type: listingLoadFailed ? "error" : "success",
        message:
          listingLoadFailed
            ? "Your preferences were saved successfully, but we couldn’t load listings right now. Please try again."
            : listingData.count > 0
              ? `Found ${listingData.count} housing listing${
                  listingData.count === 1 ? "" : "s"
                } and saved your preferences successfully.`
            : "Your preferences were saved successfully. No listings match your current preferences. Try adjusting your filters.",
      });
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired();
        return;
      }

      setStatus({
        type: "error",
        message: "We couldn’t save your preferences. Please try again.",
      });
    } finally {
      setIsSavingPreference(false);
    }
  };

  const handleAiSearch = async ({ filters, description }) => {
    const searchSnapshot = mapAiFiltersToSearchState(filters);
    setAiSearchDescription(description);
    setStatus({ type: "", message: "" });
    setValidationErrors({});

    const { listingData, listingLoadFailed } =
      await startListingSearch(searchSnapshot);

    setStatus({
      type: listingLoadFailed ? "error" : "success",
      message: listingLoadFailed
        ? "We started your search, but couldn’t load listings right now. Please retry from the results page."
        : listingData.count > 0
          ? `Found ${listingData.count} housing listing${
              listingData.count === 1 ? "" : "s"
            }.`
          : "No listings match these filters yet. Try adjusting your search.",
    });
  };

  const retryCampuses = async () => {
    setIsLoadingCampuses(true);
    setCampusError("");

    try {
      const data = await apiRequest("/api/campuses");
      setCampuses(Array.isArray(data.campuses) ? data.campuses : []);
    } catch {
      setCampuses([]);
      setCampusError("We couldn’t load the campus list. Please try again.");
    } finally {
      setIsLoadingCampuses(false);
    }
  };

  const retryResults = async () => {
    if (!activeSearch) {
      navigate("/");
      return;
    }

    try {
      await loadListingsForSearch(activeSearch);
    } catch {
      // The browse page already shows a user-friendly error state.
    }
  };

  const handleFilterChange = (field, value) => {
    setResultsFilters((currentFilters) => ({
      ...currentFilters,
      [field]: value,
    }));
  };

  const handleClearFilters = () => {
    setResultsFilters(createDefaultResultsFilters());
  };

  const updateValueScoreWeight = (factor, value) => {
    if (!(factor in DEFAULT_VALUE_SCORE_WEIGHTS)) {
      return;
    }

    const numericValue = Number(value);
    const safeValue = Number.isFinite(numericValue)
      ? Math.max(0, Math.min(100, numericValue))
      : DEFAULT_VALUE_SCORE_WEIGHTS[factor];

    setValueScoreWeights((currentWeights) => ({
      ...currentWeights,
      [factor]: safeValue,
    }));
  };

  const resetValueScoreWeights = () => {
    setValueScoreWeights({ ...DEFAULT_VALUE_SCORE_WEIGHTS });
  };

  const clearCompareStatus = () => {
    setCompareStatus({ type: "", message: "" });
  };

  const addListingToCompare = (listingId) => {
    if (!listingId) {
      return false;
    }

    const currentIds = compareListingIdsRef.current;

    if (currentIds.includes(listingId)) {
      setCompareStatus({
        type: "error",
        message: "This listing is already in your comparison.",
      });
      return false;
    }

    if (currentIds.length >= MAX_COMPARE_LISTINGS) {
      setCompareStatus({
        type: "error",
        message:
          "You can compare up to 3 listings at a time. Remove one before adding another.",
      });
      return false;
    }

    const nextIds = [...currentIds, listingId];
    compareListingIdsRef.current = nextIds;
    setCompareListingIds(nextIds);
    setCompareStatus({
      type: "success",
      message: "Added to comparison.",
    });
    return true;
  };

  const removeListingFromCompare = (listingId) => {
    if (!listingId) {
      return;
    }

    const nextIds = compareListingIdsRef.current.filter(
      (currentId) => currentId !== listingId,
    );
    compareListingIdsRef.current = nextIds;
    setCompareListingIds(nextIds);
    setCompareStatus({
      type: "success",
      message: "Removed from comparison.",
    });

    if (location.pathname === "/compare") {
      navigate(`/compare?ids=${nextIds.join(",")}`, { replace: true });
    }
  };

  const openCompareView = () => {
    setCompareOrigin(getCurrentRouteOrigin());
    setListingDetailOrigin("results");
    navigate(`/compare?ids=${compareListingIdsRef.current.join(",")}`);
  };

  const openCompareWithListing = (listingId) => {
    if (!listingId) {
      return;
    }

    if (!compareListingIdsRef.current.includes(listingId)) {
      addListingToCompare(listingId);
    } else {
      setCompareStatus({ type: "", message: "" });
    }

    setCompareOrigin(getCurrentRouteOrigin());
    setListingDetailOrigin("results");
    navigate(`/compare?ids=${compareListingIdsRef.current.join(",")}`);
  };

  const openListingDetail = (listingId, originOverride = "") => {
    if (!listingId) {
      return;
    }

    setListingDetailOrigin(originOverride || getCurrentRouteOrigin());
    const campusQuery = activeSearch?.campus
      ? `?campus=${encodeURIComponent(activeSearch.campus)}`
      : "";
    navigate(`/listings/${listingId}${campusQuery}`);
  };

  const fetchListingDetail = async (listingId, campusOverride) => {
    setSelectedListingId(listingId);
    setSelectedListing(null);
    setListingError("");
    setIsLoadingListing(true);

    try {
      const listing = await apiRequest(
        `/api/listings/${listingId}`,
        {},
        { campus: campusOverride ?? activeSearch?.campus },
      );
      setSelectedListing(listing);
    } catch {
      setListingError(
        "This listing could not be found or loaded. Please retry or return to results.",
      );
    } finally {
      setIsLoadingListing(false);
    }
  };

  const retryListingDetail = () => {
    if (selectedListingId) {
      fetchListingDetail(selectedListingId, searchParams.get("campus"));
    }
  };

  const getPathForView = (view) => {
    switch (view) {
      case "saved":
        return "/saved";
      case "collectionDetail":
        return selectedCollectionId
          ? `/saved/collections/${selectedCollectionId}`
          : "/saved/collections";
      case "sharedCollection":
        return selectedShareToken
          ? `/shared/collections/${selectedShareToken}`
          : "/";
      case "compare":
        return `/compare?ids=${compareListingIdsRef.current.join(",")}`;
      case "results":
      default:
        return activeSearch ? buildResultsPath(activeSearch) : "/";
    }
  };

  const returnToResults = () => {
    navigate(getPathForView(listingDetailOrigin));
    setListingError("");
    setIsLoadingListing(false);
  };

  const returnFromCompare = () => {
    setListingDetailOrigin("results");
    if (
      compareOrigin === "saved" ||
      compareOrigin === "collectionDetail" ||
      compareOrigin === "sharedCollection"
    ) {
      navigate(getPathForView(compareOrigin));
      return;
    }
    navigate(activeSearch ? getPathForView("results") : "/");
  };

  const openSavedListings = () => {
    setStatus({ type: "", message: "" });
    navigate("/saved");
  };

  const returnFromSavedListings = () => {
    navigate(activeSearch ? getPathForView("results") : "/");
  };

  const returnToSearch = () => {
    if (activeSearch) {
      setFormData((currentData) => ({
        ...currentData,
        ...activeSearch,
      }));
    }
    compareListingIdsRef.current = [];
    setCompareListingIds([]);
    setCompareStatus({ type: "", message: "" });
    setStatus({ type: "", message: "" });
    navigate("/");
  };

  // Direct/refreshed-load restoration: reconstruct in-memory state from the
  // URL for each route that supports deep linking. Each effect intentionally
  // duplicates its fetch logic inline instead of calling a named async
  // function, to avoid triggering the set-state-in-effect lint rule.
  //
  // These effects deliberately do NOT use an isMounted-guarded cleanup (the
  // pattern used elsewhere in this file for effects with no external
  // request-ordering signal). In dev-mode StrictMode, an effect's cleanup
  // runs synchronously immediately after its first invocation, before any
  // in-flight fetch has a chance to resolve -- an isMounted flag would mark
  // that first, real fetch as stale and silently drop its result, leaving
  // the UI stuck loading forever. Instead, each effect stores the key
  // (URL) it last dispatched a request for in a ref, set synchronously
  // before the request starts, and re-checks that same ref when the
  // request resolves: since the ref is only ever overwritten by a genuinely
  // new key (not by StrictMode's synthetic remount), this is safe against
  // duplicate dispatches, out-of-order resolution, and the request
  // continuing to resolve after the "owning" effect instance was cleaned up.
  useEffect(() => {
    if (location.pathname !== "/results") {
      return;
    }

    const queryFilters = parseSearchFromQuery(searchParams);
    if (!queryFilters) {
      return;
    }

    const restoreKey = location.pathname + location.search;
    if (restoredResultsKeyRef.current === restoreKey) {
      return;
    }
    restoredResultsKeyRef.current = restoreKey;

    if (isSameSearch(queryFilters, activeSearch)) {
      return;
    }

    const loadInitialResults = async () => {
      setActiveSearch(queryFilters);
      setResultsFilters(createResultsFiltersFromSearch(queryFilters));

      setIsLoadingResults(true);
      setResultsError("");

      try {
        const listingData = await apiRequest(
          "/api/listings",
          {},
          getListingQueryParams(queryFilters),
        );
        if (restoredResultsKeyRef.current === restoreKey) {
          setListings(listingData.listings || []);
        }
      } catch {
        if (restoredResultsKeyRef.current === restoreKey) {
          setListings([]);
          setResultsError(
            "We could not load listings right now. Please retry or edit your search.",
          );
        }
      } finally {
        if (restoredResultsKeyRef.current === restoreKey) {
          setIsLoadingResults(false);
        }
      }
    };

    loadInitialResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(authUser), location.pathname, location.search]);

  useEffect(() => {
    const match = location.pathname.match(/^\/listings\/([^/]+)$/);
    if (!match) {
      return;
    }

    const listingId = match[1];
    const restoreKey = location.pathname + location.search;
    if (restoredListingKeyRef.current === restoreKey) {
      return;
    }
    restoredListingKeyRef.current = restoreKey;

    // No isMounted flag here: StrictMode's dev-only mount/cleanup/remount
    // would set it false before the first invocation's fetch resolves,
    // discarding a valid result. Instead we re-check the ref at each
    // resolution point — it only changes on a genuinely new navigation.
    const loadInitialListingDetail = async () => {
      setSelectedListingId(listingId);
      setSelectedListing(null);
      setListingError("");
      setIsLoadingListing(true);

      try {
        const listing = await apiRequest(
          `/api/listings/${listingId}`,
          {},
          { campus: searchParams.get("campus") || activeSearch?.campus },
        );
        if (restoredListingKeyRef.current === restoreKey) {
          setSelectedListing(listing);
        }
      } catch {
        if (restoredListingKeyRef.current === restoreKey) {
          setListingError(
            "This listing could not be found or loaded. Please retry or return to results.",
          );
        }
      } finally {
        if (restoredListingKeyRef.current === restoreKey) {
          setIsLoadingListing(false);
        }
      }
    };

    loadInitialListingDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(authUser), location.pathname, location.search]);

  useEffect(() => {
    if (location.pathname !== "/compare") {
      return;
    }

    const queryIds = parseCompareIdsFromQuery(searchParams);
    if (sameIdSequence(queryIds, compareListingIdsRef.current)) {
      return;
    }

    const restoreKey = location.pathname + location.search;
    restoredCompareKeyRef.current = restoreKey;

    // No isMounted flag: see the /results restoration effect above for why
    // — StrictMode's dev-only remount would discard a still-resolving fetch.
    const loadInitialCompareListings = async () => {
      compareListingIdsRef.current = queryIds;
      setCompareListingIds(queryIds);

      const knownIds = new Set(
        [...listings, ...savedListings, ...directlyFetchedListings]
          .map((listing) => getListingId(listing))
          .filter(Boolean),
      );
      const missingIds = queryIds.filter((id) => !knownIds.has(id));

      if (missingIds.length === 0) {
        return;
      }

      const fetched = await Promise.all(
        missingIds.map((id) =>
          apiRequest(`/api/listings/${id}`, {}, {}).catch(() => null),
        ),
      );

      if (restoredCompareKeyRef.current !== restoreKey) {
        return;
      }

      const validFetched = fetched.filter(Boolean);
      if (validFetched.length > 0) {
        setDirectlyFetchedListings((current) => {
          const merged = new Map(
            current.map((listing) => [getListingId(listing), listing]),
          );
          validFetched.forEach((listing) =>
            merged.set(getListingId(listing), listing),
          );
          return Array.from(merged.values());
        });
      }
    };

    loadInitialCompareListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(authUser), location.pathname, location.search]);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    if (location.pathname !== "/saved/collections") {
      return;
    }

    const restoreKey = location.pathname;
    if (restoredCollectionsListKeyRef.current === restoreKey) {
      return;
    }
    restoredCollectionsListKeyRef.current = restoreKey;

    loadCollections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(authUser), location.pathname]);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    const match = location.pathname.match(/^\/saved\/collections\/([^/]+)$/);
    if (!match) {
      return;
    }

    const collectionId = match[1];
    const restoreKey = location.pathname;
    if (restoredCollectionKeyRef.current === restoreKey) {
      return;
    }
    restoredCollectionKeyRef.current = restoreKey;

    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!authToken) {
      return;
    }

    // No isMounted flag: see the /results restoration effect above for why
    // — StrictMode's dev-only remount would discard a still-resolving fetch.
    const loadInitialCollectionDetail = async () => {
      setSelectedCollectionId(collectionId);
      setCollectionDetail(null);
      setCollectionDetailError("");
      setIsLoadingCollectionDetail(true);

      try {
        const data = await apiRequest(
          `/api/collections/${collectionId}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          },
          { campus: activeSearch?.campus },
        );
        if (restoredCollectionKeyRef.current === restoreKey) {
          setCollectionDetail({
            collection: data.collection,
            listings: data.listings || [],
          });
        }
      } catch {
        if (restoredCollectionKeyRef.current === restoreKey) {
          setCollectionDetailError(
            "This collection could not be loaded. Please retry or go back.",
          );
        }
      } finally {
        if (restoredCollectionKeyRef.current === restoreKey) {
          setIsLoadingCollectionDetail(false);
        }
      }
    };

    loadInitialCollectionDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(authUser), location.pathname]);

  // Public route: works with or without an account, so it is not gated
  // on authUser like the private collection-detail effect above.
  useEffect(() => {
    const match = location.pathname.match(/^\/shared\/collections\/([^/]+)$/);
    if (!match) {
      return;
    }

    const token = match[1];
    const restoreKey = location.pathname;
    if (restoredSharedCollectionKeyRef.current === restoreKey) {
      return;
    }
    restoredSharedCollectionKeyRef.current = restoreKey;

    setSelectedShareToken(token);

    const loadInitialSharedCollection = async () => {
      setSharedCollection(null);
      setSharedCollectionError("");
      setIsLoadingSharedCollection(true);

      try {
        const data = await apiRequest(`/api/collections/shared/${token}`);
        if (restoredSharedCollectionKeyRef.current === restoreKey) {
          setSharedCollection({
            collection: data.collection,
            listings: data.listings || [],
          });
        }
      } catch {
        if (restoredSharedCollectionKeyRef.current === restoreKey) {
          setSharedCollectionError(
            "This shared collection could not be found or loaded.",
          );
        }
      } finally {
        if (restoredSharedCollectionKeyRef.current === restoreKey) {
          setIsLoadingSharedCollection(false);
        }
      }
    };

    loadInitialSharedCollection();
  }, [location.pathname]);

  if (isAuthChecking) {
    return (
      <main className="auth-page">
        <section className="auth-check-card" aria-labelledby="auth-check-title">
          <span className="spinner" aria-hidden="true"></span>
          <div role="status" aria-live="polite">
            <h1 id="auth-check-title">Checking your account</h1>
            <p>Restoring your saved session…</p>
          </div>
        </section>
      </main>
    );
  }

  if (!authUser && !isPublicRoute(location.pathname)) {
    return (
      <AuthForm
        authMode={authMode}
        authForm={authForm}
        authStatus={authStatus}
        isSubmitting={isAuthSubmitting}
        onFieldChange={updateAuthField}
        onModeChange={handleAuthModeChange}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  const displayName = authUser?.name || authUser?.email || "";
  const isSavedSection = location.pathname.startsWith("/saved");
  const isSharedSection = location.pathname.startsWith("/shared/");
  const headerView = isSavedSection ? "saved" : "other";
  const stepKey = location.pathname.startsWith("/results")
    ? "results"
    : location.pathname.startsWith("/listings/")
      ? "details"
      : location.pathname === "/compare"
        ? "compare"
        : "search";
  const detailCampusLabel =
    searchParams.get("campus") || activeSearch?.campus || "";
  const selectedCampus = findCampusByLabel(campuses, activeSearch?.campus);
  const detailSelectedCampus = findCampusByLabel(
    campuses,
    detailCampusLabel,
  );
  const comparisonListingPool = Array.from(
    new Map(
      [
        ...listings,
        ...savedListings,
        ...directlyFetchedListings,
        ...(collectionDetail?.listings || []),
        ...(sharedCollection?.listings || []),
        ...(selectedListing ? [selectedListing] : []),
      ]
        .filter((listing) => getListingId(listing))
        .map((listing) => [getListingId(listing), listing]),
    ).values(),
  );
  const comparedListings = compareListingIds
    .map((listingId) =>
      comparisonListingPool.find(
        (listing) => getListingId(listing) === listingId,
      ),
    )
    .filter(Boolean);
  const comparisonAvailableListings = Array.from(
    new Map(
      [
        ...(listings.length > 0 ? listings : savedListings),
        ...comparedListings,
      ]
        .filter((listing) => getListingId(listing))
        .map((listing) => [getListingId(listing), listing]),
    ).values(),
  );
  const recommendationBadgesByListingId =
    getRecommendationBadgesByListingId(
      listings,
      activeSearch?.campus,
      valueScoreWeights,
    );

  return (
    <main className="app-shell">
      <Header
        currentView={headerView}
        userName={displayName}
        onLogout={handleLogout}
        onOpenSaved={openSavedListings}
        onOpenSearch={returnToSearch}
        onLogIn={returnToSearch}
      />
      {!isSavedSection && !isSharedSection && (
        <StepProgress currentStep={stepKey} />
      )}

      {(authStatus.message || listingActionStatus.message) && (
        <div className="app-feedback-region" aria-label="Application notifications">
          {authStatus.message && (
            <StatusMessage type={authStatus.type || "info"}>
              {authStatus.message}
            </StatusMessage>
          )}
          {listingActionStatus.message && (
            <StatusMessage type={listingActionStatus.type || "info"}>
              {listingActionStatus.message}
            </StatusMessage>
          )}
        </div>
      )}

      <Routes>
        <Route
          path="/"
          element={
            <SearchForm
              userName={displayName}
              campuses={campuses}
              formData={formData}
              status={status}
              isSavingPreference={isSavingPreference}
              isSearchingListings={isLoadingResults}
              isLoadingCampuses={isLoadingCampuses}
              campusError={campusError}
              validationErrors={validationErrors}
              onFieldChange={updateField}
              onRentChange={handleRentChange}
              onSubmit={handleSubmit}
              onClear={clearManualSearch}
              onRetryCampuses={retryCampuses}
              aiSearchDescription={aiSearchDescription}
              onAiSearchDescriptionChange={setAiSearchDescription}
              onAiSearch={handleAiSearch}
              recentSearches={recentSearches}
              isLoadingRecentSearches={isLoadingRecentSearches}
            />
          }
        />

        <Route
          path="/results"
          element={
            <>
              <div className="route-share-bar">
                <CopyLinkButton label="Copy Link to This Search" />
              </div>
              <BrowseResults
                listings={listings}
                search={activeSearch}
                selectedCampus={selectedCampus}
                filters={resultsFilters}
                isLoading={isLoadingResults}
                errorMessage={resultsError}
                compareListingIds={compareListingIds}
                compareStatus={compareStatus}
                maxCompareListings={MAX_COMPARE_LISTINGS}
                onCompareListing={openCompareWithListing}
                onOpenCompare={openCompareView}
                onClearCompareStatus={clearCompareStatus}
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
                onDetails={openListingDetail}
                onEditSearch={returnToSearch}
                onRetry={retryResults}
                savedListingIds={savedListingIds}
                savingListingIds={savingListingIds}
                onToggleSave={authUser ? toggleSavedListing : undefined}
                valueScoreWeights={valueScoreWeights}
                onWeightChange={updateValueScoreWeight}
                onResetWeights={resetValueScoreWeights}
              />
            </>
          }
        />

        <Route
          path="/compare"
          element={
            <>
              <div className="route-share-bar">
                <CopyLinkButton label="Copy Link to This Comparison" />
              </div>
              <CompareListings
                listings={comparedListings}
                listingIds={compareListingIds}
                availableListings={comparisonAvailableListings}
                campus={activeSearch?.campus}
                compareStatus={compareStatus}
                maxCompareListings={MAX_COMPARE_LISTINGS}
                valueScoreWeights={valueScoreWeights}
                savedListingIds={savedListingIds}
                savingListingIds={savingListingIds}
                onToggleSave={authUser ? toggleSavedListing : undefined}
                onAddCompare={addListingToCompare}
                onRemoveCompare={removeListingFromCompare}
                onBackToResults={returnFromCompare}
                backLabel={
                  compareOrigin === "saved"
                    ? "Back to Saved Listings"
                    : compareOrigin === "collectionDetail"
                      ? "Back to Collection"
                      : compareOrigin === "sharedCollection"
                        ? "Back to Shared Collection"
                        : "Back to Results"
                }
                onDetails={openListingDetail}
              />
            </>
          }
        />

        <Route
          path="/saved"
          element={
            <SavedListings
              listings={savedListings}
              campus={activeSearch?.campus}
              isLoading={isLoadingSavedListings}
              errorMessage={savedListingsError}
              onDetails={openListingDetail}
              onBack={returnFromSavedListings}
              backLabel={activeSearch ? "Back to Results" : "Back to Search"}
              emptyActionLabel={
                activeSearch ? "Browse Results" : "Start a Search"
              }
              onRetry={loadSavedListings}
              savedListingIds={savedListingIds}
              savingListingIds={savingListingIds}
              onToggleSave={toggleSavedListing}
              compareListingIds={compareListingIds}
              onCompareListing={openCompareWithListing}
              badgesByListingId={recommendationBadgesByListingId}
              valueScoreWeights={valueScoreWeights}
              onOpenCollections={openCollections}
              onAddToCollection={openCollectionPicker}
            />
          }
        />

        <Route
          path="/saved/collections"
          element={
            <Collections
              collections={collections}
              isLoading={isLoadingCollections}
              errorMessage={collectionsError}
              actionStatus={collectionActionStatus}
              onBack={returnFromCollections}
              onOpenCollection={openCollectionDetail}
              onCreateCollection={createCollection}
              onRenameCollection={renameCollection}
              onDeleteCollection={deleteCollection}
              isCreating={isCreatingCollection}
              pendingCollectionIds={pendingCollectionIds}
            />
          }
        />

        <Route
          path="/saved/collections/:collectionId"
          element={
            <>
              <div className="route-share-bar">
                <CopyLinkButton label="Copy Link to This Collection" />
              </div>
              <CollectionDetail
                collection={collectionDetail?.collection || null}
                listings={collectionDetail?.listings || []}
                campus={activeSearch?.campus}
                isLoading={isLoadingCollectionDetail}
                errorMessage={collectionDetailError}
                onDetails={openListingDetail}
                onBack={returnFromCollectionDetail}
                onRetry={retryCollectionDetail}
                savedListingIds={savedListingIds}
                savingListingIds={savingListingIds}
                onToggleSave={toggleSavedListing}
                removingListingIds={removingFromCollectionIds}
                onRemoveFromCollection={removeListingFromCollection}
                compareListingIds={compareListingIds}
                onCompareListing={openCompareWithListing}
                badgesByListingId={recommendationBadgesByListingId}
                valueScoreWeights={valueScoreWeights}
                isUpdatingShare={isUpdatingShare}
                shareActionError={shareActionError}
                onEnableShare={enableCollectionShare}
                onDisableShare={disableCollectionShare}
              />
            </>
          }
        />

        <Route
          path="/shared/collections/:token"
          element={
            <>
              <div className="route-share-bar">
                <CopyLinkButton label="Copy Link to This Collection" />
              </div>
              <CollectionDetail
                readOnly
                collection={sharedCollection?.collection || null}
                listings={sharedCollection?.listings || []}
                isLoading={isLoadingSharedCollection}
                errorMessage={sharedCollectionError}
                onDetails={openListingDetail}
                compareListingIds={compareListingIds}
                onCompareListing={openCompareWithListing}
              />
            </>
          }
        />

        <Route
          path="/listings/:listingId"
          element={
            <>
              <div className="route-share-bar">
                <CopyLinkButton label="Copy Link to This Listing" />
              </div>
              <ListingDetail
                listing={selectedListing}
                campus={detailCampusLabel}
                selectedCampus={detailSelectedCampus}
                isLoadingCampus={isLoadingCampuses}
                campusError={campusError}
                badges={recommendationBadgesByListingId[selectedListingId] || []}
                isLoading={isLoadingListing}
                errorMessage={listingError}
                onBack={returnToResults}
                backLabel={
                  listingDetailOrigin === "compare"
                    ? "Back to Compare"
                    : listingDetailOrigin === "saved"
                      ? "Back to Saved Listings"
                      : listingDetailOrigin === "collectionDetail"
                        ? "Back to Collection"
                        : listingDetailOrigin === "sharedCollection"
                          ? "Back to Shared Collection"
                          : "Back to Results"
                }
                onRetry={retryListingDetail}
                isSaved={savedListingIds.has(selectedListingId)}
                isSaving={savingListingIds.has(selectedListingId)}
                onToggleSave={authUser ? toggleSavedListing : undefined}
                isCompared={compareListingIds.includes(selectedListingId)}
                compareCount={compareListingIds.length}
                maxCompareListings={MAX_COMPARE_LISTINGS}
                onCompareListing={openCompareWithListing}
                valueScoreWeights={valueScoreWeights}
              />
            </>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>

      {collectionPickerListingId && (
        <CollectionPickerModal
          listingTitle={getListingTitle(
            savedListings.find(
              (listing) => getListingId(listing) === collectionPickerListingId,
            ),
          )}
          collections={collections}
          isLoading={isLoadingCollections}
          isSubmitting={isSubmittingCollectionPicker}
          onAddToCollections={addListingToCollections}
          onCreateAndAdd={createAndAddCollectionFromPicker}
          onClose={closeCollectionPicker}
        />
      )}
    </main>
  );
}

export default App;
