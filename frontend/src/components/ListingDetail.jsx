import {
  DATA_UNAVAILABLE,
  formatCommute,
  formatFurnishedStatus,
  formatRent,
  getAmenities,
  getDescription,
  getListingId,
  getListingTitle,
  getLocationLabel,
  getPropertyType,
  getSafetyLevel,
  getValueScore,
  getValueScoreBreakdown,
} from "../utils/listingFormatters";

function DetailRow({ label, children }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ListingDetail({
  listing,
  campus,
  isLoading,
  errorMessage,
  onBack,
  backLabel = "Back to Results",
  onRetry,
  isSaved = false,
  isSaving = false,
  onToggleSave,
}) {
  const amenities = getAmenities(listing);
  const safetyLevel = getSafetyLevel(listing);
  const valueScore = getValueScore(listing, campus);
  const scoreBreakdown = getValueScoreBreakdown(listing, campus);
  const listingId = getListingId(listing);
  const safetyClass =
    safetyLevel === DATA_UNAVAILABLE
      ? "unknown"
      : safetyLevel.toLowerCase().replace(/\s+/g, "-");

  return (
    <section className="detail-page" aria-labelledby="detail-title">
      <button type="button" className="back-button" onClick={onBack}>
        {backLabel}
      </button>

      {isLoading && (
        <div className="state-panel loading-state" role="status">
          <span className="spinner" aria-hidden="true"></span>
          <div>
            <h2 id="detail-title">Loading listing details</h2>
            <p>Getting rent, commute, safety, and amenities for this listing.</p>
          </div>
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="state-panel error" role="alert">
          <h2 id="detail-title">Listing details unavailable</h2>
          <p>{errorMessage}</p>
          <div className="state-actions">
            <button type="button" className="details-button" onClick={onRetry}>
              Retry
            </button>
            <button type="button" className="secondary-button" onClick={onBack}>
              Back to Results
            </button>
          </div>
        </div>
      )}

      {!isLoading && !errorMessage && listing && (
        <article className="detail-card">
          <div className="detail-hero">
            <div>
              <div className="listing-meta-row">
                <span className="type-badge large">{getPropertyType(listing)}</span>
                <span className={`safety-badge ${safetyClass}`}>{safetyLevel}</span>
              </div>
              <h2 id="detail-title">{getListingTitle(listing)}</h2>
              <p>{getLocationLabel(listing)}</p>
              <p className="detail-rent">
                {formatRent(listing.monthlyRent ?? listing.rent)}
              </p>
            </div>
            <div className="detail-hero-actions">
              <div className="value-score-card" aria-label="Value score">
                <span>Value Score</span>
                <strong>{valueScore}</strong>
                <small>out of 100</small>
              </div>
              {onToggleSave && (
                <button
                  type="button"
                  className={`save-toggle-button${isSaved ? " saved" : ""}`}
                  disabled={!listingId || isSaving}
                  aria-pressed={isSaved}
                  aria-label={
                    isSaved
                      ? "Remove listing from saved listings"
                      : "Save listing"
                  }
                  onClick={() => onToggleSave(listingId)}
                >
                  {isSaved ? "★ Saved" : "☆ Save Listing"}
                </button>
              )}
            </div>
          </div>

          <dl className="quick-stats">
            <DetailRow label="Monthly rent">
              {formatRent(listing.monthlyRent ?? listing.rent)}
            </DetailRow>
            <DetailRow label="Estimated commute">
              {formatCommute(listing, campus)}
              {campus && (
                <small className="commute-campus-label">to {campus}</small>
              )}
            </DetailRow>
            <DetailRow label="Safety level">
              <span className={`safety-badge ${safetyClass}`}>{safetyLevel}</span>
            </DetailRow>
            <DetailRow label="Furnished status">
              {formatFurnishedStatus(listing.furnished)}
            </DetailRow>
            <DetailRow label="Value score">
              <span className={valueScore === DATA_UNAVAILABLE ? "unavailable-data" : ""}>
                {valueScore}
              </span>
            </DetailRow>
          </dl>

          <section className="detail-section" aria-labelledby="amenities-title">
            <h3 id="amenities-title">Amenities</h3>
            {amenities.length > 0 ? (
              <ul className="chip-list">
                {amenities.map((amenity) => (
                  <li key={amenity}>{amenity}</li>
                ))}
              </ul>
            ) : (
              <p>{DATA_UNAVAILABLE}</p>
            )}
          </section>

          <section className="detail-section" aria-labelledby="commute-title">
            <h3 id="commute-title">Estimated Commute</h3>
            <p>
              {campus
                ? `This is the estimated TTC commute from this listing to ${campus}. `
                : "Estimated TTC commute is matched to your selected campus when available. "}
              Use it as a planning estimate and confirm the route before
              signing a lease.
            </p>
          </section>

          <section className="detail-section" aria-labelledby="score-title">
            <h3 id="score-title">Score Breakdown</h3>
            <div className="score-breakdown-grid">
              <DetailRow label="Affordability score">
                {scoreBreakdown.affordability}/100
              </DetailRow>
              <DetailRow label="Commute score">{scoreBreakdown.commute}/100</DetailRow>
              <DetailRow label="Safety score">{scoreBreakdown.safety}/100</DetailRow>
              <DetailRow label="Amenities score">
                {scoreBreakdown.amenities}/100
              </DetailRow>
            </div>
          </section>

          <section className="detail-section" aria-labelledby="description-title">
            <h3 id="description-title">Description</h3>
            <p>{getDescription(listing)}</p>
          </section>
        </article>
      )}
    </section>
  );
}

export default ListingDetail;
