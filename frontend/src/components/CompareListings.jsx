import { useMemo, useRef, useState } from "react";
import ListingBadges from "./ListingBadges";
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
  getWeightedValueScore,
  getValueScoreBreakdown,
} from "../utils/listingFormatters";
import { getRecommendationBadgesByListingId } from "../utils/recommendationBadges";

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
  return Number.isFinite(numericScore)
    ? Math.round(numericScore)
    : DATA_UNAVAILABLE;
};

const getSafetyClass = (safetyLevel) =>
  safetyLevel === DATA_UNAVAILABLE
    ? "unknown"
    : safetyLevel.toLowerCase().replace(/\s+/g, "-");

const formatSafetyLevel = (safetyLevel) =>
  safetyLevel === DATA_UNAVAILABLE ? safetyLevel : `${safetyLevel} crime`;

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
    return Number.isFinite(score) && score > highestScore
      ? score
      : highestScore;
  }, Number.NEGATIVE_INFINITY);

function ScoreBar({ score, isBest }) {
  const numericScore = Number(score);
  const width = Number.isFinite(numericScore)
    ? Math.max(0, Math.min(100, numericScore))
    : 0;
  const formattedScore = formatScore(score);

  return (
    <span
      className={`compare-score-bar${isBest ? " best" : ""}`}
      aria-label={`${formattedScore} out of 100${
        isBest ? ", highest among selected listings" : ""
      }`}
    >
      <strong>{formattedScore}</strong>
      <span className="compare-score-track" aria-hidden="true">
        <span style={{ width: `${width}%` }}></span>
      </span>
      {isBest && <small>Highest</small>}
    </span>
  );
}

function CompareSectionRow({ label }) {
  return (
    <div className="compare-section-row" role="row">
      <strong role="rowheader">{label}</strong>
    </div>
  );
}

