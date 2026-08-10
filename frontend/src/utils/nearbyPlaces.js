import { SEEDED_NEARBY_PLACES } from "../data/nearbyPlaces.js";
import {
  calculateHaversineDistanceKm,
  getValidCoordinates,
  isValidCoordinatePair,
} from "./mapCoordinates.js";
import { isNearbyPlaceCategory } from "./nearbyPlaceCategories.js";

export const NEARBY_SEARCH_RADIUS_KM = 2.5;

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const getNonNegativeNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) && number >= 0 ? number : null;
};

const getCoordinateNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
};

export const getNearbyPlaceCoordinates = (place) => {
  const coordinates = [
    getCoordinateNumber(place?.latitude),
    getCoordinateNumber(place?.longitude),
  ];

  return isValidCoordinatePair(coordinates) ? coordinates : null;
};

const toIdentityPart = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const getFallbackPlaceIdentity = (place, coordinates) =>
  [
    place.name,
    place.address,
    coordinates?.[0]?.toFixed(6),
    coordinates?.[1]?.toFixed(6),
  ]
    .map(toIdentityPart)
    .filter(Boolean)
    .join("-");

const normalizeNearbyPlace = (place, listingCoordinates) => {
  const name = normalizeText(place?.name);
  const category = normalizeText(place?.category);

  if (!name || !isNearbyPlaceCategory(category)) {
    return null;
  }

  const coordinates = getNearbyPlaceCoordinates(place);
  const calculatedDistance = coordinates
    ? calculateHaversineDistanceKm(listingCoordinates, coordinates)
    : null;
  const trustedDistance = getNonNegativeNumber(place?.distanceKm);
  const distanceKm = calculatedDistance ?? trustedDistance;

  if (distanceKm === null) {
    return null;
  }

  const storedIdentity = toIdentityPart(place?.id);
  const fallbackIdentity = getFallbackPlaceIdentity(place, coordinates);
  const placeIdentity = storedIdentity || fallbackIdentity;

  if (!placeIdentity) {
    return null;
  }

  return {
    id: `seeded-${placeIdentity}`,
    name,
    category,
    distanceKm,
    address: normalizeText(place?.address) || null,
    latitude: coordinates?.[0] ?? null,
    longitude: coordinates?.[1] ?? null,
  };
};

export const deduplicateNearbyPlaces = (places) => {
  const uniquePlaces = new Map();

  places.forEach((place) => {
    if (place?.id && !uniquePlaces.has(place.id)) {
      uniquePlaces.set(place.id, place);
    }
  });

  return [...uniquePlaces.values()];
};

export const normalizeNearbyPlaces = (
  places,
  listing,
  { radiusKm = NEARBY_SEARCH_RADIUS_KM } = {},
) => {
  const listingCoordinates = getValidCoordinates(listing);

  if (!listingCoordinates || !Array.isArray(places)) {
    return [];
  }

  const requestedRadiusKm = getNonNegativeNumber(radiusKm);
  if (requestedRadiusKm === null) {
    return [];
  }

  const normalizedPlaces = places
    .map((place) => normalizeNearbyPlace(place, listingCoordinates))
    .filter(
      (place) => place && place.distanceKm <= requestedRadiusKm,
    );

  return deduplicateNearbyPlaces(normalizedPlaces).sort(
    (firstPlace, secondPlace) =>
      firstPlace.distanceKm - secondPlace.distanceKm ||
      firstPlace.name.localeCompare(secondPlace.name, "en-CA"),
  );
};

export const loadSeededNearbyPlaces = async (listing) => {
  const listingCoordinates = getValidCoordinates(listing);

  if (!listingCoordinates) {
    return [];
  }

  return normalizeNearbyPlaces(SEEDED_NEARBY_PLACES, listing);
};
