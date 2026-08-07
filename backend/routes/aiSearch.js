const express = require("express");

const {
  MAX_HOUSING_DESCRIPTION_LENGTH,
} = require("../constants/aiSearch");
const openRouterService = require("../services/openRouterService");
const {
  AIOutputValidationError,
  AIServiceError,
  AIServiceUnavailableError,
} = require("../services/aiErrors");
const {
  HousingFilterValidationError,
  validateHousingFilters,
} = require("../utils/housingFilterSchema");

const JSON_BODY_ERROR_TYPES = new Set([
  "charset.unsupported",
  "encoding.unsupported",
  "entity.parse.failed",
  "entity.verify.failed",
  "request.aborted",
  "request.size.invalid",
  "stream.encoding.set",
  "stream.not.readable",
]);

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

const invalidDescription = (message) => ({
  code: "INVALID_DESCRIPTION",
  message,
});

const validateRequestBody = (body) => {
  if (
    !isPlainObject(body) ||
    !Object.prototype.hasOwnProperty.call(body, "description")
  ) {
    return {
      error: invalidDescription("Housing description is required."),
    };
  }

  if (Object.keys(body).some((field) => field !== "description")) {
    return {
      error: invalidDescription(
        "Request body must contain only a housing description.",
      ),
    };
  }

  if (typeof body.description !== "string") {
    return {
      error: invalidDescription("Housing description must be a string."),
    };
  }

  const description = body.description.trim();

  if (!description) {
    return {
      error: invalidDescription("Housing description is required."),
    };
  }

  if (description.length > MAX_HOUSING_DESCRIPTION_LENGTH) {
    return {
      error: {
        code: "DESCRIPTION_TOO_LONG",
        message: `Housing description must not exceed ${MAX_HOUSING_DESCRIPTION_LENGTH} characters.`,
      },
    };
  }

  return { description };
};

const normalizeServiceOutput = (filters) => {
  try {
    return validateHousingFilters(filters);
  } catch (error) {
    if (error instanceof HousingFilterValidationError) {
      throw new AIOutputValidationError();
    }

    throw error;
  }
};

const toSafeServiceError = (error) => {
  if (error instanceof HousingFilterValidationError) {
    return new AIOutputValidationError();
  }

  if (error instanceof AIServiceError) {
    return error;
  }

  return new AIServiceUnavailableError();
};

const getHttpStatus = (error) => {
  if (error.code === "AI_SERVICE_TIMEOUT") {
    return 504;
  }

  return Number.isInteger(error.statusCode) ? error.statusCode : 503;
};

const sendError = (res, status, error) =>
  res.status(status).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
    },
  });

const handleAiSearchJsonBodyError = (error, _req, res, next) => {
  if (error?.type === "entity.too.large") {
    return sendError(res, 400, {
      code: "DESCRIPTION_TOO_LONG",
      message: `Housing description must not exceed ${MAX_HOUSING_DESCRIPTION_LENGTH} characters.`,
    });
  }

  if (JSON_BODY_ERROR_TYPES.has(error?.type)) {
    return sendError(res, 400, {
      code: "INVALID_DESCRIPTION",
      message: "Request body must be a valid JSON object.",
    });
  }

  return next(error);
};

const createAiSearchRouter = ({
  extractHousingFilters = openRouterService.extractHousingFilters,
} = {}) => {
  if (typeof extractHousingFilters !== "function") {
    throw new TypeError("extractHousingFilters must be a function.");
  }

  const router = express.Router();

  router.post("/search", async (req, res) => {
    const validation = validateRequestBody(req.body);

    if (validation.error) {
      return sendError(res, 400, validation.error);
    }

    try {
      const serviceFilters = await extractHousingFilters(
        validation.description,
      );
      const filters = normalizeServiceOutput(serviceFilters);

      return res.json({
        success: true,
        filters,
      });
    } catch (error) {
      const safeError = toSafeServiceError(error);
      return sendError(res, getHttpStatus(safeError), safeError);
    }
  });

  return router;
};

const router = createAiSearchRouter();

module.exports = router;
module.exports.createAiSearchRouter = createAiSearchRouter;
module.exports.handleAiSearchJsonBodyError = handleAiSearchJsonBodyError;
module.exports.validateRequestBody = validateRequestBody;
