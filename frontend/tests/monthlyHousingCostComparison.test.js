import assert from "node:assert/strict";
import test from "node:test";

import {
  HOUSING_COST_DEFAULT_ENABLED,
  HOUSING_COST_DEFAULTS,
  calculateComparisonMonthlyCosts,
  createDefaultHousingCostAssumptions,
  formatCanadianCurrency,
  formatHousingCostDifference,
  resetHousingCostAssumptions,
} from "../src/utils/monthlyHousingCost.js";

const DEFAULT_EXPENSE_TOTAL = 336;

const withExpense = (fieldKey, amount) => {
  const assumptions = createDefaultHousingCostAssumptions();
  assumptions.expenses[fieldKey] = amount;
  return assumptions;
};

const withEnabled = (fieldKey, enabled) => {
  const assumptions = createDefaultHousingCostAssumptions();
  assumptions.enabled[fieldKey] = enabled;
  return assumptions;
};

test("calculates two listing totals in input order", () => {
  const result = calculateComparisonMonthlyCosts([1500, 1650]);

  assert.deepEqual(
    result.calculations.map(({ advertisedRent }) => advertisedRent),
    [1500, 1650],
  );
  assert.deepEqual(
    result.calculations.map(({ estimatedMonthlyTotal }) =>
      estimatedMonthlyTotal,
    ),
    [1836, 1986],
  );
});

test("calculates three listing totals with the documented defaults", () => {
  const result = calculateComparisonMonthlyCosts([1200, 1400, 1600]);

  assert.deepEqual(
    result.calculations.map(({ expenseTotal }) => expenseTotal),
    [DEFAULT_EXPENSE_TOTAL, DEFAULT_EXPENSE_TOTAL, DEFAULT_EXPENSE_TOTAL],
  );
  assert.deepEqual(
    result.calculations.map(({ estimatedMonthlyTotal }) =>
      estimatedMonthlyTotal,
    ),
    [1536, 1736, 1936],
  );
});

test("null and omitted assumptions both use the documented defaults", () => {
  const omitted = calculateComparisonMonthlyCosts([1500, 1600]);
  const explicitNull = calculateComparisonMonthlyCosts([1500, 1600], null);

  assert.deepEqual(explicitNull, omitted);
  assert.deepEqual(
    omitted.calculations.map(({ expenseTotal }) => expenseTotal),
    [DEFAULT_EXPENSE_TOTAL, DEFAULT_EXPENSE_TOTAL],
  );
});

test("a shared utilities edit updates every listing", () => {
  const result = calculateComparisonMonthlyCosts(
    [1500, 1650, 1800],
    withExpense("utilities", "120.00"),
  );

  assert.deepEqual(
    result.calculations.map(({ expenseTotal }) => expenseTotal),
    [376, 376, 376],
  );
  assert.deepEqual(
    result.calculations.map(({ estimatedMonthlyTotal }) =>
      estimatedMonthlyTotal,
    ),
    [1876, 2026, 2176],
  );
});

test("a shared internet edit updates every listing", () => {
  const result = calculateComparisonMonthlyCosts(
    [1500, 1650],
    withExpense("internet", "75.25"),
  );

  assert.deepEqual(
    result.calculations.map(({ expenseTotal }) => expenseTotal),
    [361.25, 361.25],
  );
  assert.deepEqual(
    result.calculations.map(({ estimatedMonthlyTotal }) =>
      estimatedMonthlyTotal,
    ),
    [1861.25, 2011.25],
  );
});

test("a disabled optional expense is excluded from every listing", () => {
  const result = calculateComparisonMonthlyCosts(
    [1500, 1650, 1800],
    withEnabled("transit", false),
  );

  assert.deepEqual(
    result.calculations.map(({ expenseTotal }) => expenseTotal),
    [180, 180, 180],
  );
});

