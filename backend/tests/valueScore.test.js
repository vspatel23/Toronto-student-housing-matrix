const test = require("node:test");
const assert = require("node:assert/strict");

const {
  VALUE_SCORE_WEIGHTS,
  calculateValueScore,
  calculateValueScoreBreakdown,
  calculateWeightedValueScoreFromBreakdown,
  getAvailableSafetyScore,
  getCommuteEstimate,
  getCommuteMinutes,
  normalizeValueScoreWeights,
} = require("../utils/valueScore");

const listing = {
  monthlyRent: 1_500,
  safety: { safetyScore: 82, crimeRateLevel: "Low" },
  commuteEstimates: [
    {
      campus: "Toronto Metropolitan University",
      minutes: 30,
      isEstimated: true,
    },
    {
      campus: "University of Toronto -- St. George",
      minutes: 20,
      isEstimated: true,
    },
  ],
  amenities: ["WiFi", "Laundry"],
};

test("the established Value Score formula and component values remain unchanged", () => {
  assert.deepEqual(VALUE_SCORE_WEIGHTS, {
    affordability: 35,
    commute: 25,
    safety: 25,
    amenities: 15,
  });
  assert.deepEqual(
    calculateValueScoreBreakdown(
      listing,
      "Toronto Metropolitan University",
    ),
    {
      affordability: 80,
      commute: 77,
      safety: 82,
      amenities: 25,
    },
  );
  assert.equal(
    calculateValueScore(listing, "Toronto Metropolitan University"),
    72,
  );
});

test("current comparison weights produce the displayed weighted Value Score", () => {
  const breakdown = calculateValueScoreBreakdown(
    listing,
    "Toronto Metropolitan University",
  );

  assert.equal(
    calculateWeightedValueScoreFromBreakdown(breakdown, {
      affordability: 0,
      commute: 100,
      safety: 0,
      amenities: 0,
    }),
    77,
  );
  assert.equal(
    calculateWeightedValueScoreFromBreakdown(breakdown, {
      affordability: 7,
      commute: 5,
      safety: 5,
      amenities: 3,
    }),
    calculateValueScore(listing, "Toronto Metropolitan University"),
  );
});

test("fractional comparison weights stay stable at the shared rounding boundary", () => {
  const weights = {
    affordability: 33,
    commute: 33,
    safety: 0,
    amenities: 4,
  };
  const normalizedWeights = normalizeValueScoreWeights(weights);
  const breakdown = {
    affordability: 40,
    commute: 65,
    safety: 20,
    amenities: 0,
  };

  assert.deepEqual(
    normalizeValueScoreWeights(normalizedWeights),
    normalizedWeights,
  );
  assert.equal(
    calculateWeightedValueScoreFromBreakdown(breakdown, weights),
    50,
  );
  assert.equal(
    calculateWeightedValueScoreFromBreakdown(
      breakdown,
      normalizedWeights,
    ),
    50,
  );
});

test("canonical Value Score weights use the same stable rounding path", () => {
  const boundaryListing = {
    monthlyRent: 2925,
    commuteEstimates: [
      { campus: "Toronto Metropolitan University", minutes: 60 },
    ],
    safety: { safetyScore: 2 },
    amenities: ["WiFi", "Laundry", "Kitchen", "Transit", "Storage"],
  };

  assert.deepEqual(
    calculateValueScoreBreakdown(
      boundaryListing,
      "Toronto Metropolitan University",
    ),
    { affordability: 23, commute: 30, safety: 2, amenities: 63 },
  );
  assert.equal(
    calculateValueScore(
      boundaryListing,
      "Toronto Metropolitan University",
    ),
    26,
  );
});

test("the existing campus matching behavior is reused for comparison context", () => {
  assert.equal(
    getCommuteMinutes(listing, "University of Toronto - St. George"),
    20,
  );
  assert.deepEqual(
    getCommuteEstimate(listing, "University of Toronto - St. George"),
    listing.commuteEstimates[1],
  );
  assert.equal(getCommuteMinutes(listing, "York University"), null);
});

test("the existing rule-based handling of explicit null values remains unchanged", () => {
  const missingDataListing = {
    monthlyRent: 1_500,
    commuteEstimates: [{ campus: "Test Campus", minutes: null }],
    safety: { safetyScore: null },
    amenities: [],
  };

  assert.equal(getCommuteMinutes(missingDataListing), 0);
  assert.equal(getAvailableSafetyScore(missingDataListing), null);
  assert.deepEqual(calculateValueScoreBreakdown(missingDataListing), {
    affordability: 80,
    commute: 100,
    safety: 0,
    amenities: 0,
  });
});
