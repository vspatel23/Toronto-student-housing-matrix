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
  AIOutputValidationError,
  AIServiceConfigurationError,
  AIServiceError,
  AIServiceUnavailableError,
} = require("./aiErrors");

const buildRequestBody = (model, housingDescription) => ({
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

const parseOpenRouterPayload = (payload) => {
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

  let filters;
  try {
    filters = JSON.parse(content);
  } catch {
    throw new AIOutputValidationError();
  }

  try {
    return validateHousingFilters(filters);
  } catch (error) {
    if (error instanceof HousingFilterValidationError) {
      throw new AIOutputValidationError();
    }
    throw error;
  }
};

const createOpenRouterService = ({
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_OPENROUTER_TIMEOUT_MS,
} = {}) => ({
  async extractHousingFilters(housingDescription) {
    const config = getOpenRouterConfig(env);

    if (typeof fetchImpl !== "function") {
      throw new AIServiceConfigurationError();
    }

    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw new AIServiceConfigurationError();
    }

    if (typeof housingDescription !== "string") {
      throw new AIOutputValidationError();
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
        body: JSON.stringify(
          buildRequestBody(config.model, housingDescription),
        ),
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

      return parseOpenRouterPayload(payload);
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
  },
});

const defaultOpenRouterService = createOpenRouterService();

module.exports = {
  createOpenRouterService,
  extractHousingFilters: (housingDescription) =>
    defaultOpenRouterService.extractHousingFilters(housingDescription),
};
