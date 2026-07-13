import { useRef, useState } from "react";
import { DEFAULT_VALUE_SCORE_WEIGHTS, housingTypes } from "../utils/constants";
import { getRecommendationBadgesByListingId } from "../utils/recommendationBadges";
import ListingBadges from "./ListingBadges";
import ListingsMap from "./ListingsMap";
import RecommendationSummary from "./RecommendationSummary";
import {
  DATA_UNAVAILABLE,
  formatCommute,
  formatFurnishedStatus,
  formatRent,
  getAmenities,
  getCommuteMinutes,
  getListingId,
  getListingTitle,
  getLocationLabel,
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

const compareListingsByWeightedScore = (firstListing, secondListing, campus, weights) => {
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
          <h4 id="weight-controls-title">Value Score Priorities</h4>
          <p>
            Adjust how much each factor affects the score and ranking. We
            normalize the weights automatically.
          </p>
        </div>
        <button
          type="button"
          className="reset-weights-button"
          onClick={onResetWeights}
        >
          Reset weights
        </button>
      </div>

      <div className="weight-control-list">
        {valueScoreFactors.map((factor) => {
          const displayWeight = getWeightDisplayValue(weights, factor.key);
          const effectiveWeight = Math.round(normalizedWeights[factor.key]);

          return (
            <label key={factor.key} className="weight-control">
              <span className="weight-control-label">
                <span>{factor.label}</span>
                <span className="weight-control-value">{displayWeight}%</span>
              </span>
              <input
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
        Current total: {rawTotal}%. Scores use normalized weights so ranking
        stays consistent.
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
  return (
    <section className="results-filter-panel" aria-labelledby="filters-title">
      <div>
        <h3 id="filters-title">Refine Results</h3>
        <p>Adjust the displayed listings without changing your saved search.</p>
      </div>

      <div className="results-filter-grid">
        <label>
          <span>Minimum monthly rent</span>
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
          <span>Maximum monthly rent</span>
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

      <ValueScoreWeightControls
        weights={valueScoreWeights}
        onWeightChange={onWeightChange}
        onResetWeights={onResetWeights}
      />
    </section>
  );
}

export function ListingCard({
  listing,
  campus,
  badges = [],
  onDetails,
  isActive = false,
  onSelect,
  cardRef,
  isSaved = false,
  isSaving = false,
  onToggleSave,
  isCompared = false,
  onCompareListing,
  valueScoreWeights,
}) {
  const listingId = getListingId(listing);
  const amenities = getAmenities(listing);
  const safetyLevel = getSafetyLevel(listing);
  const valueScore = getWeightedValueScore(listing, campus, valueScoreWeights);
  const safetyClass =
    safetyLevel === DATA_UNAVAILABLE
      ? "unknown"
      : safetyLevel.toLowerCase().replace(/\s+/g, "-");
  const selectCard = () => {
    if (listingId) {
      onSelect?.(listingId);
    }
  };
  const handleCardKeyDown = (event) => {
    const isNestedButton = event.target?.closest?.("button");

    if (isNestedButton) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectCard();
    }
  };

  return (
    <article
      ref={cardRef}
      aria-current={isActive ? "true" : undefined}
      aria-label={`${getListingTitle(listing)} listing card${
        isActive ? ", selected" : ""
      }`}
      className={`listing-card${isActive ? " active" : ""}`}
      onClick={selectCard}
      onFocus={(event) => {
        if (event.target === event.currentTarget) {
          selectCard();
        }
      }}
      onKeyDown={handleCardKeyDown}
      tabIndex="0"
    >
      <div className="listing-card-heading">
        <h3>{getListingTitle(listing)}</h3>
        <span className="score-badge">{valueScore}/100</span>
      </div>

      <ListingBadges badges={badges} />

      <div className="listing-meta-row">
        {getPropertyType(listing) !== DATA_UNAVAILABLE && (
          <span className="type-badge">{getPropertyType(listing)}</span>
        )}
        <span className={`safety-badge ${safetyClass}`}>{safetyLevel}</span>
      </div>

      <p className="listing-rent">
        {formatRent(listing?.monthlyRent ?? listing?.rent)}
      </p>
      <p className="listing-location">{getLocationLabel(listing)}</p>

      <dl className="listing-facts">
        <div>
          <dt>Neighbourhood</dt>
          <dd>{getLocationLabel(listing)}</dd>
        </div>
        <div>
          <dt>Estimated commute</dt>
          <dd>{formatCommute(listing, campus)}</dd>
        </div>
        <div>
          <dt>Furnished</dt>
          <dd>{formatFurnishedStatus(listing?.furnished)}</dd>
        </div>
      </dl>

      {amenities.length > 0 && (
        <ul className="chip-list" aria-label="Amenities">
          {amenities.slice(0, 4).map((amenity) => (
            <li key={amenity}>{amenity}</li>
          ))}
        </ul>
      )}

      {hasValue(listing?.description) && (
        <p className="listing-description">{listing.description}</p>
      )}

      <div className="listing-card-actions">
        {onCompareListing && (
          <button
            type="button"
            className={`secondary-button compare-toggle-button${
              isCompared ? " selected" : ""
            }`}
            disabled={!listingId}
            aria-pressed={isCompared}
            onClick={(event) => {
              event.stopPropagation();
              onCompareListing(listingId);
            }}
          >
            Compare
          </button>
        )}
        <button
          type="button"
          className="details-button"
          disabled={!listingId}
          onClick={(event) => {
            event.stopPropagation();
            onDetails(listingId);
          }}
        >
          Details
        </button>
        {onToggleSave && (
          <button
            type="button"
            className={`save-toggle-button${isSaved ? " saved" : ""}`}
            disabled={!listingId || isSaving}
            aria-pressed={isSaved}
            aria-label={
              isSaved ? "Remove listing from saved listings" : "Save listing"
            }
            onClick={(event) => {
              event.stopPropagation();
              onToggleSave(listingId);
            }}
          >
            {isSaved ? "★ Saved" : "☆ Save"}
          </button>
        )}
      </div>
    </article>
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

    if (
      maxCommute !== null &&
      Number.isFinite(maxCommute) &&
      commuteMinutes !== null &&
      commuteMinutes > maxCommute
    ) {
      return false;
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
  const handleOpenCompare = () => {
    onClearCompareStatus?.();
    onOpenCompare?.();
  };

  return (
    <section className="browse-page" aria-labelledby="results-title">
      <div className="active-search-bar">
        <div className="active-search-content">
          <strong>Active Search</strong>
          {searchChips.length > 0 ? (
            <div className="search-chip-list" aria-label="Active search criteria">
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
        <button type="button" className="link-button strong" onClick={onEditSearch}>
          Edit Search
        </button>
      </div>

      <ResultsFilters
        filters={filters}
        onChange={onFilterChange}
        valueScoreWeights={valueScoreWeights}
        onWeightChange={onWeightChange}
        onResetWeights={onResetWeights}
      />

      {!isLoading && !errorMessage && rankedListings.length > 0 && (
        <RecommendationSummary
          listings={rankedListings}
          campus={search?.campus}
          valueScoreWeights={valueScoreWeights}
        />
      )}

      <div className="results-title-row">
        <div>
          <h2 id="results-title">Housing Results</h2>
          <p>
            {rankedListings.length} listing
            {rankedListings.length === 1 ? "" : "s"} found based on your
            preferences
          </p>
        </div>
        <div className="compare-toolbar" aria-label="Compare selected listings">
          <div className="compare-count">
            <span>Compare</span>
            <strong>
              {compareCount}/{maxCompareListings} selected
            </strong>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={handleOpenCompare}
          >
            Open Compare
          </button>
        </div>
      </div>

      {hasCompareStatus && (
        <p
          className={`compare-status ${compareStatus.type || "info"}`}
          role={compareStatus.type === "error" ? "alert" : "status"}
        >
          {compareStatus.message}
        </p>
      )}

      {isLoading && (
        <div className="state-panel loading-state" role="status">
          <span className="spinner" aria-hidden="true"></span>
          <div>
            <h3>Finding housing matches</h3>
            <p>Checking listings that fit your rent, commute, and safety needs.</p>
          </div>
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="state-panel error" role="alert">
          <h3>Listings could not be loaded</h3>
          <p>{errorMessage}</p>
          <div className="state-actions">
            <button type="button" className="details-button" onClick={onRetry}>
              Retry
            </button>
            <button type="button" className="secondary-button" onClick={onEditSearch}>
              Edit Search
            </button>
          </div>
        </div>
      )}

      {!isLoading && !errorMessage && rankedListings.length === 0 && (
        <div className="state-panel empty-state">
          <h3>No listings match these filters</h3>
          <p>
            Try widening the rent range, commute time, or housing type to see
            more options.
          </p>
          <button type="button" className="secondary-button" onClick={onEditSearch}>
            Edit Search
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
  );
}

export default BrowseResults;
