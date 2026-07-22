import { useRef, useState } from "react";
import {
  DEFAULT_VALUE_SCORE_WEIGHTS,
  advancedAmenityFilters,
  furnishedFilterOptions,
  housingTypes,
} from "../utils/constants";
import { getRecommendationBadgesByListingId } from "../utils/recommendationBadges";
import ListingCard from "./ListingCard";
import ListingsMap from "./ListingsMap";
import RecommendationSummary from "./RecommendationSummary";
import {
  DATA_UNAVAILABLE,
  getAmenities,
  getCommuteMinutes,
  getListingId,
  getListingTitle,
  getPropertyType,
  getSafetyLevel,
  getWeightedValueScore,
  normalizeValueScoreWeights,
} from "../utils/listingFormatters";

const safetyOptions = ["Any", "Low", "Medium", "High"];
const valueScoreFactors = [
  { key: "affordability", label: "Affordability" },
  { key: "commute", label: "Commute" },
  { key: "safety", label: "Safety" },
  { key: "amenities", label: "Amenities" },
];

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const getRentNumber = (listing) => {
  const rent = Number(listing?.monthlyRent ?? listing?.rent);
  return Number.isFinite(rent) ? rent : null;
};

const matchesNumberFilter = (value, min, max) => {
  if (value === null) {
    return true;
  }

  const minNumber = hasValue(min) ? Number(min) : null;
  const maxNumber = hasValue(max) ? Number(max) : null;

  if (minNumber !== null && Number.isFinite(minNumber) && value < minNumber) {
    return false;
  }

  if (maxNumber !== null && Number.isFinite(maxNumber) && value > maxNumber) {
    return false;
  }

  return true;
};

const getSelectedAmenities = (filters) =>
  Array.isArray(filters?.amenities) ? filters.amenities : [];

const getSearchChips = (search) =>
  [
    search?.campus && { label: search.campus },
    Number.isFinite(Number(search?.minRent)) &&
      Number.isFinite(Number(search?.maxRent)) && {
        label: `$${search.minRent} - $${search.maxRent}/mo`,
      },
    search?.housingType &&
      search.housingType !== "All types" && { label: search.housingType },
    Number.isFinite(Number(search?.maxCommute)) && {
      label: `<= ${search.maxCommute} min commute`,
    },
    search?.safetyLevel &&
      search.safetyLevel !== "Any" && { label: search.safetyLevel },
  ].filter(Boolean);

const getWeightDisplayValue = (weights, key) => {
  const rawWeight = Number(weights?.[key]);

  if (!Number.isFinite(rawWeight)) {
    return DEFAULT_VALUE_SCORE_WEIGHTS[key];
  }

  return Math.round(Math.max(0, Math.min(100, rawWeight)));
};

const getRawWeightTotal = (weights) =>
  valueScoreFactors.reduce(
    (total, factor) => total + getWeightDisplayValue(weights, factor.key),
    0,
  );

const getTieBreakerValue = (value) =>
  value === null ? Number.POSITIVE_INFINITY : value;

const getSortableTitle = (listing) => {
  const title = getListingTitle(listing);
  return title === DATA_UNAVAILABLE ? "" : title;
};

const compareListingsByWeightedScore = (
  firstListing,
  secondListing,
  campus,
  weights,
) => {
  const scoreDifference =
    getWeightedValueScore(secondListing, campus, weights) -
    getWeightedValueScore(firstListing, campus, weights);

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  const rentDifference =
    getTieBreakerValue(getRentNumber(firstListing)) -
    getTieBreakerValue(getRentNumber(secondListing));

  if (rentDifference !== 0) {
    return rentDifference;
  }

  const commuteDifference =
    getTieBreakerValue(getCommuteMinutes(firstListing, campus)) -
    getTieBreakerValue(getCommuteMinutes(secondListing, campus));

  if (commuteDifference !== 0) {
    return commuteDifference;
  }

  return getSortableTitle(firstListing).localeCompare(
    getSortableTitle(secondListing),
  );
};

