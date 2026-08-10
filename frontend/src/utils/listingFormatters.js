import { DEFAULT_VALUE_SCORE_WEIGHTS } from "./constants";
import { getCampusLabel } from "./campusFormatters";

export const DATA_UNAVAILABLE = "Data unavailable";

const VALUE_SCORE_WEIGHT_KEYS = [
  "affordability",
  "commute",
  "safety",
  "amenities",
];
const NORMALIZED_WEIGHT_TOTAL = 100;
const NORMALIZED_WEIGHT_EPSILON = 1e-10;
const VALUE_SCORE_PRECISION = 1e12;

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const normalizeText = (value) =>
  hasValue(value) ? String(value).trim() : DATA_UNAVAILABLE;

export const normalizeCampusName = (value) =>
  hasValue(value)
    ? String(value)
        .replace(/--/g, "-")
        .replace(/[—–]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
    : "";

export const isMatchingCampusName = (estimateCampus, selectedCampus) => {
  const normalizedEstimateCampus = normalizeCampusName(estimateCampus);
  const normalizedSelectedCampus = normalizeCampusName(selectedCampus);

  if (!normalizedEstimateCampus || !normalizedSelectedCampus) {
    return false;
  }

  return (
    normalizedEstimateCampus === normalizedSelectedCampus ||
    normalizedSelectedCampus.startsWith(`${normalizedEstimateCampus} -`) ||
    normalizedEstimateCampus.startsWith(`${normalizedSelectedCampus} -`)
  );
};

export const findCampusByLabel = (campuses, campusLabel) => {
  if (!Array.isArray(campuses)) {
    return null;
  }

  const normalizedCampusLabel = normalizeCampusName(campusLabel);

  if (!normalizedCampusLabel) {
    return null;
  }

  const exactMatch = campuses.find(
    (campus) =>
      normalizeCampusName(getCampusLabel(campus)) === normalizedCampusLabel,
  );

  if (exactMatch) {
    return exactMatch;
  }

  const compatibleMatches = campuses.filter((campus) =>
    isMatchingCampusName(getCampusLabel(campus), campusLabel),
  );

  return compatibleMatches.length === 1 ? compatibleMatches[0] : null;
};

export const formatRent = (value) => {
  const rent = Number(value);

  if (!Number.isFinite(rent) || rent < 0) {
    return DATA_UNAVAILABLE;
  }

  return `$${rent.toLocaleString("en-CA")}/mo`;
};

export const formatFurnishedStatus = (value) => {
  if (typeof value === "boolean") {
    return value ? "Furnished" : "Unfurnished";
  }

  if (hasValue(value)) {
    return String(value);
  }

  return DATA_UNAVAILABLE;
};

export const getListingTitle = (listing) =>
  normalizeText(listing?.title || listing?.name);

export const getLocationLabel = (listing) =>
  normalizeText(listing?.neighborhood || listing?.neighbourhood || listing?.address);

export const getPropertyType = (listing) =>
  normalizeText(listing?.propertyType || listing?.housingType);

export const getSafetyLevel = (listing) =>
  normalizeText(
    listing?.safety?.crimeRateLevel ||
      listing?.safetyLevel ||
      listing?.crimeRateLevel,
  );

export const getDescription = (listing) => normalizeText(listing?.description);

export const getAmenities = (listing) =>
  Array.isArray(listing?.amenities)
    ? listing.amenities.filter((amenity) => hasValue(amenity))
    : [];

export const getCommuteMinutes = (listing, campus) => {
  if (!Array.isArray(listing?.commuteEstimates)) {
    return null;
  }

  const normalizedCampus = normalizeCampusName(campus);
  let commute;

  if (normalizedCampus) {
    commute = listing.commuteEstimates.find(
      (estimate) => isMatchingCampusName(estimate?.campus, campus),
    );

    if (!commute) {
      return null;
    }
  } else {
    commute = listing.commuteEstimates[0];
  }

  const minutes = Number(commute?.minutes);
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
};

export const formatCommute = (listing, campus) => {
  const minutes = getCommuteMinutes(listing, campus);
  return minutes === null ? DATA_UNAVAILABLE : `${minutes} min`;
};

export const formatValueScore = (value) => {
  const score = Number(value);
  return Number.isFinite(score) ? String(score) : DATA_UNAVAILABLE;
};

export const getListingId = (listing) => listing?._id || listing?.id || "";

const clampScore = (score) =>
  Math.max(0, Math.min(100, Math.round(Number(score) || 0)));

const clampWeight = (weight) => {
  const numericWeight = Number(weight);

  if (!Number.isFinite(numericWeight)) {
    return null;
  }

  return Math.max(0, Math.min(100, numericWeight));
};

const getRentNumber = (listing) => {
  const rent = Number(listing?.monthlyRent ?? listing?.rent);
  return Number.isFinite(rent) && rent >= 0 ? rent : null;
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

const getSafetyScore = (listing) => {
  const numericSafetyScore = Number(listing?.safety?.safetyScore);

  if (
    Number.isFinite(numericSafetyScore) &&
    numericSafetyScore >= 0 &&
    numericSafetyScore <= 100
  ) {
    return clampScore(numericSafetyScore);
  }

  const safetyLevel = getSafetyLevel(listing).toLowerCase();

  if (safetyLevel.includes("low")) {
    return 100;
  }

  if (safetyLevel.includes("medium")) {
    return 72;
  }

  if (safetyLevel.includes("high")) {
    return 42;
  }

  return 55;
};

const getAmenitiesScore = (listing) =>
  clampScore(Math.min(getAmenities(listing).length * 12.5, 100));

export const getValueScoreBreakdown = (listing, campus) => {
  // Derive from the listing's authoritative raw fields for the requested
  // campus. Cached result, saved, and direct-hydration objects can carry a
  // server breakdown calculated for a different (or absent) campus.
  return {
    affordability: getAffordabilityScore(listing),
    commute: getCommuteScore(listing, campus),
    safety: getSafetyScore(listing),
    amenities: getAmenitiesScore(listing),
  };
};

export const normalizeValueScoreWeights = (weights) => {
  const sourceWeights =
    weights && typeof weights === "object" ? weights : DEFAULT_VALUE_SCORE_WEIGHTS;
  const safeWeights = VALUE_SCORE_WEIGHT_KEYS.reduce((normalized, key) => {
    const clampedWeight = clampWeight(sourceWeights[key]);

    normalized[key] =
      clampedWeight === null ? DEFAULT_VALUE_SCORE_WEIGHTS[key] : clampedWeight;
    return normalized;
  }, {});
  const totalWeight = VALUE_SCORE_WEIGHT_KEYS.reduce(
    (total, key) => total + safeWeights[key],
    0,
  );

  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    return { ...DEFAULT_VALUE_SCORE_WEIGHTS };
  }

  if (
    Math.abs(totalWeight - NORMALIZED_WEIGHT_TOTAL) <=
    NORMALIZED_WEIGHT_EPSILON
  ) {
    return { ...safeWeights };
  }

  return VALUE_SCORE_WEIGHT_KEYS.reduce((normalized, key) => {
    normalized[key] =
      (safeWeights[key] / totalWeight) * NORMALIZED_WEIGHT_TOTAL;
    return normalized;
  }, {});
};

export const getWeightedValueScore = (listing, campus, weights) => {
  const breakdown = getValueScoreBreakdown(listing, campus);
  const normalizedWeights = normalizeValueScoreWeights(weights);
  const weightedScore = VALUE_SCORE_WEIGHT_KEYS.reduce(
    (score, key) => score + breakdown[key] * (normalizedWeights[key] / 100),
    0,
  );
  const stableWeightedScore =
    Math.round(weightedScore * VALUE_SCORE_PRECISION) /
    VALUE_SCORE_PRECISION;

  return clampScore(stableWeightedScore);
};

export const getValueScore = (listing, campus) => {
  // Keep the established affordability 35%, commute 25%, safety 25%,
  // amenities 15% formula, using the current campus-derived breakdown.
  return getWeightedValueScore(
    listing,
    campus,
    DEFAULT_VALUE_SCORE_WEIGHTS,
  );
};
