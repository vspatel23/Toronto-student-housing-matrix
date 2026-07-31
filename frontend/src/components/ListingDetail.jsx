import ListingBadges from "./ListingBadges";
import ListingImageGallery from "./ListingImageGallery";
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
  getWeightedValueScore,
  getValueScoreBreakdown,
  normalizeValueScoreWeights,
} from "../utils/listingFormatters";

const SCORE_FACTORS = [
  { key: "affordability", label: "Affordability" },
  { key: "commute", label: "Commute" },
  { key: "safety", label: "Safety" },
  { key: "amenities", label: "Amenities" },
];

const getSafetyClass = (safetyLevel) =>
  safetyLevel === DATA_UNAVAILABLE
    ? "unknown"
    : safetyLevel.toLowerCase().replace(/\s+/g, "-");

function DetailStat({ label, children, featured = false }) {
  return (
    <div className={`detail-stat${featured ? " featured" : ""}`}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ListingDetail({
  listing,
  campus,
  badges = [],
  isLoading,
  errorMessage,
  onBack,
  backLabel = "Back to Results",
  onRetry,
  isSaved = false,
  isSaving = false,
  onToggleSave,
  isCompared = false,
  compareCount = 0,
  maxCompareListings = 3,
  onCompareListing,
  valueScoreWeights,
}) {
  const amenities = getAmenities(listing);
  const description = getDescription(listing);
  const safetyLevel = getSafetyLevel(listing);
  const safetyClass = getSafetyClass(safetyLevel);
  const valueScore = valueScoreWeights
    ? getWeightedValueScore(listing, campus, valueScoreWeights)
    : getValueScore(listing, campus);
  const scoreBreakdown = getValueScoreBreakdown(listing, campus);
  const effectiveWeights = normalizeValueScoreWeights(valueScoreWeights);
  const listingId = getListingId(listing);
  const listingTitle = getListingTitle(listing);
  const isCompareFull =
    !isCompared && compareCount >= maxCompareListings;
  const compareButtonLabel = isCompared
    ? "View Comparison"
    : isCompareFull
      ? "View Full Comparison"
      : "Add to Compare";

  return (
    <section className="detail-page" aria-labelledby="detail-title">
      <nav className="detail-navigation" aria-label="Listing details navigation">
        <button type="button" className="back-button" onClick={onBack}>
          {backLabel}
        </button>
      </nav>

      {isLoading && (
        <div className="state-panel loading-state" role="status">
          <span className="spinner" aria-hidden="true"></span>
          <div>
            <h1 id="detail-title">Loading listing details</h1>
            <p>Getting rent, commute, safety, and amenities for this listing.</p>
          </div>
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="state-panel error" role="alert">
          <h1 id="detail-title">Listing details unavailable</h1>
          <p>{errorMessage}</p>
          <div className="state-actions">
            {onRetry && (
              <button type="button" className="details-button" onClick={onRetry}>
                Retry
              </button>
            )}
            <button type="button" className="secondary-button" onClick={onBack}>
              {backLabel}
            </button>
          </div>
        </div>
      )}

      {!isLoading && !errorMessage && !listing && (
        <div className="state-panel empty-state">
          <h1 id="detail-title">Listing not found</h1>
          <p>This listing is no longer available in the current results.</p>
          <button type="button" className="secondary-button" onClick={onBack}>
            {backLabel}
          </button>
        </div>
      )}

      {!isLoading && !errorMessage && listing && (
        <article className="detail-content">
          <ListingImageGallery
            key={listingId || listingTitle}
            listing={listing}
          />

          <header className="detail-overview">
            <div className="detail-identity">
              <ListingBadges badges={badges} />
              <p className="section-eyebrow">Listing details</p>
              <h1 id="detail-title">{listingTitle}</h1>
              <div className="detail-identity-meta">
                <span>{getLocationLabel(listing)}</span>
                <span className="type-badge">{getPropertyType(listing)}</span>
              </div>
            </div>

            <div className="detail-actions" aria-label="Listing actions">
              {onToggleSave && (
                <button
                  type="button"
                  className={`save-toggle-button${isSaved ? " saved" : ""}`}
                  disabled={!listingId || isSaving}
                  aria-pressed={isSaved}
                  onClick={() => onToggleSave(listingId)}
                >
                  {isSaving ? "Updating..." : isSaved ? "Saved" : "Save Listing"}
                </button>
              )}
              {onCompareListing && (
                <button
                  type="button"
                  className={`secondary-button compare-toggle-button${
                    isCompared ? " selected" : ""
                  }`}
                  disabled={!listingId}
                  aria-pressed={isCompared}
                  onClick={() => onCompareListing(listingId)}
                >
                  {compareButtonLabel}
                </button>
              )}
              {isCompared && (
                <span className="detail-action-note" role="status">
                  Selected for comparison
                </span>
              )}
              {isCompareFull && (
                <span className="detail-action-note" role="status">
                  Comparison is full. Open it to remove a listing.
                </span>
              )}
            </div>
          </header>

          <dl className="detail-quick-stats" aria-label="Listing quick statistics">
            <DetailStat label="Monthly rent" featured>
              {formatRent(listing.monthlyRent ?? listing.rent)}
            </DetailStat>
            <DetailStat label="Estimated commute">
              {formatCommute(listing, campus)}
              {campus && <small>to {campus}</small>}
            </DetailStat>
            <DetailStat label="Safety level">
              <span className={`safety-badge ${safetyClass}`}>
                {safetyLevel === DATA_UNAVAILABLE
                  ? safetyLevel
                  : `${safetyLevel} crime`}
              </span>
            </DetailStat>
            <DetailStat label="Furnishing">
              {formatFurnishedStatus(listing.furnished)}
            </DetailStat>
          </dl>

          <div className="detail-decision-grid">
            <div className="detail-main-column">
              <section className="detail-section" aria-labelledby="description-title">
                <h2 id="description-title">About this listing</h2>
                <p className={description === DATA_UNAVAILABLE ? "unavailable-data" : ""}>
                  {description === DATA_UNAVAILABLE
                    ? "No description was provided for this listing."
                    : description}
                </p>
              </section>

              <section className="detail-section" aria-labelledby="amenities-title">
                <div className="detail-section-heading">
                  <h2 id="amenities-title">Amenities</h2>
                  {amenities.length > 0 && (
                    <span>{amenities.length} listed</span>
                  )}
                </div>
                {amenities.length > 0 ? (
                  <ul className="chip-list" aria-label="Listing amenities">
                    {amenities.map((amenity) => (
                      <li key={amenity}>{amenity}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="unavailable-data">
                    No amenities were provided for this listing.
                  </p>
                )}
              </section>

              <section className="detail-section" aria-labelledby="context-title">
                <h2 id="context-title">Commute and safety context</h2>
                <div className="detail-context-grid">
                  <article>
                    <h3>Campus commute</h3>
                    <p>
                      {campus
                        ? `The TTC estimate is calculated to ${campus}. Confirm the route and service schedule before signing a lease.`
                        : "Select a campus during search to match this listing with a TTC commute estimate."}
                    </p>
                  </article>
                  <article>
                    <h3>Neighbourhood safety</h3>
                    <p>
                      {safetyLevel === DATA_UNAVAILABLE
                        ? "Neighbourhood safety data is not available for this listing. Other listing information remains usable."
                        : `${safetyLevel} crime level is based on the neighbourhood safety data currently available.`}
                    </p>
                  </article>
                </div>
              </section>
            </div>

            <aside className="detail-score-panel" aria-labelledby="score-title">
              <p className="section-eyebrow">Current priorities</p>
              <div className="detail-score-heading">
                <div>
                  <h2 id="score-title">Value Score</h2>
                  <p>Overall score using your current factor priorities.</p>
                </div>
                <div
                  className="detail-score-total"
                  aria-label={`Value Score ${valueScore} out of 100`}
                >
                  <strong>{valueScore}</strong>
                  <span>/100</span>
                </div>
              </div>

              <ul className="detail-score-list" aria-label="Value Score breakdown">
                {SCORE_FACTORS.map((factor) => {
                  const score = scoreBreakdown[factor.key];
                  const weight = Math.round(effectiveWeights[factor.key]);

                  return (
                    <li key={factor.key}>
                      <div className="detail-score-label">
                        <span>{factor.label}</span>
                        <strong>{score}/100</strong>
                      </div>
                      <div className="detail-score-track" aria-hidden="true">
                        <span style={{ width: `${score}%` }}></span>
                      </div>
                      <small>{weight}% of the overall score</small>
                    </li>
                  );
                })}
              </ul>

              <p className="detail-score-note">
                Factor scores use the existing rent, commute, safety, and
                amenities data. Changing priorities changes their influence,
                not the underlying data.
              </p>
            </aside>
          </div>
        </article>
      )}
    </section>
  );
}

export default ListingDetail;
