import {
  DATA_UNAVAILABLE,
  formatCommute,
  formatRent,
  getAmenities,
  getListingId,
  getListingTitle,
  getLocationLabel,
  getSafetyLevel,
  getValueScore,
} from "../utils/listingFormatters";

function CompareFact({ label, children }) {
  return (
    <div className="compare-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const getSafetyClass = (safetyLevel) =>
  safetyLevel === DATA_UNAVAILABLE
    ? "unknown"
    : safetyLevel.toLowerCase().replace(/\s+/g, "-");

const getStrongestListingId = (listings, campus) => {
  if (!Array.isArray(listings) || listings.length < 2) {
    return "";
  }

  const strongestListing = listings.reduce((bestListing, listing) => {
    if (!bestListing) {
      return listing;
    }

    return getValueScore(listing, campus) > getValueScore(bestListing, campus)
      ? listing
      : bestListing;
  }, null);

  return getListingId(strongestListing);
};

function CompareListings({
  listings,
  campus,
  onRemoveCompare,
  onBackToResults,
}) {
  const strongestListingId = getStrongestListingId(listings, campus);

  return (
    <section className="compare-page" aria-labelledby="compare-title">
      <div className="compare-header">
        <div>
          <h2 id="compare-title">Compare Listings</h2>
          <p>
            Review selected options side by side across rent, commute, safety,
            amenities, and Value Score.
          </p>
        </div>
        <button type="button" className="back-button" onClick={onBackToResults}>
          Back to Results
        </button>
      </div>

      {listings.length === 0 && (
        <div className="state-panel empty-state">
          <h3>No listings selected</h3>
          <p>Add listings from the results page to compare them here.</p>
          <button
            type="button"
            className="secondary-button"
            onClick={onBackToResults}
          >
            Back to Results
          </button>
        </div>
      )}

      {listings.length === 1 && (
        <p className="compare-note">
          Add another listing from the results page for a stronger side-by-side
          comparison.
        </p>
      )}

      {listings.length > 0 && (
        <div className="compare-grid">
          {listings.map((listing) => {
            const listingId = getListingId(listing);
            const safetyLevel = getSafetyLevel(listing);
            const safetyClass = getSafetyClass(safetyLevel);
            const amenities = getAmenities(listing);
            const valueScore = getValueScore(listing, campus);
            const isStrongest =
              strongestListingId && listingId === strongestListingId;

            return (
              <article
                key={listingId}
                className={`compare-card${isStrongest ? " best-match" : ""}`}
              >
                <div className="compare-card-heading">
                  <div>
                    {isStrongest && (
                      <span className="strongest-match-label">
                        Strongest Match
                      </span>
                    )}
                    <h3>{getListingTitle(listing)}</h3>
                    <p>{getLocationLabel(listing)}</p>
                  </div>
                  <div className="compare-value-score" aria-label="Value score">
                    <span>Value Score</span>
                    <strong>{valueScore}</strong>
                    <small>out of 100</small>
                  </div>
                </div>

                <dl className="compare-facts">
                  <CompareFact label="Monthly rent">
                    {formatRent(listing.monthlyRent ?? listing.rent)}
                  </CompareFact>
                  <CompareFact label="Estimated commute">
                    {formatCommute(listing, campus)}
                    {campus && (
                      <small className="commute-campus-label">to {campus}</small>
                    )}
                  </CompareFact>
                  <CompareFact label="Safety level">
                    <span className={`safety-badge ${safetyClass}`}>
                      {safetyLevel}
                    </span>
                  </CompareFact>
                </dl>

                <section
                  className="compare-amenities"
                  aria-labelledby={`compare-amenities-${listingId}`}
                >
                  <h4 id={`compare-amenities-${listingId}`}>Amenities</h4>
                  {amenities.length > 0 ? (
                    <ul className="chip-list">
                      {amenities.map((amenity, index) => (
                        <li key={`${amenity}-${index}`}>{amenity}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No listed amenities</p>
                  )}
                </section>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={!listingId}
                  onClick={() => onRemoveCompare(listingId)}
                >
                  Remove from Compare
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default CompareListings;
