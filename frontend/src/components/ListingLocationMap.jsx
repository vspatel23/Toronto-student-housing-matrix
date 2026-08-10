import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import { getCampusLabel } from "../utils/campusFormatters";
import {
  calculateHaversineDistanceKm,
  getValidCoordinates,
} from "../utils/mapCoordinates";
import {
  createCampusIcon,
  createListingIcon,
  getMapPointKey,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
} from "../utils/mapPresentation";
import {
  getListingTitle,
  getLocationLabel,
} from "../utils/listingFormatters";
import MapAccessibilityController from "./MapAccessibilityController";
import MapBoundsController from "./MapBoundsController";

const TILE_LOAD_TIMEOUT_MS = 12000;

const getAddress = (entity) =>
  typeof entity?.address === "string" ? entity.address.trim() : "";

function ListingLocationMap({ listing, selectedCampus }) {
  const [providerResult, setProviderResult] = useState({
    attemptKey: "",
    hasLoadedPreviousArea: false,
    status: "loading",
  });
  const [retryAttempt, setRetryAttempt] = useState(0);
  const mapRegion = useRef(null);
  const tileActivity = useRef({
    attemptKey: "",
    batchErrors: 0,
    batchPending: false,
    batchSuccesses: 0,
    hasEverLoaded: false,
  });
  const tileTimeout = useRef(null);
  const listingCoordinates = getValidCoordinates(listing);
  const hasListingCoordinates = Boolean(listingCoordinates);
  const campusCoordinates = getValidCoordinates(selectedCampus);
  const markersAreNearby =
    campusCoordinates &&
    calculateHaversineDistanceKm(listingCoordinates, campusCoordinates) <= 0.02;
  const listingIcon = useMemo(
    () =>
      createListingIcon(
        false,
        markersAreNearby ? { horizontalOffset: 18 } : undefined,
      ),
    [markersAreNearby],
  );
  const campusIcon = useMemo(
    () =>
      createCampusIcon(
        markersAreNearby ? { horizontalOffset: -18 } : undefined,
      ),
    [markersAreNearby],
  );
  const mapPoints = useMemo(
    () => [listingCoordinates, campusCoordinates].filter(Boolean),
    [campusCoordinates, listingCoordinates],
  );
  const pointsKey = mapPoints.map(getMapPointKey).join("|");
  const listingKey = listing?._id || listing?.id || getListingTitle(listing);
  const mapRequestKey = `${listingKey}|${pointsKey}`;
  const tileAttemptKey = `${mapRequestKey}-${retryAttempt}`;
  const activeTileAttemptKey = useRef(tileAttemptKey);

  useLayoutEffect(() => {
    activeTileAttemptKey.current = tileAttemptKey;
  }, [tileAttemptKey]);

  const providerStatus =
    providerResult.attemptKey === tileAttemptKey
      ? providerResult.status
    : "loading";
  const hasLoadedPreviousArea =
    providerResult.attemptKey === tileAttemptKey &&
    providerResult.hasLoadedPreviousArea;
  const campusName = selectedCampus ? getCampusLabel(selectedCampus) : "";
  const mapLabel = campusCoordinates
    ? "Map showing listing and selected campus"
    : "Map showing listing location";

  const clearTileTimeout = useCallback(() => {
    if (tileTimeout.current !== null) {
      window.clearTimeout(tileTimeout.current);
      tileTimeout.current = null;
    }
  }, []);

  const armTileTimeout = useCallback((attemptKey) => {
    clearTileTimeout();
    tileTimeout.current = window.setTimeout(() => {
      tileTimeout.current = null;

      if (
        tileActivity.current.attemptKey === attemptKey &&
        tileActivity.current.batchPending
      ) {
        setProviderResult({
          attemptKey,
          hasLoadedPreviousArea: tileActivity.current.hasEverLoaded,
          status: "error",
        });
      }
    }, TILE_LOAD_TIMEOUT_MS);
  }, [clearTileTimeout]);

  const prepareTileAttempt = useCallback((attemptKey) => {
    if (tileActivity.current.attemptKey === attemptKey) {
      if (tileActivity.current.batchPending && tileTimeout.current === null) {
        armTileTimeout(attemptKey);
      }

      return tileActivity.current;
    }

    tileActivity.current = {
      attemptKey,
      batchErrors: 0,
      batchPending: true,
      batchSuccesses: 0,
      hasEverLoaded: false,
    };
    armTileTimeout(attemptKey);
    return tileActivity.current;
  }, [armTileTimeout]);

  useEffect(() => {
    if (!hasListingCoordinates) {
      clearTileTimeout();
      return undefined;
    }

    prepareTileAttempt(tileAttemptKey);
    return () => {
      if (tileActivity.current.attemptKey === tileAttemptKey) {
        clearTileTimeout();
      }
    };
  }, [
    clearTileTimeout,
    hasListingCoordinates,
    prepareTileAttempt,
    tileAttemptKey,
  ]);

  const handleTileLoading = useCallback(() => {
    if (activeTileAttemptKey.current !== tileAttemptKey) {
      return;
    }

    const activity = prepareTileAttempt(tileAttemptKey);
    activity.batchErrors = 0;
    activity.batchPending = true;
    activity.batchSuccesses = 0;
    armTileTimeout(tileAttemptKey);
    setProviderResult({
      attemptKey: tileAttemptKey,
      hasLoadedPreviousArea: activity.hasEverLoaded,
      status: "loading",
    });
  }, [armTileTimeout, prepareTileAttempt, tileAttemptKey]);

  const handleTileLoad = useCallback(() => {
    if (
      activeTileAttemptKey.current === tileAttemptKey &&
      tileActivity.current.attemptKey === tileAttemptKey &&
      tileActivity.current.batchPending
    ) {
      tileActivity.current.batchSuccesses += 1;
    }
  }, [tileAttemptKey]);

  const handleTileError = useCallback(() => {
    if (
      activeTileAttemptKey.current === tileAttemptKey &&
      tileActivity.current.attemptKey === tileAttemptKey &&
      tileActivity.current.batchPending
    ) {
      tileActivity.current.batchErrors += 1;
    }
  }, [tileAttemptKey]);

  const handleLayerLoad = useCallback(() => {
    const activity = tileActivity.current;

    if (
      activeTileAttemptKey.current !== tileAttemptKey ||
      activity.attemptKey !== tileAttemptKey ||
      !activity.batchPending
    ) {
      return;
    }

    activity.batchPending = false;
    clearTileTimeout();

    if (activity.batchSuccesses > 0 || activity.batchErrors === 0) {
      activity.hasEverLoaded = true;
      setProviderResult({
        attemptKey: tileAttemptKey,
        hasLoadedPreviousArea: true,
        status: "ready",
      });
      return;
    }

    setProviderResult({
      attemptKey: tileAttemptKey,
      hasLoadedPreviousArea: activity.hasEverLoaded,
      status: "error",
    });
  }, [clearTileTimeout, tileAttemptKey]);

  const handleRetry = () => {
    const mapContainer = mapRegion.current?.querySelector(
      ".listing-location-map",
    );
    mapContainer?.focus();
    setRetryAttempt((attempt) => attempt + 1);
  };

  if (!listingCoordinates) {
    return null;
  }

  return (
    <div ref={mapRegion} className="listing-location-map-region">
      {providerStatus === "loading" && (
        <p className="listing-location-provider-loading" role="status">
          Loading map tiles…
        </p>
      )}

      <MapContainer
        center={listingCoordinates}
        className="listing-location-map"
        keyboard
        scrollWheelZoom={false}
        zoom={14}
      >
        <TileLayer
          key={tileAttemptKey}
          attribution={OSM_ATTRIBUTION}
          eventHandlers={{
            load: handleLayerLoad,
            loading: handleTileLoading,
            tileerror: handleTileError,
            tileload: handleTileLoad,
          }}
          url={OSM_TILE_URL}
        />

        <MapBoundsController points={mapPoints} pointsKey={pointsKey} />
        <MapAccessibilityController
          label={mapLabel}
          isBusy={providerStatus === "loading"}
        />

        <Marker
          icon={listingIcon}
          position={listingCoordinates}
          title={`Housing listing: ${getListingTitle(listing)}`}
          zIndexOffset={markersAreNearby ? 500 : 0}
        >
          <Tooltip className="housing-map-tooltip" direction="bottom" permanent>
            Listing
          </Tooltip>
          <Popup>
            <div className="map-popup">
              <strong>{getListingTitle(listing)}</strong>
              <span>{getAddress(listing) || getLocationLabel(listing)}</span>
            </div>
          </Popup>
        </Marker>

        {campusCoordinates && (
          <Marker
            icon={campusIcon}
            position={campusCoordinates}
            title={`Selected campus: ${campusName}`}
            zIndexOffset={markersAreNearby ? 600 : 0}
          >
            <Tooltip direction="top" permanent>
              Campus
            </Tooltip>
            <Popup>
              <div className="map-popup">
                <strong>{campusName}</strong>
                {getAddress(selectedCampus) && (
                  <span>{getAddress(selectedCampus)}</span>
                )}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {providerStatus === "error" && (
        <div
          className="map-fallback-panel listing-location-provider-error"
          role="alert"
        >
          <h3>
            {hasLoadedPreviousArea
              ? "The current map area could not be loaded"
              : "The map could not be loaded"}
          </h3>
          <p>
            {hasLoadedPreviousArea
              ? "Previously loaded map areas remain available. Retry this area, or use Open Directions below when available."
              : "Listing details are still available. Retry the map, or use Open Directions below when destination information is available."}
          </p>
          <button
            className="secondary-button listing-map-retry-button"
            type="button"
            onClick={handleRetry}
          >
            Retry map
          </button>
        </div>
      )}
    </div>
  );
}

export default ListingLocationMap;
