export const HOUSING_COST_DEFAULTS = Object.freeze({
  utilities: 80,
  internet: 50,
  tenantInsurance: 25,
  laundry: 25,
  transit: 156,
  parking: 0,
  additionalExpenses: 0,
});

export const HOUSING_COST_LIMITS = Object.freeze({
  utilities: 1000,
  internet: 500,
  tenantInsurance: 500,
  laundry: 500,
  transit: 1000,
  parking: 2000,
  additionalExpenses: 5000,
});

export const HOUSING_COST_FIELDS = Object.freeze([
  Object.freeze({ key: "utilities", label: "Utilities", optional: false }),
  Object.freeze({ key: "internet", label: "Internet", optional: false }),
  Object.freeze({
    key: "tenantInsurance",
    label: "Tenant Insurance",
    optional: true,
  }),
  Object.freeze({ key: "laundry", label: "Laundry", optional: true }),
  Object.freeze({ key: "transit", label: "Transit", optional: true }),
  Object.freeze({ key: "parking", label: "Parking", optional: true }),
  Object.freeze({
    key: "additionalExpenses",
    label: "Additional Monthly Expenses",
    optional: false,
  }),
]);

export const HOUSING_COST_DEFAULT_ENABLED = Object.freeze({
  utilities: true,
  internet: true,
  tenantInsurance: true,
  laundry: true,
  transit: true,
  parking: false,
  additionalExpenses: true,
});

const VALID_AMOUNT_MESSAGE = "Enter a valid monthly amount.";
const NEGATIVE_AMOUNT_MESSAGE = "Amount cannot be negative.";
const ABOVE_LIMIT_MESSAGE =
  "Amount is above the supported planning limit.";
const INVALID_RENT_REASON =
  "Monthly cost estimate unavailable because this listing does not have a valid advertised rent.";
const INVALID_EXPENSE_REASON =
  "Correct the highlighted amounts to update the estimate.";

const BASE_TEN_DECIMAL_PATTERN = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;
const CAD_AMOUNT_PATTERN = /^-?(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/;
const FIELD_KEYS = new Set(HOUSING_COST_FIELDS.map(({ key }) => key));
const MAX_EXPENSE_TOTAL_CENTS =
  Object.values(HOUSING_COST_LIMITS).reduce(
    (total, amount) => total + amount,
    0,
  ) * 100;

const currencyFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const signedCurrencyFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "always",
});

const parseBaseTenDecimal = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  if (
    normalizedValue === "" ||
    !BASE_TEN_DECIMAL_PATTERN.test(normalizedValue)
  ) {
    return null;
  }

  const numericValue = Number(normalizedValue);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const hasAtMostTwoDecimalPlaces = (value) => {
  const scaledValue = value * 100;
  const nearestCent = Math.round(scaledValue);
  const tolerance =
    Number.EPSILON * Math.max(1, Math.abs(scaledValue)) * 8;

  return Math.abs(scaledValue - nearestCent) <= tolerance;
};

const toSafeCents = (value) => {
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) ? cents : null;
};

const fromCents = (cents) => cents / 100;

const normalizeCurrencyValue = (value) => {
  const numericValue = parseBaseTenDecimal(value);
  if (numericValue === null) {
    return null;
  }

  const cents = toSafeCents(numericValue);
  return cents === null ? null : fromCents(cents);
};

export const normalizeListingRent = (listingRent) => {
  const numericRent = parseBaseTenDecimal(listingRent);
  if (numericRent === null || numericRent < 0) {
    return null;
  }

  const rentCents = toSafeCents(numericRent);
  if (
    rentCents === null ||
    rentCents > Number.MAX_SAFE_INTEGER - MAX_EXPENSE_TOTAL_CENTS
  ) {
    return null;
  }

  return fromCents(rentCents);
};

export const createDefaultHousingCosts = (listingRent) => ({
  advertisedRent: normalizeListingRent(listingRent),
  expenses: { ...HOUSING_COST_DEFAULTS },
  enabled: { ...HOUSING_COST_DEFAULT_ENABLED },
});

export const resetHousingCosts = (listingRent) =>
  createDefaultHousingCosts(listingRent);

export const updateHousingCostAmount = (housingCosts, fieldKey, amount) => {
  if (!housingCosts || !FIELD_KEYS.has(fieldKey)) {
    return housingCosts;
  }

  return {
    ...housingCosts,
    expenses: {
      ...housingCosts.expenses,
      [fieldKey]: amount,
    },
  };
};

