const CATEGORY_FIELDS = Object.freeze([
  "bestOverall",
  "bestBudget",
  "bestCommute",
  "bestSafety",
]);

const TOP_LEVEL_FIELDS = Object.freeze([
  ...CATEGORY_FIELDS,
  "listingInsights",
  "recommendation",
]);

const CATEGORY_RESULT_FIELDS = Object.freeze(["listingId", "reason"]);
const LISTING_INSIGHT_FIELDS = Object.freeze([
  "listingId",
  "advantage",
  "compromise",
]);

const MAX_CATEGORY_REASON_LENGTH = 400;
const MAX_INSIGHT_TEXT_LENGTH = 400;
const MAX_RECOMMENDATION_LENGTH = 800;

class ComparisonRecommendationValidationError extends Error {
  constructor(issues) {
    super("Comparison recommendation is invalid.");
    this.name = "ComparisonRecommendationValidationError";
    this.code = "COMPARISON_RECOMMENDATION_INVALID";
    this.issues = Array.isArray(issues) ? issues : [];
  }
}

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

const validateListingIds = (listingIds, issues) => {
  if (!Array.isArray(listingIds)) {
    issues.push("listingIds must be an array containing exactly 2 or 3 IDs.");
    return [];
  }

  if (listingIds.length !== 2 && listingIds.length !== 3) {
    issues.push("listingIds must contain exactly 2 or 3 IDs.");
  }

  const validIds = [];

  listingIds.forEach((listingId, index) => {
    if (typeof listingId !== "string" || !listingId.trim()) {
      issues.push(`listingIds[${index}] must be a non-empty string.`);
      return;
    }

    if (listingId !== listingId.trim()) {
      issues.push(`listingIds[${index}] must not contain surrounding whitespace.`);
      return;
    }

    validIds.push(listingId);
  });

  if (new Set(validIds).size !== validIds.length) {
    issues.push("listingIds must not contain duplicates.");
  }

  return validIds;
};

const assertValidListingIds = (listingIds) => {
  const issues = [];
  const validIds = validateListingIds(listingIds, issues);

  if (issues.length > 0) {
    throw new ComparisonRecommendationValidationError(issues);
  }

  return validIds;
};

const createNullableListingIdSchema = (listingIds) => ({
  anyOf: [
    { type: "string", enum: [...listingIds] },
    { type: "null" },
  ],
});

const createCategorySchema = (
  listingIds,
  description,
  approvedReason,
) => ({
  type: "object",
  additionalProperties: false,
  properties: {
    listingId: {
      ...createNullableListingIdSchema(listingIds),
      description:
        "A compared listing ID, or null when the supplied data cannot determine this category.",
    },
    reason: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CATEGORY_REASON_LENGTH,
      ...(typeof approvedReason === "string"
        ? { enum: [approvedReason] }
        : {}),
      description,
    },
  },
  required: [...CATEGORY_RESULT_FIELDS],
});

const createComparisonRecommendationJsonSchema = (
  listingIds,
  approvedGrounding,
) => {
  const insightGrounding = approvedGrounding?.listingInsights;
  const approvedAdvantages = insightGrounding
    ? Object.values(insightGrounding).flatMap(
        (options) => options?.advantages || [],
      )
    : [];
  const approvedCompromises = insightGrounding
    ? Object.values(insightGrounding).flatMap(
        (options) => options?.compromises || [],
      )
    : [];
  const approvedRecommendations = approvedGrounding
    ?.recommendationsByOverallListingId
    ? Object.values(
        approvedGrounding.recommendationsByOverallListingId,
      ).flat()
    : [];

  return {
  type: "object",
  additionalProperties: false,
  properties: {
    bestOverall: createCategorySchema(
      listingIds,
      "A concise, supplied-data-grounded explanation of the overall result.",
      approvedGrounding?.categoryReasons?.bestOverall,
    ),
    bestBudget: createCategorySchema(
      listingIds,
      "A concise explanation grounded in supplied monthly-rent data.",
      approvedGrounding?.categoryReasons?.bestBudget,
    ),
    bestCommute: createCategorySchema(
      listingIds,
      "A concise explanation grounded in supplied application commute data.",
      approvedGrounding?.categoryReasons?.bestCommute,
    ),
    bestSafety: createCategorySchema(
      listingIds,
      "A concise explanation grounded in supplied application safety data.",
      approvedGrounding?.categoryReasons?.bestSafety,
    ),
    listingInsights: {
      type: "array",
      minItems: listingIds.length,
      maxItems: listingIds.length,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          listingId: {
            type: "string",
            enum: [...listingIds],
          },
          advantage: {
            type: "string",
            minLength: 1,
            maxLength: MAX_INSIGHT_TEXT_LENGTH,
            ...(approvedAdvantages.length > 0
              ? { enum: [...new Set(approvedAdvantages)] }
              : {}),
          },
          compromise: {
            type: "string",
            minLength: 1,
            maxLength: MAX_INSIGHT_TEXT_LENGTH,
            ...(approvedCompromises.length > 0
              ? { enum: [...new Set(approvedCompromises)] }
              : {}),
          },
        },
        required: [...LISTING_INSIGHT_FIELDS],
      },
    },
    recommendation: {
      type: "string",
      minLength: 1,
      maxLength: MAX_RECOMMENDATION_LENGTH,
      ...(approvedRecommendations.length > 0
        ? { enum: [...new Set(approvedRecommendations)] }
        : {}),
    },
  },
  required: [...TOP_LEVEL_FIELDS],
  };
};

