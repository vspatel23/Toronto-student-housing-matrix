import {
  furnishedFilterOptions,
  housingTypes,
  safetyLevels,
  supportedAmenityFilters,
} from "../utils/constants";
import { getCampusLabel } from "../utils/campusFormatters";
import StatusMessage from "./StatusMessage";

function AdvancedSearchForm({
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
  onClear,
  onRetryCampuses,
}) {
  const isSubmittingSearch = isSavingPreference || isSearchingListings;
  const selectedAmenities = Array.isArray(formData.amenities)
    ? formData.amenities
    : [];

  const toggleAmenity = (amenity) => {
    const nextAmenities = selectedAmenities.includes(amenity)
      ? selectedAmenities.filter((item) => item !== amenity)
      : [...selectedAmenities, amenity];
    onFieldChange("amenities", nextAmenities);
  };

  return (
    <form className="advanced-search-form" onSubmit={onSubmit} noValidate>
      <p className="advanced-search-intro">
        Use specific filters when you prefer to build the search yourself.
      </p>

      <div className="advanced-search-grid">
        <label className="advanced-search-field" htmlFor="campus">
          <span>Campus</span>
          <select
            id="campus"
            value={formData.campus}
            onChange={(event) => onFieldChange("campus", event.target.value)}
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
              <p className="validation-message">{validationErrors.campus}</p>
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

        <label className="advanced-search-field" htmlFor="housing-type">
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

        <label className="advanced-search-field" htmlFor="furnished">
          <span>Furnishing</span>
          <select
            id="furnished"
            value={formData.furnished || "Any"}
            onChange={(event) =>
              onFieldChange("furnished", event.target.value)
            }
          >
            {furnishedFilterOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <div className="field-message-slot" aria-hidden="true" />
        </label>

        <fieldset className="advanced-search-field safety-fieldset">
          <legend>Minimum safety level</legend>
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

        <fieldset className="advanced-search-range advanced-search-span-two">
          <legend>Monthly rent range</legend>
          <div className="advanced-range-summary" aria-live="polite">
            ${formData.minRent} – ${formData.maxRent}
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
              <p className="validation-message">{validationErrors.maxRent}</p>
            )}
          </div>
        </fieldset>

        <fieldset className="advanced-search-range advanced-search-span-two">
          <legend>Maximum TTC commute</legend>
          <div className="advanced-range-summary" aria-live="polite">
            {formData.maxCommute} minutes
          </div>
          <label className="range-row" htmlFor="maxCommute">
            <span>Commute</span>
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
            <output htmlFor="maxCommute">{formData.maxCommute} min</output>
          </label>
          <p className={formData.campus ? "helper good" : "helper warning"}>
            {formData.campus
              ? `Measured to ${formData.campus}`
              : "Select a campus to set the commute destination."}
          </p>
        </fieldset>

        <fieldset className="advanced-amenities advanced-search-span-two">
          <legend>Amenities</legend>
          <p>Select every feature that must be included.</p>
          <div className="advanced-amenity-options">
            {supportedAmenityFilters.map((amenity) => (
              <label
                key={amenity}
                className={`amenity-filter-chip${
                  selectedAmenities.includes(amenity) ? " selected" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedAmenities.includes(amenity)}
                  onChange={() => toggleAmenity(amenity)}
                />
                <span>{amenity}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="advanced-search-status">
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
      </div>

      <div className="advanced-search-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={onClear}
          disabled={isSubmittingSearch}
        >
          Clear filters
        </button>
        <button
          className="button button-primary"
          type="submit"
          disabled={isSubmittingSearch}
        >
          {isSearchingListings
            ? "Finding housing…"
            : isSavingPreference
              ? "Saving criteria…"
              : "Search listings"}
        </button>
      </div>
    </form>
  );
}

export default AdvancedSearchForm;
