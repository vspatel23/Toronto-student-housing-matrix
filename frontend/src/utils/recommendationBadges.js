import {
  DATA_UNAVAILABLE,
  getAmenities,
  getCommuteMinutes,
  getListingId,
  getListingTitle,
  getSafetyLevel,
  getValueScore,
  getWeightedValueScore,
} from "./listingFormatters";

const MAX_BADGES_PER_LISTING = 3;

const BADGES = {
  value: { label: "Best Value", tone: "value" },
  budget: { label: "Best Budget", tone: "budget" },
  commute: { label: "Shortest Commute", tone: "commute" },
  safety: { label: "Safest", tone: "safety" },
  amenities: { label: "Most Amenities", tone: "amenities" },
};

const badgePriority = ["value", "budget", "commute", "safety", "amenities"];

const getRentNumber = (listing) => {
  const rent = Number(listing?.monthlyRent ?? listing?.rent);
  return Number.isFinite(rent) && rent >= 0 ? rent : null;
};

const getSortableTitle = (listing) => {
  const title = getListingTitle(listing);
  return title === DATA_UNAVAILABLE ? "" : title.toLowerCase();
};

const getTieBreakerValue = (value) =>
  value === null ? Number.POSITIVE_INFINITY : value;

const getListingScore = (listing, campus, weights) =>
  weights
    ? getWeightedValueScore(listing, campus, weights)
    : getValueScore(listing, campus);

const compareLowerTieBreaker = (listingValue, bestListingValue) => {
  const currentValue = getTieBreakerValue(listingValue);
  const bestValue = getTieBreakerValue(bestListingValue);

  if (currentValue === bestValue) {
    return 0;
  }

  return currentValue < bestValue ? 1 : -1;
};

const clampSafetyScore = (score) => {
  const numericScore = Number(score);

  if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100) {
    return null;
  }

  return numericScore;
};

const getSafetyScore = (listing) => {
  const directSafetyScore = clampSafetyScore(listing?.safety?.safetyScore);

  if (directSafetyScore !== null) {
    return directSafetyScore;
  }

  const breakdownSafetyScore = clampSafetyScore(
    listing?.valueScoreBreakdown?.safety,
  );

  if (breakdownSafetyScore !== null) {
    return breakdownSafetyScore;
  }

  const safetyLevel = getSafetyLevel(listing).toLowerCase();

  if (safetyLevel === DATA_UNAVAILABLE.toLowerCase()) {
    return null;
  }

  if (safetyLevel.includes("low")) {
    return 100;
  }

  if (safetyLevel.includes("medium")) {
    return 72;
  }

  if (safetyLevel.includes("high")) {
    return 42;
  }

  return null;
};

const compareBestValue = (listing, bestListing, campus, weights) => {
  const scoreDifference =
    getListingScore(listing, campus, weights) -
    getListingScore(bestListing, campus, weights);

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  const rentDifference = compareLowerTieBreaker(
    getRentNumber(listing),
    getRentNumber(bestListing),
  );

  if (rentDifference !== 0) {
    return rentDifference;
  }

  const commuteDifference = compareLowerTieBreaker(
    getCommuteMinutes(listing, campus),
    getCommuteMinutes(bestListing, campus),
  );

  if (commuteDifference !== 0) {
    return commuteDifference;
  }

  return getSortableTitle(bestListing).localeCompare(getSortableTitle(listing));
};

const chooseBestListing = (listings, isBetter) =>
  listings.reduce((bestListing, listing) => {
    if (!getListingId(listing)) {
      return bestListing;
    }

    if (!bestListing) {
      return listing;
    }

    return isBetter(listing, bestListing) ? listing : bestListing;
  }, null);

const chooseLowestRentListing = (listings, campus, weights) =>
  chooseBestListing(listings, (listing, bestListing) => {
    const rent = getRentNumber(listing);
    const bestRent = getRentNumber(bestListing);

    if (rent === null) {
      return false;
    }

    if (bestRent === null || rent !== bestRent) {
      return bestRent === null || rent < bestRent;
    }

    const scoreDifference =
      getListingScore(listing, campus, weights) -
      getListingScore(bestListing, campus, weights);

    if (scoreDifference !== 0) {
      return scoreDifference > 0;
    }

    return getSortableTitle(listing).localeCompare(getSortableTitle(bestListing)) < 0;
  });

