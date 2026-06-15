import {
  DATA_UNAVAILABLE,
  formatCommute,
  formatFurnishedStatus,
  formatRent,
  getAmenities,
  getDescription,
  getListingTitle,
  getLocationLabel,
  getPropertyType,
  getSafetyLevel,
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
  onRetry,
}) {
  const amenities = getAmenities(listing);
  const safetyLevel = getSafetyLevel(listing);
  const safetyClass =
    safetyLevel === DATA_UNAVAILABLE
      ? "unknown"
      : safetyLevel.toLowerCase().replace(/\s+/g, "-");

  return (
    <section className="detail-page" aria-labelledby="detail-title">
      <button type="button" className="back-button" onClick={onBack}>
        Back to Results
      </button>

      {isLoading && (
        <div className="state-panel" role="status">
          Loading listing details...
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
          <div className="detail-heading">
            <div>
              <h2 id="detail-title">{getListingTitle(listing)}</h2>
              <p>{getLocationLabel(listing)}</p>
            </div>
            <span className="type-badge large">{getPropertyType(listing)}</span>
          </div>

          <p className="detail-rent">{formatRent(listing.monthlyRent ?? listing.rent)}</p>

          <dl className="detail-grid">
            <DetailRow label="Property type">{getPropertyType(listing)}</DetailRow>
            <DetailRow label="Address or neighbourhood">
              {getLocationLabel(listing)}
            </DetailRow>
            <DetailRow label="Furnished status">
              {formatFurnishedStatus(listing.furnished)}
            </DetailRow>
            <DetailRow label="Safety level">
              <span className={`safety-badge ${safetyClass}`}>{safetyLevel}</span>
            </DetailRow>
            <DetailRow label="Estimated commute">
              {formatCommute(listing, campus)}
            </DetailRow>
          </dl>

          <section className="detail-section" aria-labelledby="amenities-title">
            <h3 id="amenities-title">Amenities</h3>
            {amenities.length > 0 ? (
              <ul className="amenities-list">
                {amenities.map((amenity) => (
                  <li key={amenity}>{amenity}</li>
                ))}
              </ul>
            ) : (
              <p>{DATA_UNAVAILABLE}</p>
            )}
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
