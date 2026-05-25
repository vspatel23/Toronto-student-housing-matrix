import { useState } from "react";
import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001";
const SESSION_KEY = "tshm_session_id";

const campuses = [
  "University of Toronto -- St. George",
  "University of Toronto -- Scarborough",
  "University of Toronto -- Mississauga",
  "Toronto Metropolitan University",
  "York University",
  "Seneca Polytechnic",
];

const housingTypes = [
  "All types",
  "Apartment",
  "Shared House",
  "Studio",
  "Basement",
  "Room Rental",
];

const safetyLevels = ["Any", "Medium+", "High Only"];

const helpCards = [
  {
    icon: "◷",
    title: "TTC Commute Times",
    text: "Estimated transit commute to your selected campus",
    tone: "blue",
  },
  {
    icon: "⌂",
    title: "Safety Data",
    text: "Neighbourhood crime statistics as relative safety indicators",
    tone: "green",
  },
  {
    icon: "☷",
    title: "Value Score",
    text: "Weighted composite score for objective housing comparison",
    tone: "purple",
  },
  {
    icon: "⌖",
    title: "Map Visualization",
    text: "Interactive map showing housing locations across Toronto",
    tone: "orange",
  },
];

const createLocalSessionId = () =>
  `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const getStoredSessionId = () => {
  const existingSessionId = localStorage.getItem(SESSION_KEY);
  if (existingSessionId) {
    return existingSessionId;
  }

  const newSessionId = createLocalSessionId();
  localStorage.setItem(SESSION_KEY, newSessionId);
  return newSessionId;
};

const formatDate = (dateValue) =>
  new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateValue));

const buildApiUrl = (path, params = {}) => {
  const url = new URL(path, API_BASE_URL);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
};

const getBackendMessage = (data) => {
  if (!data) {
    return "";
  }

  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.join(", ");
  }

  return data.message || data.error || "";
};

const apiRequest = async (path, options = {}, params = {}) => {
  const url = buildApiUrl(path, params);

  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(`API request failed: ${url}. ${error.message}`, {
      cause: error,
    });
  }

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error(
        `API request failed: ${url}. HTTP ${response.status} - backend returned a non-JSON response.`,
        { cause: error },
      );
    }
  }

  if (!response.ok) {
    const backendMessage = getBackendMessage(data);
    throw new Error(
      `API request failed: ${url}. HTTP ${response.status}${
        backendMessage ? ` - ${backendMessage}` : ""
      }`,
    );
  }

  return data;
};

function App() {
  const [sessionId, setSessionId] = useState(() => getStoredSessionId());
  const [formData, setFormData] = useState({
    campus: "",
    housingType: "All types",
    minRent: 500,
    maxRent: 2000,
    maxCommute: 30,
    safetyLevel: "Any",
    amenities: [],
    notes: "",
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [savedPreference, setSavedPreference] = useState(null);
  const [savedPreferences, setSavedPreferences] = useState([]);
  const [listings, setListings] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

  const updateField = (field, value) => {
    setStatus({ type: "", message: "" });
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
    }));
  };

  const handleRentChange = (field, value) => {
    const numberValue = Number(value);

    setStatus({ type: "", message: "" });
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

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.campus) {
      setStatus({
        type: "error",
        message: "Select a campus first.",
      });
      return;
    }

    setIsSaving(true);
    setStatus({ type: "", message: "" });

    try {
      const preferenceData = await apiRequest("/api/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          sessionId,
        }),
      });

      const listingData = await apiRequest("/api/listings", {}, {
        minRent: formData.minRent,
        maxRent: formData.maxRent,
        propertyType:
          formData.housingType === "All types" ? "" : formData.housingType,
        safetyLevel: formData.safetyLevel === "Any" ? "" : formData.safetyLevel,
      });

      localStorage.setItem(SESSION_KEY, preferenceData.sessionId);
      setSessionId(preferenceData.sessionId);
      setSavedPreference(preferenceData.preference);
      setSavedPreferences((currentPreferences) => [
        preferenceData.preference,
        ...currentPreferences,
      ]);
      setListings(listingData.listings || []);
      setHasSearched(true);
      setStatus({
        type: "success",
        message:
          listingData.count > 0
            ? `Found ${listingData.count} housing listing${
                listingData.count === 1 ? "" : "s"
              } and saved your preferences.`
            : "No matching listings found. Your search preferences were saved.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const loadSavedPreferences = async () => {
    if (!sessionId) {
      return;
    }

    setIsLoadingSaved(true);
    setStatus({ type: "", message: "" });

    try {
      const data = await apiRequest(`/api/preferences/${sessionId}`);
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
      }

      setStatus({
        type: preferences.length > 0 ? "success" : "error",
        message:
          preferences.length > 0
            ? "Loaded saved preferences for this session."
            : "No saved preferences found for this session.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message,
      });
    } finally {
      setIsLoadingSaved(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="home-mark" aria-hidden="true">
            ⌂
          </div>
          <span>Toronto Student Housing Matrix</span>
        </div>
        <p>Academic Decision-Support System</p>
      </header>

      <nav className="step-nav" aria-label="Search progress">
        <div className="step active">
          <span className="step-number">1</span>
          <span className="step-label">⌕ Search</span>
        </div>
        <span className="step-line"></span>
        <div className="step">
          <span className="step-number">2</span>
          <span className="step-label">☷ Browse Results</span>
        </div>
        <span className="step-line"></span>
        <div className="step">
          <span className="step-number">3</span>
          <span className="step-label">▤ View Details</span>
        </div>
        <span className="step-line"></span>
        <div className="step">
          <span className="step-number">4</span>
          <span className="step-label">⌘ Compare</span>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-copy">
          <h1>Compare Housing Beyond Rent</h1>
          <p>
            Make informed housing decisions using TTC commute times,
            neighbourhood safety data, and weighted value scoring.
          </p>
        </div>
      </section>

      <section className="search-card" aria-labelledby="criteria-title">
        <h2 id="criteria-title">⌕ Set Your Search Criteria</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              <span>♙ Select Campus</span>
              <select
                value={formData.campus}
                onChange={(event) => updateField("campus", event.target.value)}
              >
                <option value="">Choose a campus...</option>
                {campuses.map((campus) => (
                  <option key={campus} value={campus}>
                    {campus}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>⌂ Housing Type</span>
              <select
                value={formData.housingType}
                onChange={(event) =>
                  updateField("housingType", event.target.value)
                }
              >
                {housingTypes.map((housingType) => (
                  <option key={housingType} value={housingType}>
                    {housingType}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="range-section">
            <div className="range-heading">
              <span>$ Monthly Price Range</span>
              <strong>
                ${formData.minRent} - ${formData.maxRent}
              </strong>
            </div>
            <label className="range-row">
              <span>Min</span>
              <input
                type="range"
                min="500"
                max="3000"
                step="50"
                value={formData.minRent}
                onChange={(event) =>
                  handleRentChange("minRent", event.target.value)
                }
              />
              <output>${formData.minRent}</output>
            </label>
            <label className="range-row">
              <span>Max</span>
              <input
                type="range"
                min="500"
                max="3000"
                step="50"
                value={formData.maxRent}
                onChange={(event) =>
                  handleRentChange("maxRent", event.target.value)
                }
              />
              <output>${formData.maxRent}</output>
            </label>
          </div>

          <div className="form-grid">
            <div className="range-section compact">
              <div className="range-heading">
                <span>◷ Max TTC Commute</span>
                <strong>{formData.maxCommute} min</strong>
              </div>
              <p className={formData.campus ? "helper good" : "helper warning"}>
                {formData.campus
                  ? `Commute to: ${formData.campus}`
                  : "Select a campus first"}
              </p>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={formData.maxCommute}
                onChange={(event) =>
                  updateField("maxCommute", Number(event.target.value))
                }
              />
              <div className="range-scale">
                <span>10 min</span>
                <span>60 min</span>
              </div>
            </div>

            <fieldset className="safety-fieldset">
              <legend>♢ Minimum Safety Level</legend>
              <p>Based on historical crime data</p>
              <div className="segmented-control">
                {safetyLevels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={
                      formData.safetyLevel === level ? "selected" : ""
                    }
                    onClick={() => updateField("safetyLevel", level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <label className="notes-field">
            <span>Optional notes</span>
            <textarea
              rows="3"
              value={formData.notes}
              placeholder="Example: prefers furnished rooms or quiet neighbourhoods"
              onChange={(event) => updateField("notes", event.target.value)}
            />
          </label>

          {status.message && (
            <div className={`status-message ${status.type}`} role="status">
              {status.message}
            </div>
          )}

          <button className="submit-button" type="submit" disabled={isSaving}>
            ⌕ {isSaving ? "Saving..." : "Find Housing"}
          </button>
        </form>

        <div className="session-panel">
          <span>Anonymous session</span>
          <code>{sessionId || "Starting session..."}</code>
          <button
            type="button"
            className="link-button"
            onClick={loadSavedPreferences}
            disabled={isLoadingSaved || !sessionId}
          >
            {isLoadingSaved ? "Loading..." : "Load Saved Preferences"}
          </button>
        </div>

        {savedPreference && (
          <section className="summary-panel" aria-label="Saved preference">
            <h3>Current Saved Search</h3>
            <p>
              {savedPreference.campus} · {savedPreference.housingType} · $
              {savedPreference.minRent}-${savedPreference.maxRent} · Up to{" "}
              {savedPreference.maxCommute} min · {savedPreference.safetyLevel}
            </p>
          </section>
        )}

        {hasSearched && (
          <section className="results-panel" aria-label="Housing results">
            <h3>Housing Results</h3>
            {listings.length > 0 ? (
              <div className="results-grid">
                {listings.map((listing) => (
                  <article key={listing._id} className="result-item">
                    <div>
                      <strong>{listing.title || "Untitled listing"}</strong>
                      <span>
                        {listing.neighborhood || listing.address || "Toronto"}
                      </span>
                    </div>
                    <p>
                      ${listing.monthlyRent || "N/A"} ·{" "}
                      {listing.propertyType || "Housing"} ·{" "}
                      {listing.furnished ? "Furnished" : "Unfurnished"}
                    </p>
                    <small>
                      Safety: {listing.safety?.crimeRateLevel || "Unknown"} ·
                      Value score: {listing.valueScore || "N/A"}
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-results">
                No listings match these filters yet.
              </p>
            )}
          </section>
        )}

        {savedPreferences.length > 0 && (
          <section className="saved-list" aria-label="Previous preferences">
            <h3>Saved Preferences</h3>
            <div className="saved-grid">
              {savedPreferences.map((preference) => (
                <article key={preference._id} className="saved-item">
                  <strong>{preference.campus || "No campus selected"}</strong>
                  <span>{formatDate(preference.createdAt)}</span>
                  <p>
                    {preference.housingType} · ${preference.minRent}-$
                    {preference.maxRent} · {preference.maxCommute} min ·{" "}
                    {preference.safetyLevel}
                  </p>
                  {preference.notes && <small>{preference.notes}</small>}
                </article>
              ))}
            </div>
          </section>
        )}
      </section>

      <section className="help-section" aria-labelledby="help-title">
        <h2 id="help-title">How We Help You Decide</h2>
        <div className="help-grid">
          {helpCards.map((card) => (
            <article className="help-card" key={card.title}>
              <div className={`help-icon ${card.tone}`}>{card.icon}</div>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
