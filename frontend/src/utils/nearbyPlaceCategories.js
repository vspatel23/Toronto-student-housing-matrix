export const NEARBY_PLACE_CATEGORY_IDS = Object.freeze({
  TRANSIT: "transit",
  GROCERY: "grocery",
  PHARMACY: "pharmacy",
  LIBRARY: "library",
  PARK: "park",
  GYM: "gym",
  CLINIC: "clinic",
  CAMPUS: "campus",
});

export const NEARBY_PLACE_CATEGORIES = Object.freeze(
  [
    {
      id: NEARBY_PLACE_CATEGORY_IDS.TRANSIT,
      label: "Public Transit",
      markerGlyph: "🚇",
    },
    {
      id: NEARBY_PLACE_CATEGORY_IDS.GROCERY,
      label: "Grocery Stores",
      markerGlyph: "🛒",
    },
    {
      id: NEARBY_PLACE_CATEGORY_IDS.PHARMACY,
      label: "Pharmacies",
      markerGlyph: "Rx",
    },
    {
      id: NEARBY_PLACE_CATEGORY_IDS.LIBRARY,
      label: "Libraries",
      markerGlyph: "📚",
    },
    {
      id: NEARBY_PLACE_CATEGORY_IDS.PARK,
      label: "Parks",
      markerGlyph: "🌳",
    },
    {
      id: NEARBY_PLACE_CATEGORY_IDS.GYM,
      label: "Gyms",
      markerGlyph: "🏋",
    },
    {
      id: NEARBY_PLACE_CATEGORY_IDS.CLINIC,
      label: "Clinics",
      markerGlyph: "✚",
    },
    {
      id: NEARBY_PLACE_CATEGORY_IDS.CAMPUS,
      label: "Campus Locations",
      markerGlyph: "🎓",
    },
  ].map((category) => Object.freeze(category)),
);

const nearbyPlaceCategoryById = new Map(
  NEARBY_PLACE_CATEGORIES.map((category) => [category.id, category]),
);

export const isNearbyPlaceCategory = (categoryId) =>
  nearbyPlaceCategoryById.has(categoryId);

export const getNearbyPlaceCategory = (categoryId) =>
  nearbyPlaceCategoryById.get(categoryId) || null;

export const getNearbyPlaceCategoryLabel = (categoryId) =>
  getNearbyPlaceCategory(categoryId)?.label || "Nearby place";

export const getNearbyPlaceCategoryMarkerGlyph = (categoryId) =>
  getNearbyPlaceCategory(categoryId)?.markerGlyph || "•";
