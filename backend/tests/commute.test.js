const test = require("node:test");
const assert = require("node:assert/strict");

const {
  COMMUTE_ESTIMATION_CONSTANTS,
  SUPPORTED_CAMPUS_LABELS,
  calculateHaversineDistanceKm,
  enrichListingCommuteEstimates,
  estimateCommuteMinutesFromDistance,
  getCommuteEstimate,
  getCommuteMinutes,
  getValidCommuteMinutes,
  getValidCoordinates,
  resolveCampus,
} = require("../utils/commute");
const { listings } = require("../scripts/seedListings");

const TMU = "Toronto Metropolitan University";
const U_OF_T = "University of Toronto -- St. George";

test("valid numeric and string coordinates produce the same deterministic estimate", () => {
  const numericListing = {
    location: { lat: 43.6567, lng: -79.3749 },
  };
  const stringListing = {
    location: { lat: " 43.6567 ", lng: "-79.3749" },
  };

  assert.deepEqual(getValidCoordinates(numericListing), [43.6567, -79.3749]);
  assert.deepEqual(getValidCoordinates(stringListing), [43.6567, -79.3749]);
  assert.deepEqual(
    getCommuteEstimate(stringListing, TMU),
    getCommuteEstimate(numericListing, TMU),
  );
  assert.equal(Number.isInteger(getCommuteMinutes(numericListing, TMU)), true);
  assert.ok(
    getCommuteMinutes(numericListing, TMU) >=
      COMMUTE_ESTIMATION_CONSTANTS.minimumMinutes,
  );
});

test("stored estimates take precedence over coordinate-derived estimates", () => {
  const listing = {
    location: { lat: 43.6577, lng: -79.3788 },
    commuteEstimates: [
      {
        campus: "University of Toronto — St. George",
        minutes: "47",
        isEstimated: false,
      },
    ],
  };

  assert.deepEqual(getCommuteEstimate(listing, U_OF_T), {
    campus: "University of Toronto — St. George",
    minutes: 47,
    isEstimated: false,
  });
  assert.equal(getCommuteMinutes(listing, U_OF_T), 47);
});

test("missing and malformed coordinates cannot produce a fallback commute", async (t) => {
  const invalidLocations = [
    null,
    {},
    { location: {} },
    { location: { lat: null, lng: -79.38 } },
    { location: { lat: "", lng: -79.38 } },
    { location: { lat: "not-a-number", lng: -79.38 } },
    { location: { lat: false, lng: -79.38 } },
    { location: { lat: Number.NaN, lng: -79.38 } },
    { location: { lat: Number.POSITIVE_INFINITY, lng: -79.38 } },
    { location: { lat: 91, lng: -79.38 } },
    { location: { lat: 43.65, lng: -181 } },
    { location: { lat: 0, lng: -79.38 } },
    { location: { lat: 43.65, lng: 0 } },
  ];

  for (const [index, listing] of invalidLocations.entries()) {
    await t.test(`invalid location ${index + 1}`, () => {
      assert.equal(getValidCoordinates(listing), null);
      assert.equal(getCommuteEstimate(listing, TMU), null);
      assert.equal(getCommuteMinutes(listing, TMU), null);
    });
  }
});

test("unknown or missing campuses are unavailable even when listing data exists", () => {
  const listing = {
    location: { lat: 43.6567, lng: -79.3749 },
    commuteEstimates: [{ campus: TMU, minutes: 11, isEstimated: true }],
  };

  assert.equal(resolveCampus(""), null);
  assert.equal(resolveCampus("Invented Toronto Campus"), null);
  assert.equal(resolveCampus("University of Toronto"), null);
  assert.equal(getCommuteEstimate(listing), null);
  assert.equal(getCommuteEstimate(listing, ""), null);
  assert.equal(getCommuteEstimate(listing, "Invented Toronto Campus"), null);
  assert.equal(getCommuteMinutes(listing), null);
});

test("null, blank, boolean, negative, and non-finite stored minutes are invalid", () => {
  [
    null,
    undefined,
    "",
    "   ",
    false,
    true,
    [],
    [18],
    {},
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    "Infinity",
  ].forEach((value) => assert.equal(getValidCommuteMinutes(value), null));

  assert.equal(getValidCommuteMinutes(0), 0);
  assert.equal(getValidCommuteMinutes("18"), 18);

  const missingLocation = {
    commuteEstimates: [{ campus: TMU, minutes: null, isEstimated: true }],
  };
  assert.equal(getCommuteEstimate(missingLocation, TMU), null);
});

test("Haversine distance and distance-to-time conversion handle valid and invalid values", () => {
  const origin = [43.6567, -79.3749];
  const destination = [43.6577, -79.3788];
  const distance = calculateHaversineDistanceKm(origin, destination);

  assert.ok(Math.abs(distance - 0.332867) < 0.00001);
  assert.equal(calculateHaversineDistanceKm(origin, origin), 0);
  assert.equal(calculateHaversineDistanceKm([0, -79], destination), null);
  assert.equal(calculateHaversineDistanceKm(null, destination), null);
  assert.equal(estimateCommuteMinutesFromDistance(0), 10);
  assert.equal(estimateCommuteMinutesFromDistance(-1), null);
  assert.equal(estimateCommuteMinutesFromDistance(Number.NaN), null);
});

test("normalization enriches every supported campus without mutating the source", () => {
  const source = {
    title: "Normalization Test",
    location: { lat: 43.6567, lng: -79.3749 },
    commuteEstimates: [{ campus: TMU, minutes: 11, isEstimated: true }],
  };
  const sourceSnapshot = structuredClone(source);
  const enriched = enrichListingCommuteEstimates(source);

  assert.deepEqual(source, sourceSnapshot);
  assert.notEqual(enriched, source);
  assert.equal(enriched.commuteEstimates.length, SUPPORTED_CAMPUS_LABELS.length);
  assert.equal(getCommuteMinutes(enriched, TMU), 11);

  SUPPORTED_CAMPUS_LABELS.forEach((campus) => {
    assert.equal(Number.isFinite(getCommuteMinutes(enriched, campus)), true);
  });
});

test("all active seed listings have a commute for all six campuses", () => {
  const activeListings = listings.filter((listing) => listing.isActive === true);
  const coordinateDerivedFixture = activeListings.find(
    (listing) => listing.seedId === "listing-021",
  );

  assert.equal(activeListings.length, 27);
  assert.equal(SUPPORTED_CAMPUS_LABELS.length, 6);
  assert.equal(coordinateDerivedFixture.title, "Affordable Scarborough Basement");
  assert.deepEqual(coordinateDerivedFixture.location, {
    lat: 43.7597385,
    lng: -79.2774456,
  });
  assert.equal(coordinateDerivedFixture.commuteEstimates, undefined);

  SUPPORTED_CAMPUS_LABELS.forEach((campus) => {
    const availableListings = activeListings.filter((listing) =>
      Number.isFinite(getCommuteMinutes(listing, campus)),
    );
    const unavailableListings = activeListings.filter(
      (listing) => !Number.isFinite(getCommuteMinutes(listing, campus)),
    );

    assert.equal(
      availableListings.length,
      27,
      `${campus} should have 27 available estimates`,
    );
    assert.deepEqual(unavailableListings, [], `${campus} should be available`);
  });
});
