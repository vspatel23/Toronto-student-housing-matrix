import ListingBadges from "./ListingBadges";
import {
  DATA_UNAVAILABLE,
  formatCommute,
  formatFurnishedStatus,
  formatRent,
  getAmenities,
  getListingId,
  getListingTitle,
  getLocationLabel,
  getPropertyType,
  getSafetyLevel,
  getWeightedValueScore,
} from "../utils/listingFormatters";

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

function ListingCard({
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
  saveLabel = "Save",
  savedLabel = "Saved",
  savingLabel = "Updating...",
  isCompared = false,
  onCompareListing,
  valueScoreWeights,
}) {
  const listingId = getListingId(listing);
  const listingTitle = getListingTitle(listing);
  const location = getLocationLabel(listing);
  const propertyType = getPropertyType(listing);
  const amenities = getAmenities(listing);
  const visibleAmenities = amenities.slice(0, 4);
  const hiddenAmenityCount = Math.max(
    0,
    amenities.length - visibleAmenities.length,
  );
  const safetyLevel = getSafetyLevel(listing);
  const valueScore = getWeightedValueScore(listing, campus, valueScoreWeights);
  const safetyClass =
    safetyLevel === DATA_UNAVAILABLE
      ? "unknown"
      : safetyLevel.toLowerCase().replace(/\s+/g, "-");
  const safetyLabel =
    safetyLevel === DATA_UNAVAILABLE ? safetyLevel : `${safetyLevel} crime`;
  const isSelectable = Boolean(listingId && onSelect);

  const selectCard = () => {
    if (listingId) {
      onSelect?.(listingId);
    }
  };

  const handleCardKeyDown = (event) => {
    if (event.target?.closest?.("button")) {
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
      aria-label={`${listingTitle} listing card${
        isActive ? ", selected on map" : ""
      }${isCompared ? ", selected for comparison" : ""}${
        isSaved ? ", saved" : ""
      }`}
      className={`listing-card${isSelectable ? " selectable" : ""}${
        isActive ? " active" : ""
      }${isCompared ? " compared" : ""}${isSaved ? " saved" : ""}`}
      onClick={isSelectable ? selectCard : undefined}
      onFocus={
        isSelectable
          ? (event) => {
              if (event.target === event.currentTarget) {
                selectCard();
              }
            }
          : undefined
      }
      onKeyDown={isSelectable ? handleCardKeyDown : undefined}
      tabIndex={isSelectable ? 0 : undefined}
    >
      <div className="listing-card-badge-row">
        <ListingBadges badges={badges} />
        {isCompared && (
          <span className="comparison-state-badge">Selected to compare</span>
        )}
      </div>

      <header className="listing-card-heading">
        <div className="listing-title-group">
          <h3>{listingTitle}</h3>
          <p className="listing-location">{location}</p>
        </div>
        <div
          className="score-badge"
          aria-label={`Value Score ${valueScore} out of 100`}
        >
          <span>Value Score</span>
          <strong>{valueScore}</strong>
          <small>/100</small>
        </div>
      </header>

      <div className="listing-price-row">
        <p className="listing-rent">
          {formatRent(listing?.monthlyRent ?? listing?.rent)}
        </p>
        {propertyType !== DATA_UNAVAILABLE && (
          <span className="type-badge">{propertyType}</span>
        )}
      </div>

      <dl className="listing-facts">
        <div>
          <dt>Commute</dt>
          <dd>{formatCommute(listing, campus)}</dd>
        </div>
        <div>
          <dt>Safety</dt>
          <dd>
            <span className={`safety-badge ${safetyClass}`}>{safetyLabel}</span>
          </dd>
        </div>
        <div>
          <dt>Furnishing</dt>
          <dd>{formatFurnishedStatus(listing?.furnished)}</dd>
        </div>
      </dl>

      <div className="listing-amenities">
        <span className="listing-card-label">Key amenities</span>
        {visibleAmenities.length > 0 ? (
          <ul className="chip-list" aria-label="Key amenities">
            {visibleAmenities.map((amenity) => (
              <li key={amenity}>{amenity}</li>
            ))}
            {hiddenAmenityCount > 0 && (
              <li className="amenity-more">+{hiddenAmenityCount} more</li>
            )}
          </ul>
        ) : (
          <p className="unavailable-data">Amenities not provided</p>
        )}
      </div>

      {hasValue(listing?.description) && (
        <p className="listing-description">{listing.description}</p>
      )}

      <footer className="listing-card-actions">
        <button
          type="button"
          className="details-button"
          disabled={!listingId}
          onClick={(event) => {
            event.stopPropagation();
            onDetails?.(listingId);
          }}
        >
          View Details
        </button>
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
            {isCompared ? "View comparison" : "Compare"}
          </button>
        )}
        {onToggleSave && (
          <button
            type="button"
            className={`save-toggle-button${isSaved ? " saved" : ""}`}
            disabled={!listingId || isSaving}
            aria-pressed={isSaved}
            aria-label={
              isSaving
                ? "Updating saved listing"
                : isSaved
                  ? "Remove listing from saved listings"
                  : "Save listing"
            }
            onClick={(event) => {
              event.stopPropagation();
              onToggleSave(listingId);
            }}
          >
            {isSaving ? savingLabel : isSaved ? savedLabel : saveLabel}
          </button>
        )}
      </footer>
    </article>
  );
}

export default ListingCard;
