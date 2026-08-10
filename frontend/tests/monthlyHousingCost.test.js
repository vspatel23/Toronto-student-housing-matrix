import assert from "node:assert/strict";
import test from "node:test";

import {
  HOUSING_COST_DEFAULT_ENABLED,
  HOUSING_COST_DEFAULTS,
  HOUSING_COST_FIELDS,
  HOUSING_COST_LIMITS,
  calculateMonthlyHousingCost,
  createDefaultHousingCosts,
  formatCanadianCurrency,
  formatHousingCostDifference,
  normalizeListingRent,
  resetHousingCosts,
  setHousingCostEnabled,
  updateHousingCostAmount,
  validateHousingCostField,
} from "../src/utils/monthlyHousingCost.js";

const DEFAULT_RENT = 1750;
const DEFAULT_EXPENSE_TOTAL = Object.entries(HOUSING_COST_DEFAULTS).reduce(
  (total, [fieldKey, amount]) =>
    total + (HOUSING_COST_DEFAULT_ENABLED[fieldKey] ? amount : 0),
  0,
);

test("documents the shared fields, defaults, limits, and optional enabled states", () => {
  assert.deepEqual(
    HOUSING_COST_FIELDS.map(({ key, optional }) => ({ key, optional })),
    [
      { key: "utilities", optional: false },
      { key: "internet", optional: false },
      { key: "tenantInsurance", optional: true },
      { key: "laundry", optional: true },
      { key: "transit", optional: true },
      { key: "parking", optional: true },
      { key: "additionalExpenses", optional: false },
    ],
  );
  assert.deepEqual(HOUSING_COST_DEFAULTS, {
    utilities: 80,
    internet: 50,
    tenantInsurance: 25,
    laundry: 25,
    transit: 156,
    parking: 0,
    additionalExpenses: 0,
  });
  assert.deepEqual(HOUSING_COST_LIMITS, {
    utilities: 1000,
    internet: 500,
    tenantInsurance: 500,
    laundry: 500,
    transit: 1000,
    parking: 2000,
    additionalExpenses: 5000,
  });
  assert.deepEqual(HOUSING_COST_DEFAULT_ENABLED, {
    utilities: true,
    internet: true,
    tenantInsurance: true,
    laundry: true,
    transit: true,
    parking: false,
    additionalExpenses: true,
  });
});

test("valid rent plus documented defaults calculates the expected total", () => {
  const result = calculateMonthlyHousingCost(
    createDefaultHousingCosts(DEFAULT_RENT),
  );

  assert.equal(result.isAvailable, true);
  assert.equal(result.advertisedRent, DEFAULT_RENT);
  assert.equal(result.expenseTotal, DEFAULT_EXPENSE_TOTAL);
  assert.equal(result.estimatedMonthlyTotal, 2086);
  assert.deepEqual(result.fieldErrors, {});
});

test("difference from advertised rent equals included monthly expenses", () => {
  const result = calculateMonthlyHousingCost(
    createDefaultHousingCosts(DEFAULT_RENT),
  );

  assert.equal(result.differenceFromAdvertisedRent, DEFAULT_EXPENSE_TOTAL);
});

test("edited expenses update the monthly total without mutating prior state", () => {
  const defaults = createDefaultHousingCosts(DEFAULT_RENT);
  const editedUtilities = updateHousingCostAmount(defaults, "utilities", "95.50");
  const editedInternet = updateHousingCostAmount(
    editedUtilities,
    "internet",
    "65.25",
  );
  const result = calculateMonthlyHousingCost(editedInternet);

  assert.notEqual(editedUtilities, defaults);
  assert.notEqual(editedUtilities.expenses, defaults.expenses);
  assert.equal(defaults.expenses.utilities, 80);
  assert.equal(defaults.expenses.internet, 50);
  assert.equal(result.expenseTotal, 366.75);
  assert.equal(result.estimatedMonthlyTotal, 2116.75);
});

test("a disabled optional expense contributes zero and keeps its amount", () => {
  const defaults = createDefaultHousingCosts(DEFAULT_RENT);
  const withoutTransit = setHousingCostEnabled(defaults, "transit", false);
  const result = calculateMonthlyHousingCost(withoutTransit);

  assert.equal(withoutTransit.expenses.transit, 156);
  assert.equal(defaults.enabled.transit, true);
  assert.equal(withoutTransit.enabled.transit, false);
  assert.equal(result.expenseTotal, 180);
  assert.equal(result.estimatedMonthlyTotal, 1930);
});

