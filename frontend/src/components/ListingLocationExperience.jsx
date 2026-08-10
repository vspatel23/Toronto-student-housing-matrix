import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getValidCoordinates } from "../utils/mapCoordinates";
import { loadSeededNearbyPlaces } from "../utils/nearbyPlaces";
import { getListingId, getListingTitle } from "../utils/listingFormatters";
import ListingLocationSection from "./ListingLocationSection";
import NearbyStudentEssentials from "./NearbyStudentEssentials";

export const INITIAL_NEARBY_PLACE_LIMIT = 6;

const DEFAULT_CATEGORY = "all";
const DEFAULT_SORT_ORDER = "nearest";

const createDefaultViewState = (requestKey) => ({
  requestKey,
  activeCategory: DEFAULT_CATEGORY,
  sortOrder: DEFAULT_SORT_ORDER,
  visiblePlaceCount: INITIAL_NEARBY_PLACE_LIMIT,
  selectedPlaceId: "",
  selectionSource: "",
});

const getUniquePlaces = (places) => {
  if (!Array.isArray(places)) {
    throw new TypeError("Nearby places must be returned as an array.");
  }

  const seenPlaceIds = new Set();

  return places.filter((place) => {
    const placeId =
      place?.id === null || place?.id === undefined
        ? ""
        : String(place.id).trim();

    if (!placeId || seenPlaceIds.has(placeId)) {
      return false;
    }

    seenPlaceIds.add(placeId);
    return true;
  });
};

const comparePlacesByDistance = (sortOrder) => (firstPlace, secondPlace) => {
  const firstDistance = Number(firstPlace.distanceKm);
  const secondDistance = Number(secondPlace.distanceKm);
  const firstHasDistance = Number.isFinite(firstDistance);
  const secondHasDistance = Number.isFinite(secondDistance);

  if (firstHasDistance !== secondHasDistance) {
    return firstHasDistance ? -1 : 1;
  }

  if (firstHasDistance && firstDistance !== secondDistance) {
    return sortOrder === "farthest"
      ? secondDistance - firstDistance
      : firstDistance - secondDistance;
  }

  return String(firstPlace.id).localeCompare(String(secondPlace.id));
};

