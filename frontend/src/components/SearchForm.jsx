import { housingTypes, safetyLevels } from "../utils/constants";
import { formatDate } from "../utils/api";
import { getCampusLabel } from "../utils/campusFormatters";
import StatusMessage from "./StatusMessage";

function SearchForm({
  campuses,
  formData,
  status,
  isSavingPreference,
  isSearchingListings,
  isLoadingCampuses,
  isLoadingSaved,
  campusError,
  validationErrors,
  savedPreference,
  savedPreferences,
  userName,
  onFieldChange,
  onRentChange,
  onSubmit,
  onLoadSaved,
  onRetryCampuses,
  recentSearches = [],
  isLoadingRecentSearches = false,
}) {
  const isSubmittingSearch = isSavingPreference || isSearchingListings;

  return (
    <section className="search-card" aria-labelledby="criteria-title">
      <h2 id="criteria-title">⌕ Set Your Search Criteria</h2>

      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <label>
            <span>♙ Select Campus</span>
            <select
              id="campus"
              value={formData.campus}
              onChange={(event) => onFieldChange("campus", event.target.value)}
              disabled={isLoadingCampuses || campuses.length === 0}
              aria-invalid={validationErrors.campus ? "true" : "false"}
              aria-describedby={
                validationErrors.campus || campusError ? "campus-message" : undefined
              }
            >
              <option value="">
                {isLoadingCampuses
                  ? "Loading campuses…"
                  : campuses.length === 0
                    ? "No campuses available"
                    : "Choose a campus..."}
              </option>
              {campuses.map((campus) => (
                <option key={campus._id} value={getCampusLabel(campus)}>
                  {getCampusLabel(campus)}
                </option>
              ))}
            </select>
            {validationErrors.campus && (
              <p className="validation-message" id="campus-message">
                {validationErrors.campus}
              </p>
            )}
            {!validationErrors.campus && isLoadingCampuses && (
              <p className="helper info" id="campus-message" role="status">
                Loading campuses…
              </p>
            )}
            {!validationErrors.campus && campusError && (
              <div className="field-status-row" id="campus-message">
                <p className="helper warning">{campusError}</p>
                <button type="button" className="inline-retry-button" onClick={onRetryCampuses}>
                  Retry
                </button>
              </div>
            )}
          </label>

          <label>
            <span>⌂ Housing Type</span>
            <select
              value={formData.housingType}
              onChange={(event) =>
                onFieldChange("housingType", event.target.value)
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
              id="minRent"
              type="range"
              min="500"
              max="3000"
              step="50"
              value={formData.minRent}
              onChange={(event) =>
                onRentChange("minRent", event.target.value)
              }
            />
            <output>${formData.minRent}</output>
          </label>
          <label className="range-row">
            <span>Max</span>
            <input
              id="maxRent"
              type="range"
              min="500"
              max="3000"
              step="50"
              value={formData.maxRent}
              onChange={(event) =>
                onRentChange("maxRent", event.target.value)
              }
              aria-invalid={validationErrors.maxRent ? "true" : "false"}
              aria-describedby={
                validationErrors.maxRent ? "max-rent-message" : undefined
              }
            />
            <output>${formData.maxRent}</output>
          </label>
          {validationErrors.maxRent && (
            <p className="validation-message" id="max-rent-message">
              {validationErrors.maxRent}
            </p>
          )}
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
              id="maxCommute"
              type="range"
              min="10"
              max="60"
              step="5"
              value={formData.maxCommute}
              onChange={(event) =>
                onFieldChange("maxCommute", Number(event.target.value))
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
                  onClick={() => onFieldChange("safetyLevel", level)}
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
            onChange={(event) => onFieldChange("notes", event.target.value)}
          />
        </label>

        {status.message && (
          <StatusMessage type={status.type || "info"}>
            {status.message}
          </StatusMessage>
        )}

        {isSearchingListings && (
          <StatusMessage type="loading">
            Searching for matching listings...
          </StatusMessage>
        )}

        <button className="submit-button" type="submit" disabled={isSubmittingSearch}>
          ⌕{" "}
          {isSearchingListings
            ? "Searching..."
            : isSavingPreference
              ? "Saving..."
              : "Find Housing"}
        </button>
      </form>

      <div className="session-panel">
        <span>Saved to account</span>
        <code>{userName}</code>
        <button
          type="button"
          className="link-button"
          onClick={onLoadSaved}
          disabled={isLoadingSaved}
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

      {isLoadingRecentSearches && (
        <p className="helper info" role="status">
          Loading recent searches…
        </p>
      )}

      {!isLoadingRecentSearches && recentSearches.length > 0 && (
        <section className="saved-list" aria-label="Recent searches">
          <h3>Recent Searches</h3>
          <div className="saved-grid">
            {recentSearches.map((search) => (
              <article key={search._id} className="saved-item">
                <strong>{search.campus || "No campus selected"}</strong>
                <span>{formatDate(search.updatedAt || search.createdAt)}</span>
                <p>
                  {search.housingType || "All types"}
                  {(search.minRent || search.maxRent) &&
                    ` · $${search.minRent ?? "0"}-$${search.maxRent ?? "∞"}`}
                  {search.maxCommute && ` · ${search.maxCommute} min`}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

export default SearchForm;
