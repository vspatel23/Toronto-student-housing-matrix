import { useEffect, useRef, useState } from "react";
import "./App.css";
import "./styles/ui-cleanup.css";
import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  DEFAULT_VALUE_SCORE_WEIGHTS,
  defaultFormData,
} from "./utils/constants";
import { getCampusLabel } from "./utils/campusFormatters";
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
import HelpCards from "./components/HelpCards";
import BrowseResults from "./components/BrowseResults";
import CompareListings from "./components/CompareListings";
import ListingDetail from "./components/ListingDetail";
import SavedListings from "./components/SavedListings";
import Collections from "./components/Collections";
import CollectionDetail from "./components/CollectionDetail";
import CollectionPickerModal from "./components/CollectionPickerModal";
import StatusMessage from "./components/StatusMessage";
import { getListingId, getListingTitle } from "./utils/listingFormatters";
import { getRecommendationBadgesByListingId } from "./utils/recommendationBadges";

const MAX_COMPARE_LISTINGS = 3;

const createDefaultResultsFilters = () => ({
  minRent: "",
  maxRent: "",
  housingType: "All types",
  safetyLevel: "Any",
  maxCommute: "",
  furnished: "Any",
  amenities: [],
});

function App() {
  const latestListingsRequestId = useRef(0);
  const compareListingIdsRef = useRef([]);
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
  const [currentView, setCurrentView] = useState("search");
  const [resultsFilters, setResultsFilters] = useState(
    createDefaultResultsFilters,
  );
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const [selectedListingId, setSelectedListingId] = useState("");
  const [selectedListing, setSelectedListing] = useState(null);
  const [isLoadingListing, setIsLoadingListing] = useState(false);
  const [listingError, setListingError] = useState("");
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

  const resetSessionState = ({ resetForm = false } = {}) => {
    setStatus({ type: "", message: "" });
    setValidationErrors({});
    setListings([]);
    setActiveSearch(null);
    setResultsFilters(createDefaultResultsFilters());
    setCurrentView("search");
    setResultsError("");
    setCampuses([]);
    setCampusError("");
    setIsLoadingCampuses(false);
    setSelectedListing(null);
    setSelectedListingId("");
    setListingError("");
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

  useEffect(() => {
    if (!authUser) {
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
  }, [authUser]);

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
      const listings = data.listings || [];
      setSavedListings(listings);
      setSavedListingIds(new Set(listings.map((listing) => listing._id)));
    } catch (error) {
      if (isUnauthorizedError(error)) {
        clearAuthStorage();
        setAuthUser(null);
        resetSessionState({ resetForm: true });
        setAuthStatus({
          type: "error",
          message: "Your saved login expired. Please log in again.",
        });
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
          const listings = data.listings || [];
          setSavedListings(listings);
          setSavedListingIds(new Set(listings.map((listing) => listing._id)));
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
        clearAuthStorage();
        setAuthUser(null);
        resetSessionState({ resetForm: true });
        setAuthStatus({
          type: "error",
          message: "Your saved login expired. Please log in again.",
        });
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
        clearAuthStorage();
        setAuthUser(null);
        resetSessionState({ resetForm: true });
        setAuthStatus({
          type: "error",
          message: "Your saved login expired. Please log in again.",
        });
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
    setCurrentView("collections");
    loadCollections();
  };

  const returnFromCollections = () => {
    setCurrentView("saved");
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
        clearAuthStorage();
        setAuthUser(null);
        resetSessionState({ resetForm: true });
        setAuthStatus({
          type: "error",
          message: "Your saved login expired. Please log in again.",
        });
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
        clearAuthStorage();
        setAuthUser(null);
        resetSessionState({ resetForm: true });
        setAuthStatus({
          type: "error",
          message: "Your saved login expired. Please log in again.",
        });
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
        clearAuthStorage();
        setAuthUser(null);
        resetSessionState({ resetForm: true });
        setAuthStatus({
          type: "error",
          message: "Your saved login expired. Please log in again.",
        });
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

  const openCollectionDetail = async (collectionId) => {
    if (!collectionId) {
      return;
    }

    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    setSelectedCollectionId(collectionId);
    setCollectionDetail(null);
    setCollectionDetailError("");
    setIsLoadingCollectionDetail(true);
    setCurrentView("collectionDetail");

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
        clearAuthStorage();
        setAuthUser(null);
        resetSessionState({ resetForm: true });
        setAuthStatus({
          type: "error",
          message: "Your saved login expired. Please log in again.",
        });
        return;
      }
      setCollectionDetailError(
        "This collection could not be loaded. Please retry or go back.",
      );
    } finally {
      setIsLoadingCollectionDetail(false);
    }
  };

  const retryCollectionDetail = () => {
    if (selectedCollectionId) {
      openCollectionDetail(selectedCollectionId);
    }
  };

  const returnFromCollectionDetail = () => {
    setCurrentView("collections");
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
        clearAuthStorage();
        setAuthUser(null);
        resetSessionState({ resetForm: true });
        setAuthStatus({
          type: "error",
          message: "Your saved login expired. Please log in again.",
        });
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
        clearAuthStorage();
        setAuthUser(null);
        resetSessionState({ resetForm: true });
        setAuthStatus({
          type: "error",
          message: "Your saved login expired. Please log in again.",
        });
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
        clearAuthStorage();
        setAuthUser(null);
        resetSessionState({ resetForm: true });
        setAuthStatus({
          type: "error",
          message: "Your saved login expired. Please log in again.",
        });
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

  const getListingQueryParams = (searchData) => ({
    campus: searchData.campus,
    minRent: searchData.minRent,
    maxRent: searchData.maxRent,
    propertyType:
      searchData.housingType === "All types" ? "" : searchData.housingType,
    safetyLevel: searchData.safetyLevel === "Any" ? "" : searchData.safetyLevel,
  });

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
    setResultsError("");
    compareListingIdsRef.current = [];
    setCompareListingIds([]);
    setCompareStatus({ type: "", message: "" });

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

      setStatus({
        type: "success",
        message: "Your preferences were saved successfully.",
      });
      setActiveSearch(searchSnapshot);
      setResultsFilters({
        ...createDefaultResultsFilters(),
        minRent: searchSnapshot.minRent,
        maxRent: searchSnapshot.maxRent,
        housingType: searchSnapshot.housingType,
        safetyLevel: "Any",
        maxCommute: searchSnapshot.maxCommute,
      });
      setCurrentView("results");
      setIsSavingPreference(false);

      let listingData = { count: 0 };
      let listingLoadFailed = false;
      try {
        listingData = await loadListingsForSearch(searchSnapshot);
      } catch {
        listingLoadFailed = true;
        listingData = { count: 0 };
      }

      apiRequest("/api/analytics/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campus: searchSnapshot.campus,
          minRent: searchSnapshot.minRent,
          maxRent: searchSnapshot.maxRent,
          housingType: searchSnapshot.housingType,
          maxCommute: searchSnapshot.maxCommute,
        }),
      })
        .then(() => loadRecentSearches())
        .catch(() => {
          // Analytics is best-effort and must never block or degrade search.
        });

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
        clearAuthStorage();
        setAuthUser(null);
        resetSessionState({ resetForm: true });
        setAuthStatus({
          type: "error",
          message: "Your saved login expired. Please log in again.",
        });
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
      setCurrentView("search");
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
  };

  const openCompareView = () => {
    let origin = "results";

    if (currentView === "saved" || currentView === "collectionDetail") {
      origin = currentView;
    } else if (currentView === "details") {
      if (listingDetailOrigin === "saved" || listingDetailOrigin === "collectionDetail") {
        origin = listingDetailOrigin;
      }
    }

    setCompareOrigin(origin);
    setListingDetailOrigin("results");
    setCurrentView("compare");
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

    openCompareView();
  };

  const openListingDetail = async (listingId, originOverride = "") => {
    if (!listingId) {
      return;
    }

    setListingDetailOrigin(
      originOverride ||
        (currentView === "saved"
          ? "saved"
          : currentView === "compare"
            ? "compare"
            : currentView === "collectionDetail"
              ? "collectionDetail"
              : "results"),
    );
    setSelectedListingId(listingId);
    setSelectedListing(null);
    setListingError("");
    setIsLoadingListing(true);
    setCurrentView("details");

    try {
      const listing = await apiRequest(
        `/api/listings/${listingId}`,
        {},
        { campus: activeSearch?.campus },
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
      openListingDetail(selectedListingId, listingDetailOrigin);
    }
  };

  const returnToResults = () => {
    setCurrentView(listingDetailOrigin);
    setListingError("");
    setIsLoadingListing(false);
  };

  const returnFromCompare = () => {
    setListingDetailOrigin("results");
    setCurrentView(
      compareOrigin === "saved" || compareOrigin === "collectionDetail"
        ? compareOrigin
        : activeSearch
          ? "results"
          : "search",
    );
  };

  const openSavedListings = () => {
    setStatus({ type: "", message: "" });
    setCurrentView("saved");
  };

  const returnFromSavedListings = () => {
    setCurrentView(activeSearch ? "results" : "search");
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
    setCurrentView("search");
    setStatus({ type: "", message: "" });
  };

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

  if (!authUser) {
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

  const displayName = authUser.name || authUser.email;
  const selectedCampus =
    campuses.find(
      (campus) => getCampusLabel(campus) === activeSearch?.campus,
    ) || null;
  const comparisonListingPool = Array.from(
    new Map(
      [...listings, ...savedListings, ...(selectedListing ? [selectedListing] : [])]
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
        currentView={currentView}
        userName={displayName}
        onLogout={handleLogout}
        onOpenSaved={openSavedListings}
        onOpenSearch={returnToSearch}
      />
      {currentView !== "saved" &&
        currentView !== "collections" &&
        currentView !== "collectionDetail" && (
          <StepProgress currentStep={currentView} />
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

      {currentView === "search" && (
        <>
          <section className="hero-section">
            <div className="hero-copy">
              <h1>Compare Housing Beyond Rent</h1>
              <p>
                Make informed housing decisions using TTC commute times,
                neighbourhood safety data, and listing details in one place.
              </p>
            </div>
          </section>

          <SearchForm
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
            onRetryCampuses={retryCampuses}
            recentSearches={recentSearches}
            isLoadingRecentSearches={isLoadingRecentSearches}
          />

          <HelpCards />
        </>
      )}

      {currentView === "results" && (
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
          onToggleSave={toggleSavedListing}
          valueScoreWeights={valueScoreWeights}
          onWeightChange={updateValueScoreWeight}
          onResetWeights={resetValueScoreWeights}
        />
      )}

      {currentView === "compare" && (
        <CompareListings
          listings={comparedListings}
          availableListings={comparisonAvailableListings}
          campus={activeSearch?.campus}
          compareStatus={compareStatus}
          maxCompareListings={MAX_COMPARE_LISTINGS}
          valueScoreWeights={valueScoreWeights}
          savedListingIds={savedListingIds}
          savingListingIds={savingListingIds}
          onToggleSave={toggleSavedListing}
          onAddCompare={addListingToCompare}
          onRemoveCompare={removeListingFromCompare}
          onBackToResults={returnFromCompare}
          backLabel={
            compareOrigin === "saved"
              ? "Back to Saved Listings"
              : compareOrigin === "collectionDetail"
                ? "Back to Collection"
                : "Back to Results"
          }
          onDetails={openListingDetail}
        />
      )}

      {currentView === "saved" && (
        <SavedListings
          listings={savedListings}
          campus={activeSearch?.campus}
          isLoading={isLoadingSavedListings}
          errorMessage={savedListingsError}
          onDetails={openListingDetail}
          onBack={returnFromSavedListings}
          backLabel={activeSearch ? "Back to Results" : "Back to Search"}
          emptyActionLabel={activeSearch ? "Browse Results" : "Start a Search"}
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
      )}

      {currentView === "collections" && (
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
      )}

      {currentView === "collectionDetail" && (
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
        />
      )}

      {currentView === "details" && (
        <ListingDetail
          listing={selectedListing}
          campus={activeSearch?.campus}
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
                  : "Back to Results"
          }
          onRetry={retryListingDetail}
          isSaved={savedListingIds.has(selectedListingId)}
          isSaving={savingListingIds.has(selectedListingId)}
          onToggleSave={toggleSavedListing}
          isCompared={compareListingIds.includes(selectedListingId)}
          compareCount={compareListingIds.length}
          maxCompareListings={MAX_COMPARE_LISTINGS}
          onCompareListing={openCompareWithListing}
          valueScoreWeights={valueScoreWeights}
        />
      )}

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