function ListingLocationExperience({
  listing,
  campus,
  selectedCampus,
  isLoadingCampus = false,
  campusError = "",
  loadNearbyPlaces = loadSeededNearbyPlaces,
}) {
  const [loadState, setLoadState] = useState({
    requestKey: "",
    status: "loading",
    places: [],
  });
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [viewState, setViewState] = useState(() =>
    createDefaultViewState(""),
  );
  const [markerFocusRequest, setMarkerFocusRequest] = useState(0);
  const placeItemRefs = useRef(new Map());
  const listingRef = useRef(listing);
  const listingCoordinates = getValidCoordinates(listing);
  const listingIdentity =
    getListingId(listing) || getListingTitle(listing) || "listing";
  const listingRequestKey = `${listingIdentity}|${
    listingCoordinates ? listingCoordinates.join(",") : "missing-coordinates"
  }`;
  const hasListingCoordinates = Boolean(listingCoordinates);
  const loadRequestKey = `${listingRequestKey}|attempt-${retryAttempt}`;
  const currentViewState =
    viewState.requestKey === listingRequestKey
      ? viewState
      : createDefaultViewState(listingRequestKey);
  const {
    activeCategory,
    sortOrder,
    visiblePlaceCount,
    selectedPlaceId,
    selectionSource,
  } = currentViewState;

  useEffect(() => {
    listingRef.current = listing;
  }, [listing]);

  useEffect(() => {
    if (!hasListingCoordinates) {
      return undefined;
    }

    let isStale = false;

    Promise.resolve()
      .then(() => loadNearbyPlaces(listingRef.current))
      .then((places) => {
        if (isStale) {
          return;
        }

        setLoadState({
          requestKey: loadRequestKey,
          status: "ready",
          places: getUniquePlaces(places),
        });
      })
      .catch(() => {
        if (isStale) {
          return;
        }

        setViewState(createDefaultViewState(listingRequestKey));
        setLoadState({
          requestKey: loadRequestKey,
          status: "error",
          places: [],
        });
      });

    return () => {
      isStale = true;
    };
  }, [
    hasListingCoordinates,
    listingRequestKey,
    loadRequestKey,
    loadNearbyPlaces,
    retryAttempt,
  ]);

  const currentLoadState = !hasListingCoordinates
    ? { status: "unavailable", places: [] }
    : loadState.requestKey === loadRequestKey
      ? loadState
      : { status: "loading", places: [] };

  const filteredAndSortedPlaces = useMemo(() => {
    const filteredPlaces =
      activeCategory === DEFAULT_CATEGORY
        ? currentLoadState.places
        : currentLoadState.places.filter(
            (place) => place.category === activeCategory,
          );

    return [...filteredPlaces].sort(comparePlacesByDistance(sortOrder));
  }, [activeCategory, currentLoadState.places, sortOrder]);

  const visiblePlaces = useMemo(
    () => filteredAndSortedPlaces.slice(0, visiblePlaceCount),
    [filteredAndSortedPlaces, visiblePlaceCount],
  );

  const registerPlaceItem = useCallback((placeId, node) => {
    if (node) {
      placeItemRefs.current.set(placeId, node);
    } else {
      placeItemRefs.current.delete(placeId);
    }
  }, []);

  const handleCategoryChange = useCallback((categoryId) => {
    setViewState({
      ...createDefaultViewState(listingRequestKey),
      activeCategory: categoryId,
      sortOrder,
    });
  }, [listingRequestKey, sortOrder]);

  const handleSortOrderChange = useCallback((nextSortOrder) => {
    setViewState({
      ...createDefaultViewState(listingRequestKey),
      activeCategory,
      sortOrder: nextSortOrder,
    });
  }, [activeCategory, listingRequestKey]);

  const handleSelectPlace = useCallback(
    (placeId, { source = "list" } = {}) => {
      const normalizedPlaceId =
        placeId === null || placeId === undefined
          ? ""
          : String(placeId).trim();

      if (!normalizedPlaceId) {
        return;
      }

      const normalizedSource = source === "marker" ? "marker" : "list";

      if (normalizedSource === "marker") {
        const placeIndex = filteredAndSortedPlaces.findIndex(
          (place) => place.id === normalizedPlaceId,
        );

        setMarkerFocusRequest((request) => request + 1);

        setViewState((currentState) => {
          const activeState =
            currentState.requestKey === listingRequestKey
              ? currentState
              : createDefaultViewState(listingRequestKey);

          return {
            ...activeState,
            visiblePlaceCount:
              placeIndex >= 0
                ? Math.max(activeState.visiblePlaceCount, placeIndex + 1)
                : activeState.visiblePlaceCount,
            selectedPlaceId: normalizedPlaceId,
            selectionSource: normalizedSource,
          };
        });

        return;
      }

      setViewState((currentState) => ({
        ...(currentState.requestKey === listingRequestKey
          ? currentState
          : createDefaultViewState(listingRequestKey)),
        selectedPlaceId: normalizedPlaceId,
        selectionSource: normalizedSource,
      }));
    },
    [filteredAndSortedPlaces, listingRequestKey],
  );

  useEffect(() => {
    if (selectionSource !== "marker" || !selectedPlaceId) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      const placeItem = placeItemRefs.current.get(selectedPlaceId);

      if (!placeItem) {
        return;
      }

      placeItem.focus({ preventScroll: true });
      placeItem.scrollIntoView?.({ block: "nearest", behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [markerFocusRequest, selectedPlaceId, selectionSource]);

  const handleShowMore = useCallback(() => {
    setViewState((currentState) => {
      const activeState =
        currentState.requestKey === listingRequestKey
          ? currentState
          : createDefaultViewState(listingRequestKey);

      return {
        ...activeState,
        visiblePlaceCount: Math.min(
          activeState.visiblePlaceCount + INITIAL_NEARBY_PLACE_LIMIT,
          filteredAndSortedPlaces.length,
        ),
      };
    });
  }, [filteredAndSortedPlaces.length, listingRequestKey]);

  const handleRetry = useCallback(() => {
    setRetryAttempt((attempt) => attempt + 1);
  }, []);

  return (
    <>
      <ListingLocationSection
        listing={listing}
        campus={campus}
        selectedCampus={selectedCampus}
        isLoadingCampus={isLoadingCampus}
        campusError={campusError}
        nearbyPlaces={
          currentLoadState.status === "ready" ? filteredAndSortedPlaces : []
        }
        selectedPlaceId={selectedPlaceId}
        onSelectNearbyPlace={handleSelectPlace}
      />

      <NearbyStudentEssentials
        status={currentLoadState.status}
        places={visiblePlaces}
        totalPlaceCount={currentLoadState.places.length}
        filteredPlaceCount={filteredAndSortedPlaces.length}
        activeCategory={activeCategory}
        sortOrder={sortOrder}
        selectedPlaceId={selectedPlaceId}
        hasMorePlaces={visiblePlaces.length < filteredAndSortedPlaces.length}
        onCategoryChange={handleCategoryChange}
        onSortOrderChange={handleSortOrderChange}
        onSelectPlace={handleSelectPlace}
        onShowMore={handleShowMore}
        onRetry={handleRetry}
        registerPlaceItem={registerPlaceItem}
      />
    </>
  );
}

export default ListingLocationExperience;
