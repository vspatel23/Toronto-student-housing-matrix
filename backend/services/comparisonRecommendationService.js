const HousingListing = require("../models/HousingListing");
const SavedPreference = require("../models/SavedPreference");
const {
  ComparisonRecommendationValidationError,
  validateComparisonRecommendation,
} = require("../utils/comparisonRecommendationSchema");
const {
  buildComparisonGrounding,
} = require("../utils/comparisonGrounding");
const {
  VALUE_SCORE_WEIGHTS,
  VALUE_SCORE_WEIGHT_KEYS,
  calculateValueScoreBreakdown,
  calculateWeightedValueScoreFromBreakdown,
  getAvailableSafetyScore,
  getCommuteEstimate,
  normalizeValueScoreWeights,
} = require("../utils/valueScore");
const {
  AIOutputValidationError,
  AIServiceError,
} = require("./aiErrors");
const {
  ComparisonServiceError,
  createComparisonServiceUnavailableError,
  createDuplicateListingIdsError,
  createInvalidComparisonContextError,
  createInvalidComparisonCountError,
  createInvalidListingIdError,
  createListingInactiveError,
  createListingNotFoundError,
} = require("./comparisonErrors");
const openRouterService = require("./openRouterService");

const LISTING_COMPARISON_PROJECTION =
  "_id title address monthlyRent propertyType furnished " +
  "location.lat location.lng " +
  "safety.safetyScore safety.crimeRateLevel " +
  "commuteEstimates.campus commuteEstimates.minutes " +
  "commuteEstimates.isEstimated amenities isActive";

const PREFERENCE_COMPARISON_PROJECTION =
  "campus minRent maxRent maxBudget housingType maxCommute safetyLevel " +
  "minimumSafetyLevel amenities";

const CANONICAL_LISTING_ID_PATTERN = /^[0-9a-f]{24}$/i;
const MAX_COMPARISON_CAMPUS_LENGTH = 160;

const normalizeComparisonListingIds = (listingIds) => {
  if (
    !Array.isArray(listingIds) ||
    (listingIds.length !== 2 && listingIds.length !== 3)
  ) {
    throw createInvalidComparisonCountError();
  }

  if (
    listingIds.some(
      (listingId) =>
        typeof listingId !== "string" ||
        !CANONICAL_LISTING_ID_PATTERN.test(listingId),
    )
  ) {
    throw createInvalidListingIdError();
  }

  const normalizedIds = listingIds.map((listingId) =>
    listingId.toLowerCase(),
  );

  if (new Set(normalizedIds).size !== normalizedIds.length) {
    throw createDuplicateListingIdsError();
  }

  return normalizedIds;
};

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

const normalizeComparisonContext = (campus, valueScoreWeights) => {
  const validCampus =
    campus === null ||
    (typeof campus === "string" &&
      campus.length > 0 &&
      campus.length <= MAX_COMPARISON_CAMPUS_LENGTH &&
      campus.trim() === campus &&
      !/[\u0000-\u001f\u007f]/.test(campus));
  const weightKeys = isPlainObject(valueScoreWeights)
    ? Object.keys(valueScoreWeights)
    : [];
  const validWeightKeys =
    weightKeys.length === VALUE_SCORE_WEIGHT_KEYS.length &&
    VALUE_SCORE_WEIGHT_KEYS.every((key) => weightKeys.includes(key));
  const validWeightValues =
    validWeightKeys &&
    VALUE_SCORE_WEIGHT_KEYS.every((key) => {
      const weight = valueScoreWeights[key];
      return (
        typeof weight === "number" &&
        Number.isFinite(weight) &&
        weight >= 0 &&
        weight <= 100
      );
    });
  const totalWeight = validWeightValues
    ? VALUE_SCORE_WEIGHT_KEYS.reduce(
        (total, key) => total + valueScoreWeights[key],
        0,
      )
    : 0;

  if (!validCampus || !validWeightValues || totalWeight <= 0) {
    throw createInvalidComparisonContextError();
  }

  return {
    campus,
    valueScoreWeights: normalizeValueScoreWeights(valueScoreWeights),
  };
};

const toPlainObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  if (typeof value.toObject === "function") {
    return value.toObject();
  }

  return value;
};

const toNullableString = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
};

const toNullableFiniteNumber = (value, { minimum = -Infinity } = {}) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= minimum
    ? value
    : null;

const sanitizeAmenities = (amenities) =>
  Array.isArray(amenities)
    ? amenities
        .filter((amenity) => typeof amenity === "string")
        .map((amenity) => amenity.trim())
        .filter(Boolean)
    : [];

