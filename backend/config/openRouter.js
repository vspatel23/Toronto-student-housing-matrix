const { AIServiceConfigurationError } = require("../services/aiErrors");

const OPENROUTER_API_URL =
  "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";
const DEFAULT_OPENROUTER_TIMEOUT_MS = 20_000;
const OPENROUTER_APP_URL =
  "https://github.com/vspatel23/Toronto-student-housing-matrix";
const OPENROUTER_APP_TITLE = "Toronto Student Housing Matrix";

const MODEL_SLUG_PATTERN = /^[~a-z0-9][a-z0-9._~:-]*\/[a-z0-9._~:-]+$/i;
const PLACEHOLDER_PATTERN = /^(?:your_|replace_|example)/i;

const getOpenRouterConfig = (env = process.env) => {
  const apiKey = typeof env.OPENROUTER_API_KEY === "string"
    ? env.OPENROUTER_API_KEY.trim()
    : "";

  if (!apiKey) {
    throw new AIServiceConfigurationError(
      "AI service is not configured.",
      "AI_NOT_CONFIGURED",
    );
  }

  if (PLACEHOLDER_PATTERN.test(apiKey)) {
    throw new AIServiceConfigurationError();
  }

  const configuredModel = typeof env.OPENROUTER_MODEL === "string"
    ? env.OPENROUTER_MODEL.trim()
    : "";
  const model = configuredModel || DEFAULT_OPENROUTER_MODEL;

  if (PLACEHOLDER_PATTERN.test(model) || !MODEL_SLUG_PATTERN.test(model)) {
    throw new AIServiceConfigurationError();
  }

  return Object.freeze({
    apiKey,
    model,
    apiUrl: OPENROUTER_API_URL,
  });
};

module.exports = {
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_OPENROUTER_TIMEOUT_MS,
  OPENROUTER_API_URL,
  OPENROUTER_APP_TITLE,
  OPENROUTER_APP_URL,
  getOpenRouterConfig,
};
