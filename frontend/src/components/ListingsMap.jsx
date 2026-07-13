import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { getCampusLabel } from "../utils/campusFormatters";
import {
  getSafeListingMarkerLabel,
  getValidCoordinates,
} from "../utils/mapCoordinates";
import {
  formatRent,
  getListingId,
  getListingTitle,
  getLocationLabel,
} from "../utils/listingFormatters";

const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
const MAPTILER_ATTRIBUTION =
  '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

const createListingIcon = (isActive = false) =>
  L.divIcon({
    className: `housing-map-marker${isActive ? " active" : ""}`,
    html: '<span aria-hidden="true"></span>',
    iconAnchor: isActive ? [17, 17] : [14, 14],
    iconSize: isActive ? [34, 34] : [28, 28],
    popupAnchor: [0, -18],
    tooltipAnchor: [0, -18],
  });

const createCampusIcon = () =>
  L.divIcon({
    className: "campus-map-marker",
    html: '<span aria-hidden="true">▥</span>',
    iconAnchor: [18, 18],
    iconSize: [36, 36],
    popupAnchor: [0, -20],
    tooltipAnchor: [0, -20],
  });

const getPointKey = (point) => `${point[0].toFixed(6)},${point[1].toFixed(6)}`;

function FitMapToLocations({ points, pointsKey }) {
  const map = useMap();
  const lastFitKey = useRef("");

  useEffect(() => {
    if (lastFitKey.current === pointsKey || points.length === 0) {
      return;
    }

    lastFitKey.current = pointsKey;

    if (points.length === 1) {
      map.setView(points[0], 14, { animate: false });
      return;
    }

    const bounds = L.latLngBounds(points);

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [35, 35],
        maxZoom: 15,
        animate: false,
      });
    }
  }, [map, points, pointsKey]);

  return null;
}

function FocusActiveMarker({ coordinates }) {
  const map = useMap();
  const lastFocusedKey = useRef("");

  useEffect(() => {
    if (!coordinates) {
      lastFocusedKey.current = "";
      return;
    }

    const activeKey = getPointKey(coordinates);

    if (lastFocusedKey.current === activeKey) {
      return;
    }

    lastFocusedKey.current = activeKey;

    const activePoint = L.latLng(coordinates);
    const visibleBounds = map.getBounds().pad(-0.18);

    if (!visibleBounds.contains(activePoint)) {
      map.panTo(activePoint, {
        animate: true,
        duration: 0.45,
      });
    }
  }, [coordinates, map]);

  return null;
}

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
  const pointsKey = mapPoints.map(getPointKey).join("|");
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
            aria-label="Interactive map of filtered housing listings and selected campus"
            center={initialCenter}
            className="listings-map"
            scrollWheelZoom={false}
            zoom={13}
          >
            <TileLayer
              key={tileUrl}
              attribution={tileAttribution}
              eventHandlers={{ tileerror: handleTileError }}
              url={tileUrl}
            />

            <FitMapToLocations points={mapPoints} pointsKey={pointsKey} />
            <FocusActiveMarker coordinates={activeMarker?.coordinates || null} />

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
                    key={listingId || `${getPointKey(coordinates)}-${index}`}
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