const sanitizePreference = (preferenceDocument) => {
  const preference = toPlainObject(preferenceDocument);

  if (!preference) {
    return null;
  }

  return {
    campus: toNullableString(preference.campus),
    minRent: toNullableFiniteNumber(preference.minRent, { minimum: 0 }),
    maxRent: toNullableFiniteNumber(preference.maxRent, { minimum: 0 }),
    maxBudget: toNullableFiniteNumber(preference.maxBudget, { minimum: 0 }),
    housingType: toNullableString(preference.housingType),
    maxCommute: toNullableFiniteNumber(preference.maxCommute, { minimum: 0 }),
    safetyLevel: toNullableString(preference.safetyLevel),
    minimumSafetyLevel: toNullableString(preference.minimumSafetyLevel),
    amenities: sanitizeAmenities(preference.amenities),
  };
};

const sanitizeCommute = (listing, campus) => {
  const estimate = toPlainObject(getCommuteEstimate(listing, campus));

  if (!estimate) {
    return null;
  }

  return {
    campus: toNullableString(estimate.campus),
    minutes: toNullableFiniteNumber(estimate.minutes, { minimum: 0 }),
    isEstimated:
      typeof estimate.isEstimated === "boolean" ? estimate.isEstimated : null,
  };
};

const sanitizeSafety = (safetyValue) => {
  const safety = toPlainObject(safetyValue);

  if (!safety) {
    return null;
  }

  const safetyScore = toNullableFiniteNumber(safety.safetyScore, {
    minimum: 0,
  });
  const validSafetyScore =
    safetyScore !== null && safetyScore <= 100 ? safetyScore : null;
  const crimeRateLevel = toNullableString(safety.crimeRateLevel);

  if (validSafetyScore === null && crimeRateLevel === null) {
    return null;
  }

  return {
    safetyScore: validSafetyScore,
    crimeRateLevel,
  };
};

const sanitizeValueScoreBreakdown = (breakdownValue) => {
  const breakdown = toPlainObject(breakdownValue) || {};

  return {
    affordability: toNullableFiniteNumber(breakdown.affordability, {
      minimum: 0,
    }),
    commute: toNullableFiniteNumber(breakdown.commute, { minimum: 0 }),
    safety: toNullableFiniteNumber(breakdown.safety, { minimum: 0 }),
    amenities: toNullableFiniteNumber(breakdown.amenities, { minimum: 0 }),
  };
};

const sanitizeListing = (
  listing,
  id,
  campus,
  valueScoreWeights,
  calculateValueScoreBreakdownImpl,
) => {
  const valueScoreBreakdown = sanitizeValueScoreBreakdown(
    calculateValueScoreBreakdownImpl(listing, campus),
  );

  const valueScore = calculateWeightedValueScoreFromBreakdown(
    valueScoreBreakdown,
    valueScoreWeights,
  );

  return {
    id,
    title: toNullableString(listing.title),
    address: toNullableString(listing.address),
    monthlyRent: toNullableFiniteNumber(listing.monthlyRent, { minimum: 0 }),
    propertyType: toNullableString(listing.propertyType),
    furnished:
      typeof listing.furnished === "boolean" ? listing.furnished : null,
    commute: sanitizeCommute(listing, campus),
    safety: sanitizeSafety(listing.safety),
    amenities: sanitizeAmenities(listing.amenities),
    valueScore,
    valueScoreBreakdown,
  };
};

const findWinnerCandidates = (listings, getMetric, direction) => {
  const availableMetrics = listings
    .map((listing) => ({ id: listing.id, value: getMetric(listing) }))
    .filter(({ value }) => typeof value === "number" && Number.isFinite(value));

  if (availableMetrics.length === 0) {
    return [];
  }

  const winningValue = Math[direction](
    ...availableMetrics.map(({ value }) => value),
  );

  return availableMetrics
    .filter(({ value }) => value === winningValue)
    .map(({ id }) => id);
};

const buildCategoryCandidates = (listingContexts, orderedListings) => ({
  bestOverall: findWinnerCandidates(
    listingContexts,
    (listing) => listing.valueScore,
    "max",
  ),
  bestBudget: findWinnerCandidates(
    listingContexts,
    (listing) => listing.monthlyRent,
    "min",
  ),
  bestCommute: findWinnerCandidates(
    listingContexts,
    (listing) => listing.commute?.minutes,
    "min",
  ),
  bestSafety: findWinnerCandidates(
    orderedListings.map((listing, index) => ({
      id: listingContexts[index].id,
      listing,
    })),
    ({ listing }) => getAvailableSafetyScore(listing),
    "max",
  ),
});

const loadListings = async (HousingListingModel, listingIds) => {
  const query = HousingListingModel.find({ _id: { $in: listingIds } });

  if (!query || typeof query.select !== "function") {
    throw new TypeError("Housing listing query is unavailable.");
  }

  const documents = await query.select(LISTING_COMPARISON_PROJECTION);
  return Array.isArray(documents) ? documents : [];
};

