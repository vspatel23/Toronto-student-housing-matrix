const clampScore = (score) => {
  const numericScore = Number(score);

  if (!Number.isFinite(numericScore)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numericScore)));
};

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const normalizeCampusName = (value) =>
  hasValue(value)
    ? String(value)
        .replace(/--/g, "-")
        .replace(/[—–]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
    : "";

const isMatchingCampusName = (estimateCampus, selectedCampus) => {
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

const getRentNumber = (listing) => {
  const rent = Number(listing?.monthlyRent ?? listing?.rent);
  return Number.isFinite(rent) && rent >= 0 ? rent : null;
};

const getCommuteMinutes = (listing, campus) => {
  if (!Array.isArray(listing?.commuteEstimates)) {
    return null;
  }

  const normalizedCampus = normalizeCampusName(campus);
  let commuteEstimate;

  if (normalizedCampus) {
    commuteEstimate = listing.commuteEstimates.find(
      (estimate) => isMatchingCampusName(estimate?.campus, campus),
    );

    if (!commuteEstimate) {
      return null;
    }
  } else {
    commuteEstimate = listing.commuteEstimates[0];
  }

  const minutes = Number(commuteEstimate?.minutes);
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
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

const calculateValueScore = (listing, campus) => {
  const breakdown = calculateValueScoreBreakdown(listing, campus);

  // Value Score formula:
  // Affordability 35% + Commute 25% + Safety 25% + Amenities 15%.
  // The weights reflect the project goal: students usually care most about rent,
  // but commute and safety are also major decision factors.
  const overall =
    breakdown.affordability * 0.35 +
    breakdown.commute * 0.25 +
    breakdown.safety * 0.25 +
    breakdown.amenities * 0.15;

  return clampScore(overall);
};

module.exports = {
  calculateValueScore,
  calculateValueScoreBreakdown,
};
