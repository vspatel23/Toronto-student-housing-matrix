import { useMemo, useState } from "react";
import {
  DATA_UNAVAILABLE,
  formatCommute,
  formatRent,
  getAmenities,
  getCommuteMinutes,
  getListingId,
  getListingTitle,
  getLocationLabel,
  getPropertyType,
  getSafetyLevel,
  getValueScore,
  getWeightedValueScore,
  getValueScoreBreakdown,
} from "../utils/listingFormatters";

const SCORE_KEYS = [
  { key: "affordability", label: "Affordability Score" },
  { key: "commute", label: "Commute Score" },
  { key: "safety", label: "Safety Score" },
  { key: "amenities", label: "Amenities Score" },
];

const getRentNumber = (listing) => {
  const rent = Number(listing?.monthlyRent ?? listing?.rent);
  return Number.isFinite(rent) && rent >= 0 ? rent : null;
};

const formatScore = (score) => {
  const numericScore = Number(score);
  return Number.isFinite(numericScore) ? Math.round(numericScore) : DATA_UNAVAILABLE;
};

const getSafetyClass = (safetyLevel) =>
  safetyLevel === DATA_UNAVAILABLE
    ? "unknown"
    : safetyLevel.toLowerCase().replace(/\s+/g, "-");

const getListingScore = (listing, campus, weights) =>
  weights
    ? getWeightedValueScore(listing, campus, weights)
    : getValueScore(listing, campus);

const getBestListing = (listings, campus, weights) =>
  listings.reduce((bestListing, listing) => {
    if (!bestListing) {
      return listing;
    }

    return getListingScore(listing, campus, weights) >
      getListingScore(bestListing, campus, weights)
      ? listing
      : bestListing;
  }, null);

const getLowestRent = (listings) =>
  listings.reduce((lowestRent, listing) => {
    const rent = getRentNumber(listing);

    if (rent === null) {
      return lowestRent;
    }

    return lowestRent === null || rent < lowestRent ? rent : lowestRent;
  }, null);

const getShortestCommute = (listings, campus) =>
  listings.reduce((shortestCommute, listing) => {
    const commute = getCommuteMinutes(listing, campus);

    if (commute === null) {
      return shortestCommute;
    }

    return shortestCommute === null || commute < shortestCommute
      ? commute
      : shortestCommute;
  }, null);

const getHighestBreakdownScore = (listings, campus, scoreKey) =>
  listings.reduce((highestScore, listing) => {
    const score = Number(getValueScoreBreakdown(listing, campus)[scoreKey]);
    return Number.isFinite(score) && score > highestScore ? score : highestScore;
  }, Number.NEGATIVE_INFINITY);

function ScoreBar({ score, isBest }) {
  const numericScore = Number(score);
  const width = Number.isFinite(numericScore)
    ? Math.max(0, Math.min(100, numericScore))
    : 0;

  return (
    <span className={`compare-score-bar${isBest ? " best" : ""}`}>
      <strong>{formatScore(score)}</strong>
      <span className="compare-score-track" aria-hidden="true">
        <span style={{ width: `${width}%` }}></span>
      </span>
    </span>
  );
}

function CompareSectionRow({ children, label }) {
  return (
    <div className="compare-section-row">
      <strong>{label}</strong>
      {children}
    </div>
  );
}

function EmptyCompareSlot({ onOpenPicker }) {
  return (
    <div className="compare-empty-slot">
      <button
        type="button"
        className="compare-add-slot-button"
        onClick={onOpenPicker}
        aria-label="Add listing to compare"
      >
        <span aria-hidden="true">+</span>
        Add Listing
      </button>
    </div>
  );
}

