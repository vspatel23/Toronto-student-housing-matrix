const CATEGORY_FIELDS = Object.freeze([
  "bestOverall",
  "bestBudget",
  "bestCommute",
  "bestSafety",
]);

const { getAvailableSafetyScore } = require("./valueScore");

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const formatNumber = (value) =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

const unique = (values) => [...new Set(values)];

const getOverallScore = (listing) =>
  isFiniteNumber(listing.preferenceWeightedValueScore)
    ? listing.preferenceWeightedValueScore
    : listing.valueScore;

const getSafetyComparisonValue = (listing) =>
  getAvailableSafetyScore({ safety: listing.safety });

const createCategorySelections = (categoryCandidates) =>
  Object.fromEntries(
    CATEGORY_FIELDS.map((category) => [
      category,
      Array.isArray(categoryCandidates?.[category]) &&
      categoryCandidates[category].length > 0
        ? [categoryCandidates[category][0]]
        : [],
    ]),
  );

const buildCategoryReasons = (listingsById, categoryCandidates) => {
  const reasonFor = (category, availableReason, unavailableReason) => {
    const candidates = categoryCandidates[category];

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return unavailableReason;
    }

    const listing = listingsById.get(candidates[0]);
    return availableReason(listing, candidates.length > 1);
  };

  return {
    bestOverall: reasonFor(
      "bestOverall",
      (listing, tied) => {
        const score = getOverallScore(listing);
        const scoreName = isFiniteNumber(listing.preferenceWeightedValueScore)
          ? "application-calculated preference-weighted comparison score"
          : "existing Value Score";
        return `This listing ${tied ? "is tied for" : "has"} the highest ${scoreName} at ${formatNumber(score)}/100 among the compared listings.`;
      },
      "The supplied data does not establish an overall score result.",
    ),
    bestBudget: reasonFor(
      "bestBudget",
      (listing, tied) =>
        `This listing ${tied ? "is tied for" : "has"} the lowest supplied monthly rent at $${formatNumber(listing.monthlyRent)} per month.`,
      "The supplied listings do not include comparable monthly-rent data.",
    ),
    bestCommute: reasonFor(
      "bestCommute",
      (listing, tied) =>
        `This listing ${tied ? "is tied for" : "has"} the shortest supplied commute at ${formatNumber(listing.commute.minutes)} minutes for the applicable campus context.`,
      "The supplied listings do not include comparable commute data for the applicable campus.",
    ),
    bestSafety: reasonFor(
      "bestSafety",
      (listing, tied) =>
        `This listing ${tied ? "is tied for" : "has"} the highest available application safety comparison value at ${formatNumber(getSafetyComparisonValue(listing))}/100.`,
      "The supplied listings do not include comparable safety data.",
    ),
  };
};

const getMinimum = (listings, getter) => {
  const values = listings.map(getter).filter(isFiniteNumber);
  return values.length > 0 ? Math.min(...values) : null;
};

const getMaximum = (listings, getter) => {
  const values = listings.map(getter).filter(isFiniteNumber);
  return values.length > 0 ? Math.max(...values) : null;
};

