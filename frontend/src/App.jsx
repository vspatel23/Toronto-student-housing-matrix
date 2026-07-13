import { useEffect, useRef, useState } from "react";
import "./App.css";
import { AUTH_TOKEN_KEY, AUTH_USER_KEY, defaultFormData } from "./utils/constants";
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
import ListingDetail from "./components/ListingDetail";

function App() {
  const latestListingsRequestId = useRef(0);
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
  const [savedPreference, setSavedPreference] = useState(null);
  const [savedPreferences, setSavedPreferences] = useState([]);
  const [hasLoadedPreferenceIntoForm, setHasLoadedPreferenceIntoForm] =
    useState(false);
  const [listings, setListings] = useState([]);
  const [activeSearch, setActiveSearch] = useState(null);
  const [currentView, setCurrentView] = useState("search");
  const [resultsFilters, setResultsFilters] = useState({
    minRent: "",
    maxRent: "",
    housingType: "All types",
    safetyLevel: "Any",
    maxCommute: "",
  });
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const [selectedListingId, setSelectedListingId] = useState("");
  const [selectedListing, setSelectedListing] = useState(null);
  const [isLoadingListing, setIsLoadingListing] = useState(false);
  const [listingError, setListingError] = useState("");
  const [isSavingPreference, setIsSavingPreference] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isLoadingRecentSearches, setIsLoadingRecentSearches] = useState(false);

  const clearDisplayedPreferences = ({ resetLoadedForm = false } = {}) => {
    setSavedPreference(null);
    setSavedPreferences([]);
    setStatus({ type: "", message: "" });
    setValidationErrors({});
    setListings([]);
    setActiveSearch(null);
    setCurrentView("search");
    setResultsError("");
    setCampuses([]);
    setCampusError("");
    setIsLoadingCampuses(false);
    setSelectedListing(null);
    setSelectedListingId("");
    setListingError("");
    setRecentSearches([]);
    if (resetLoadedForm && hasLoadedPreferenceIntoForm) {
      setFormData(defaultFormData);
    }
    setHasLoadedPreferenceIntoForm(false);
  };

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
        setSavedPreference(null);
        setSavedPreferences([]);
        setStatus({ type: "", message: "" });
        setFormData(defaultFormData);
        setHasLoadedPreferenceIntoForm(false);
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
      clearDisplayedPreferences({ resetLoadedForm: true });
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
    setAuthForm({ name: "", email: "", password: "" });
    clearDisplayedPreferences({ resetLoadedForm: true });
    setAuthStatus({ type: "success", message: "You have logged out." });
  };

  const updateField = (field, value) => {
    setStatus({ type: "", message: "" });
    setValidationErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
    setHasLoadedPreferenceIntoForm(false);
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
    setHasLoadedPreferenceIntoForm(false);
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

    const searchSnapshot = { ...formData };

    try {
      const preferenceData = await apiRequest("/api/preferences", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      setSavedPreference(preferenceData.preference);
      setSavedPreferences((currentPreferences) => [
        preferenceData.preference,
        ...currentPreferences,
      ]);
      setStatus({
        type: "success",
        message: "Your preferences were saved successfully.",
      });
      setHasLoadedPreferenceIntoForm(false);
      setActiveSearch(searchSnapshot);
      setResultsFilters({
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
        clearDisplayedPreferences({ resetLoadedForm: true });
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

  const openListingDetail = async (listingId) => {
    if (!listingId) {
      return;
    }

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
      openListingDetail(selectedListingId);
    }
  };

  const returnToResults = () => {
    setCurrentView("results");
    setListingError("");
    setIsLoadingListing(false);
  };

  const returnToSearch = () => {
    if (activeSearch) {
      setFormData((currentData) => ({
        ...currentData,
        ...activeSearch,
      }));
    }
    setCurrentView("search");
    setStatus({ type: "", message: "" });
  };

  const loadSavedPreferences = async () => {
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!authUser || !authToken) {
      setStatus({
        type: "error",
        message: "Please log in to load your saved preferences.",
      });
      return;
    }

    setIsLoadingSaved(true);
    setStatus({ type: "", message: "" });

    try {
      const data = await apiRequest("/api/preferences", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const preferences = data.preferences || [];
      const latestPreference = preferences[0];

      setSavedPreferences(preferences);
      setSavedPreference(latestPreference || null);

      if (latestPreference) {
        setFormData((currentData) => ({
          ...currentData,
          campus: latestPreference.campus || currentData.campus,
          housingType: latestPreference.housingType || currentData.housingType,
          minRent: latestPreference.minRent ?? currentData.minRent,
          maxRent: latestPreference.maxRent ?? currentData.maxRent,
          maxCommute: latestPreference.maxCommute ?? currentData.maxCommute,
          safetyLevel: latestPreference.safetyLevel || currentData.safetyLevel,
          amenities: latestPreference.amenities || currentData.amenities,
          notes: latestPreference.notes || currentData.notes,
        }));
        setHasLoadedPreferenceIntoForm(true);
      } else {
        setHasLoadedPreferenceIntoForm(false);
      }

      setStatus({
        type: preferences.length > 0 ? "success" : "error",
        message:
          preferences.length > 0
            ? "Your saved preferences were loaded."
            : "No saved preferences found for your account.",
      });
    } catch (error) {
      if (isUnauthorizedError(error)) {
        clearAuthStorage();
        setAuthUser(null);
        clearDisplayedPreferences({ resetLoadedForm: true });
        setAuthStatus({
          type: "error",
          message: "Your saved login expired. Please log in again.",
        });
        return;
      }

      setStatus({
        type: "error",
        message: "We couldn’t load your saved preferences. Please try again.",
      });
    } finally {
      setIsLoadingSaved(false);
    }
  };

  if (isAuthChecking) {
    return (
      <main className="auth-page">
        <div className="auth-loading">Loading...</div>
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

  return (
    <main className="app-shell">
      <Header userName={displayName} onLogout={handleLogout} />
      <StepProgress currentStep={currentView} />

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
            isLoadingSaved={isLoadingSaved}
            campusError={campusError}
            validationErrors={validationErrors}
            savedPreference={savedPreference}
            savedPreferences={savedPreferences}
            userName={displayName}
            onFieldChange={updateField}
            onRentChange={handleRentChange}
            onSubmit={handleSubmit}
            onLoadSaved={loadSavedPreferences}
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
          filters={resultsFilters}
          isLoading={isLoadingResults}
          errorMessage={resultsError}
          onFilterChange={handleFilterChange}
          onDetails={openListingDetail}
          onEditSearch={returnToSearch}
          onRetry={retryResults}
        />
      )}

      {currentView === "details" && (
        <ListingDetail
          listing={selectedListing}
          campus={activeSearch?.campus}
          isLoading={isLoadingListing}
          errorMessage={listingError}
          onBack={returnToResults}
          onRetry={retryListingDetail}
        />
      )}
    </main>
  );
}

export default App;
