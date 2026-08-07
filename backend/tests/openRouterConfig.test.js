const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_API_URL,
  getOpenRouterConfig,
} = require("../config/openRouter");
const {
  AIServiceConfigurationError,
} = require("../services/aiErrors");
const { createOpenRouterService } = require("../services/openRouterService");

const serializeError = (error) =>
  JSON.stringify({
    name: error.name,
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
  });

test("missing OPENROUTER_API_KEY throws a controlled configuration error", () => {
  assert.throws(
    () => getOpenRouterConfig({}),
    (error) => {
      assert.ok(error instanceof AIServiceConfigurationError);
      assert.equal(error.message, "AI service is not configured.");
      assert.equal(error.code, "AI_NOT_CONFIGURED");
      assert.equal(error.statusCode, 503);
      return true;
    },
  );
});

test("missing configuration does not leak unrelated environment values", () => {
  const privateEnvironmentValue = "database-password-that-must-stay-private";

  try {
    getOpenRouterConfig({ MONGO_URI: privateEnvironmentValue });
    assert.fail("Expected configuration validation to fail");
  } catch (error) {
    assert.doesNotMatch(serializeError(error), new RegExp(privateEnvironmentValue));
    assert.doesNotMatch(error.message, /MONGO_URI/);
  }
});

test("API key values never appear in invalid model errors", () => {
  const privateApiKey = "test-api-key-not-a-credential";

  try {
    getOpenRouterConfig({
      OPENROUTER_API_KEY: privateApiKey,
      OPENROUTER_MODEL: "not a model slug",
    });
    assert.fail("Expected model validation to fail");
  } catch (error) {
    assert.ok(error instanceof AIServiceConfigurationError);
    assert.doesNotMatch(serializeError(error), new RegExp(privateApiKey));
  }
});

test("OpenRouter configuration uses the centralized endpoint and default model", () => {
  const config = getOpenRouterConfig({
    OPENROUTER_API_KEY: "test-api-key-not-a-credential",
  });

  assert.equal(config.apiUrl, OPENROUTER_API_URL);
  assert.equal(config.model, DEFAULT_OPENROUTER_MODEL);
});

test("creating the reusable service does not require AI configuration at startup", () => {
  assert.doesNotThrow(() => createOpenRouterService({ env: {} }));
});