const createComparisonRecommendationResponseFormat = (
  listingIds,
  { approvedGrounding } = {},
) => {
  const validIds = assertValidListingIds(listingIds);

  return {
    type: "json_schema",
    json_schema: {
      name: "comparison_recommendation",
      strict: true,
      schema: createComparisonRecommendationJsonSchema(
        validIds,
        approvedGrounding,
      ),
    },
  };
};

const validateExactFields = (value, expectedFields, path, issues) => {
  const expectedFieldSet = new Set(expectedFields);
  const actualFields = Object.keys(value);
  const missingFields = expectedFields.filter(
    (field) => !Object.prototype.hasOwnProperty.call(value, field),
  );
  const unsupportedFields = actualFields.filter(
    (field) => !expectedFieldSet.has(field),
  );

  if (missingFields.length > 0) {
    issues.push(`${path} is missing required fields: ${missingFields.join(", ")}.`);
  }

  if (unsupportedFields.length > 0) {
    issues.push(
      `${path} contains unsupported fields: ${unsupportedFields.join(", ")}.`,
    );
  }
};

const validateText = (value, path, maxLength, issues) => {
  if (typeof value !== "string" || !value.trim()) {
    issues.push(`${path} must be a non-empty string.`);
    return null;
  }

  if (value.length > maxLength) {
    issues.push(`${path} must be ${maxLength} characters or fewer.`);
  }

  return value.trim();
};

const validateCategoryResult = (
  value,
  category,
  knownIds,
  expectedWinnerIds,
  approvedReason,
  issues,
) => {
  if (!isPlainObject(value)) {
    issues.push(`${category} must be a plain object.`);
    return null;
  }

  validateExactFields(value, CATEGORY_RESULT_FIELDS, category, issues);

  const listingId = value.listingId;
  if (listingId !== null && !knownIds.has(listingId)) {
    issues.push(
      `${category}.listingId must be null or one of the compared listing IDs.`,
    );
  }

  const reason = validateText(
    value.reason,
    `${category}.reason`,
    MAX_CATEGORY_REASON_LENGTH,
    issues,
  );

  if (
    approvedReason !== undefined &&
    (typeof approvedReason !== "string" || reason !== approvedReason)
  ) {
    issues.push(
      `${category}.reason must exactly match the application-approved grounded reason.`,
    );
  }

  if (expectedWinnerIds !== undefined) {
    if (!Array.isArray(expectedWinnerIds)) {
      issues.push(`${category} expected winner candidates must be an array.`);
    } else {
      const invalidCandidates = expectedWinnerIds.filter(
        (candidateId) => !knownIds.has(candidateId),
      );

      if (invalidCandidates.length > 0) {
        issues.push(
          `${category} expected winner candidates must use compared listing IDs.`,
        );
      } else if (expectedWinnerIds.length === 0 && listingId !== null) {
        issues.push(`${category}.listingId must be null when no winner is available.`);
      } else if (
        expectedWinnerIds.length > 0 &&
        !expectedWinnerIds.includes(listingId)
      ) {
        issues.push(
          `${category}.listingId must be one of the deterministic winner candidates.`,
        );
      }
    }
  }

  return {
    listingId:
      listingId === null || typeof listingId === "string" ? listingId : null,
    reason,
  };
};

const validateExpectedWinnerIds = (expectedWinnerIds, issues) => {
  if (expectedWinnerIds === undefined) {
    return {};
  }

  if (!isPlainObject(expectedWinnerIds)) {
    issues.push("expectedWinnerIds must be a plain object when provided.");
    return {};
  }

  const unsupportedFields = Object.keys(expectedWinnerIds).filter(
    (field) => !CATEGORY_FIELDS.includes(field),
  );

  if (unsupportedFields.length > 0) {
    issues.push(
      `expectedWinnerIds contains unsupported fields: ${unsupportedFields.join(", ")}.`,
    );
  }

  return expectedWinnerIds;
};