function CompareDataRow({
  label,
  helper,
  listings,
  children,
  compact = false,
}) {
  return (
    <div
      className={`compare-row${compact ? " compact" : ""}${
        label === "Listing actions" ? " action-row" : ""
      }`}
      role="row"
    >
      <div className="compare-row-label" role="rowheader">
        <span>{label}</span>
        {helper && <small>{helper}</small>}
      </div>
      {listings.map((listing) => (
        <div
          key={`${label}-${getListingId(listing)}`}
          className="compare-cell"
          role="cell"
          aria-label={`${getListingTitle(listing)}, ${label}`}
        >
          {children(listing)}
        </div>
      ))}
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
  const dialogRef = useRef(null);

  const handleDialogKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableControls = dialogRef.current?.querySelectorAll(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    );

    if (!focusableControls?.length) {
      return;
    }

    const firstControl = focusableControls[0];
    const lastControl = focusableControls[focusableControls.length - 1];

    if (event.shiftKey && document.activeElement === firstControl) {
      event.preventDefault();
      lastControl.focus();
    } else if (!event.shiftKey && document.activeElement === lastControl) {
      event.preventDefault();
      firstControl.focus();
    }
  };

  return (
    <div className="compare-picker-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="compare-picker-modal"
        role="dialog"
        aria-labelledby="compare-picker-title"
        aria-describedby="compare-picker-description"
        aria-modal="true"
        onKeyDown={handleDialogKeyDown}
      >
        <div className="compare-picker-header">
          <div>
            <h2 id="compare-picker-title">Add a listing</h2>
            <p id="compare-picker-description">
              {availableListings.length} option
              {availableListings.length === 1 ? "" : "s"} available from your
              current results.
            </p>
          </div>
          <button
            type="button"
            className="button button-small compare-picker-close"
            autoFocus
            onClick={onClose}
          >
            Close
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

function CompareMobileCard({
  listing,
  campus,
  badges,
  isStrongest,
  lowestRent,
  shortestCommute,
  valueScoreWeights,
  isSaved,
  isSaving,
  onDetails,
  onToggleSave,
  onRemoveCompare,
}) {
  const listingId = getListingId(listing);
  const rent = getRentNumber(listing);
  const commute = getCommuteMinutes(listing, campus);
  const safetyLevel = getSafetyLevel(listing);
  const scoreBreakdown = getValueScoreBreakdown(listing, campus);
  const amenities = getAmenities(listing);

  return (
    <article
      className={`compare-mobile-card ${
        isStrongest ? "best-match" : "alternative-match"
      }`}
    >
      <ListingBadges badges={badges} />
      {isStrongest && (
        <span className="best-value-label">Highest Value Score</span>
      )}
      <header>
        <h3>{getListingTitle(listing)}</h3>
        <p>{getLocationLabel(listing)}</p>
      </header>

      <dl className="compare-mobile-facts">
        <div className="featured">
          <dt>Value Score</dt>
          <dd>
            {getListingScore(listing, campus, valueScoreWeights)}/100
            {isStrongest && <small>Highest</small>}
          </dd>
        </div>
        <div>
          <dt>Monthly rent</dt>
          <dd>
            {formatRent(listing.monthlyRent ?? listing.rent)}
            {rent !== null && rent === lowestRent && <small>Lowest</small>}
          </dd>
        </div>
        <div>
          <dt>Commute</dt>
          <dd>
            {formatCommute(listing, campus)}
            {commute !== null && commute === shortestCommute && (
              <small>Shortest</small>
            )}
          </dd>
        </div>
        <div>
          <dt>Safety</dt>
          <dd>
            <span className={`safety-badge ${getSafetyClass(safetyLevel)}`}>
              {formatSafetyLevel(safetyLevel)}
            </span>
          </dd>
        </div>
        <div>
          <dt>Housing type</dt>
          <dd>{getPropertyType(listing)}</dd>
        </div>
        <div>
          <dt>Furnishing</dt>
          <dd>{formatFurnishedStatus(listing.furnished)}</dd>
        </div>
      </dl>

      <section className="compare-mobile-section" aria-label="Score breakdown">
        <h4>Score breakdown</h4>
        <dl className="compare-mobile-scores">
          {SCORE_KEYS.map((scoreItem) => (
            <div key={scoreItem.key}>
              <dt>{scoreItem.label.replace(" Score", "")}</dt>
              <dd>{scoreBreakdown[scoreItem.key]}/100</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="compare-mobile-section" aria-label="Amenities">
        <h4>Amenities</h4>
        {amenities.length > 0 ? (
          <ul className="chip-list">
            {amenities.map((amenity) => (
              <li key={amenity}>{amenity}</li>
            ))}
          </ul>
        ) : (
          <p className="unavailable-data">No amenities listed</p>
        )}
      </section>

      <footer className="compare-mobile-actions">
        <button
          type="button"
          className="details-button"
          onClick={() => onDetails(listingId)}
        >
          View Details
        </button>
        {onToggleSave && (
          <button
            type="button"
            className={`save-toggle-button${isSaved ? " saved" : ""}`}
            disabled={isSaving}
            aria-pressed={isSaved}
            onClick={() => onToggleSave(listingId)}
          >
            {isSaving ? "Updating..." : isSaved ? "Saved" : "Save"}
          </button>
        )}
        <button
          type="button"
          className="button button-danger-ghost"
          onClick={() => onRemoveCompare(listingId)}
        >
          Remove
        </button>
      </footer>
    </article>
  );
}

function CompareListings({
  listings,
  availableListings = [],
  campus,
  compareStatus = { type: "", message: "" },
  maxCompareListings = 3,
  valueScoreWeights,
  savedListingIds,
  savingListingIds,
  onToggleSave,
  onAddCompare,
  onRemoveCompare,
  onBackToResults,
  backLabel = "Back to Results",
  onDetails,
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const pickerTriggerRef = useRef(null);
  const selectedIds = useMemo(
    () => new Set(listings.map((listing) => getListingId(listing))),
    [listings],
  );
  const listingsToAdd = availableListings.filter(
    (listing) => getListingId(listing) && !selectedIds.has(getListingId(listing)),
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
  const badgeSource = availableListings.length > 0 ? availableListings : listings;
  const badgesByListingId = getRecommendationBadgesByListingId(
    badgeSource,
    campus,
    valueScoreWeights,
  );
  const columnStyle = {
    "--compare-columns": `minmax(150px, 0.65fr) repeat(${Math.max(
      listings.length,
      1,
    )}, minmax(0, 1fr))`,
  };
  const canAddListing =
    listings.length < maxCompareListings && listingsToAdd.length > 0;
  const openPicker = (event) => {
    pickerTriggerRef.current = event.currentTarget;
    setIsPickerOpen(true);
  };
  const closePicker = () => {
    setIsPickerOpen(false);
    window.requestAnimationFrame(() => pickerTriggerRef.current?.focus());
  };

  return (
    <section className="compare-page" aria-labelledby="compare-title">
      <nav className="compare-navigation" aria-label="Comparison navigation">
        <button type="button" className="back-button" onClick={onBackToResults}>
          {backLabel}
        </button>
      </nav>

      <header className="compare-header">
        <div>
          <p className="section-eyebrow">Housing comparison</p>
          <h1 id="compare-title">Compare Listings</h1>
          <p>
            Review the most important differences across your selected housing
            options.
          </p>
        </div>
        <div className="compare-header-actions">
          <span className="compare-count-pill">
            {listings.length}/{maxCompareListings} selected
          </span>
          {canAddListing && (
            <button
              type="button"
              className="secondary-button"
              onClick={openPicker}
            >
              Add Listing
            </button>
          )}
        </div>
      </header>

      {compareStatus.message && (
        <p
          className={`compare-status ${compareStatus.type || "info"}`}
          role={compareStatus.type === "error" ? "alert" : "status"}
        >
          {compareStatus.message}
        </p>
      )}

      {listings.length === 0 && (
        <div className="state-panel empty-state">
          <h2>No listings selected</h2>
          <p>Add listings from your current results to start a comparison.</p>
          <div className="state-actions">
            {canAddListing && (
              <button
                type="button"
                className="details-button"
                onClick={openPicker}
              >
                Add a Listing
              </button>
            )}
            <button
              type="button"
              className="secondary-button"
              onClick={onBackToResults}
            >
              {backLabel}
            </button>
          </div>
        </div>
      )}

      {listings.length === 1 && (
        <p className="compare-note" role="status">
          Add one more listing to compare differences and identify leading
          values.
        </p>
      )}

      {strongestListing && (
        <aside className="compare-decision-summary" aria-labelledby="compare-leader-title">
          <div>
            <p className="section-eyebrow">Rule-based summary</p>
            <h2 id="compare-leader-title">Current Value Score leader</h2>
            <p>
              <strong>{getListingTitle(strongestListing)}</strong> has the
              highest Value Score among these selected listings using your
              current priorities.
            </p>
          </div>
          <div className="compare-leader-score">
            <strong>
              {getListingScore(strongestListing, campus, valueScoreWeights)}
            </strong>
            <span>/100</span>
          </div>
          <ListingBadges
            badges={badgesByListingId[strongestListingId] || []}
          />
        </aside>
      )}

      {listings.length > 0 && (
        <>
          <div className="comparison-section-heading">
            <div>
              <h2>Comparison details</h2>
              <p>
                “Lowest,” “Shortest,” and “Highest” labels use the existing
                listing data and Value Score rules.
              </p>
            </div>
          </div>

          <div
            className="compare-board compare-desktop-board"
            style={columnStyle}
            role="table"
            aria-label="Listing comparison"
          >
            <div className="compare-row property-row" role="row">
              <div className="compare-row-label" role="rowheader">
                <strong>Listing</strong>
              </div>
              {listings.map((listing) => {
                const listingId = getListingId(listing);

                return (
                  <div
                    key={listingId}
                    className={`compare-property-cell ${
                      listingId === strongestListingId
                        ? "best-match"
                        : "alternative-match"
                    }`}
                    role="columnheader"
                  >
                    <div className="compare-property-highlights">
                      <ListingBadges
                        badges={badgesByListingId[listingId] || []}
                      />
                      {listingId === strongestListingId && (
                        <span className="best-value-label">
                          Highest Value Score
                        </span>
                      )}
                    </div>
                    <h3>{getListingTitle(listing)}</h3>
                    <button
                      type="button"
                      className="button button-small button-danger-ghost compare-remove-button"
                      onClick={() => onRemoveCompare(listingId)}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>

            <CompareDataRow
              label="Value Score"
              listings={listings}
            >
              {(listing) => {
                const listingId = getListingId(listing);
                return (
                  <span
                    className={
                      listingId === strongestListingId ? "compare-best-text" : ""
                    }
                  >
                    {getListingScore(listing, campus, valueScoreWeights)}/100
                    {listingId === strongestListingId && <small>Highest</small>}
                  </span>
                );
              }}
            </CompareDataRow>

            <CompareDataRow
              label="Monthly Rent"
              listings={listings}
            >
              {(listing) => {
                const rent = getRentNumber(listing);
                const isLowest = rent !== null && rent === lowestRent;
                return (
                  <span className={isLowest ? "compare-best-text" : ""}>
                    {formatRent(listing.monthlyRent ?? listing.rent)}
                    {isLowest && <small>Lowest</small>}
                  </span>
                );
              }}
            </CompareDataRow>

            <CompareDataRow
              label="TTC Commute"
              helper={campus ? `to ${campus}` : "Campus estimate"}
              listings={listings}
            >
              {(listing) => {
                const commute = getCommuteMinutes(listing, campus);
                const isShortest =
                  commute !== null && commute === shortestCommute;
                return (
                  <span className={isShortest ? "compare-best-text" : ""}>
                    {formatCommute(listing, campus)}
                    {isShortest && <small>Shortest</small>}
                  </span>
                );
              }}
            </CompareDataRow>

            <CompareDataRow
              label="Safety Level"
              helper="Based on available crime data"
              listings={listings}
            >
              {(listing) => {
                const safetyLevel = getSafetyLevel(listing);
                return (
                  <span className={`safety-badge ${getSafetyClass(safetyLevel)}`}>
                    {formatSafetyLevel(safetyLevel)}
                  </span>
                );
              }}
            </CompareDataRow>

            <CompareSectionRow label="Property information" />

            <CompareDataRow
              label="Housing Type"
              listings={listings}
              compact
            >
              {(listing) => getPropertyType(listing)}
            </CompareDataRow>
            <CompareDataRow
              label="Furnishing"
              listings={listings}
              compact
            >
              {(listing) => formatFurnishedStatus(listing.furnished)}
            </CompareDataRow>
            <CompareDataRow
              label="Location"
              listings={listings}
              compact
            >
              {(listing) => getLocationLabel(listing)}
            </CompareDataRow>

            <CompareSectionRow label="Score breakdown" />

            {SCORE_KEYS.map((scoreItem) => {
              const highestScore = getHighestBreakdownScore(
                listings,
                campus,
                scoreItem.key,
              );

              return (
                <CompareDataRow
                  key={scoreItem.key}
                  label={scoreItem.label}
                  listings={listings}
                  compact
                >
                  {(listing) => {
                    const score = getValueScoreBreakdown(listing, campus)[
                      scoreItem.key
                    ];
                    return (
                      <ScoreBar
                        score={score}
                        isBest={Number(score) === highestScore}
                      />
                    );
                  }}
                </CompareDataRow>
              );
            })}

            <CompareSectionRow label="Amenities" />

            {allAmenities.length > 0 ? (
              allAmenities.map((amenity) => (
                <CompareDataRow
                  key={amenity}
                  label={amenity}
                  listings={listings}
                  compact
                >
                  {(listing) => {
                    const hasAmenity = getAmenities(listing).includes(amenity);
                    return (
                      <span
                        className={`amenity-check${hasAmenity ? " yes" : " no"}`}
                        aria-label={hasAmenity ? "Included" : "Not listed"}
                        title={hasAmenity ? "Included" : "Not listed"}
                      >
                        <svg
                          viewBox="0 0 16 16"
                          aria-hidden="true"
                          focusable="false"
                        >
                          {hasAmenity ? (
                            <path d="M3 8.25 6.5 11.5 13 4.5" />
                          ) : (
                            <path d="m4 4 8 8m0-8-8 8" />
                          )}
                        </svg>
                      </span>
                    );
                  }}
                </CompareDataRow>
              ))
            ) : (
              <CompareDataRow
                label="Amenities"
                listings={listings}
                compact
              >
                {() => <span className="unavailable-data">None listed</span>}
              </CompareDataRow>
            )}

            <CompareSectionRow label="Actions" />
            <CompareDataRow
              label="Listing actions"
              listings={listings}
              compact
            >
              {(listing) => {
                const listingId = getListingId(listing);
                const isSaved = savedListingIds?.has(listingId);
                const isSaving = savingListingIds?.has(listingId);

                return (
                  <div className="compare-cell-actions">
                    <button
                      type="button"
                      className="details-button"
                      onClick={() => onDetails(listingId)}
                    >
                      View Details
                    </button>
                    {onToggleSave && (
                      <button
                        type="button"
                        className={`save-toggle-button${isSaved ? " saved" : ""}`}
                        disabled={isSaving}
                        aria-pressed={isSaved}
                        onClick={() => onToggleSave(listingId)}
                      >
                        {isSaving ? "Updating..." : isSaved ? "Saved" : "Save"}
                      </button>
                    )}
                  </div>
                );
              }}
            </CompareDataRow>
          </div>

          <div className="compare-mobile-list" aria-label="Mobile listing comparison">
            {listings.map((listing) => {
              const listingId = getListingId(listing);
              return (
                <CompareMobileCard
                  key={listingId}
                  listing={listing}
                  campus={campus}
                  badges={badgesByListingId[listingId] || []}
                  isStrongest={listingId === strongestListingId}
                  lowestRent={lowestRent}
                  shortestCommute={shortestCommute}
                  valueScoreWeights={valueScoreWeights}
                  isSaved={savedListingIds?.has(listingId)}
                  isSaving={savingListingIds?.has(listingId)}
                  onDetails={onDetails}
                  onToggleSave={onToggleSave}
                  onRemoveCompare={onRemoveCompare}
                />
              );
            })}
          </div>
        </>
      )}

      {isPickerOpen && (
        <ComparePicker
          availableListings={listingsToAdd}
          campus={campus}
          valueScoreWeights={valueScoreWeights}
          onAddCompare={onAddCompare}
          onClose={closePicker}
        />
      )}
    </section>
  );
}

export default CompareListings;