test("re-enabling a shared expense restores its preserved value for all listings", () => {
  const assumptions = withExpense("parking", "125.50");
  assumptions.enabled.parking = false;
  const excluded = calculateComparisonMonthlyCosts([1500, 1650], assumptions);

  assumptions.enabled.parking = true;
  const included = calculateComparisonMonthlyCosts([1500, 1650], assumptions);

  assert.deepEqual(
    excluded.calculations.map(({ expenseTotal }) => expenseTotal),
    [DEFAULT_EXPENSE_TOTAL, DEFAULT_EXPENSE_TOTAL],
  );
  assert.deepEqual(
    included.calculations.map(({ expenseTotal }) => expenseTotal),
    [461.5, 461.5],
  );
});

test("additional monthly expenses contribute to each expense total", () => {
  const result = calculateComparisonMonthlyCosts(
    [1500, 1650],
    withExpense("additionalExpenses", "42.50"),
  );

  assert.deepEqual(
    result.calculations.map(({ expenseTotal }) => expenseTotal),
    [378.5, 378.5],
  );
});

test("selects the numeric lowest total regardless of listing order", () => {
  const result = calculateComparisonMonthlyCosts([1700, 1400, 1600]);

  assert.equal(result.lowestEstimatedMonthlyTotal, 1736);
  assert.equal(result.lowestCount, 1);
  assert.equal(result.hasLowestTie, false);
  assert.deepEqual(
    result.calculations.map(({ isLowest }) => isLowest),
    [false, true, false],
  );
});

test("marks every listing in a two-way lowest tie", () => {
  const result = calculateComparisonMonthlyCosts([1500, 1500, 1650]);

  assert.equal(result.lowestCount, 2);
  assert.equal(result.hasLowestTie, true);
  assert.deepEqual(
    result.calculations.map(({ isLowest, isLowestTie }) => ({
      isLowest,
      isLowestTie,
    })),
    [
      { isLowest: true, isLowestTie: true },
      { isLowest: true, isLowestTie: true },
      { isLowest: false, isLowestTie: false },
    ],
  );
});

test("marks every listing in a three-way lowest tie", () => {
  const result = calculateComparisonMonthlyCosts([1500, 1500, 1500]);

  assert.equal(result.lowestCount, 3);
  assert.equal(result.hasLowestTie, true);
  assert.deepEqual(
    result.calculations.map(({ isLowestTie }) => isLowestTie),
    [true, true, true],
  );
});

test("calculates every difference from the lowest valid total", () => {
  const result = calculateComparisonMonthlyCosts([1500, 1650, 1820]);

  assert.deepEqual(
    result.calculations.map(({ differenceFromLowest }) =>
      differenceFromLowest,
    ),
    [0, 150, 320],
  );
  assert.equal(result.calculations[0].differenceFromLowest, 0);
});

test("excludes a missing rent from the lowest calculation", () => {
  const result = calculateComparisonMonthlyCosts([null, 1600, 1500]);

  assert.equal(result.lowestEstimatedMonthlyTotal, 1836);
  assert.equal(result.calculations[0].isAvailable, false);
  assert.equal(result.calculations[0].differenceFromLowest, null);
  assert.equal(result.calculations[0].isLowest, false);
  assert.deepEqual(
    result.calculations.slice(1).map(({ estimatedMonthlyTotal }) =>
      estimatedMonthlyTotal,
    ),
    [1936, 1836],
  );
});

test("malformed and negative rents do not break valid listing totals", () => {
  const result = calculateComparisonMonthlyCosts([
    "not rent",
    -1,
    1500,
    undefined,
  ]);

  assert.deepEqual(
    result.calculations.map(({ isAvailable }) => isAvailable),
    [false, false, true, false],
  );
  assert.equal(result.calculations[2].estimatedMonthlyTotal, 1836);
  assert.equal(result.lowestEstimatedMonthlyTotal, 1836);
  assert.equal(result.lowestCount, 1);
});

