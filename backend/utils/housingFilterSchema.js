const {
  AMENITY_FILTER_VALUES,
  CAMPUS_FILTER_VALUES,
  COMMUTE_FILTER_LIMITS,
  FURNISHING_FILTER_VALUES,
  HOUSING_TYPE_FILTER_VALUES,
  RENT_FILTER_LIMITS,
  SAFETY_FILTER_VALUES,
} = require("../constants/housingFilters");

const HOUSING_FILTER_FIELDS = Object.freeze([
  "campus",
  "minRent",
  "maxRent",
  "housingType",
  "maxCommute",
  "safetyLevel",
  "furnished",
  "amenities",
]);

const allowedFields = new Set(HOUSING_FILTER_FIELDS);

class HousingFilterValidationError extends Error {
  constructor(issues) {
    super("Housing filters are invalid.");
    this.name = "HousingFilterValidationError";
    this.code = "HOUSING_FILTERS_INVALID";
    this.issues = issues;
  }
}

const nullableEnumSchema = (values, description) => ({
  anyOf: [
    { type: "string", enum: values },
    { type: "null" },
  ],
  description,
});

const nullableNumberSchema = (limits, description) => ({
  anyOf: [
    {
      type: "number",
      minimum: limits.minimum,
      maximum: limits.maximum,
      multipleOf: limits.step,
    },
    { type: "null" },
  ],
  description,
});

const HOUSING_FILTER_JSON_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: {
    campus: nullableEnumSchema(
      CAMPUS_FILTER_VALUES,
      "The supported campus label, or null when no campus is provided.",
    ),
    minRent: nullableNumberSchema(
      RENT_FILTER_LIMITS,
      "Minimum monthly rent in Canadian dollars, or null.",
    ),
    maxRent: nullableNumberSchema(
      RENT_FILTER_LIMITS,
      "Maximum monthly rent in Canadian dollars, or null.",
    ),
    housingType: nullableEnumSchema(
      HOUSING_TYPE_FILTER_VALUES,
      "A supported housing type, or null.",
    ),
    maxCommute: nullableNumberSchema(
      COMMUTE_FILTER_LIMITS,
      "Maximum TTC commute in minutes, or null.",
    ),
    safetyLevel: nullableEnumSchema(
      SAFETY_FILTER_VALUES,
      "A supported minimum safety preference, or null.",
    ),
    furnished: nullableEnumSchema(
      FURNISHING_FILTER_VALUES,
      "A supported furnishing preference, or null.",
    ),
    amenities: {
      type: "array",
      items: { type: "string", enum: AMENITY_FILTER_VALUES },
      description: "Supported amenities explicitly requested by the student.",
    },
  },
  required: HOUSING_FILTER_FIELDS,
});

const HOUSING_FILTER_RESPONSE_FORMAT = Object.freeze({
  type: "json_schema",
  json_schema: {
    name: "housing_filters",
    strict: true,
    schema: HOUSING_FILTER_JSON_SCHEMA,
  },
});

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

const hasValue = (object, field) =>
  Object.prototype.hasOwnProperty.call(object, field) &&
  object[field] !== null &&
  object[field] !== undefined;

const validateEnum = (value, field, allowedValues, issues) => {
  if (typeof value !== "string" || !allowedValues.includes(value)) {
    issues.push(`${field} must be one of the application's supported values.`);
  }
};

const validateNumber = (value, field, limits, issues) => {
  if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
    issues.push(`${field} must be a finite integer.`);
    return;
  }

  if (value < limits.minimum || value > limits.maximum) {
    issues.push(
      `${field} must be between ${limits.minimum} and ${limits.maximum}.`,
    );
  }

  if (value % limits.step !== 0) {
    issues.push(`${field} must use increments of ${limits.step}.`);
  }
};

const validateHousingFilters = (input) => {
  if (!isPlainObject(input)) {
    throw new HousingFilterValidationError([
      "Housing filters must be a plain object.",
    ]);
  }

  const issues = [];
  const unsupportedFields = Object.keys(input).filter(
    (field) => !allowedFields.has(field),
  );

  if (unsupportedFields.length > 0) {
    issues.push(
      `Unsupported housing filter field${unsupportedFields.length === 1 ? "" : "s"}: ${unsupportedFields.join(", ")}.`,
    );
  }

  if (hasValue(input, "campus")) {
    validateEnum(input.campus, "campus", CAMPUS_FILTER_VALUES, issues);
  }

  if (hasValue(input, "minRent")) {
    validateNumber(input.minRent, "minRent", RENT_FILTER_LIMITS, issues);
  }

  if (hasValue(input, "maxRent")) {
    validateNumber(input.maxRent, "maxRent", RENT_FILTER_LIMITS, issues);
  }

  if (hasValue(input, "housingType")) {
    validateEnum(
      input.housingType,
      "housingType",
      HOUSING_TYPE_FILTER_VALUES,
      issues,
    );
  }

  if (hasValue(input, "maxCommute")) {
    validateNumber(
      input.maxCommute,
      "maxCommute",
      COMMUTE_FILTER_LIMITS,
      issues,
    );
  }

  if (hasValue(input, "safetyLevel")) {
    validateEnum(
      input.safetyLevel,
      "safetyLevel",
      SAFETY_FILTER_VALUES,
      issues,
    );
  }

  if (hasValue(input, "furnished")) {
    validateEnum(
      input.furnished,
      "furnished",
      FURNISHING_FILTER_VALUES,
      issues,
    );
  }

  if (hasValue(input, "amenities")) {
    if (!Array.isArray(input.amenities)) {
      issues.push("amenities must be an array.");
    } else {
      input.amenities.forEach((amenity) => {
        validateEnum(
          amenity,
          "amenities",
          AMENITY_FILTER_VALUES,
          issues,
        );
      });

      if (new Set(input.amenities).size !== input.amenities.length) {
        issues.push("amenities must not contain duplicates.");
      }
    }
  }

  if (
    hasValue(input, "minRent") &&
    hasValue(input, "maxRent") &&
    Number.isFinite(input.minRent) &&
    Number.isFinite(input.maxRent) &&
    input.minRent > input.maxRent
  ) {
    issues.push("minRent must be less than or equal to maxRent.");
  }

  if (issues.length > 0) {
    throw new HousingFilterValidationError(issues);
  }

  return {
    campus: input.campus ?? null,
    minRent: input.minRent ?? null,
    maxRent: input.maxRent ?? null,
    housingType: input.housingType ?? null,
    maxCommute: input.maxCommute ?? null,
    safetyLevel: input.safetyLevel ?? null,
    furnished: input.furnished ?? null,
    amenities: input.amenities ? [...input.amenities] : [],
  };
};

module.exports = {
  HOUSING_FILTER_FIELDS,
  HOUSING_FILTER_JSON_SCHEMA,
  HOUSING_FILTER_RESPONSE_FORMAT,
  HousingFilterValidationError,
  validateHousingFilters,
};
