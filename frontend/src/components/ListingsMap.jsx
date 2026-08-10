import { useCallback, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import { getCampusLabel } from "../utils/campusFormatters";
import {
  getSafeListingMarkerLabel,
  getValidCoordinates,
} from "../utils/mapCoordinates";
import {
  createCampusIcon,
  createListingIcon,
  getMapPointKey,
  MAPTILER_ATTRIBUTION,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
} from "../utils/mapPresentation";
import {
  formatRent,
  getListingId,
  getListingTitle,
  getLocationLabel,
} from "../utils/listingFormatters";
import MapAccessibilityController from "./MapAccessibilityController";
import MapBoundsController from "./MapBoundsController";
import MapFocusController from "./MapFocusController";

function ListingsMap({
  listings,
  selectedCampus,
  activeListingId,
  onSelectListing,
  onOpenDetails,
}) {
  const mapTilerKey = import.meta.env.VITE_MAPTILER_KEY?.trim();
  const [failedMapTilerKey, setFailedMapTilerKey] = useState("");

  const listingIcon = useMemo(() => createListingIcon(false), []);
  const activeListingIcon = useMemo(() => createListingIcon(true), []);
  const campusIcon = useMemo(() => createCampusIcon(), []);

  const listingMarkers = useMemo(
    () =>
      listings
        .map((listing, index) => {
          const coordinates = getValidCoordinates(listing);
          const listingId = getListingId(listing);

          if (!coordinates) {
            return null;
          }

          return {
            coordinates,
            index,
            listing,
            listingId,
            markerLabel: getSafeListingMarkerLabel(listing, listingId),
          };
        })
        .filter(Boolean),
    [listings],
  );
  const campusCoordinates = useMemo(
    () => getValidCoordinates(selectedCampus),
    [selectedCampus],
  );
  const mapPoints = useMemo(
    () =>
      [
        ...listingMarkers.map((marker) => marker.coordinates),
        campusCoordinates,
      ].filter(Boolean),
    [campusCoordinates, listingMarkers],
  );
  const pointsKey = mapPoints.map(getMapPointKey).join("|");
  const activeMarker = listingMarkers.find(
    (marker) => marker.listingId && marker.listingId === activeListingId,
  );
  const totalListings = listings.length;
  const mappedListingCount = listingMarkers.length;
  const missingLocationCount = totalListings - mappedListingCount;
  const hasAnyMapCoordinates = mapPoints.length > 0;
  const shouldUseMapTiler =
    Boolean(mapTilerKey) && failedMapTilerKey !== mapTilerKey;
  const tileUrl = shouldUseMapTiler
    ? `https://api.maptiler.com/maps/streets-v4/256/{z}/{x}/{y}.png?key=${encodeURIComponent(
        mapTilerKey,
      )}`
    : OSM_TILE_URL;
  const tileAttribution = shouldUseMapTiler
    ? MAPTILER_ATTRIBUTION
    : OSM_ATTRIBUTION;
  const initialCenter = mapPoints[0] || [43.6532, -79.3832];

  const handleTileError = useCallback(() => {
    if (mapTilerKey && failedMapTilerKey !== mapTilerKey) {
      setFailedMapTilerKey(mapTilerKey);
    }
  }, [failedMapTilerKey, mapTilerKey]);

  return (
    <section className="results-map-panel" aria-labelledby="results-map-title">
      <div className="results-map-heading">
        <div>
          <h3 id="results-map-title">Results Map</h3>
          <p className="results-map-summary">
            {mappedListingCount} of {totalListings} listing
            {totalListings === 1 ? " is" : "s are"} shown on the map.
          </p>
          <p className="results-map-helper">
            Select a marker to highlight its listing card.
          </p>
        </div>
        <div
          className="results-map-legend"
          role="group"
          aria-label="Map marker legend"
        >
          <span>
            <i className="map-legend-marker listing" aria-hidden="true"></i>
            Listing
          </span>
          <span>
            <i className="map-legend-marker campus" aria-hidden="true">C</i>
            Campus
          </span>
        </div>
      </div>

      {missingLocationCount > 0 && (
        <p className="map-missing-location-note" role="status">
          {missingLocationCount} listing
          {missingLocationCount === 1 ? " does" : "s do"} not have location
          coordinates yet.
        </p>
      )}

      {!hasAnyMapCoordinates && (
        <div className="map-fallback-panel" role="status">
          <h4>Map unavailable</h4>
          <p>
            These results do not include location coordinates yet. You can
            still review the listing cards below.
          </p>
        </div>
      )}

      {hasAnyMapCoordinates && (
        <>
          {mappedListingCount === 0 && (
            <p className="map-missing-location-note" role="status">
              Listing locations are unavailable, so the map is centered on the
              selected campus.
            </p>
          )}

          <MapContainer
            center={initialCenter}
            className="listings-map"
            keyboard
            scrollWheelZoom={false}
            zoom={13}
          >
            <TileLayer
              key={tileUrl}
              attribution={tileAttribution}
              eventHandlers={{ tileerror: handleTileError }}
              url={tileUrl}
            />

            <MapBoundsController points={mapPoints} pointsKey={pointsKey} />
            <MapAccessibilityController label="Interactive map of filtered housing listings and selected campus" />
            <MapFocusController coordinates={activeMarker?.coordinates || null} />

            {campusCoordinates && (
              <Marker
                icon={campusIcon}
                position={campusCoordinates}
                title={`Selected campus: ${getCampusLabel(selectedCampus)}`}
              >
                <Tooltip direction="top" permanent>
                  Selected campus
                </Tooltip>
                <Popup>
                  <div className="map-popup">
                    <strong>{selectedCampus?.institution || "Selected campus"}</strong>
                    <span>{selectedCampus?.campusName || getCampusLabel(selectedCampus)}</span>
                    {selectedCampus?.address && <span>{selectedCampus.address}</span>}
                  </div>
                </Popup>
              </Marker>
            )}

            {listingMarkers.map(
              ({ coordinates, index, listing, listingId, markerLabel }) => {
                const isActive = listingId && listingId === activeListingId;

                return (
                  <Marker
                    key={listingId || `${getMapPointKey(coordinates)}-${index}`}
                    eventHandlers={{
                      click: () => {
                        if (listingId) {
                          onSelectListing?.(listingId);
                        }
                      },
                    }}
                    icon={isActive ? activeListingIcon : listingIcon}
                    position={coordinates}
                    title={`Housing listing: ${getListingTitle(listing)}`}
                    zIndexOffset={isActive ? 800 : 0}
                  >
                    <Tooltip
                      className="housing-map-tooltip"
                      direction="top"
                      permanent
                    >
                      {markerLabel}
                      {isActive ? " selected" : ""}
                    </Tooltip>
                    <Popup>
                      <div className="map-popup">
                        <strong>{getListingTitle(listing)}</strong>
                        <span>{formatRent(listing?.monthlyRent ?? listing?.rent)}</span>
                        <span>{getLocationLabel(listing)}</span>
                        {listingId && (
                          <button
                            type="button"
                            className="map-popup-button"
                            onClick={() => onOpenDetails?.(listingId)}
                          >
                            Details
                          </button>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              },
            )}
          </MapContainer>
        </>
      )}
    </section>
  );
}

export default ListingsMap;
