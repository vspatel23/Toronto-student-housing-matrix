const express = require("express");

const authenticateUser = require("../middleware/auth");
const {
  AIServiceError,
} = require("../services/aiErrors");
const {
  ComparisonServiceError,
} = require("../services/comparisonErrors");
const comparisonRecommendationService = require("../services/comparisonRecommendationService");

const JSON_BODY_ERROR_TYPES = new Set([
  "charset.unsupported",
  "encoding.unsupported",
  "entity.parse.failed",
  "entity.too.large",
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

const sendError = (res, status, error) =>
  res.status(status).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
    },
  });

const invalidComparisonRequest = () => ({
  code: "INVALID_COMPARISON_REQUEST",
  message:
    "Request body must contain only listingIds, campus, and valueScoreWeights.",
});

const unavailableComparisonService = () => ({
  code: "COMPARISON_SERVICE_UNAVAILABLE",
  message: "Comparison service is temporarily unavailable.",
});

const getControlledHttpStatus = (error) => {
  if (error.code === "AI_SERVICE_TIMEOUT") {
    return 504;
  }

  return Number.isInteger(error.statusCode) ? error.statusCode : 500;
};

const validateAiCompareRequest = (req, res, next) => {
  const body = req.body;

  if (
    !isPlainObject(body) ||
    !Object.prototype.hasOwnProperty.call(body, "listingIds") ||
    !Object.prototype.hasOwnProperty.call(body, "campus") ||
    !Object.prototype.hasOwnProperty.call(body, "valueScoreWeights") ||
    Object.keys(body).length !== 3 ||
    !Array.isArray(body.listingIds)
  ) {
    return sendError(res, 400, invalidComparisonRequest());
  }

  try {
    req.comparisonListingIds =
      comparisonRecommendationService.normalizeComparisonListingIds(
        body.listingIds,
      );
    const comparisonContext =
      comparisonRecommendationService.normalizeComparisonContext(
        body.campus,
        body.valueScoreWeights,
      );
    req.comparisonCampus = comparisonContext.campus;
    req.comparisonValueScoreWeights =
      comparisonContext.valueScoreWeights;
    return next();
  } catch (error) {
    if (error instanceof ComparisonServiceError) {
      return sendError(res, getControlledHttpStatus(error), error);
    }

    return sendError(res, 500, unavailableComparisonService());
  }
};

const handleAiCompareJsonBodyError = (error, _req, res, next) => {
  if (JSON_BODY_ERROR_TYPES.has(error?.type)) {
    return sendError(res, 400, {
      code: "INVALID_COMPARISON_REQUEST",
      message: "Request body must be a valid JSON object.",
    });
  }

  return next(error);
};

const createAiCompareRouter = ({
  recommendComparison = (input) =>
    comparisonRecommendationService.recommendComparison(input),
  authenticateUserMiddleware = authenticateUser,
} = {}) => {
  if (typeof recommendComparison !== "function") {
    throw new TypeError("recommendComparison must be a function.");
  }

  if (typeof authenticateUserMiddleware !== "function") {
    throw new TypeError("authenticateUserMiddleware must be a function.");
  }

  const router = express.Router();

  router.post(
    "/compare",
    validateAiCompareRequest,
    authenticateUserMiddleware,
    async (req, res) => {
      try {
        const recommendation = await recommendComparison({
          listingIds: req.comparisonListingIds,
          campus: req.comparisonCampus,
          valueScoreWeights: req.comparisonValueScoreWeights,
          userId: req.user?._id,
        });

        return res.json({
          success: true,
          recommendation,
        });
      } catch (error) {
        if (
          error instanceof ComparisonServiceError ||
          error instanceof AIServiceError
        ) {
          return sendError(res, getControlledHttpStatus(error), error);
        }

        return sendError(res, 500, unavailableComparisonService());
      }
    },
  );

  return router;
};

const router = createAiCompareRouter();

module.exports = router;
module.exports.createAiCompareRouter = createAiCompareRouter;
module.exports.handleAiCompareJsonBodyError = handleAiCompareJsonBodyError;
