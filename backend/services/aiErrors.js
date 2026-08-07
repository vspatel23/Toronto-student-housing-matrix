class AIServiceError extends Error {
  constructor(message, { code, statusCode }) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

class AIServiceConfigurationError extends AIServiceError {
  constructor(
    message = "AI service configuration is invalid.",
    code = "AI_CONFIGURATION_INVALID",
  ) {
    super(message, { code, statusCode: 503 });
  }
}

class AIServiceUnavailableError extends AIServiceError {
  constructor(
    message = "AI service is temporarily unavailable.",
    code = "AI_SERVICE_UNAVAILABLE",
  ) {
    super(message, { code, statusCode: 503 });
  }
}

class AIOutputValidationError extends AIServiceError {
  constructor() {
    super("AI service returned an invalid response.", {
      code: "AI_OUTPUT_INVALID",
      statusCode: 502,
    });
  }
}

module.exports = {
  AIOutputValidationError,
  AIServiceConfigurationError,
  AIServiceError,
  AIServiceUnavailableError,
};