test("re-enabling an optional expense restores its preserved entered amount", () => {
  const defaults = createDefaultHousingCosts(DEFAULT_RENT);
  const withParkingAmount = updateHousingCostAmount(
    defaults,
    "parking",
    "150",
  );
  const stillDisabled = setHousingCostEnabled(
    withParkingAmount,
    "parking",
    false,
  );
  const excluded = calculateMonthlyHousingCost(stillDisabled);
  const reEnabled = setHousingCostEnabled(stillDisabled, "parking", true);
  const included = calculateMonthlyHousingCost(reEnabled);

  assert.equal(excluded.expenseTotal, DEFAULT_EXPENSE_TOTAL);
  assert.equal(reEnabled.expenses.parking, "150");
  assert.equal(included.expenseTotal, 486);
  assert.equal(included.estimatedMonthlyTotal, 2236);
});

test("multiple disabled optional expenses are excluded together", () => {
  let costs = createDefaultHousingCosts(DEFAULT_RENT);
  costs = setHousingCostEnabled(costs, "tenantInsurance", false);
  costs = setHousingCostEnabled(costs, "laundry", false);
  costs = setHousingCostEnabled(costs, "transit", false);

  const result = calculateMonthlyHousingCost(costs);

  assert.equal(result.expenseTotal, 130);
  assert.equal(result.estimatedMonthlyTotal, 1880);
});

test("an enabled zero-valued optional expense is valid", () => {
  const withParking = setHousingCostEnabled(
    createDefaultHousingCosts(DEFAULT_RENT),
    "parking",
    true,
  );
  const result = calculateMonthlyHousingCost(withParking);

  assert.equal(result.isAvailable, true);
  assert.equal(result.fieldErrors.parking, undefined);
  assert.equal(result.expenseTotal, DEFAULT_EXPENSE_TOTAL);
});

test("reset returns fresh documented defaults", () => {
  let edited = createDefaultHousingCosts(DEFAULT_RENT);
  edited = updateHousingCostAmount(edited, "utilities", "230");
  edited = setHousingCostEnabled(edited, "transit", false);

  const reset = resetHousingCosts(DEFAULT_RENT);

  assert.equal(edited.expenses.utilities, "230");
  assert.equal(edited.enabled.transit, false);
  assert.deepEqual(reset.expenses, HOUSING_COST_DEFAULTS);
  assert.deepEqual(reset.enabled, HOUSING_COST_DEFAULT_ENABLED);
  assert.notEqual(reset.expenses, HOUSING_COST_DEFAULTS);
  assert.notEqual(reset.enabled, HOUSING_COST_DEFAULT_ENABLED);
});

test("reset uses the supplied current listing rent instead of stale rent", () => {
  const firstListingCosts = createDefaultHousingCosts(1450);
  const resetForSecondListing = resetHousingCosts(2125);

  assert.equal(firstListingCosts.advertisedRent, 1450);
  assert.equal(resetForSecondListing.advertisedRent, 2125);
  assert.equal(
    calculateMonthlyHousingCost(resetForSecondListing).estimatedMonthlyTotal,
    2461,
  );
});

test("missing listing rent makes the complete estimate unavailable", () => {
  [null, undefined, "", "   "].forEach((missingRent) => {
    const result = calculateMonthlyHousingCost(
      createDefaultHousingCosts(missingRent),
    );

    assert.equal(result.isAvailable, false);
    assert.equal(result.advertisedRent, null);
    assert.equal(result.expenseTotal, null);
    assert.equal(result.estimatedMonthlyTotal, null);
    assert.equal(result.differenceFromAdvertisedRent, null);
    assert.equal(
      result.unavailableReason,
      "Monthly cost estimate unavailable because this listing does not have a valid advertised rent.",
    );
  });
});

test("invalid listing rent is rejected without throwing", () => {
  [NaN, Infinity, -1, "not rent", "$1750", false, []].forEach(
    (invalidRent) => {
      assert.equal(normalizeListingRent(invalidRent), null);
      assert.doesNotThrow(() =>
        calculateMonthlyHousingCost(createDefaultHousingCosts(invalidRent)),
      );
    },
  );
});

