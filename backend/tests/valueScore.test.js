const test = require("node:test");
const assert = require("node:assert/strict");

const {
  VALUE_SCORE_WEIGHTS,
  calculateValueScore,
  calculateValueScoreBreakdown,
  getAvailableSafetyScore,
  getCommuteEstimate,
  getCommuteMinutes,
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
