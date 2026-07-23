import { housingTypes, safetyLevels } from "../utils/constants";
import { getCampusLabel } from "../utils/campusFormatters";
import CollapsiblePanel from "./CollapsiblePanel";
import RecentSearches from "./RecentSearches";
import StatusMessage from "./StatusMessage";

const getFormSummaryChips = (formData) =>
  [
    { label: formData?.campus || "No campus selected" },
    formData?.housingType &&
      formData.housingType !== "All types" && { label: formData.housingType },
    { label: `$${formData?.minRent} - $${formData?.maxRent}/mo` },
    { label: `<= ${formData?.maxCommute} min commute` },
    formData?.safetyLevel &&
      formData.safetyLevel !== "Any" && { label: formData.safetyLevel },
  ].filter(Boolean);

function SearchForm({
  campuses,
  formData,
  status,
  isSavingPreference,
  isSearchingListings,
  isLoadingCampuses,
  campusError,
  validationErrors,
  onFieldChange,
  onRentChange,
  onSubmit,
  onRetryCampuses,
  recentSearches = [],
  isLoadingRecentSearches = false,
}) {
  const isSubmittingSearch = isSavingPreference || isSearchingListings;
  const formSummaryChips = getFormSummaryChips(formData);

  return (
    <div className="dashboard-content">
      <section className="search-card" aria-labelledby="criteria-title">
        <CollapsiblePanel
          title="Advanced Search"
          subtitle="Fine-tune every manual filter: campus, rent, commute, safety, and more."
          defaultExpanded={false}
          headerExtra={
            <div
              className="search-chip-list"
              aria-label="Current search criteria"
            >
              {formSummaryChips.map((chip) => (
                <span key={chip.label} className="search-chip">
                  {chip.label}
                </span>
              ))}
            </div>
          }
        >
          <h2 id="criteria-title" className="visually-hidden">
            Set Your Search Criteria
          </h2>

          <form className="search-form" onSubmit={onSubmit} noValidate>
          <fieldset className="form-section">
            <legend>Campus and housing type</legend>
            <p className="form-section-helper">
              Start with where you study and the kind of home you want.
            </p>
            <div className="form-grid">
              <label className="form-field" htmlFor="campus">
                <span>Campus</span>
                <select
                  id="campus"
                  value={formData.campus}
                  onChange={(event) =>
                    onFieldChange("campus", event.target.value)
                  }
                  disabled={isLoadingCampuses || campuses.length === 0}
                  aria-invalid={validationErrors.campus ? "true" : "false"}
                  aria-describedby="campus-message"
                >
                  <option value="">
                    {isLoadingCampuses
                      ? "Loading campuses…"
                      : campuses.length === 0
                        ? "No campuses available"
                        : "Choose a campus"}
                  </option>
                  {campuses.map((campus) => (
                    <option key={campus._id} value={getCampusLabel(campus)}>
                      {getCampusLabel(campus)}
                    </option>
                  ))}
                </select>
                <div className="field-message-slot" id="campus-message">
                  {validationErrors.campus && (
                    <p className="validation-message">
                      {validationErrors.campus}
                    </p>
                  )}
                  {!validationErrors.campus && isLoadingCampuses && (
                    <p className="helper info" role="status">
                      Loading campus options…
                    </p>
                  )}
                  {!validationErrors.campus && campusError && (
                    <div className="field-status-row">
                      <p className="helper warning">{campusError}</p>
                      <button
                        type="button"
                        className="button button-secondary button-small"
                        onClick={onRetryCampuses}
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              </label>

              <label className="form-field" htmlFor="housing-type">
                <span>Housing type</span>
                <select
                  id="housing-type"
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
                <div className="field-message-slot" aria-hidden="true" />
              </label>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Rent</legend>
            <div className="range-heading">
              <p className="form-section-helper">
                Set your preferred monthly rent range.
              </p>
              <output className="range-summary" htmlFor="minRent maxRent">
                ${formData.minRent} – ${formData.maxRent}
              </output>
            </div>
            <div className="range-controls">
              <label className="range-row" htmlFor="minRent">
                <span>Minimum</span>
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
                <output htmlFor="minRent">${formData.minRent}</output>
              </label>
              <label className="range-row" htmlFor="maxRent">
                <span>Maximum</span>
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
                  aria-describedby="max-rent-message"
                />
                <output htmlFor="maxRent">${formData.maxRent}</output>
              </label>
            </div>
            <div className="field-message-slot" id="max-rent-message">
              {validationErrors.maxRent && (
                <p className="validation-message">
                  {validationErrors.maxRent}
                </p>
              )}
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Commute and safety</legend>
            <p className="form-section-helper">
              Balance travel time with your preferred neighbourhood safety level.
            </p>
            <div className="form-grid decision-grid">
              <div className="range-section compact">
                <div className="range-heading">
                  <label htmlFor="maxCommute">Maximum TTC commute</label>
                  <output htmlFor="maxCommute">
                    {formData.maxCommute} min
                  </output>
                </div>
                <p className={formData.campus ? "helper good" : "helper warning"}>
                  {formData.campus
                    ? `Measured to ${formData.campus}`
                    : "Select a campus to set the destination."}
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
                <div className="range-scale" aria-hidden="true">
                  <span>10 min</span>
                  <span>60 min</span>
                </div>
              </div>

              <fieldset className="safety-fieldset">
                <legend>Minimum safety level</legend>
                <p>Uses historical neighbourhood crime data.</p>
                <div className="segmented-control">
                  {safetyLevels.map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={formData.safetyLevel === level ? "selected" : ""}
                      aria-pressed={formData.safetyLevel === level}
                      onClick={() => onFieldChange("safetyLevel", level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </fieldset>

          <fieldset className="form-section notes-section">
            <legend>Notes</legend>
            <label className="notes-field" htmlFor="search-notes">
              <span>Optional details</span>
              <textarea
                id="search-notes"
                rows="3"
                value={formData.notes}
                placeholder="For example: furnished room or quiet neighbourhood"
                onChange={(event) => onFieldChange("notes", event.target.value)}
              />
              <small className="field-helper">
                Add anything you want to remember while reviewing your results.
              </small>
            </label>
          </fieldset>

          <div className="search-action-area">
            {status.message && (
              <StatusMessage type={status.type || "info"}>
                {status.message}
              </StatusMessage>
            )}

            {isSearchingListings && (
              <StatusMessage type="loading">
                Searching for matching listings…
              </StatusMessage>
            )}

            <button
              className="button button-primary submit-button"
              type="submit"
              disabled={isSubmittingSearch}
            >
              {isSearchingListings
                ? "Finding housing…"
                : isSavingPreference
                  ? "Saving criteria…"
                  : "Find Housing"}
            </button>
          </div>
        </form>
        </CollapsiblePanel>
      </section>

      <RecentSearches
        searches={recentSearches}
        isLoading={isLoadingRecentSearches}
      />
    </div>
  );
}

export default SearchForm;
