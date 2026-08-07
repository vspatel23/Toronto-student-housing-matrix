const test = require("node:test");
const assert = require("node:assert/strict");

const {
  AMENITY_FILTER_VALUES,
  CAMPUS_FILTER_VALUES,
  FURNISHING_FILTER_VALUES,
  HOUSING_TYPE_FILTER_VALUES,
  SAFETY_FILTER_VALUES,
} = require("../constants/housingFilters");
const {
  HousingFilterValidationError,
  validateHousingFilters,
} = require("../utils/housingFilterSchema");

const fullValidFilters = () => ({
  campus: "University of Toronto -- St. George",
  minRent: 500,
  maxRent: 3000,
  housingType: "Apartment",
  maxCommute: 60,
  safetyLevel: "High Only",
  furnished: "Furnished",
  amenities: [...AMENITY_FILTER_VALUES],
});

const assertInvalidFilters = (filters, fieldPattern) => {
  assert.throws(
    () => validateHousingFilters(filters),
    (error) => {
      assert.ok(error instanceof HousingFilterValidationError);
      assert.equal(error.code, "HOUSING_FILTERS_INVALID");
      assert.match(error.issues.join(" "), fieldPattern);
      return true;
    },
  );
};

test("a valid partial housing-filter object passes and receives predictable empty values", () => {
  assert.deepEqual(
    validateHousingFilters({
      campus: "Toronto Metropolitan University",
      maxRent: 2000,
      amenities: ["Laundry", "Nearby Transit"],
    }),
    {
      campus: "Toronto Metropolitan University",
      minRent: null,
      maxRent: 2000,
      housingType: null,
      maxCommute: null,
      safetyLevel: null,
      furnished: null,
      amenities: ["Laundry", "Nearby Transit"],
    },
  );
});

test("a valid object containing every supported field passes", () => {
  assert.deepEqual(validateHousingFilters(fullValidFilters()), fullValidFilters());
});

test("every configured enum value is accepted by the housing filter schema", () => {
  CAMPUS_FILTER_VALUES.forEach((campus) => {
    assert.equal(validateHousingFilters({ campus }).campus, campus);
  });
  HOUSING_TYPE_FILTER_VALUES.forEach((housingType) => {
    assert.equal(
      validateHousingFilters({ housingType }).housingType,
      housingType,
    );
  });
  SAFETY_FILTER_VALUES.forEach((safetyLevel) => {
    assert.equal(validateHousingFilters({ safetyLevel }).safetyLevel, safetyLevel);
  });
  FURNISHING_FILTER_VALUES.forEach((furnished) => {
    assert.equal(validateHousingFilters({ furnished }).furnished, furnished);
  });
});

test("unsupported fields are rejected rather than entering approved output", () => {
  assertInvalidFilters(
    { ...fullValidFilters(), mongoQuery: { monthlyRent: { $lt: 1000 } } },
    /Unsupported housing filter field: mongoQuery/,
  );
});

test("an unsupported campus fails validation", () => {
  assertInvalidFilters({ campus: "Invented Toronto Campus" }, /campus/);
});

test("an unsupported housing type fails validation", () => {
  assertInvalidFilters({ housingType: "Luxury Castle" }, /housingType/);
});

test("an unsupported safety value fails validation", () => {
  assertInvalidFilters({ safetyLevel: "Perfectly Safe" }, /safetyLevel/);
});

test("an unsupported furnishing value fails validation", () => {
  assertInvalidFilters({ furnished: "Partially Furnished" }, /furnished/);
});

test("an unsupported amenity fails validation", () => {
  assertInvalidFilters({ amenities: ["Rooftop Helicopter Pad"] }, /amenities/);
});

test("duplicate amenities fail application-side validation", () => {
  assertInvalidFilters({ amenities: ["WiFi", "WiFi"] }, /duplicates/);
});

test("invalid numeric filter values fail validation", async (t) => {
  const cases = [
    { name: "negative rent", filters: { minRent: -50 }, field: /minRent/ },
    { name: "rent above UI range", filters: { maxRent: 3050 }, field: /maxRent/ },
    { name: "rent not on UI step", filters: { minRent: 525 }, field: /minRent/ },
    { name: "commute above UI range", filters: { maxCommute: 65 }, field: /maxCommute/ },
    { name: "commute not on UI step", filters: { maxCommute: 12 }, field: /maxCommute/ },
    { name: "numeric string", filters: { maxRent: "2000" }, field: /maxRent/ },
    { name: "non-finite number", filters: { maxRent: Infinity }, field: /maxRent/ },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, () => {
      assertInvalidFilters(testCase.filters, testCase.field);
    });
  }
});

test("minimum rent above maximum rent fails validation", () => {
  assertInvalidFilters(
    { minRent: 2000, maxRent: 1500 },
    /minRent must be less than or equal to maxRent/,
  );
});