function ValueScoreWeightControls({ weights, onWeightChange, onResetWeights }) {
  const normalizedWeights = normalizeValueScoreWeights(weights);
  const rawTotal = getRawWeightTotal(weights);
  const showEffectiveWeights = rawTotal !== 100;

  return (
    <section
      className="weight-controls"
      aria-labelledby="weight-controls-title"
    >
      <div className="weight-controls-header">
        <div>
          <span className="filter-section-kicker">Ranking priorities</span>
          <h3 id="weight-controls-title">Value Score Priorities</h3>
          <p>
            Higher percentages give a factor more influence on ranking.
          </p>
        </div>
        <div className="weight-summary-actions">
          <div className="weight-total" aria-live="polite">
            <span>Current total</span>
            <strong>{rawTotal}%</strong>
            {showEffectiveWeights && <small>Normalized to 100%</small>}
          </div>
          <button
            type="button"
            className="button button-secondary button-small reset-weights-button"
            onClick={onResetWeights}
          >
            Reset priorities
          </button>
        </div>
      </div>

      <div className="weight-control-list">
        {valueScoreFactors.map((factor) => {
          const displayWeight = getWeightDisplayValue(weights, factor.key);
          const effectiveWeight = Math.round(normalizedWeights[factor.key]);
          const sliderId = `value-score-${factor.key}`;

          return (
            <label key={factor.key} className="weight-control">
              <span className="weight-control-label">
                <span>{factor.label}</span>
                <output className="weight-control-value" htmlFor={sliderId}>
                  {displayWeight}%
                </output>
              </span>
              <input
                id={sliderId}
                className="weight-slider"
                type="range"
                min="0"
                max="100"
                step="5"
                value={displayWeight}
                aria-label={`${factor.label} Value Score weight`}
                onChange={(event) =>
                  onWeightChange?.(factor.key, event.target.value)
                }
              />
              {showEffectiveWeights && (
                <small className="weight-effective-value">
                  Effective {effectiveWeight}%
                </small>
              )}
            </label>
          );
        })}
      </div>

      <p className="weight-helper-text">
        {showEffectiveWeights
          ? "Effective percentages show how the current total is normalized for scoring."
          : "Priorities total 100%, so the selected and effective percentages match."}
      </p>
    </section>
  );
}

