import {
  DATA_UNAVAILABLE,
  formatCommute,
  formatRent,
  getAmenities,
  getCommuteMinutes,
  getListingTitle,
  getSafetyLevel,
  getValueScore,
  getWeightedValueScore,
} from "../utils/listingFormatters";

const getRentNumber = (listing) => {
  const rent = Number(listing?.monthlyRent ?? listing?.rent);
  return Number.isFinite(rent) && rent >= 0 ? rent : null;
};

const getTieBreakerValue = (value) =>
  value === null ? Number.POSITIVE_INFINITY : value;

const getDisplayTitle = (listing) => {
  const title = getListingTitle(listing);
  return title === DATA_UNAVAILABLE ? "This listing" : title;
};

const formatAmenityList = (amenities) => {
  const visibleAmenities = amenities.slice(0, 3);

  if (visibleAmenities.length === 1) {
    return visibleAmenities[0];
  }

  if (visibleAmenities.length === 2) {
    return `${visibleAmenities[0]} and ${visibleAmenities[1]}`;
  }

  return `${visibleAmenities[0]}, ${visibleAmenities[1]}, and ${visibleAmenities[2]}`;
};

const getListingScore = (listing, campus, weights) =>
  weights
    ? getWeightedValueScore(listing, campus, weights)
    : getValueScore(listing, campus);

const compareListings = (firstListing, secondListing, campus, weights) => {
  const scoreDifference =
    getListingScore(secondListing, campus, weights) -
    getListingScore(firstListing, campus, weights);

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  const rentDifference =
    getTieBreakerValue(getRentNumber(firstListing)) -
    getTieBreakerValue(getRentNumber(secondListing));

  if (rentDifference !== 0) {
    return rentDifference;
  }

  const commuteDifference =
    getTieBreakerValue(getCommuteMinutes(firstListing, campus)) -
    getTieBreakerValue(getCommuteMinutes(secondListing, campus));

  if (commuteDifference !== 0) {
    return commuteDifference;
  }

  return getDisplayTitle(firstListing).localeCompare(getDisplayTitle(secondListing));
};

const getRecommendedListing = (listings, campus, weights) =>
  listings.reduce((bestListing, listing) => {
    if (!bestListing) {
      return listing;
    }

    return compareListings(listing, bestListing, campus, weights) < 0
      ? listing
      : bestListing;
  }, null);

const getRecommendationReasons = (listing, campus) => {
  const reasons = [];
  const rent = getRentNumber(listing);
  const commuteMinutes = getCommuteMinutes(listing, campus);
  const safetyLevel = getSafetyLevel(listing);
  const amenities = getAmenities(listing);

  if (rent !== null) {
    reasons.push(`Rent is listed at ${formatRent(rent)}.`);
  }

  if (commuteMinutes !== null) {
    reasons.push(
      `Estimated commute to your selected campus is ${formatCommute(
        listing,
        campus,
      )}.`,
    );
  }

  if (safetyLevel !== DATA_UNAVAILABLE) {
    reasons.push(`Safety data shows ${safetyLevel} crime level.`);
  }

  if (amenities.length > 0) {
    reasons.push(
      `It includes ${amenities.length} amenit${
        amenities.length === 1 ? "y" : "ies"
      }, including ${formatAmenityList(amenities)}.`,
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      "This listing currently has the highest Value Score among the displayed results.",
    );
  }

  return reasons.slice(0, 4);
};

function RecommendationSummary({ listings, campus, valueScoreWeights }) {
  if (!Array.isArray(listings) || listings.length === 0) {
    return null;
  }

  const recommendedListing = getRecommendedListing(
    listings,
    campus,
    valueScoreWeights,
  );

  if (!recommendedListing) {
    return null;
  }

  const title = getDisplayTitle(recommendedListing);
  const valueScore = getListingScore(recommendedListing, campus, valueScoreWeights);
  const reasons = getRecommendationReasons(recommendedListing, campus);

  return (
    <section
      className="recommendation-summary"
      aria-labelledby="recommendation-title"
    >
      <div className="recommendation-summary-header">
        <div>
          <h3
            id="recommendation-title"
            className="recommendation-summary-eyebrow"
          >
            Recommended Match
          </h3>
          <p className="recommendation-summary-title">
            {title}
          </p>
        </div>
        <span className="recommendation-score-pill">
          Value Score {valueScore}/100
        </span>
      </div>

      <p className="recommendation-summary-copy">
        {title} looks like your strongest match based on the current results,
        with a Value Score of {valueScore}/100.
      </p>

      <div>
        <strong>Why this stands out:</strong>
        <ul className="recommendation-reasons">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default RecommendationSummary;