const validateListingInsights = (
  value,
  listingIds,
  knownIds,
  approvedInsightGrounding,
  issues,
) => {
  if (!Array.isArray(value)) {
    issues.push("listingInsights must be an array.");
    return [];
  }

  if (value.length !== listingIds.length) {
    issues.push(
      `listingInsights must contain exactly ${listingIds.length} entries.`,
    );
  }

  const seenIds = new Set();
  const normalizedInsights = value.map((insight, index) => {
    const path = `listingInsights[${index}]`;

    if (!isPlainObject(insight)) {
      issues.push(`${path} must be a plain object.`);
      return null;
    }

    validateExactFields(insight, LISTING_INSIGHT_FIELDS, path, issues);

    const listingId = insight.listingId;
    if (!knownIds.has(listingId)) {
      issues.push(`${path}.listingId must be one of the compared listing IDs.`);
    } else if (seenIds.has(listingId)) {
      issues.push(`${path}.listingId must not duplicate another listing insight.`);
    } else {
      seenIds.add(listingId);
    }

    const advantage = validateText(
      insight.advantage,
      `${path}.advantage`,
      MAX_INSIGHT_TEXT_LENGTH,
      issues,
    );
    const compromise = validateText(
      insight.compromise,
      `${path}.compromise`,
      MAX_INSIGHT_TEXT_LENGTH,
      issues,
    );
    const approvedOptions = approvedInsightGrounding?.[listingId];

    if (approvedInsightGrounding !== undefined) {
      if (
        !Array.isArray(approvedOptions?.advantages) ||
        !approvedOptions.advantages.includes(advantage)
      ) {
        issues.push(
          `${path}.advantage must exactly match an application-approved grounded statement for this listing.`,
        );
      }

      if (
        !Array.isArray(approvedOptions?.compromises) ||
        !approvedOptions.compromises.includes(compromise)
      ) {
        issues.push(
          `${path}.compromise must exactly match an application-approved grounded statement for this listing.`,
        );
      }
    }

    return {
      listingId: typeof listingId === "string" ? listingId : "",
      advantage,
      compromise,
    };
  });

  const missingIds = listingIds.filter((listingId) => !seenIds.has(listingId));
  if (missingIds.length > 0) {
    issues.push(
      `listingInsights is missing compared listing IDs: ${missingIds.join(", ")}.`,
    );
  }

  return normalizedInsights;
};

const validateComparisonRecommendation = (
  input,
  { listingIds, expectedWinnerIds, approvedGrounding } = {},
) => {
  const issues = [];
  const validListingIds = validateListingIds(listingIds, issues);
  const knownIds = new Set(validListingIds);
  const winnerCandidates = validateExpectedWinnerIds(expectedWinnerIds, issues);

  if (!isPlainObject(input)) {
    issues.push("Comparison recommendation must be a plain object.");
    throw new ComparisonRecommendationValidationError(issues);
  }

  validateExactFields(input, TOP_LEVEL_FIELDS, "recommendation output", issues);

  const normalizedCategories = Object.fromEntries(
    CATEGORY_FIELDS.map((category) => [
      category,
      validateCategoryResult(
        input[category],
        category,
        knownIds,
        winnerCandidates[category],
        approvedGrounding?.categoryReasons?.[category],
        issues,
      ),
    ]),
  );

  const listingInsights = validateListingInsights(
    input.listingInsights,
    validListingIds,
    knownIds,
    approvedGrounding?.listingInsights,
    issues,
  );
  const recommendation = validateText(
    input.recommendation,
    "recommendation",
    MAX_RECOMMENDATION_LENGTH,
    issues,
  );

  if (approvedGrounding !== undefined) {
    const selectedOverallId = normalizedCategories.bestOverall?.listingId;
    const approvedRecommendations =
      approvedGrounding.recommendationsByOverallListingId?.[
        selectedOverallId
      ];

    if (
      !Array.isArray(approvedRecommendations) ||
      !approvedRecommendations.includes(recommendation)
    ) {
      issues.push(
        "recommendation must exactly match an application-approved grounded recommendation for bestOverall.listingId.",
      );
    }
  }

  if (issues.length > 0) {
    throw new ComparisonRecommendationValidationError(issues);
  }

  return {
    ...normalizedCategories,
    listingInsights,
    recommendation,
  };
};

module.exports = {
  ComparisonRecommendationValidationError,
  createComparisonRecommendationResponseFormat,
  validateComparisonRecommendation,
};