function ResultsFilters({
  filters,
  onChange,
  valueScoreWeights,
  onWeightChange,
  onResetWeights,
}) {
  const selectedAmenities = getSelectedAmenities(filters);

  return (
    <section className="results-filter-panel" aria-labelledby="filters-title">
      <header className="filter-panel-header">
        <div>
          <p className="section-eyebrow">Display controls</p>
          <h2 id="filters-title">Refine Results</h2>
          <p>Adjust the displayed listings without changing your search.</p>
        </div>
        <div
          className="sort-summary"
          aria-label="Results sorted by Value Score, highest first"
        >
          <span>Sorted by</span>
          <strong>Value Score</strong>
          <small>Highest first</small>
        </div>
      </header>

      <section className="filter-section" aria-labelledby="basic-filters-title">
        <div className="filter-section-heading">
          <h3 id="basic-filters-title">Basic filters</h3>
          <p>Refine rent, housing type, safety, and commute.</p>
        </div>
        <div className="results-filter-grid basic-filter-grid">
          <label>
            <span>Minimum rent</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={filters.minRent}
              onChange={(event) => onChange("minRent", event.target.value)}
              placeholder="No minimum"
            />
          </label>

          <label>
            <span>Maximum rent</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={filters.maxRent}
              onChange={(event) => onChange("maxRent", event.target.value)}
              placeholder="No maximum"
            />
          </label>

          <label>
            <span>Housing type</span>
            <select
              value={filters.housingType}
              onChange={(event) => onChange("housingType", event.target.value)}
            >
              {housingTypes.map((housingType) => (
                <option key={housingType} value={housingType}>
                  {housingType}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Safety level</span>
            <select
              value={filters.safetyLevel}
              onChange={(event) => onChange("safetyLevel", event.target.value)}
            >
              {safetyOptions.map((safetyLevel) => (
                <option key={safetyLevel} value={safetyLevel}>
                  {safetyLevel}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Maximum commute</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={filters.maxCommute}
              onChange={(event) => onChange("maxCommute", event.target.value)}
              placeholder="Any"
            />
          </label>
        </div>
      </section>

      <section
        className="filter-section advanced-filter-section"
        aria-labelledby="amenity-filters-title"
      >
        <div className="filter-section-heading">
          <h3 id="amenity-filters-title">Furnishing and amenities</h3>
          <p>Narrow results by setup and included features.</p>
        </div>
        <div className="furnishing-amenities-layout">
          <label className="furnishing-filter">
            <span>Furnishing</span>
            <select
              value={filters.furnished || "Any"}
              onChange={(event) => onChange("furnished", event.target.value)}
            >
              {furnishedFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="amenity-filter-group">
            <legend className="filter-group-label">Amenities</legend>
            {selectedAmenities.length > 0 && (
              <p className="selected-filter-count">
                {selectedAmenities.length} amenity filter
                {selectedAmenities.length === 1 ? "" : "s"} selected
              </p>
            )}
            <div className="amenity-filter-options">
              {advancedAmenityFilters.map((amenity) => {
                const isSelected = selectedAmenities.includes(amenity);
                const nextAmenities = isSelected
                  ? selectedAmenities.filter((item) => item !== amenity)
                  : [...selectedAmenities, amenity];

                return (
                  <label
                    key={amenity}
                    className={`amenity-filter-chip${
                      isSelected ? " selected" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onChange("amenities", nextAmenities)}
                    />
                    <span>{amenity}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      </section>

      <ValueScoreWeightControls
        weights={valueScoreWeights}
        onWeightChange={onWeightChange}
        onResetWeights={onResetWeights}
      />
    </section>
  );
}

function BrowseResults({
  listings,
  search,
  selectedCampus,
  filters,
  isLoading,
  errorMessage,
  onFilterChange,
  onDetails,
  onEditSearch,
  onRetry,
  savedListingIds,
  savingListingIds,
  onToggleSave,
  compareListingIds = [],
  compareStatus = { type: "", message: "" },
  maxCompareListings = 3,
  onCompareListing,
  onOpenCompare,
  onClearCompareStatus,
  valueScoreWeights = DEFAULT_VALUE_SCORE_WEIGHTS,
  onWeightChange,
  onResetWeights,
}) {
  const [activeListingSelection, setActiveListingSelection] = useState({
    filterKey: "",
    listingId: "",
    resultKey: "",
  });
  const cardRefs = useRef(new Map());
  const searchChips = getSearchChips(search);
  const selectedAmenities = getSelectedAmenities(filters);
  const filteredListings = listings.filter((listing) => {
    const rent = getRentNumber(listing);
    const commuteMinutes = getCommuteMinutes(listing, search?.campus);
    const maxCommute = hasValue(filters.maxCommute)
      ? Number(filters.maxCommute)
      : null;

    if (!matchesNumberFilter(rent, filters.minRent, filters.maxRent)) {
      return false;
    }

    if (
      filters.housingType &&
      filters.housingType !== "All types" &&
      getPropertyType(listing) !== filters.housingType
    ) {
      return false;
    }

    if (
      filters.safetyLevel &&
      filters.safetyLevel !== "Any" &&
      getSafetyLevel(listing) !== filters.safetyLevel
    ) {
      return false;
    }

    if (maxCommute !== null && Number.isFinite(maxCommute)) {
      if (commuteMinutes === null || commuteMinutes > maxCommute) {
        return false;
      }
    }

    if (filters.furnished === "Furnished" && listing?.furnished !== true) {
      return false;
    }

    if (filters.furnished === "Unfurnished" && listing?.furnished !== false) {
      return false;
    }

    if (selectedAmenities.length > 0) {
      const listingAmenities = getAmenities(listing);
      const hasAllSelectedAmenities = selectedAmenities.every((amenity) =>
        listingAmenities.includes(amenity),
      );

      if (!hasAllSelectedAmenities) {
        return false;
      }
    }

    return true;
  });
  const rankedListings = [...filteredListings].sort((firstListing, secondListing) =>
    compareListingsByWeightedScore(
      firstListing,
      secondListing,
      search?.campus,
      valueScoreWeights,
    ),
  );
  const badgesByListingId = getRecommendationBadgesByListingId(
    rankedListings,
    search?.campus,
    valueScoreWeights,
  );
  const resultKey = [
    search?.campus,
    search?.minRent,
    search?.maxRent,
    search?.housingType,
    search?.safetyLevel,
    search?.maxCommute,
    listings.map((listing) => getListingId(listing)).join(","),
  ]
    .filter(hasValue)
    .join("|");
  const filterKey = [
    filters.minRent,
    filters.maxRent,
    filters.housingType,
    filters.safetyLevel,
    filters.maxCommute,
    filters.furnished,
    ...selectedAmenities,
  ]
    .filter(hasValue)
    .join("|");
  const activeListingId =
    activeListingSelection.resultKey === resultKey &&
    activeListingSelection.filterKey === filterKey &&
    rankedListings.some(
      (listing) => getListingId(listing) === activeListingSelection.listingId,
    )
      ? activeListingSelection.listingId
      : "";
  const handleSelectListing = (listingId, { scrollToCard = false } = {}) => {
    if (!listingId) {
      return;
    }

    setActiveListingSelection({
      filterKey,
      listingId,
      resultKey,
    });

    if (scrollToCard) {
      window.requestAnimationFrame(() => {
        cardRefs.current.get(listingId)?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    }
  };
  const compareCount = compareListingIds.length;
  const hasCompareStatus = hasValue(compareStatus.message);
  const resultCountLabel = isLoading
    ? "Loading listings"
    : errorMessage
      ? "Results unavailable"
      : `${rankedListings.length} listing${
          rankedListings.length === 1 ? "" : "s"
        }`;
  const handleOpenCompare = () => {
    onClearCompareStatus?.();
    onOpenCompare?.();
  };

  return (
    <section className="browse-page" aria-labelledby="results-title">
      <header className="results-page-header">
        <div className="results-heading-row">
          <div className="results-heading-copy">
            <p className="section-eyebrow">Housing search</p>
            <div className="results-title-group">
              <h1 id="results-title">Browse Results</h1>
              <span className="result-count-pill" aria-live="polite">
                {resultCountLabel}
              </span>
            </div>
            <p>Review matches, adjust priorities, and compare your options.</p>
          </div>

          <div className="results-header-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={onEditSearch}
            >
              Modify Search
            </button>
            <div
              className="compare-header-control"
              aria-label="Compare selected listings"
            >
              <span className="compare-selection-count" aria-live="polite">
                <strong>{compareCount}</strong> of {maxCompareListings} selected
              </span>
              <button
                type="button"
                className="button button-primary"
                disabled={compareCount === 0 || !onOpenCompare}
                onClick={handleOpenCompare}
              >
                Compare selected
              </button>
            </div>
          </div>
        </div>

        <div className="results-search-summary">
          <strong>Search summary</strong>
          {searchChips.length > 0 ? (
            <div className="search-chip-list" aria-label="Search criteria">
              {searchChips.map((chip) => (
                <span key={chip.label} className="search-chip">
                  {chip.label}
                </span>
              ))}
            </div>
          ) : (
            <span className="muted-text">No search criteria selected</span>
          )}
        </div>
      </header>

      {hasCompareStatus && (
        <p
          className={`compare-status ${compareStatus.type || "info"}`}
          role={compareStatus.type === "error" ? "alert" : "status"}
        >
          {compareStatus.message}
        </p>
      )}

      {!isLoading && !errorMessage && rankedListings.length > 0 && (
        <RecommendationSummary
          listings={rankedListings}
          campus={search?.campus}
          valueScoreWeights={valueScoreWeights}
        />
      )}

      <ResultsFilters
        filters={filters}
        onChange={onFilterChange}
        valueScoreWeights={valueScoreWeights}
        onWeightChange={onWeightChange}
        onResetWeights={onResetWeights}
      />

      <section className="results-content" aria-labelledby="listings-title">
        <div className="results-content-heading">
          <div>
            <p className="section-eyebrow">Results and map</p>
            <h2 id="listings-title">Listings and locations</h2>
          </div>
          <p>Cards and map markers stay linked as you review each option.</p>
        </div>

        {isLoading && (
          <div className="state-panel loading-state" role="status">
            <span className="spinner" aria-hidden="true"></span>
            <div>
              <h3>Finding housing matches</h3>
              <p>
                Checking listings that fit your rent, commute, and safety needs.
              </p>
            </div>
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="state-panel error error-state" role="alert">
            <h3>Listings could not be loaded</h3>
            <p>{errorMessage}</p>
            <div className="state-actions">
              <button type="button" className="details-button" onClick={onRetry}>
                Retry
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={onEditSearch}
              >
                Modify Search
              </button>
            </div>
          </div>
        )}

        {!isLoading && !errorMessage && rankedListings.length === 0 && (
          <div className="state-panel empty-state">
            <h3>No listings match these filters</h3>
            <p>
              Try removing an amenity or widening the rent, commute, or housing
              type filters to see more options.
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={onEditSearch}
            >
              Modify Search
            </button>
          </div>
        )}

        {!isLoading && !errorMessage && rankedListings.length > 0 && (
          <div className="results-map-layout">
            <div className="results-list-column">
              <div className="listing-grid">
                {rankedListings.map((listing) => {
                  const listingId = getListingId(listing);

                  return (
                    <ListingCard
                      key={listingId}
                      cardRef={(element) => {
                        if (!listingId) {
                          return;
                        }

                        if (element) {
                          cardRefs.current.set(listingId, element);
                        } else {
                          cardRefs.current.delete(listingId);
                        }
                      }}
                      listing={listing}
                      campus={search?.campus}
                      badges={badgesByListingId[listingId] || []}
                      onDetails={onDetails}
                      isActive={listingId === activeListingId}
                      onSelect={handleSelectListing}
                      isSaved={savedListingIds?.has(listingId)}
                      isSaving={savingListingIds?.has(listingId)}
                      onToggleSave={onToggleSave}
                      isCompared={compareListingIds.includes(listingId)}
                      onCompareListing={onCompareListing}
                      valueScoreWeights={valueScoreWeights}
                    />
                  );
                })}
              </div>
            </div>

            <ListingsMap
              activeListingId={activeListingId}
              listings={rankedListings}
              onOpenDetails={onDetails}
              onSelectListing={(listingId) =>
                handleSelectListing(listingId, { scrollToCard: true })
              }
              selectedCampus={selectedCampus}
            />
          </div>
        )}
      </section>
    </section>
  );
}

export default BrowseResults;
