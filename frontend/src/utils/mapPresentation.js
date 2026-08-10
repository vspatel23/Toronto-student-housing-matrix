import L from "leaflet";

export const OSM_TILE_URL =
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
export const MAPTILER_ATTRIBUTION =
  '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

export const createListingIcon = (
  isActive = false,
  { horizontalOffset = 0 } = {},
) => {
  const markerRadius = isActive ? 17 : 14;

  return L.divIcon({
    className: `housing-map-marker${isActive ? " active" : ""}`,
    html: '<span aria-hidden="true"></span>',
    iconAnchor: [markerRadius + horizontalOffset, markerRadius],
    iconSize: isActive ? [34, 34] : [28, 28],
    popupAnchor: [-horizontalOffset, -18],
    tooltipAnchor: [-horizontalOffset, -18],
  });
};

export const createCampusIcon = ({ horizontalOffset = 0 } = {}) =>
  L.divIcon({
    className: "campus-map-marker",
    html: '<span aria-hidden="true">C</span>',
    iconAnchor: [18 + horizontalOffset, 18],
    iconSize: [36, 36],
    popupAnchor: [-horizontalOffset, -20],
    tooltipAnchor: [-horizontalOffset, -20],
  });

const escapeMarkerGlyph = (glyph) =>
  String(glyph || "E")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export const createNearbyPlaceIcon = (markerGlyph, isActive = false) => {
  const markerSize = isActive ? 34 : 30;

  return L.divIcon({
    className: `nearby-place-map-marker${isActive ? " active" : ""}`,
    html: `<span aria-hidden="true">${escapeMarkerGlyph(markerGlyph)}</span>`,
    iconAnchor: [markerSize / 2, markerSize / 2],
    iconSize: [markerSize, markerSize],
    popupAnchor: [0, -(markerSize / 2 + 3)],
    tooltipAnchor: [0, -(markerSize / 2 + 3)],
  });
};

export const getMapPointKey = (point) =>
  `${point[0].toFixed(6)},${point[1].toFixed(6)}`;
