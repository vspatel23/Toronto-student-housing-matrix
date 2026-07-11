import { housingTypes } from "../utils/constants";
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
  getValueScore,
} from "../utils/listingFormatters";

const safetyOptions = ["Any", "Low", "Medium", "High"];

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

function ResultsFilters({ filters, onChange }) {
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
    </section>
  );
}

function ListingCard({ listing, campus, onDetails }) {
  const listingId = getListingId(listing);
  const amenities = getAmenities(listing);
  const safetyLevel = getSafetyLevel(listing);
  const valueScore = getValueScore(listing, campus);
  const safetyClass =
    safetyLevel === DATA_UNAVAILABLE
      ? "unknown"
      : safetyLevel.toLowerCase().replace(/\s+/g, "-");

  return (
    <article className="listing-card" tabIndex="0">
      <div className="listing-card-heading">
        <h3>{getListingTitle(listing)}</h3>
        <span className="score-badge">{valueScore}/100</span>
      </div>

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

      <button
        type="button"
        className="details-button"
        disabled={!listingId}
        onClick={() => onDetails(listingId)}
      >
        Details
      </button>
    </article>
  );
}

function BrowseResults({
  listings,
  search,
  filters,
  isLoading,
  errorMessage,
  onFilterChange,
  onDetails,
  onEditSearch,
  onRetry,
}) {
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

      <ResultsFilters filters={filters} onChange={onFilterChange} />

      {!isLoading && !errorMessage && filteredListings.length > 0 && (
        <RecommendationSummary
          listings={filteredListings}
          campus={search?.campus}
        />
      )}

      <div className="results-title-row">
        <div>
          <h2 id="results-title">Housing Results</h2>
          <p>
            {filteredListings.length} listing
            {filteredListings.length === 1 ? "" : "s"} found based on your
            preferences
          </p>
        </div>
      </div>

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

      {!isLoading && !errorMessage && filteredListings.length === 0 && (
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

      {!isLoading && !errorMessage && filteredListings.length > 0 && (
        <div className="listing-grid">
          {filteredListings.map((listing) => (
            <ListingCard
              key={getListingId(listing)}
              listing={listing}
              campus={search?.campus}
              onDetails={onDetails}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default BrowseResults;
