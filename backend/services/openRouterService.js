const {
  DEFAULT_OPENROUTER_TIMEOUT_MS,
  OPENROUTER_APP_TITLE,
  OPENROUTER_APP_URL,
  getOpenRouterConfig,
} = require("../config/openRouter");
const {
  HOUSING_FILTER_RESPONSE_FORMAT,
  HousingFilterValidationError,
  validateHousingFilters,
} = require("../utils/housingFilterSchema");
const {
  HOUSING_SEARCH_SYSTEM_PROMPT,
  buildHousingDescriptionMessage,
} = require("../prompts/housingSearchPrompt");
const {
  COMPARISON_RECOMMENDATION_SYSTEM_PROMPT,
  buildComparisonRecommendationMessage,
} = require("../prompts/comparisonRecommendationPrompt");
const {
  ComparisonRecommendationValidationError,
  createComparisonRecommendationResponseFormat,
  validateComparisonRecommendation,
} = require("../utils/comparisonRecommendationSchema");
const {
  AIOutputValidationError,
  AIServiceConfigurationError,
  AIServiceError,
  AIServiceUnavailableError,
} = require("./aiErrors");

const buildHousingSearchRequestBody = (model, housingDescription) => ({
  model,
  messages: [
    { role: "system", content: HOUSING_SEARCH_SYSTEM_PROMPT },
    {
      role: "user",
      content: buildHousingDescriptionMessage(housingDescription),
    },
  ],
  response_format: HOUSING_FILTER_RESPONSE_FORMAT,
  provider: {
    require_parameters: true,
  },
  max_tokens: 500,
  stream: false,
});

const buildComparisonRequestBody = (model, comparisonContext) => {
  const listingIds = comparisonContext.listings.map((listing) => listing.id);

  return {
    model,
    messages: [
      { role: "system", content: COMPARISON_RECOMMENDATION_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildComparisonRecommendationMessage(comparisonContext),
      },
    ],
    response_format: createComparisonRecommendationResponseFormat(
      listingIds,
      { approvedGrounding: comparisonContext.approvedGrounding },
    ),
    provider: {
      require_parameters: true,
    },
    max_tokens: 1_400,
    stream: false,
  };
};

const toProviderError = (status) => {
  if (status === 401 || status === 403 || status === 404) {
    return new AIServiceConfigurationError();
  }

  if (
    status === 408 ||
    status === 409 ||
    status === 402 ||
    status === 429 ||
    status >= 500
  ) {
    return new AIServiceUnavailableError();
  }

  return new AIServiceConfigurationError();
};

const getErrorStatus = (payload, fallbackStatus) => {
  const code = Number(
    payload?.error?.code ??
      payload?.choices?.[0]?.error?.code ??
      fallbackStatus,
  );

  return Number.isInteger(code) ? code : fallbackStatus;
};

const parseOpenRouterPayload = (
  payload,
  { validateOutput, isValidationError },
) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AIOutputValidationError();
  }

  if (payload.error || payload.choices?.[0]?.error) {
    throw toProviderError(getErrorStatus(payload, 500));
  }

  const content = payload.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new AIOutputValidationError();
  }

  let output;
  try {
    output = JSON.parse(content);
  } catch {
    throw new AIOutputValidationError();
  }

  try {
    return validateOutput(output);
  } catch (error) {
    if (isValidationError(error)) {
      throw new AIOutputValidationError();
    }
    throw error;
  }
};

const isComparisonContext = (context) =>
  context !== null &&
  typeof context === "object" &&
  !Array.isArray(context) &&
  Array.isArray(context.listings) &&
  (context.listings.length === 2 || context.listings.length === 3) &&
  context.listings.every(
    (listing) =>
      listing !== null &&
      typeof listing === "object" &&
      !Array.isArray(listing) &&
      typeof listing.id === "string" &&
      listing.id.length > 0,
  );

const createOpenRouterService = ({
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_OPENROUTER_TIMEOUT_MS,
} = {}) => {
  const requestStructuredOutput = async ({ buildBody, validateOutput, isValidationError }) => {
    const config = getOpenRouterConfig(env);

    if (typeof fetchImpl !== "function") {
      throw new AIServiceConfigurationError();
    }

    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw new AIServiceConfigurationError();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(config.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": OPENROUTER_APP_URL,
          "X-Title": OPENROUTER_APP_TITLE,
        },
        body: JSON.stringify(buildBody(config.model)),
        signal: controller.signal,
      });

      if (!response || typeof response.json !== "function") {
        throw new AIServiceUnavailableError();
      }

      let payload;
      try {
        payload = await response.json();
      } catch {
        if (!response.ok) {
          throw toProviderError(response.status);
        }
        throw new AIOutputValidationError();
      }

      if (!response.ok) {
        throw toProviderError(getErrorStatus(payload, response.status));
      }

      return parseOpenRouterPayload(payload, {
        validateOutput,
        isValidationError,
      });
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }

      if (controller.signal.aborted || error?.name === "AbortError") {
        throw new AIServiceUnavailableError(
          "AI service request timed out.",
          "AI_SERVICE_TIMEOUT",
        );
      }

      throw new AIServiceUnavailableError();
    } finally {
      clearTimeout(timeoutId);
    }
  };

  return {
    async extractHousingFilters(housingDescription) {
      if (typeof housingDescription !== "string") {
        throw new AIOutputValidationError();
      }

      return requestStructuredOutput({
        buildBody: (model) =>
          buildHousingSearchRequestBody(model, housingDescription),
        validateOutput: validateHousingFilters,
        isValidationError: (error) =>
          error instanceof HousingFilterValidationError,
      });
    },

    async generateComparisonRecommendation(comparisonContext) {
      if (!isComparisonContext(comparisonContext)) {
        throw new AIOutputValidationError();
      }

      const listingIds = comparisonContext.listings.map(
        (listing) => listing.id,
      );
      const expectedWinnerIds = comparisonContext.categorySelections;

      return requestStructuredOutput({
        buildBody: (model) =>
          buildComparisonRequestBody(model, comparisonContext),
        validateOutput: (output) =>
          validateComparisonRecommendation(output, {
            listingIds,
            expectedWinnerIds,
            approvedGrounding: comparisonContext.approvedGrounding,
          }),
        isValidationError: (error) =>
          error instanceof ComparisonRecommendationValidationError,
      });
    },
  };
};

const defaultOpenRouterService = createOpenRouterService();

module.exports = {
  createOpenRouterService,
  extractHousingFilters: (housingDescription) =>
    defaultOpenRouterService.extractHousingFilters(housingDescription),
  generateComparisonRecommendation: (comparisonContext) =>
    defaultOpenRouterService.generateComparisonRecommendation(
      comparisonContext,
    ),
};