const buildListingInsightOptions = (
  listings,
  categoryCandidates,
  categoryReasons,
  preferences,
) => {
  const lowestRent = getMinimum(listings, (listing) => listing.monthlyRent);
  const shortestCommute = getMinimum(
    listings,
    (listing) => listing.commute?.minutes,
  );
  const highestSafety = getMaximum(listings, getSafetyComparisonValue);
  const highestAmenityCount = getMaximum(
    listings,
    (listing) => listing.amenities.length,
  );
  const highestAmenityListingCount = highestAmenityCount === null
    ? 0
    : listings.filter(
        (listing) => listing.amenities.length === highestAmenityCount,
      ).length;
  const savedMaximumRent = isFiniteNumber(preferences?.maxBudget)
    ? preferences.maxBudget
    : preferences?.maxRent;

  return Object.fromEntries(
    listings.map((listing) => {
      const advantages = [];
      const compromises = [];

      CATEGORY_FIELDS.forEach((category) => {
        if (categoryCandidates[category].includes(listing.id)) {
          advantages.push(
            categoryReasons[category].replace(/^This listing/, "It"),
          );
        }
      });

      if (listing.furnished === true) {
        advantages.push("It is stored as furnished in the listing data.");
      } else if (listing.furnished === false) {
        compromises.push("It is stored as unfurnished in the listing data.");
      }

      if (
        highestAmenityCount !== null &&
        highestAmenityCount > 0 &&
        listing.amenities.length === highestAmenityCount
      ) {
        advantages.push(
          `It lists ${highestAmenityCount} stored amenities, ${highestAmenityListingCount > 1 ? "tied for the most" : "the most"} among the compared listings.`,
        );
      } else if (
        highestAmenityCount !== null &&
        listing.amenities.length < highestAmenityCount
      ) {
        compromises.push(
          `It lists ${highestAmenityCount - listing.amenities.length} fewer stored amenities than the compared listing with the most.`,
        );
      }

      if (
        isFiniteNumber(savedMaximumRent) &&
        isFiniteNumber(listing.monthlyRent)
      ) {
        if (listing.monthlyRent <= savedMaximumRent) {
          advantages.push(
            `Its monthly rent of $${formatNumber(listing.monthlyRent)} is within the saved maximum of $${formatNumber(savedMaximumRent)}.`,
          );
        } else {
          compromises.push(
            `Its monthly rent of $${formatNumber(listing.monthlyRent)} is $${formatNumber(listing.monthlyRent - savedMaximumRent)} above the saved maximum.`,
          );
        }
      }

      if (
        isFiniteNumber(lowestRent) &&
        isFiniteNumber(listing.monthlyRent) &&
        listing.monthlyRent > lowestRent
      ) {
        compromises.push(
          `Its monthly rent is $${formatNumber(listing.monthlyRent - lowestRent)} higher than the lowest-rent compared listing.`,
        );
      }

      if (!isFiniteNumber(listing.commute?.minutes)) {
        compromises.push(
          "The supplied data does not include an applicable commute estimate for this listing.",
        );
      } else if (
        isFiniteNumber(shortestCommute) &&
        listing.commute.minutes > shortestCommute
      ) {
        compromises.push(
          `Its supplied commute is ${formatNumber(listing.commute.minutes - shortestCommute)} minutes longer than the shortest compared commute.`,
        );
      }

      const safetyValue = getSafetyComparisonValue(listing);
      if (!isFiniteNumber(safetyValue)) {
        compromises.push(
          "The supplied data does not include an available safety comparison value for this listing.",
        );
      } else if (
        isFiniteNumber(highestSafety) &&
        safetyValue < highestSafety
      ) {
        compromises.push(
          `Its application safety comparison value is ${formatNumber(highestSafety - safetyValue)} points below the highest compared value.`,
        );
      }

      if (advantages.length === 0) {
        advantages.push(
          "The supplied data does not establish a unique main advantage for this listing.",
        );
      }

      if (compromises.length === 0) {
        compromises.push(
          "The supplied data does not establish a unique main compromise for this listing.",
        );
      }

      return [
        listing.id,
        {
          advantages: unique(advantages),
          compromises: unique(compromises),
        },
      ];
    }),
  );
};

const buildRecommendationOptions = (
  listingsById,
  categoryCandidates,
  categorySelections,
  insightOptions,
) => {
  const selectedId = categorySelections.bestOverall[0];

  if (!selectedId) {
    return {};
  }

  const listing = listingsById.get(selectedId);
  const score = getOverallScore(listing);
  const scoreDescription = isFiniteNumber(
    listing.preferenceWeightedValueScore,
  )
    ? "application-calculated preference-weighted comparison score"
    : "existing Value Score";
  const tieDescription = categoryCandidates.bestOverall.length > 1
    ? `is tied for the highest ${scoreDescription}`
    : `has the highest ${scoreDescription}`;
  const prefix = `Choose listing ${selectedId}, which ${tieDescription} at ${formatNumber(score)}/100.`;

  return {
    [selectedId]: insightOptions[selectedId].compromises.map(
      (compromise) => `${prefix} Important tradeoff: ${compromise}`,
    ),
  };
};

const buildComparisonGrounding = ({
  listings,
  preferences,
  categoryCandidates,
}) => {
  const listingsById = new Map(
    listings.map((listing) => [listing.id, listing]),
  );
  const categorySelections = createCategorySelections(categoryCandidates);
  const categoryReasons = buildCategoryReasons(
    listingsById,
    categoryCandidates,
  );
  const listingInsights = buildListingInsightOptions(
    listings,
    categoryCandidates,
    categoryReasons,
    preferences,
  );
  const recommendationsByOverallListingId = buildRecommendationOptions(
    listingsById,
    categoryCandidates,
    categorySelections,
    listingInsights,
  );

  return {
    categorySelections,
    approvedGrounding: {
      categoryReasons,
      listingInsights,
      recommendationsByOverallListingId,
    },
  };
};

module.exports = {
  buildComparisonGrounding,
};
