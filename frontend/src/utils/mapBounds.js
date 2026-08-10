import L from "leaflet";
import { getMapPointKey } from "./mapPresentation";

const DEFAULT_PADDING = [35, 35];

const getUniquePoints = (points) =>
  Array.from(
    new Map(points.map((point) => [getMapPointKey(point), point])).values(),
  );

export const fitMapToLocations = (
  map,
  points,
  {
    padding = DEFAULT_PADDING,
    maxZoom = 15,
    singlePointZoom = 14,
    nearbyThresholdMeters = 10,
  } = {},
) => {
  const uniquePoints = getUniquePoints(points);

  if (uniquePoints.length === 0) {
    return;
  }

  if (uniquePoints.length === 1) {
    map.setView(uniquePoints[0], singlePointZoom, { animate: false });
    return;
  }

  const firstPoint = L.latLng(uniquePoints[0]);
  const allPointsAreNearby = uniquePoints.every(
    (point) => firstPoint.distanceTo(L.latLng(point)) <= nearbyThresholdMeters,
  );

  if (allPointsAreNearby) {
    map.setView(uniquePoints[0], maxZoom, { animate: false });
    return;
  }

  const bounds = L.latLngBounds(uniquePoints);

  if (bounds.isValid()) {
    map.fitBounds(bounds, {
      padding,
      maxZoom,
      animate: false,
    });
  }
};
