import { apiRequest } from "./api";
import { normalizeComparisonCampus } from "./comparisonContext";
import { normalizeValueScoreWeights } from "./listingFormatters";

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
const OBJECT_ID_TOKEN_PATTERN = /[0-9a-f]{24}/gi;
const CATEGORY_FIELDS = [
  "bestOverall",
  "bestBudget",
  "bestCommute",
  "bestSafety",
];
const AMENITY_TEXT_PATTERN = /\bamenit(?:y|ies)\b/i;

const retryableErrorCodes = new Set([
  "AI_NOT_CONFIGURED",
  "AI_CONFIGURATION_INVALID",
  "AI_SERVICE_UNAVAILABLE",
  "AI_SERVICE_TIMEOUT",
  "AI_OUTPUT_INVALID",
  "COMPARISON_SERVICE_UNAVAILABLE",
]);

const selectionErrorCodes = new Set([
  "INVALID_COMPARISON_REQUEST",
  "INVALID_COMPARISON_COUNT",
  "INVALID_LISTING_ID",
  "DUPLICATE_LISTING_IDS",
  "INVALID_COMPARISON_CONTEXT",
  "LISTING_NOT_FOUND",
  "LISTING_INACTIVE",
]);

const errorMessages = {
  AI_AUTH_REQUIRED: "Sign in to generate an AI recommendation.",
  AI_NOT_CONFIGURED: "AI recommendations are temporarily unavailable.",
  AI_CONFIGURATION_INVALID:
    "AI recommendations are temporarily unavailable.",
  AI_SERVICE_UNAVAILABLE:
    "The AI service is unavailable right now. Please try again.",
  AI_SERVICE_TIMEOUT: "The AI recommendation took too long. Please retry.",
  AI_OUTPUT_INVALID:
    "We couldn't generate a reliable recommendation. Please try again.",
  COMPARISON_SERVICE_UNAVAILABLE:
    "We couldn't generate the AI recommendation right now. Your regular comparison is still available.",
};

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

const createAiComparisonError = (code, message, status = null) => {
  const error = new Error(message);
  error.name = "AiComparisonError";
  error.code = code;
  error.status = status;
  return error;
};

const createInvalidOutputError = () =>
  createAiComparisonError(
    "AI_OUTPUT_INVALID",
    "AI comparison returned an invalid response.",
  );

const normalizeListingId = (listingId) =>
  typeof listingId === "string" && OBJECT_ID_PATTERN.test(listingId)
    ? listingId.toLowerCase()
    : null;

const validateRequestListingIds = (listingIds) => {
  if (
    !Array.isArray(listingIds) ||
    (listingIds.length !== 2 && listingIds.length !== 3)
  ) {
    throw createAiComparisonError(
      "INVALID_COMPARISON_COUNT",
      "Exactly 2 or 3 listing IDs are required.",
    );
  }

  const normalizedIds = listingIds.map(normalizeListingId);

  if (normalizedIds.some((listingId) => listingId === null)) {
    throw createAiComparisonError(
      "INVALID_LISTING_ID",
      "Each listing ID must be valid.",
    );
  }

  if (new Set(normalizedIds).size !== normalizedIds.length) {
    throw createAiComparisonError(
      "DUPLICATE_LISTING_IDS",
      "Listing IDs must be unique.",
    );
  }

  return normalizedIds;
};

export const normalizeAiComparisonContext = ({
  campus,
  valueScoreWeights,
} = {}) => ({
  campus: normalizeComparisonCampus(campus) || null,
  valueScoreWeights: normalizeValueScoreWeights(valueScoreWeights),
});

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const containsUnknownObjectId = (value, selectedIdSet, visited = new Set()) => {
  if (typeof value === "string") {
    const objectIds = value.match(OBJECT_ID_TOKEN_PATTERN) || [];
    return objectIds.some(
      (listingId) => !selectedIdSet.has(listingId.toLowerCase()),
    );
  }

  if (!value || typeof value !== "object" || visited.has(value)) {
    return false;
  }

  visited.add(value);

  if (Array.isArray(value)) {
    return value.some((item) =>
      containsUnknownObjectId(item, selectedIdSet, visited),
    );
  }

  return Object.values(value).some((item) =>
    containsUnknownObjectId(item, selectedIdSet, visited),
  );
};