const loadLatestPreference = async (SavedPreferenceModel, userId) => {
  if (!userId) {
    return null;
  }

  const query = SavedPreferenceModel.findOne({ userId });

  if (
    !query ||
    typeof query.sort !== "function" ||
    typeof query.select !== "function"
  ) {
    throw new TypeError("Saved preference query is unavailable.");
  }

  return query
    .sort({ createdAt: -1 })
    .select(PREFERENCE_COMPARISON_PROJECTION);
};

const createComparisonRecommendationService = ({
  HousingListingModel = HousingListing,
  SavedPreferenceModel = SavedPreference,
  generateComparisonRecommendation =
    openRouterService.generateComparisonRecommendation,
  calculateValueScoreBreakdownImpl = calculateValueScoreBreakdown,
} = {}) => ({
  async recommendComparison(input = {}) {
    try {
      const normalizedInput =
        input && typeof input === "object" && !Array.isArray(input)
          ? input
          : {};
      const { listingIds, userId } = normalizedInput;
      const normalizedListingIds = normalizeComparisonListingIds(listingIds);
      const hasCampus = Object.prototype.hasOwnProperty.call(
        normalizedInput,
        "campus",
      );
      const hasValueScoreWeights = Object.prototype.hasOwnProperty.call(
        normalizedInput,
        "valueScoreWeights",
      );

      if (hasCampus !== hasValueScoreWeights) {
        throw createInvalidComparisonContextError();
      }

      const suppliedContext = hasCampus
        ? normalizeComparisonContext(
            normalizedInput.campus,
            normalizedInput.valueScoreWeights,
          )
        : null;
      const listingDocuments = await loadListings(
        HousingListingModel,
        normalizedListingIds,
      );
      const listingsById = new Map(
        listingDocuments.map((document) => {
          const listing = toPlainObject(document);
          const id = listing?._id?.toString().toLowerCase();
          return [id, listing];
        }),
      );
      const orderedListings = normalizedListingIds.map((id) =>
        listingsById.get(id),
      );

      if (orderedListings.some((listing) => !listing)) {
        throw createListingNotFoundError();
      }

      if (orderedListings.some((listing) => listing.isActive !== true)) {
        throw createListingInactiveError();
      }

      const preferenceDocument = await loadLatestPreference(
        SavedPreferenceModel,
        userId,
      );
      const savedPreferences = sanitizePreference(preferenceDocument);
      const campus = suppliedContext
        ? suppliedContext.campus
        : savedPreferences?.campus || null;
      const valueScoreWeights = suppliedContext
        ? suppliedContext.valueScoreWeights
        : { ...VALUE_SCORE_WEIGHTS };
      const preferences = savedPreferences
        ? { ...savedPreferences, campus }
        : null;
      const listingContexts = orderedListings.map((listing, index) =>
        sanitizeListing(
          listing,
          normalizedListingIds[index],
          campus,
          valueScoreWeights,
          calculateValueScoreBreakdownImpl,
        ),
      );
      const categoryCandidates = buildCategoryCandidates(
        listingContexts,
        orderedListings,
      );
      const { categorySelections, approvedGrounding } =
        buildComparisonGrounding({
          listings: listingContexts,
          preferences,
          categoryCandidates,
        });
      const expectedWinnerIds = Object.fromEntries(
        Object.entries(categorySelections).map(([category, ids]) => [
          category,
          [...ids],
        ]),
      );
      const context = {
        listings: listingContexts,
        campus,
        preferences,
        valueScoreWeights: { ...valueScoreWeights },
        categoryCandidates: Object.fromEntries(
          Object.entries(categoryCandidates).map(([category, ids]) => [
            category,
            [...ids],
          ]),
        ),
        categorySelections: Object.fromEntries(
          Object.entries(categorySelections).map(([category, ids]) => [
            category,
            [...ids],
          ]),
        ),
        approvedGrounding,
      };

      if (typeof generateComparisonRecommendation !== "function") {
        throw new TypeError("Comparison recommendation provider is unavailable.");
      }

      const providerRecommendation =
        await generateComparisonRecommendation(context);

      return validateComparisonRecommendation(providerRecommendation, {
        listingIds: normalizedListingIds,
        expectedWinnerIds,
        approvedGrounding,
      });
    } catch (error) {
      if (error instanceof ComparisonRecommendationValidationError) {
        throw new AIOutputValidationError();
      }

      if (
        error instanceof ComparisonServiceError ||
        error instanceof AIServiceError
      ) {
        throw error;
      }

      throw createComparisonServiceUnavailableError();
    }
  },
});

const defaultComparisonRecommendationService =
  createComparisonRecommendationService();

module.exports = {
  LISTING_COMPARISON_PROJECTION,
  PREFERENCE_COMPARISON_PROJECTION,
  MAX_COMPARISON_CAMPUS_LENGTH,
  createComparisonRecommendationService,
  normalizeComparisonContext,
  normalizeComparisonListingIds,
  recommendComparison: (options) =>
    defaultComparisonRecommendationService.recommendComparison(options),
};
