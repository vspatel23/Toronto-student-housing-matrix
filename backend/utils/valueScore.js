const {
  getCommuteEstimate,
  getCommuteMinutes,
} = require("./commute");

const clampScore = (score) => {
  const numericScore = Number(score);

  if (!Number.isFinite(numericScore)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numericScore)));
};

const VALUE_SCORE_WEIGHTS = Object.freeze({
  affordability: 35,
  commute: 25,
  safety: 25,
  amenities: 15,
});

const VALUE_SCORE_WEIGHT_KEYS = Object.freeze([
  "affordability",
  "commute",
  "safety",
  "amenities",
]);
const NORMALIZED_WEIGHT_TOTAL = 100;
const NORMALIZED_WEIGHT_EPSILON = 1e-10;
const VALUE_SCORE_PRECISION = 1e12;

const normalizeValueScoreWeights = (weights) => {
  const source =
    weights && typeof weights === "object" && !Array.isArray(weights)
      ? weights
      : VALUE_SCORE_WEIGHTS;
  const safeWeights = Object.fromEntries(
    VALUE_SCORE_WEIGHT_KEYS.map((key) => {
      const weight = Number(source[key]);
      return [key, Number.isFinite(weight) && weight >= 0 ? weight : 0];
    }),
  );
  const totalWeight = VALUE_SCORE_WEIGHT_KEYS.reduce(
    (total, key) => total + safeWeights[key],
    0,
  );

  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    return { ...VALUE_SCORE_WEIGHTS };
  }

  if (
    Math.abs(totalWeight - NORMALIZED_WEIGHT_TOTAL) <=
    NORMALIZED_WEIGHT_EPSILON
  ) {
    return { ...safeWeights };
  }

  return Object.fromEntries(
    VALUE_SCORE_WEIGHT_KEYS.map((key) => [
      key,
      (safeWeights[key] / totalWeight) * NORMALIZED_WEIGHT_TOTAL,
    ]),
  );
};

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const getRentNumber = (listing) => {
  const rent = Number(listing?.monthlyRent ?? listing?.rent);
  return Number.isFinite(rent) && rent >= 0 ? rent : null;
};

const getAvailableSafetyScore = (listing) => {
  const rawSafetyScore = listing?.safety?.safetyScore;
  const safetyScore = hasValue(rawSafetyScore)
    ? Number(rawSafetyScore)
    : Number.NaN;

  if (Number.isFinite(safetyScore) && safetyScore >= 0 && safetyScore <= 100) {
    return safetyScore;
  }

  const crimeRateLevel = hasValue(listing?.safety?.crimeRateLevel)
    ? String(listing.safety.crimeRateLevel).trim().toLowerCase()
    : "";

  if (crimeRateLevel === "low") {
    return 100;
  }

  if (crimeRateLevel === "medium") {
    return 72;
  }

  if (crimeRateLevel === "high") {
    return 42;
  }

  return null;
};

const getSafetyScore = (listing) => {
  const safetyScore = Number(listing?.safety?.safetyScore);

  if (Number.isFinite(safetyScore) && safetyScore >= 0 && safetyScore <= 100) {
    return clampScore(safetyScore);
  }

  const crimeRateLevel = hasValue(listing?.safety?.crimeRateLevel)
    ? String(listing.safety.crimeRateLevel).trim().toLowerCase()
    : "";

  if (crimeRateLevel === "low") {
    return 100;
  }

  if (crimeRateLevel === "medium") {
    return 72;
  }

  if (crimeRateLevel === "high") {
    return 42;
  }

  return 55;
};

const getAmenitiesScore = (listing) => {
  if (!Array.isArray(listing?.amenities)) {
    return 0;
  }

  const validAmenities = listing.amenities.filter(hasValue);
  return clampScore(Math.min(validAmenities.length * 12.5, 100));
};

const getAffordabilityScore = (listing) => {
  const rent = getRentNumber(listing);

  if (rent === null) {
    return 50;
  }

  if (rent <= 1000) {
    return 100;
  }

  if (rent >= 3000) {
    return 20;
  }

  return clampScore(100 - ((rent - 1000) / 2000) * 80);
};

const getCommuteScore = (listing, campus) => {
  const minutes = getCommuteMinutes(listing, campus);

  if (minutes === null) {
    return 50;
  }

  if (minutes <= 15) {
    return 100;
  }

  if (minutes >= 60) {
    return 30;
  }

  return clampScore(100 - ((minutes - 15) / 45) * 70);
};

const calculateValueScoreBreakdown = (listing, campus) => ({
  affordability: getAffordabilityScore(listing),
  commute: getCommuteScore(listing, campus),
  safety: getSafetyScore(listing),
  amenities: getAmenitiesScore(listing),
});

const calculateWeightedValueScoreFromBreakdown = (breakdown, weights) => {
  const normalizedWeights = normalizeValueScoreWeights(weights);
  const overall = VALUE_SCORE_WEIGHT_KEYS.reduce(
    (score, key) =>
      score + clampScore(breakdown?.[key]) * (normalizedWeights[key] / 100),
    0,
  );
  const stableOverall =
    Math.round(overall * VALUE_SCORE_PRECISION) / VALUE_SCORE_PRECISION;

  return clampScore(stableOverall);
};

const calculateValueScore = (listing, campus) => {
  const breakdown = calculateValueScoreBreakdown(listing, campus);
  return calculateWeightedValueScoreFromBreakdown(
    breakdown,
    VALUE_SCORE_WEIGHTS,
  );
};

module.exports = {
  VALUE_SCORE_WEIGHTS,
  VALUE_SCORE_WEIGHT_KEYS,
  calculateValueScore,
  calculateValueScoreBreakdown,
  calculateWeightedValueScoreFromBreakdown,
  getAvailableSafetyScore,
  getCommuteEstimate,
  getCommuteMinutes,
  getRentNumber,
  normalizeValueScoreWeights,
};