export const setHousingCostEnabled = (housingCosts, fieldKey, enabled) => {
  const field = HOUSING_COST_FIELDS.find(({ key }) => key === fieldKey);
  if (!housingCosts || !field?.optional) {
    return housingCosts;
  }

  return {
    ...housingCosts,
    enabled: {
      ...housingCosts.enabled,
      [fieldKey]: Boolean(enabled),
    },
  };
};

export const validateHousingCostField = (fieldKey, rawAmount) => {
  if (!FIELD_KEYS.has(fieldKey)) {
    return { isValid: false, amount: null, error: VALID_AMOUNT_MESSAGE };
  }

  const amount = parseBaseTenDecimal(rawAmount);
  if (amount === null) {
    return { isValid: false, amount: null, error: VALID_AMOUNT_MESSAGE };
  }

  if (amount < 0) {
    return { isValid: false, amount: null, error: NEGATIVE_AMOUNT_MESSAGE };
  }

  const normalizedRawAmount =
    typeof rawAmount === "string" ? rawAmount.trim() : null;
  if (
    (normalizedRawAmount !== null &&
      !CAD_AMOUNT_PATTERN.test(normalizedRawAmount)) ||
    (typeof rawAmount === "number" &&
      !hasAtMostTwoDecimalPlaces(rawAmount))
  ) {
    return { isValid: false, amount: null, error: VALID_AMOUNT_MESSAGE };
  }

  if (amount > HOUSING_COST_LIMITS[fieldKey]) {
    return { isValid: false, amount: null, error: ABOVE_LIMIT_MESSAGE };
  }

  const amountCents = toSafeCents(amount);
  if (amountCents === null) {
    return { isValid: false, amount: null, error: VALID_AMOUNT_MESSAGE };
  }

  return { isValid: true, amount: fromCents(amountCents), error: "" };
};

export const calculateMonthlyHousingCost = (housingCosts) => {
  const advertisedRent = normalizeListingRent(housingCosts?.advertisedRent);
  const fieldErrors = {};
  let expenseTotalCents = 0;

  HOUSING_COST_FIELDS.forEach((field) => {
    const suppliedEnabledState = housingCosts?.enabled?.[field.key];
    const isEnabled = field.optional
      ? typeof suppliedEnabledState === "boolean"
        ? suppliedEnabledState
        : HOUSING_COST_DEFAULT_ENABLED[field.key]
      : true;

    if (!isEnabled) {
      return;
    }

    const validation = validateHousingCostField(
      field.key,
      housingCosts?.expenses?.[field.key],
    );

    if (!validation.isValid) {
      fieldErrors[field.key] = validation.error;
      return;
    }

    expenseTotalCents += toSafeCents(validation.amount);
  });

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const isAvailable = advertisedRent !== null && !hasFieldErrors;

  if (!isAvailable) {
    return {
      isAvailable: false,
      advertisedRent,
      expenseTotal: null,
      estimatedMonthlyTotal: null,
      differenceFromAdvertisedRent: null,
      fieldErrors,
      unavailableReason:
        advertisedRent === null ? INVALID_RENT_REASON : INVALID_EXPENSE_REASON,
    };
  }

  const advertisedRentCents = toSafeCents(advertisedRent);
  const estimatedMonthlyTotalCents =
    advertisedRentCents + expenseTotalCents;

  return {
    isAvailable: true,
    advertisedRent,
    expenseTotal: fromCents(expenseTotalCents),
    estimatedMonthlyTotal: fromCents(estimatedMonthlyTotalCents),
    differenceFromAdvertisedRent: fromCents(
      estimatedMonthlyTotalCents - advertisedRentCents,
    ),
    fieldErrors,
    unavailableReason: "",
  };
};

export const formatCanadianCurrency = (amount) => {
  const normalizedAmount = normalizeCurrencyValue(amount);
  return normalizedAmount === null
    ? "—"
    : currencyFormatter.format(normalizedAmount);
};

export const formatHousingCostDifference = (amount) => {
  const normalizedAmount = normalizeCurrencyValue(amount);
  return normalizedAmount === null
    ? "—"
    : signedCurrencyFormatter.format(normalizedAmount);
};
