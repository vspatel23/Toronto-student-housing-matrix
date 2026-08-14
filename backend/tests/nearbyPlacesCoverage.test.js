const test = require("node:test");
const assert = require("node:assert/strict");

const { listings } = require("../scripts/seedListings");

const CORE_ESSENTIAL_CATEGORIES = [
  "transit",
  "grocery",
  "pharmacy",
  "library",
  "park",
  "gym",
  "clinic",
];

test("every active seed listing has bundled nearby student essentials", async () => {
  const {
    NEARBY_SEARCH_RADIUS_KM,
    loadSeededNearbyPlaces,
  } = await import("../../frontend/src/utils/nearbyPlaces.js");
  const activeListings = listings.filter(({ isActive }) => isActive === true);

  assert.equal(activeListings.length, 27);

  for (const listing of activeListings) {
    const places = await loadSeededNearbyPlaces(listing);
    const returnedCategories = new Set(
      places.map(({ category }) => category),
    );

    assert.ok(
      places.length >= CORE_ESSENTIAL_CATEGORIES.length,
      `${listing.seedId} should return nearby student essentials`,
    );
    CORE_ESSENTIAL_CATEGORIES.forEach((category) => {
      assert.equal(
        returnedCategories.has(category),
        true,
        `${listing.seedId} should include ${category}`,
      );
    });
    assert.equal(
      new Set(places.map(({ id }) => id)).size,
      places.length,
      `${listing.seedId} should not return duplicate places`,
    );
    assert.equal(
      places.every(({ distanceKm }) => distanceKm <= NEARBY_SEARCH_RADIUS_KM),
      true,
      `${listing.seedId} should only return places inside the search radius`,
    );
  }
});
