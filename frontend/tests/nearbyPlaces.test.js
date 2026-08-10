import test from "node:test";
import assert from "node:assert/strict";

import {
  NEARBY_PLACE_CATEGORIES,
  NEARBY_PLACE_CATEGORY_IDS,
  getNearbyPlaceCategoryLabel,
  getNearbyPlaceCategoryMarkerGlyph,
  isNearbyPlaceCategory,
} from "../src/utils/nearbyPlaceCategories.js";
import {
  NEARBY_SEARCH_RADIUS_KM,
  getNearbyPlaceCoordinates,
  loadSeededNearbyPlaces,
  normalizeNearbyPlaces,
} from "../src/utils/nearbyPlaces.js";
import { calculateHaversineDistanceKm } from "../src/utils/mapCoordinates.js";

const listing = {
  _id: "listing-022",
  address: "184 Jarvis Street, Toronto, ON",
  neighborhood: "Downtown Toronto",
  location: { lat: 43.6567, lng: -79.3749 },
  nearestTransit: { name: "Dundas Station", walkMinutes: 8 },
};

test("defines the eight supported categories with labels and marker glyphs", () => {
  assert.deepEqual(
    NEARBY_PLACE_CATEGORIES.map(({ id }) => id),
    [
      "transit",
      "grocery",
      "pharmacy",
      "library",
      "park",
      "gym",
      "clinic",
      "campus",
    ],
  );

  NEARBY_PLACE_CATEGORIES.forEach(({ id, label, markerGlyph }) => {
    assert.equal(isNearbyPlaceCategory(id), true);
    assert.ok(label.length > 0);
    assert.ok(markerGlyph.length > 0);
    assert.equal(getNearbyPlaceCategoryLabel(id), label);
    assert.equal(getNearbyPlaceCategoryMarkerGlyph(id), markerGlyph);
  });
});

test("returns deterministic seeded places for a coordinate-backed listing", async () => {
  const firstLoad = await loadSeededNearbyPlaces(listing);
  const secondLoad = await loadSeededNearbyPlaces({ ...listing });

  assert.ok(firstLoad.length > 6);
  assert.deepEqual(firstLoad, secondLoad);
  assert.equal(
    firstLoad.some((place) => place.name === "Metro"),
    true,
  );
  assert.equal(
    firstLoad.some(
      (place) => place.name === "Toronto Metropolitan University",
    ),
    true,
  );
  assert.equal(
    firstLoad.every((place) => place.distanceKm <= NEARBY_SEARCH_RADIUS_KM),
    true,
  );
});

test("keeps fixed place coordinates when the listing location changes", async () => {
  const otherListing = {
    ...listing,
    _id: "listing-009",
    location: { lat: 43.6603, lng: -79.3789 },
  };
  const firstMetro = (await loadSeededNearbyPlaces(listing)).find(
    (place) => place.name === "Metro",
  );
  const secondMetro = (await loadSeededNearbyPlaces(otherListing)).find(
    (place) => place.name === "Metro",
  );

  assert.ok(firstMetro);
  assert.ok(secondMetro);
  assert.equal(firstMetro.id, secondMetro.id);
  assert.equal(firstMetro.latitude, secondMetro.latitude);
  assert.equal(firstMetro.longitude, secondMetro.longitude);
  assert.notEqual(firstMetro.distanceKm, secondMetro.distanceKm);
});

test("normalizes every required field without leaking template fields", async () => {
  const places = await loadSeededNearbyPlaces(listing);

  places.forEach((place) => {
    assert.deepEqual(Object.keys(place), [
      "id",
      "name",
      "category",
      "distanceKm",
      "address",
      "latitude",
      "longitude",
    ]);
    assert.equal(typeof place.id, "string");
    assert.ok(place.id.length > 0);
    assert.equal(typeof place.name, "string");
    assert.equal(isNearbyPlaceCategory(place.category), true);
    assert.equal(typeof place.distanceKm, "number");
    assert.equal(Number.isFinite(place.distanceKm), true);
    assert.equal(place.address === null || typeof place.address === "string", true);
    assert.equal(
      place.latitude === null || Number.isFinite(place.latitude),
      true,
    );
    assert.equal(
      place.longitude === null || Number.isFinite(place.longitude),
      true,
    );
  });
});

test("calculates coordinate-backed distances with the shared Haversine helper", async () => {
  const places = await loadSeededNearbyPlaces(listing);
  const grocery = places.find((place) => place.name === "Metro");
  const expectedDistance = calculateHaversineDistanceKm(
    [listing.location.lat, listing.location.lng],
    getNearbyPlaceCoordinates(grocery),
  );

  assert.ok(grocery);
  assert.ok(Math.abs(grocery.distanceKm - expectedDistance) < Number.EPSILON);
});