test("all unavailable rents produce clean empty-lowest metadata", () => {
  const result = calculateComparisonMonthlyCosts([
    null,
    undefined,
    "bad rent",
    -100,
  ]);

  assert.equal(result.lowestEstimatedMonthlyTotal, null);
  assert.equal(result.lowestCount, 0);
  assert.equal(result.hasLowestTie, false);
  result.calculations.forEach((calculation) => {
    assert.equal(calculation.isAvailable, false);
    assert.equal(calculation.differenceFromLowest, null);
    assert.equal(calculation.isLowest, false);
    assert.equal(calculation.isLowestTie, false);
  });
});

test("reset returns exact fresh Issue #70 assumptions", () => {
  const first = resetHousingCostAssumptions();
  first.expenses.utilities = 999;
  first.enabled.transit = false;
  const second = resetHousingCostAssumptions();

  assert.deepEqual(second.expenses, HOUSING_COST_DEFAULTS);
  assert.deepEqual(second.enabled, HOUSING_COST_DEFAULT_ENABLED);
  assert.notEqual(first, second);
  assert.notEqual(first.expenses, second.expenses);
  assert.notEqual(first.enabled, second.enabled);
  assert.equal(second.expenses.utilities, 80);
  assert.equal(second.enabled.transit, true);
});

test("uses cents-safe decimal arithmetic and the shared CAD formatters", () => {
  const assumptions = createDefaultHousingCostAssumptions();
  assumptions.expenses.utilities = "0.10";
  assumptions.expenses.internet = "0.20";
  assumptions.enabled.tenantInsurance = false;
  assumptions.enabled.laundry = false;
  assumptions.enabled.transit = false;

  const result = calculateComparisonMonthlyCosts(
    [1000.1, 1000.3],
    assumptions,
  );

  assert.deepEqual(
    result.calculations.map(({ expenseTotal }) => expenseTotal),
    [0.3, 0.3],
  );
  assert.deepEqual(
    result.calculations.map(({ estimatedMonthlyTotal }) =>
      estimatedMonthlyTotal,
    ),
    [1000.4, 1000.6],
  );
  assert.deepEqual(
    result.calculations.map(({ differenceFromLowest }) =>
      differenceFromLowest,
    ),
    [0, 0.2],
  );
  assert.equal(formatCanadianCurrency(result.lowestEstimatedMonthlyTotal), "$1,000.40");
  assert.equal(formatHousingCostDifference(0.2), "+$0.20");
});

test("invalid or partial explicit assumptions remain unavailable", () => {
  const invalidCases = [
    { expenses: { ...HOUSING_COST_DEFAULTS, utilities: "invalid" } },
    { expenses: { ...HOUSING_COST_DEFAULTS, utilities: -1 } },
    { expenses: { utilities: 80 }, enabled: {} },
    {},
  ];

  invalidCases.forEach((assumptions) => {
    const result = calculateComparisonMonthlyCosts([1500, 1650], assumptions);

    assert.equal(result.lowestEstimatedMonthlyTotal, null);
    assert.equal(result.lowestCount, 0);
    result.calculations.forEach((calculation) => {
      assert.equal(calculation.isAvailable, false);
      assert.equal(calculation.estimatedMonthlyTotal, null);
      assert.notDeepEqual(calculation.fieldErrors, {});
    });
  });
});

test("does not mutate shared assumptions or the rent array", () => {
  const rents = Object.freeze([1650, null, 1500]);
  const assumptions = createDefaultHousingCostAssumptions();
  Object.freeze(assumptions.expenses);
  Object.freeze(assumptions.enabled);
  Object.freeze(assumptions);

  const beforeRents = [...rents];
  const beforeAssumptions = JSON.parse(JSON.stringify(assumptions));
  const result = calculateComparisonMonthlyCosts(rents, assumptions);

  assert.deepEqual(rents, beforeRents);
  assert.deepEqual(assumptions, beforeAssumptions);
  assert.deepEqual(
    result.calculations.map(({ advertisedRent }) => advertisedRent),
    [1650, null, 1500],
  );
});