export const validateAiComparisonRecommendation = (
  recommendation,
  listingIds,
) => {
  const normalizedIds = validateRequestListingIds(listingIds);
  const selectedIdSet = new Set(normalizedIds);

  if (!isPlainObject(recommendation)) {
    throw createInvalidOutputError();
  }

  for (const category of CATEGORY_FIELDS) {
    const result = recommendation[category];

    if (!isPlainObject(result) || !isNonEmptyString(result.reason)) {
      throw createInvalidOutputError();
    }

    if (
      result.listingId !== null &&
      !selectedIdSet.has(normalizeListingId(result.listingId))
    ) {
      throw createInvalidOutputError();
    }
  }

  if (
    !Array.isArray(recommendation.listingInsights) ||
    recommendation.listingInsights.length !== normalizedIds.length
  ) {
    throw createInvalidOutputError();
  }

  const insightIds = new Set();

  for (const insight of recommendation.listingInsights) {
    if (
      !isPlainObject(insight) ||
      !isNonEmptyString(insight.advantage) ||
      !isNonEmptyString(insight.compromise)
    ) {
      throw createInvalidOutputError();
    }

    const normalizedInsightId = normalizeListingId(insight.listingId);

    if (
      !selectedIdSet.has(normalizedInsightId) ||
      insightIds.has(normalizedInsightId)
    ) {
      throw createInvalidOutputError();
    }

    insightIds.add(normalizedInsightId);
  }

  if (
    normalizedIds.some((listingId) => !insightIds.has(listingId)) ||
    !isNonEmptyString(recommendation.recommendation) ||
    containsUnknownObjectId(recommendation, selectedIdSet)
  ) {
    throw createInvalidOutputError();
  }

  return recommendation;
};

export const requestAiComparisonRecommendation = async (
  listingIds,
  { authToken, signal, campus, valueScoreWeights } = {},
) => {
  validateRequestListingIds(listingIds);
  const comparisonContext = normalizeAiComparisonContext({
    campus,
    valueScoreWeights,
  });

  const normalizedAuthToken =
    typeof authToken === "string" ? authToken.trim() : "";

  if (!normalizedAuthToken) {
    throw createAiComparisonError(
      "AI_AUTH_REQUIRED",
      "Authentication is required to generate an AI comparison.",
      401,
    );
  }

  const data = await apiRequest("/api/ai/compare", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${normalizedAuthToken}`,
    },
    body: JSON.stringify({
      listingIds: [...listingIds],
      ...comparisonContext,
    }),
    ...(signal ? { signal } : {}),
  });

  if (!data?.success) {
    throw createInvalidOutputError();
  }

  return validateAiComparisonRecommendation(data.recommendation, listingIds);
};

export const getAiComparisonErrorPresentation = (error) => {
  if (error?.status === 401 || error?.code === "AI_AUTH_REQUIRED") {
    return {
      message: errorMessages.AI_AUTH_REQUIRED,
      retryable: false,
    };
  }

  if (error?.code === "INVALID_COMPARISON_CONTEXT") {
    return {
      message:
        "The current campus or Value Score weights cannot be used for this AI comparison.",
      retryable: false,
    };
  }

  if (selectionErrorCodes.has(error?.code)) {
    return {
      message:
        "The selected listings are no longer available for this AI comparison.",
      retryable: false,
    };
  }

  return {
    message:
      errorMessages[error?.code] ||
      "We couldn't generate the AI recommendation right now. Your regular comparison is still available.",
    retryable: !error?.code || retryableErrorCodes.has(error.code),
  };
};

const getTitleEntries = (titleById) => {
  if (titleById instanceof Map) {
    return titleById.entries();
  }

  if (isPlainObject(titleById)) {
    return Object.entries(titleById);
  }

  return [];
};

export const formatAiComparisonText = (text, titleById) => {
  if (typeof text !== "string") {
    return "";
  }

  const normalizedTitles = new Map();

  for (const [listingId, title] of getTitleEntries(titleById)) {
    const normalizedId = normalizeListingId(listingId);

    if (normalizedId && isNonEmptyString(title)) {
      normalizedTitles.set(normalizedId, title.trim());
    }
  }

  return text.replace(OBJECT_ID_TOKEN_PATTERN, (listingId) =>
    normalizedTitles.get(listingId.toLowerCase()) || "selected listing",
  );
};

export const getAmenityInsights = (recommendation) => {
  if (!Array.isArray(recommendation?.listingInsights)) {
    return [];
  }

  return recommendation.listingInsights.flatMap((insight) => {
    if (!isPlainObject(insight) || typeof insight.listingId !== "string") {
      return [];
    }

    return ["advantage", "compromise"].flatMap((type) => {
      const text = insight[type];

      return typeof text === "string" && AMENITY_TEXT_PATTERN.test(text)
        ? [{ listingId: insight.listingId, type, text }]
        : [];
    });
  });
};