test("filters places beyond the named search radius", () => {
  const places = normalizeNearbyPlaces(
    [
      {
        id: "inside",
        name: "Inside Radius",
        category: NEARBY_PLACE_CATEGORY_IDS.PARK,
        latitude: 43.657,
        longitude: -79.3749,
      },
      {
        id: "outside",
        name: "Outside Radius",
        category: NEARBY_PLACE_CATEGORY_IDS.PARK,
        latitude: 43.6867,
        longitude: -79.3749,
      },
    ],
    listing,
  );

  assert.equal(NEARBY_SEARCH_RADIUS_KM, 2.5);
  assert.deepEqual(places.map(({ name }) => name), ["Inside Radius"]);
});

test("returns no seeded places when listing coordinates are unavailable", async () => {
  assert.deepEqual(await loadSeededNearbyPlaces({ ...listing, location: null }), []);
  assert.deepEqual(
    await loadSeededNearbyPlaces({
      ...listing,
      location: { lat: "not-a-coordinate", lng: -79.3749 },
    }),
    [],
  );
});

test("deduplicates stable and fallback identities across category overlap", () => {
  const sharedCoordinate = {
    latitude: 43.657,
    longitude: -79.375,
  };
  const places = normalizeNearbyPlaces(
    [
      {
        id: "provider-place-1",
        name: "First Stable Place",
        category: NEARBY_PLACE_CATEGORY_IDS.LIBRARY,
        ...sharedCoordinate,
      },
      {
        id: "provider-place-1",
        name: "Duplicate Stable Place",
        category: NEARBY_PLACE_CATEGORY_IDS.PARK,
        ...sharedCoordinate,
      },
      {
        name: "Fallback Pharmacy",
        category: NEARBY_PLACE_CATEGORY_IDS.GROCERY,
        address: "Downtown Toronto, ON",
        distanceKm: 0.6,
      },
      {
        name: "Fallback Pharmacy",
        category: NEARBY_PLACE_CATEGORY_IDS.PHARMACY,
        address: "Downtown Toronto, ON",
        distanceKm: 0.6,
      },
    ],
    listing,
  );

  assert.equal(places.length, 2);
  assert.equal(
    places.filter((place) => place.name.includes("Stable Place")).length,
    1,
  );
  assert.equal(
    places.filter((place) => place.name === "Fallback Pharmacy").length,
    1,
  );
});

test("seeded results cover every supported category", async () => {
  const places = await loadSeededNearbyPlaces(listing);
  const returnedCategories = [...new Set(places.map(({ category }) => category))].sort();
  const supportedCategories = Object.values(NEARBY_PLACE_CATEGORY_IDS).sort();

  assert.deepEqual(returnedCategories, supportedCategories);
});

test("retains a coordinate-free place only with a trusted numeric distance", () => {
  const places = normalizeNearbyPlaces(
    [
      {
        id: "trusted-distance",
        name: "Campus Service Desk",
        category: NEARBY_PLACE_CATEGORY_IDS.CAMPUS,
        distanceKm: "1.3",
      },
      {
        id: "unknown-distance",
        name: "Unknown Location",
        category: NEARBY_PLACE_CATEGORY_IDS.CAMPUS,
      },
    ],
    listing,
  );

  assert.equal(places.length, 1);
  assert.equal(places[0].name, "Campus Service Desk");
  assert.equal(places[0].distanceKm, 1.3);
  assert.equal(places[0].latitude, null);
  assert.equal(places[0].longitude, null);
  assert.equal(getNearbyPlaceCoordinates(places[0]), null);
});

test("sorts the normalized result set by numeric distance nearest first", () => {
  const places = normalizeNearbyPlaces(
    [
      {
        id: "far",
        name: "Far Place",
        category: NEARBY_PLACE_CATEGORY_IDS.GYM,
        distanceKm: "2.0",
      },
      {
        id: "nearest",
        name: "Nearest Place",
        category: NEARBY_PLACE_CATEGORY_IDS.GYM,
        distanceKm: 0.4,
      },
      {
        id: "middle",
        name: "Middle Place",
        category: NEARBY_PLACE_CATEGORY_IDS.GYM,
        distanceKm: 1.25,
      },
    ],
    listing,
  );

  assert.deepEqual(
    places.map(({ name }) => name),
    ["Nearest Place", "Middle Place", "Far Place"],
  );
  assert.deepEqual(
    places.map(({ distanceKm }) => distanceKm),
    [0.4, 1.25, 2],
  );
});
