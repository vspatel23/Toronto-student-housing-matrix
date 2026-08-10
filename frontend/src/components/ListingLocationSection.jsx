import { getCampusLabel } from "../utils/campusFormatters";
import {
  buildDirectionsUrl,
  calculateHaversineDistanceKm,
  formatStraightLineDistanceKm,
  getValidCoordinates,
} from "../utils/mapCoordinates";
import {
  DATA_UNAVAILABLE,
  formatCommute,
  getListingTitle,
  getLocationLabel,
} from "../utils/listingFormatters";
import ListingLocationMap from "./ListingLocationMap";

const hasText = (value) =>
  typeof value === "string" && value.trim().length > 0;

const getAddress = (entity) =>
  typeof entity?.address === "string" ? entity.address.trim() : "";

function LocationFact({ label, children }) {
  return (
    <div className="listing-location-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ListingLocationSection({
  listing,
  campus,
  selectedCampus,
  isLoadingCampus = false,
  campusError = "",
}) {
  const listingCoordinates = getValidCoordinates(listing);
  const campusCoordinates = getValidCoordinates(selectedCampus);
  const hasSelectedCampus = hasText(campus);
  const selectedCampusLabel = hasSelectedCampus
    ? campus.trim()
    : "No campus selected";
  const resolvedCampusLabel = selectedCampus
    ? getCampusLabel(selectedCampus)
    : selectedCampusLabel;
  const straightLineDistance =
    listingCoordinates && campusCoordinates
      ? calculateHaversineDistanceKm(listingCoordinates, campusCoordinates)
      : null;
  const distanceLabel = formatStraightLineDistanceKm(straightLineDistance);
  const commuteLabel = hasSelectedCampus
    ? formatCommute(listing, campus)
    : DATA_UNAVAILABLE;
  const directionsUrl = hasSelectedCampus
    ? buildDirectionsUrl(listing, selectedCampus)
    : "";
  const listingAddress = getAddress(listing) || getLocationLabel(listing);
  const campusAddress = getAddress(selectedCampus);

  let campusMapStatus = "";

  if (!hasSelectedCampus) {
    campusMapStatus =
      "Select a campus to compare this listing's location, distance, and commute.";
  } else if (isLoadingCampus && !selectedCampus) {
    campusMapStatus = "Loading the selected campus location…";
  } else if (campusError && !selectedCampus) {
    campusMapStatus =
      "Campus map comparison is unavailable because campus details could not be loaded.";
  } else if (!selectedCampus) {
    campusMapStatus = `Location details are not available for ${selectedCampusLabel}.`;
  } else if (!campusCoordinates) {
    campusMapStatus = `Location coordinates are not available for ${resolvedCampusLabel}. The listing marker is still shown.`;
  }

  return (
    <section
      className="detail-section listing-location-section"
      aria-labelledby="listing-location-title"
    >
      <div className="listing-location-heading">
        <div>
          <p className="section-eyebrow">Listing and campus</p>
          <h2 id="listing-location-title">Location</h2>
          <p>
            Review the listing location and compare it with your selected campus.
          </p>
        </div>
        {listingCoordinates && (
          <div
            className="location-marker-legend"
            role="group"
            aria-label="Map marker legend"
          >
            <span>
              <i className="map-legend-marker listing" aria-hidden="true"></i>
              Listing
            </span>
            {campusCoordinates && (
              <span>
                <i className="map-legend-marker campus" aria-hidden="true">C</i>
                Campus
              </span>
            )}
          </div>
        )}
      </div>

      <div className="listing-location-layout">
        <div className="listing-location-map-column">
          {listingCoordinates ? (
            <ListingLocationMap
              listing={listing}
              selectedCampus={selectedCampus}
            />
          ) : (
            <div
              className="map-fallback-panel listing-location-map-fallback"
              role="status"
            >
              <h3>Map unavailable</h3>
              <p>Location coordinates are not available for this listing.</p>
            </div>
          )}

          {listingCoordinates && campusMapStatus && (
            <p className="listing-location-status" role="status">
              {campusMapStatus}
            </p>
          )}
        </div>

        <div className="listing-location-summary">
          <dl className="listing-location-facts">
            <LocationFact label="Listing">
              <strong>{getListingTitle(listing)}</strong>
              <span>{listingAddress}</span>
            </LocationFact>

            <LocationFact label="Campus">
              <strong>{resolvedCampusLabel}</strong>
              {campusAddress && <span>{campusAddress}</span>}
            </LocationFact>

            {distanceLabel && (
              <LocationFact label="Straight-line distance">
                <strong>{distanceLabel}</strong>
                <span>Geographic distance, not route distance</span>
              </LocationFact>
            )}

            <LocationFact label="Estimated commute">
              <strong>{commuteLabel}</strong>
              {hasSelectedCampus && <span>to {selectedCampusLabel}</span>}
            </LocationFact>
          </dl>

          {directionsUrl ? (
            <a
              className="details-button listing-directions-button"
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open directions from ${getListingTitle(listing)} to ${resolvedCampusLabel} in a new tab`}
            >
              Open Directions
              <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <p className="listing-directions-unavailable">
              Directions become available when both listing and campus location
              information are available.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default ListingLocationSection;
