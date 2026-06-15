import { campuses, housingTypes, safetyLevels } from "../utils/constants";
import { formatDate } from "../utils/api";

function SearchForm({
  formData,
  status,
  isSaving,
  isLoadingSaved,
  savedPreference,
  savedPreferences,
  userName,
  onFieldChange,
  onRentChange,
  onSubmit,
  onLoadSaved,
}) {
  return (
    <section className="search-card" aria-labelledby="criteria-title">
      <h2 id="criteria-title">⌕ Set Your Search Criteria</h2>

      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <label>
            <span>♙ Select Campus</span>
            <select
              value={formData.campus}
              onChange={(event) => onFieldChange("campus", event.target.value)}
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
              type="range"
              min="500"
              max="3000"
              step="50"
              value={formData.maxRent}
              onChange={(event) =>
                onRentChange("maxRent", event.target.value)
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
          <div className={`status-message ${status.type}`} role="status">
            {status.message}
          </div>
        )}

        <button className="submit-button" type="submit" disabled={isSaving}>
          ⌕ {isSaving ? "Saving..." : "Find Housing"}
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
    </section>
  );
}

export default SearchForm;