function ComparePicker({
  availableListings,
  campus,
  valueScoreWeights,
  onAddCompare,
  onClose,
}) {
  return (
    <div className="compare-picker-backdrop" role="presentation">
      <section
        className="compare-picker-modal"
        role="dialog"
        aria-labelledby="compare-picker-title"
        aria-modal="true"
      >
        <div className="compare-picker-header">
          <div>
            <h3 id="compare-picker-title">Add Listing</h3>
            <p>{availableListings.length} option{availableListings.length === 1 ? "" : "s"} available</p>
          </div>
          <button
            type="button"
            className="compare-remove-button"
            onClick={onClose}
            aria-label="Close add listing panel"
          >
            x
          </button>
        </div>

        {availableListings.length === 0 ? (
          <div className="compare-picker-empty">
            <p>No other listings are available for this search.</p>
          </div>
        ) : (
          <div className="compare-picker-list">
            {availableListings.map((listing) => {
              const listingId = getListingId(listing);

              return (
                <button
                  key={listingId}
                  type="button"
                  className="compare-picker-option"
                  onClick={() => {
                    if (onAddCompare(listingId)) {
                      onClose();
                    }
                  }}
                >
                  <span>
                    <strong>{getListingTitle(listing)}</strong>
                    <small>{getLocationLabel(listing)}</small>
                  </span>
                  <span>{formatRent(listing.monthlyRent ?? listing.rent)}</span>
                  <span>{formatCommute(listing, campus)}</span>
                  <strong>
                    {getListingScore(listing, campus, valueScoreWeights)}/100
                  </strong>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function CompareListings({
  listings,
  availableListings = [],
  campus,
  compareStatus = { type: "", message: "" },
  maxCompareListings = 3,
  valueScoreWeights,
  onAddCompare,
  onRemoveCompare,
  onBackToResults,
  onDetails,
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const selectedIds = useMemo(
    () => new Set(listings.map((listing) => getListingId(listing))),
    [listings],
  );
  const listingsToAdd = availableListings.filter(
    (listing) => getListingId(listing) && !selectedIds.has(getListingId(listing)),
  );
  const compareSlots = Array.from(
    { length: maxCompareListings },
    (_, index) => listings[index] || null,
  );
  const strongestListing =
    listings.length >= 2
      ? getBestListing(listings, campus, valueScoreWeights)
      : null;
  const strongestListingId = getListingId(strongestListing);
  const lowestRent = listings.length >= 2 ? getLowestRent(listings) : null;
  const shortestCommute =
    listings.length >= 2 ? getShortestCommute(listings, campus) : null;
  const allAmenities = [
    ...new Set(listings.flatMap((listing) => getAmenities(listing))),
  ].sort((firstAmenity, secondAmenity) =>
    firstAmenity.localeCompare(secondAmenity),
  );
  const amenityRows =
    allAmenities.length > 0 ? allAmenities : ["No listed amenities"];
  const columnStyle = {
    "--compare-columns": `minmax(170px, 0.75fr) repeat(${maxCompareListings}, minmax(0, 1fr))`,
  };
  const recommendationListing = strongestListing || listings[0] || null;
  const recommendationTitle = recommendationListing
    ? getListingTitle(recommendationListing)
    : "";

  return (
    <section className="compare-page" aria-labelledby="compare-title">
      <div className="compare-header">
        <div>
          <h2 id="compare-title">Compare Listings</h2>
          <p>
            Side-by-side comparison of {listings.length} selected housing
            option{listings.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="compare-header-actions">
          <span className="compare-count-pill">
            {listings.length}/{maxCompareListings} selected
          </span>
          <button type="button" className="back-button" onClick={onBackToResults}>
            Back to Results
          </button>
        </div>
      </div>

      {compareStatus.message && (
        <p
          className={`compare-status ${compareStatus.type || "info"}`}
          role={compareStatus.type === "error" ? "alert" : "status"}
        >
          {compareStatus.message}
        </p>
      )}

      <div className="compare-board" style={columnStyle}>
        <div className="compare-row property-row">
          <div className="compare-row-label">
            <strong>Property</strong>
          </div>

          {compareSlots.map((listing, index) => {
            if (!listing) {
              return (
                <EmptyCompareSlot
                  key={`empty-${index}`}
                  onOpenPicker={() => setIsPickerOpen(true)}
                />
              );
            }

            const listingId = getListingId(listing);
            const isStrongest =
              strongestListingId && listingId === strongestListingId;

            return (
              <div
                key={listingId}
                className={`compare-property-cell${
                  isStrongest ? " best-match" : ""
                }`}
              >
                <button
                  type="button"
                  className="compare-remove-button"
                  onClick={() => onRemoveCompare(listingId)}
                  aria-label={`Remove ${getListingTitle(listing)} from compare`}
                >
                  x
                </button>
                {isStrongest && (
                  <span className="best-value-label">Best Value</span>
                )}
                <h3>{getListingTitle(listing)}</h3>
                <span className="compare-type-pill">{getPropertyType(listing)}</span>
                <div className={`compare-score-tile${isStrongest ? " best" : ""}`}>
                  <strong>
                    {getListingScore(listing, campus, valueScoreWeights)}
                  </strong>
                  <span>/100</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="compare-row">
          <div className="compare-row-label">Monthly Rent</div>
          {compareSlots.map((listing, index) => {
            const rent = listing ? getRentNumber(listing) : null;
            const isLowest = rent !== null && rent === lowestRent;

            return (
              <div
                key={`rent-${index}`}
                className={`compare-cell${listing ? "" : " empty"}`}
              >
                {listing ? (
                  <span className={isLowest ? "compare-best-text" : ""}>
                    {formatRent(listing.monthlyRent ?? listing.rent)}
                    {isLowest && <small>Lowest</small>}
                  </span>
                ) : (
                  DATA_UNAVAILABLE
                )}
              </div>
            );
          })}
        </div>

        <div className="compare-row">
          <div className="compare-row-label">
            <span>TTC Commute</span>
            {campus && <small>to {campus}</small>}
          </div>
          {compareSlots.map((listing, index) => {
            const commute = listing ? getCommuteMinutes(listing, campus) : null;
            const isShortest =
              commute !== null && commute === shortestCommute;

            return (
              <div
                key={`commute-${index}`}
                className={`compare-cell${listing ? "" : " empty"}`}
              >
                {listing ? (
                  <span className={isShortest ? "compare-best-text" : ""}>
                    {formatCommute(listing, campus)}
                    {isShortest && <small>Shortest</small>}
                  </span>
                ) : (
                  DATA_UNAVAILABLE
                )}
              </div>
            );
          })}
        </div>

        <div className="compare-row">
          <div className="compare-row-label">
            <span>Safety Level</span>
            <small>Based on crime data</small>
          </div>
          {compareSlots.map((listing, index) => {
            const safetyLevel = listing ? getSafetyLevel(listing) : DATA_UNAVAILABLE;

            return (
              <div
                key={`safety-${index}`}
                className={`compare-cell${listing ? "" : " empty"}`}
              >
                {listing ? (
                  <span className={`safety-badge ${getSafetyClass(safetyLevel)}`}>
                    {safetyLevel}
                  </span>
                ) : (
                  DATA_UNAVAILABLE
                )}
              </div>
            );
          })}
        </div>

        <CompareSectionRow label="Score Breakdown" />

        {SCORE_KEYS.map((scoreItem) => {
          const highestScore =
            listings.length >= 2
              ? getHighestBreakdownScore(listings, campus, scoreItem.key)
              : null;

          return (
            <div key={scoreItem.key} className="compare-row compact">
              <div className="compare-row-label">{scoreItem.label}</div>
              {compareSlots.map((listing, index) => {
                const score = listing
                  ? getValueScoreBreakdown(listing, campus)[scoreItem.key]
                  : null;
                const isBest =
                  highestScore !== null && Number(score) === highestScore;

                return (
                  <div
                    key={`${scoreItem.key}-${index}`}
                    className={`compare-cell${listing ? "" : " empty"}`}
                  >
                    {listing ? (
                      <ScoreBar score={score} isBest={isBest} />
                    ) : (
                      DATA_UNAVAILABLE
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        <CompareSectionRow label="Amenities" />

        {amenityRows.map((amenity) => (
          <div key={amenity} className="compare-row compact">
            <div className="compare-row-label">{amenity}</div>
            {compareSlots.map((listing, index) => {
              const hasAmenity =
                listing &&
                amenity !== "No listed amenities" &&
                getAmenities(listing).includes(amenity);

              return (
                <div
                  key={`${amenity}-${index}`}
                  className={`compare-cell${listing ? "" : " empty"}`}
                >
                  {listing ? (
                    <span
                      className={`amenity-check${hasAmenity ? " yes" : " no"}`}
                      aria-label={hasAmenity ? "Included" : "Not listed"}
                    >
                      {hasAmenity ? "✓" : "x"}
                    </span>
                  ) : (
                    DATA_UNAVAILABLE
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div className="compare-row action-row">
          <div className="compare-row-label">Details</div>
          {compareSlots.map((listing, index) => {
            const listingId = getListingId(listing);

            return (
              <div key={`details-${index}`} className="compare-cell">
                {listing ? (
                  <button
                    type="button"
                    className={`details-button${
                      listingId === strongestListingId ? " best-detail-button" : ""
                    }`}
                    onClick={() => onDetails(listingId)}
                  >
                    View Details
                  </button>
                ) : (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setIsPickerOpen(true)}
                  >
                    Add Listing
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {recommendationListing && (
        <aside className="compare-recommendation">
          <div className="recommendation-icon" aria-hidden="true">
            ☆
          </div>
          <div>
            <h3>Recommendation</h3>
            <p>
              Based on the Value Score calculation, <strong>{recommendationTitle}</strong>{" "}
              offers the strongest overall value at{" "}
              <strong>
                {getListingScore(
                  recommendationListing,
                  campus,
                  valueScoreWeights,
                )}
                /100
              </strong>.
              {lowestRent !== null && listings.length >= 2
                ? ` For the most affordable option, compare listings around ${formatRent(
                    lowestRent,
                  )}.`
                : ""}
            </p>
          </div>
        </aside>
      )}

      {isPickerOpen && (
        <ComparePicker
          availableListings={listingsToAdd}
          campus={campus}
          valueScoreWeights={valueScoreWeights}
          onAddCompare={onAddCompare}
          onClose={() => setIsPickerOpen(false)}
        />
      )}
    </section>
  );
}

export default CompareListings;