test("negative expense is rejected with field-level feedback", () => {
  const validation = validateHousingCostField("utilities", "-0.01");
  const costs = updateHousingCostAmount(
    createDefaultHousingCosts(DEFAULT_RENT),
    "utilities",
    "-0.01",
  );
  const result = calculateMonthlyHousingCost(costs);

  assert.deepEqual(validation, {
    isValid: false,
    amount: null,
    error: "Amount cannot be negative.",
  });
  assert.equal(result.isAvailable, false);
  assert.equal(result.fieldErrors.utilities, "Amount cannot be negative.");
  assert.equal(result.expenseTotal, null);
  assert.equal(result.estimatedMonthlyTotal, null);
  assert.equal(result.differenceFromAdvertisedRent, null);
});

test("non-numeric, empty, NaN, infinity, and sub-cent expense values are rejected", () => {
  ["abc", "", "   ", "10 dollars", NaN, Infinity, "1e2", "0.001"].forEach(
    (invalidAmount) => {
      assert.deepEqual(validateHousingCostField("internet", invalidAmount), {
        isValid: false,
        amount: null,
        error: "Enter a valid monthly amount.",
      });
    },
  );
});

test("amounts above each documented planning limit are rejected", () => {
  Object.entries(HOUSING_COST_LIMITS).forEach(([fieldKey, limit]) => {
    assert.deepEqual(validateHousingCostField(fieldKey, limit + 0.01), {
      isValid: false,
      amount: null,
      error: "Amount is above the supported planning limit.",
    });
  });
});

test("each documented upper-bound value is accepted", () => {
  Object.entries(HOUSING_COST_LIMITS).forEach(([fieldKey, limit]) => {
    assert.deepEqual(validateHousingCostField(fieldKey, limit), {
      isValid: true,
      amount: limit,
      error: "",
    });
  });
});

test("an invalid disabled optional value is ignored until re-enabled", () => {
  let costs = createDefaultHousingCosts(DEFAULT_RENT);
  costs = updateHousingCostAmount(costs, "parking", "invalid");

  const disabledResult = calculateMonthlyHousingCost(costs);
  costs = setHousingCostEnabled(costs, "parking", true);
  const enabledResult = calculateMonthlyHousingCost(costs);

  assert.equal(disabledResult.isAvailable, true);
  assert.equal(disabledResult.fieldErrors.parking, undefined);
  assert.equal(enabledResult.isAvailable, false);
  assert.equal(
    enabledResult.fieldErrors.parking,
    "Enter a valid monthly amount.",
  );
  assert.equal(
    enabledResult.unavailableReason,
    "Correct the highlighted amounts to update the estimate.",
  );
});

test("non-optional fields cannot be disabled through the optional toggle helper", () => {
  const defaults = createDefaultHousingCosts(DEFAULT_RENT);
  const unchanged = setHousingCostEnabled(defaults, "utilities", false);

  assert.equal(unchanged, defaults);
  assert.equal(
    calculateMonthlyHousingCost(unchanged).expenseTotal,
    DEFAULT_EXPENSE_TOTAL,
  );
});

test("unknown field updates are ignored and unknown validation fails safely", () => {
  const defaults = createDefaultHousingCosts(DEFAULT_RENT);

  assert.equal(
    updateHousingCostAmount(defaults, "unknownExpense", "10"),
    defaults,
  );
  assert.deepEqual(validateHousingCostField("unknownExpense", "10"), {
    isValid: false,
    amount: null,
    error: "Enter a valid monthly amount.",
  });
});

test("totals use cents-safe arithmetic", () => {
  let costs = createDefaultHousingCosts(1000.1);
  costs = updateHousingCostAmount(costs, "utilities", "0.10");
  costs = updateHousingCostAmount(costs, "internet", "0.20");
  costs = setHousingCostEnabled(costs, "tenantInsurance", false);
  costs = setHousingCostEnabled(costs, "laundry", false);
  costs = setHousingCostEnabled(costs, "transit", false);

  const result = calculateMonthlyHousingCost(costs);

  assert.equal(result.expenseTotal, 0.3);
  assert.equal(result.estimatedMonthlyTotal, 1000.4);
  assert.equal(result.differenceFromAdvertisedRent, 0.3);
});

test("Canadian currency and signed difference formatters are consistent", () => {
  assert.equal(formatCanadianCurrency(1500), "$1,500.00");
  assert.equal(formatCanadianCurrency("80"), "$80.00");
  assert.equal(formatHousingCostDifference(336), "+$336.00");
  assert.equal(formatHousingCostDifference(-25.5), "-$25.50");
  assert.equal(formatCanadianCurrency(NaN), "—");
  assert.equal(formatHousingCostDifference(Infinity), "—");
});
