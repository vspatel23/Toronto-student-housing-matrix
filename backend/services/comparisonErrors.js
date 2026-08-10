const COMPARISON_ERROR_CODES = Object.freeze({
  INVALID_COMPARISON_COUNT: "INVALID_COMPARISON_COUNT",
  INVALID_COMPARISON_CONTEXT: "INVALID_COMPARISON_CONTEXT",
  INVALID_LISTING_ID: "INVALID_LISTING_ID",
  DUPLICATE_LISTING_IDS: "DUPLICATE_LISTING_IDS",
  LISTING_NOT_FOUND: "LISTING_NOT_FOUND",
  LISTING_INACTIVE: "LISTING_INACTIVE",
  COMPARISON_SERVICE_UNAVAILABLE: "COMPARISON_SERVICE_UNAVAILABLE",
});

class ComparisonServiceError extends Error {
  constructor(message, { code, statusCode }) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

class ComparisonRequestValidationError extends ComparisonServiceError {
  constructor(message, code) {
    super(message, { code, statusCode: 400 });
  }
}

class ComparisonListingNotFoundError extends ComparisonServiceError {
  constructor() {
    super("One or more listings were not found.", {
      code: COMPARISON_ERROR_CODES.LISTING_NOT_FOUND,
      statusCode: 404,
    });
  }
}

class ComparisonListingInactiveError extends ComparisonServiceError {
  constructor() {
    super("One or more listings are inactive.", {
      code: COMPARISON_ERROR_CODES.LISTING_INACTIVE,
      statusCode: 409,
    });
  }
}

class ComparisonServiceUnavailableError extends ComparisonServiceError {
  constructor() {
    super("Comparison service is temporarily unavailable.", {
      code: COMPARISON_ERROR_CODES.COMPARISON_SERVICE_UNAVAILABLE,
      statusCode: 500,
    });
  }
}

const createInvalidComparisonCountError = () =>
  new ComparisonRequestValidationError(
    "Exactly 2 or 3 listing IDs are required.",
    COMPARISON_ERROR_CODES.INVALID_COMPARISON_COUNT,
  );

const createInvalidListingIdError = () =>
  new ComparisonRequestValidationError(
    "Each listing ID must be valid.",
    COMPARISON_ERROR_CODES.INVALID_LISTING_ID,
  );

const createDuplicateListingIdsError = () =>
  new ComparisonRequestValidationError(
    "Listing IDs must be unique.",
    COMPARISON_ERROR_CODES.DUPLICATE_LISTING_IDS,
  );

const createInvalidComparisonContextError = () =>
  new ComparisonRequestValidationError(
    "Campus and Value Score weights must be valid current comparison context.",
    COMPARISON_ERROR_CODES.INVALID_COMPARISON_CONTEXT,
  );

const createListingNotFoundError = () =>
  new ComparisonListingNotFoundError();

const createListingInactiveError = () =>
  new ComparisonListingInactiveError();

const createComparisonServiceUnavailableError = () =>
  new ComparisonServiceUnavailableError();

module.exports = {
  COMPARISON_ERROR_CODES,
  ComparisonListingInactiveError,
  ComparisonListingNotFoundError,
  ComparisonRequestValidationError,
  ComparisonServiceError,
  ComparisonServiceUnavailableError,
  createComparisonServiceUnavailableError,
  createDuplicateListingIdsError,
  createInvalidComparisonContextError,
  createInvalidComparisonCountError,
  createInvalidListingIdError,
  createListingInactiveError,
  createListingNotFoundError,
};
