export const DATA_UNAVAILABLE = "Data unavailable";

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
  const commute = normalizedCampus
    ? listing.commuteEstimates.find(
        (estimate) => normalizeCampusName(estimate?.campus) === normalizedCampus,
      )
    : listing.commuteEstimates[0];

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

const getProvidedValueScore = (listing) => {
  const rawScore =
    listing?.valueScore?.overall ??
    listing?.valueScore?.score ??
    listing?.valueScore ??
    listing?.score;
  const score = Number(rawScore);

  return Number.isFinite(score) ? clampScore(score) : null;
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

export const getValueScoreBreakdown = (listing, campus) => ({
  affordability: getAffordabilityScore(listing),
  commute: getCommuteScore(listing, campus),
  safety: getSafetyScore(listing),
  amenities: getAmenitiesScore(listing),
});

export const getValueScore = (listing, campus) => {
  const providedScore = getProvidedValueScore(listing);

  if (providedScore !== null) {
    return providedScore;
  }

  const breakdown = getValueScoreBreakdown(listing, campus);

  // Phase 0 fallback only: affordability 35%, commute 25%, safety 25%,
  // amenities 15%. Backend valueScore wins when it exists.
  return clampScore(
    breakdown.affordability * 0.35 +
      breakdown.commute * 0.25 +
      breakdown.safety * 0.25 +
      breakdown.amenities * 0.15,
  );
};