const chooseShortestCommuteListing = (listings, campus, weights) =>
  chooseBestListing(listings, (listing, bestListing) => {
    const commuteMinutes = getCommuteMinutes(listing, campus);
    const bestCommuteMinutes = getCommuteMinutes(bestListing, campus);

    if (commuteMinutes === null) {
      return false;
    }

    if (bestCommuteMinutes === null || commuteMinutes !== bestCommuteMinutes) {
      return bestCommuteMinutes === null || commuteMinutes < bestCommuteMinutes;
    }

    const scoreDifference =
      getListingScore(listing, campus, weights) -
      getListingScore(bestListing, campus, weights);

    if (scoreDifference !== 0) {
      return scoreDifference > 0;
    }

    return getSortableTitle(listing).localeCompare(getSortableTitle(bestListing)) < 0;
  });

const chooseSafestListing = (listings, campus, weights) =>
  chooseBestListing(listings, (listing, bestListing) => {
    const safetyScore = getSafetyScore(listing);
    const bestSafetyScore = getSafetyScore(bestListing);

    if (safetyScore === null) {
      return false;
    }

    if (bestSafetyScore === null || safetyScore !== bestSafetyScore) {
      return bestSafetyScore === null || safetyScore > bestSafetyScore;
    }

    const scoreDifference =
      getListingScore(listing, campus, weights) -
      getListingScore(bestListing, campus, weights);

    if (scoreDifference !== 0) {
      return scoreDifference > 0;
    }

    return getSortableTitle(listing).localeCompare(getSortableTitle(bestListing)) < 0;
  });

const chooseMostAmenitiesListing = (listings, campus, weights) =>
  chooseBestListing(listings, (listing, bestListing) => {
    const amenitiesCount = getAmenities(listing).length;
    const bestAmenitiesCount = getAmenities(bestListing).length;

    if (amenitiesCount === 0) {
      return false;
    }

    if (bestAmenitiesCount === 0 || amenitiesCount !== bestAmenitiesCount) {
      return bestAmenitiesCount === 0 || amenitiesCount > bestAmenitiesCount;
    }

    const scoreDifference =
      getListingScore(listing, campus, weights) -
      getListingScore(bestListing, campus, weights);

    if (scoreDifference !== 0) {
      return scoreDifference > 0;
    }

    return getSortableTitle(listing).localeCompare(getSortableTitle(bestListing)) < 0;
  });

const addBadge = (badgesByListingId, listing, badgeKey) => {
  const listingId = getListingId(listing);

  if (!listingId) {
    return;
  }

  badgesByListingId[listingId] = badgesByListingId[listingId] || [];
  badgesByListingId[listingId].push(BADGES[badgeKey]);
};

const sortAndLimitBadges = (badges) =>
  badges
    .sort(
      (firstBadge, secondBadge) =>
        badgePriority.indexOf(firstBadge.tone) -
        badgePriority.indexOf(secondBadge.tone),
    )
    .slice(0, MAX_BADGES_PER_LISTING);

export const getRecommendationBadgesByListingId = (listings, campus, weights) => {
  if (!Array.isArray(listings) || listings.length === 0) {
    return {};
  }

  const badgesByListingId = {};
  const listingsWithValidRent = listings.filter(
    (listing) => getRentNumber(listing) !== null,
  );
  const listingsWithValidCommute = listings.filter(
    (listing) => getCommuteMinutes(listing, campus) !== null,
  );
  const listingsWithSafetyData = listings.filter(
    (listing) => getSafetyScore(listing) !== null,
  );
  const listingsWithAmenities = listings.filter(
    (listing) => getAmenities(listing).length > 0,
  );

  const bestValueListing = chooseBestListing(
    listings,
    (listing, bestListing) =>
      compareBestValue(listing, bestListing, campus, weights) > 0,
  );
  const lowestRentListing = chooseLowestRentListing(
    listingsWithValidRent,
    campus,
    weights,
  );
  const shortestCommuteListing = chooseShortestCommuteListing(
    listingsWithValidCommute,
    campus,
    weights,
  );
  const safestListing = chooseSafestListing(
    listingsWithSafetyData,
    campus,
    weights,
  );
  const mostAmenitiesListing = chooseMostAmenitiesListing(
    listingsWithAmenities,
    campus,
    weights,
  );

  addBadge(badgesByListingId, bestValueListing, "value");
  addBadge(badgesByListingId, lowestRentListing, "budget");
  addBadge(badgesByListingId, shortestCommuteListing, "commute");
  addBadge(badgesByListingId, safestListing, "safety");
  addBadge(badgesByListingId, mostAmenitiesListing, "amenities");

  return Object.fromEntries(
    Object.entries(badgesByListingId).map(([listingId, badges]) => [
      listingId,
      sortAndLimitBadges(badges),
    ]),
  );
};
