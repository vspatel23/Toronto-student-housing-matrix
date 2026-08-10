import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";

import React from "react";

import {
  createFrontendTestServer,
  installDom,
} from "./helpers/domHarness.js";

const DEFAULT_LISTING_ID = "64b000000000000000000070";
const DEFAULT_LISTING_RENT = 1750;

let restoreDom;
let viteServer;
let MonthlyHousingCostCalculator;
let HOUSING_COST_DEFAULT_ENABLED;
let HOUSING_COST_DEFAULTS;
let HOUSING_COST_FIELDS;
let HOUSING_COST_LIMITS;
let formatCanadianCurrency;
let formatHousingCostDifference;
let cleanup;
let render;
let screen;
let userEvent;

before(async () => {
  restoreDom = installDom();
  ({ cleanup, render, screen } = await import("@testing-library/react"));
  ({ default: userEvent } = await import("@testing-library/user-event"));

  viteServer = await createFrontendTestServer();
  ({
    HOUSING_COST_DEFAULT_ENABLED,
    HOUSING_COST_DEFAULTS,
    HOUSING_COST_FIELDS,
    HOUSING_COST_LIMITS,
    formatCanadianCurrency,
    formatHousingCostDifference,
  } = await viteServer.ssrLoadModule("/src/utils/monthlyHousingCost.js"));
  ({ default: MonthlyHousingCostCalculator } =
    await viteServer.ssrLoadModule(
      "/src/components/MonthlyHousingCostCalculator.jsx",
    ));
});

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
});

afterEach(() => {
  cleanup?.();
});

after(async () => {
  await viteServer?.close();
  restoreDom?.();
});

const setupUser = () => userEvent.setup({ document: window.document });

const calculatorElement = (overrides = {}) =>
  React.createElement(MonthlyHousingCostCalculator, {
    listingId: DEFAULT_LISTING_ID,
    listingRent: DEFAULT_LISTING_RENT,
    ...overrides,
  });

const renderCalculator = (overrides = {}) => render(calculatorElement(overrides));

const getDefaultExpenseEntries = () =>
  HOUSING_COST_FIELDS.map((field) => [
    field.label,
    HOUSING_COST_DEFAULTS[field.key],
  ]);

const getIncludedExpenseTotal = ({ amounts = {}, enabled = {} } = {}) =>
  HOUSING_COST_FIELDS.reduce((total, field) => {
    const isEnabled = field.optional
      ? enabled[field.key] ?? HOUSING_COST_DEFAULT_ENABLED[field.key]
      : true;
    const amount = amounts[field.key] ?? HOUSING_COST_DEFAULTS[field.key];
    return isEnabled ? total + Number(amount) : total;
  }, 0);

const getExpenseInput = (label) =>
  screen.getByRole("textbox", { name: label });

const getValueBesideLabel = (label) => {
  const labelNode = screen.getByText(label, { exact: true });
  let currentNode = labelNode;

  for (let level = 0; level < 3 && currentNode; level += 1) {
    if (currentNode.nextElementSibling) {
      return currentNode.nextElementSibling.textContent;
    }
    currentNode = currentNode.parentElement;
  }

  return labelNode.parentElement?.textContent.replace(labelNode.textContent, "") || "";
};

const assertCurrencyBesideLabel = (label, expectedCurrency) => {
  assert.match(getValueBesideLabel(label), new RegExp(escapeRegExp(expectedCurrency)));
};

const assertDisplayedCalculation = ({
  rent = DEFAULT_LISTING_RENT,
  amounts = {},
  enabled = {},
} = {}) => {
  const expenseTotal = getIncludedExpenseTotal({ amounts, enabled });
  assertCurrencyBesideLabel(
    "Estimated Monthly Total",
    formatCanadianCurrency(rent + expenseTotal),
  );
  assertCurrencyBesideLabel(
    "Difference from Advertised Rent",
    formatHousingCostDifference(expenseTotal),
  );
};

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceInputValue = async (user, label, value) => {
  const input = getExpenseInput(label);
  await user.clear(input);
  await user.type(input, value);
  return input;
};

const assertFieldError = (input, expectedMessage) => {
  assert.equal(input.getAttribute("aria-invalid"), "true");
  assert.ok(screen.getByText(expectedMessage, { exact: true }));

  const describedIds = (input.getAttribute("aria-describedby") || "")
    .split(/\s+/)
    .filter(Boolean);
  assert.equal(
    describedIds.some(
      (id) => document.getElementById(id)?.textContent.includes(expectedMessage),
    ),
    true,
  );
};

const assertTotalUnavailable = () => {
  assert.match(
    getValueBesideLabel("Estimated Monthly Total"),
    /unavailable|correct the highlighted amounts|correct invalid amounts|—/i,
  );
};

test("renders the listing rent, documented defaults, initial total, difference, and estimate disclaimer", () => {
  renderCalculator();

  assert.ok(
    screen.getByRole("heading", { name: "Monthly Housing Cost Estimate" }),
  );
  assertCurrencyBesideLabel("Advertised Monthly Rent", "$1,750.00");

  getDefaultExpenseEntries().forEach(([label, amount]) => {
    assert.equal(Number(getExpenseInput(label).value), amount);
  });
  const utilitiesDescriptionIds = getExpenseInput("Utilities")
    .getAttribute("aria-describedby")
    .split(/\s+/);
  assert.equal(
    utilitiesDescriptionIds.some((id) =>
      document
        .getElementById(id)
        ?.textContent.includes("monthly amounts in Canadian dollars"),
    ),
    true,
  );

  HOUSING_COST_FIELDS.filter(({ optional }) => optional).forEach((field) => {
    assert.equal(
      screen.getByRole("checkbox", { name: `Include ${field.label}` }).checked,
      HOUSING_COST_DEFAULT_ENABLED[field.key],
    );
  });
  assertDisplayedCalculation();

  const calculator = screen
    .getByRole("heading", { name: "Monthly Housing Cost Estimate" })
    .closest("section");
  assert.ok(calculator);
  assert.match(calculator.textContent, /advertised rent comes from this listing/i);
  assert.match(calculator.textContent, /planning estimates/i);
  assert.match(calculator.textContent, /may (?:vary|differ)/i);
});

test("updates total and difference immediately when utilities and internet change", async () => {
  const user = setupUser();
  renderCalculator();

  await replaceInputValue(user, "Utilities", "100");
  assertDisplayedCalculation({ amounts: { utilities: 100 } });

  await replaceInputValue(user, "Internet", "75");
  assertDisplayedCalculation({ amounts: { utilities: 100, internet: 75 } });
});

test("excludes transit when disabled and restores its preserved amount when re-enabled", async () => {
  const user = setupUser();
  renderCalculator();
  const transitToggle = screen.getByRole("checkbox", {
    name: "Include Transit",
  });

  assert.equal(transitToggle.checked, true);
  await user.click(transitToggle);
  assert.equal(transitToggle.checked, false);
  assert.equal(getExpenseInput("Transit").disabled, true);
  assert.equal(
    Number(getExpenseInput("Transit").value),
    HOUSING_COST_DEFAULTS.transit,
  );
  assertDisplayedCalculation({ enabled: { transit: false } });

  await user.click(transitToggle);
  assert.equal(transitToggle.checked, true);
  assert.equal(getExpenseInput("Transit").disabled, false);
  assert.equal(
    Number(getExpenseInput("Transit").value),
    HOUSING_COST_DEFAULTS.transit,
  );
  assertDisplayedCalculation();
});

test("preserves an edited parking amount while parking is excluded", async () => {
  const user = setupUser();
  renderCalculator();
  const parkingToggle = screen.getByRole("checkbox", {
    name: "Include Parking",
  });

  assert.equal(parkingToggle.checked, false);
  assert.equal(getExpenseInput("Parking").disabled, true);
  await user.click(parkingToggle);
  await replaceInputValue(user, "Parking", "150");
  assertDisplayedCalculation({
    amounts: { parking: 150 },
    enabled: { parking: true },
  });

  await user.click(parkingToggle);
  assert.equal(parkingToggle.checked, false);
  assert.equal(getExpenseInput("Parking").disabled, true);
  assert.equal(Number(getExpenseInput("Parking").value), 150);
  assertDisplayedCalculation({
    amounts: { parking: 150 },
    enabled: { parking: false },
  });

  await user.click(parkingToggle);
  assert.equal(parkingToggle.checked, true);
  assert.equal(getExpenseInput("Parking").disabled, false);
  assert.equal(Number(getExpenseInput("Parking").value), 150);
  assertDisplayedCalculation({
    amounts: { parking: 150 },
    enabled: { parking: true },
  });
});

test("shows associated field feedback and withholds the total for a negative amount", async () => {
  const user = setupUser();
  renderCalculator();

  const input = await replaceInputValue(user, "Utilities", "-1");
  assertFieldError(input, "Amount cannot be negative.");
  assertTotalUnavailable();
});

test("shows associated field feedback and withholds the total for a non-numeric amount", async () => {
  const user = setupUser();
  renderCalculator();

  const input = await replaceInputValue(user, "Internet", "not-a-number");
  assertFieldError(input, "Enter a valid monthly amount.");
  assertTotalUnavailable();
});

test("shows associated field feedback and withholds the total above a supported limit", async () => {
  const user = setupUser();
  renderCalculator();

  const input = await replaceInputValue(
    user,
    "Utilities",
    String(HOUSING_COST_LIMITS.utilities + 0.01),
  );
  assertFieldError(input, "Amount is above the supported planning limit.");
  assertTotalUnavailable();
});

test("Reset to Defaults restores amounts, optional states, and the current advertised rent", async () => {
  const user = setupUser();
  renderCalculator();

  await replaceInputValue(user, "Utilities", "125");
  await user.click(screen.getByRole("checkbox", { name: "Include Transit" }));
  await user.click(screen.getByRole("checkbox", { name: "Include Parking" }));
  await replaceInputValue(user, "Parking", "150");
  await user.click(screen.getByRole("button", { name: "Reset to Defaults" }));

  getDefaultExpenseEntries().forEach(([label, amount]) => {
    assert.equal(Number(getExpenseInput(label).value), amount);
  });
  assert.equal(
    screen.getByRole("checkbox", { name: "Include Transit" }).checked,
    HOUSING_COST_DEFAULT_ENABLED.transit,
  );
  assert.equal(
    screen.getByRole("checkbox", { name: "Include Parking" }).checked,
    HOUSING_COST_DEFAULT_ENABLED.parking,
  );
  assertCurrencyBesideLabel("Advertised Monthly Rent", "$1,750.00");
  assertDisplayedCalculation();
});

test("a listing ID and rent change resets edits and Reset continues using the new rent", async () => {
  const user = setupUser();
  const view = renderCalculator();

  await replaceInputValue(user, "Utilities", "125");
  await user.click(screen.getByRole("checkbox", { name: "Include Transit" }));

  view.rerender(
    calculatorElement({
      listingId: "64b000000000000000000071",
      listingRent: 2000,
    }),
  );

  assert.equal(
    Number(getExpenseInput("Utilities").value),
    HOUSING_COST_DEFAULTS.utilities,
  );
  assert.equal(
    screen.getByRole("checkbox", { name: "Include Transit" }).checked,
    HOUSING_COST_DEFAULT_ENABLED.transit,
  );
  assertCurrencyBesideLabel("Advertised Monthly Rent", "$2,000.00");
  assertDisplayedCalculation({ rent: 2000 });

  await replaceInputValue(user, "Utilities", "140");
  await user.click(screen.getByRole("button", { name: "Reset to Defaults" }));
  assert.equal(
    Number(getExpenseInput("Utilities").value),
    HOUSING_COST_DEFAULTS.utilities,
  );
  assertCurrencyBesideLabel("Advertised Monthly Rent", "$2,000.00");
  assertDisplayedCalculation({ rent: 2000 });
});

test("a listing ID change resets edits when the advertised rent is unchanged", async () => {
  const user = setupUser();
  const view = renderCalculator();

  await replaceInputValue(user, "Utilities", "125");
  await user.click(screen.getByRole("checkbox", { name: "Include Transit" }));

  view.rerender(
    calculatorElement({ listingId: "64b000000000000000000071" }),
  );

  assert.equal(
    Number(getExpenseInput("Utilities").value),
    HOUSING_COST_DEFAULTS.utilities,
  );
  assert.equal(
    screen.getByRole("checkbox", { name: "Include Transit" }).checked,
    HOUSING_COST_DEFAULT_ENABLED.transit,
  );
  assertCurrencyBesideLabel("Advertised Monthly Rent", "$1,750.00");
  assertDisplayedCalculation();
});

test("missing and invalid advertised rents show a controlled fallback without a total", async (t) => {
  const cases = [
    { name: "null", listingRent: null },
    { name: "undefined", listingRent: undefined },
    { name: "NaN", listingRent: Number.NaN },
    { name: "negative", listingRent: -1 },
    { name: "infinite", listingRent: Number.POSITIVE_INFINITY },
    { name: "malformed", listingRent: "not-rent" },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, () => {
      const view = renderCalculator({ listingRent: testCase.listingRent });

      assert.ok(
        screen.getByRole("heading", { name: "Monthly Housing Cost Estimate" }),
      );
      assert.ok(screen.getByText(/does not have a valid advertised rent/i));
      assert.equal(
        screen.queryByText(
          formatCanadianCurrency(
            DEFAULT_LISTING_RENT + getIncludedExpenseTotal(),
          ),
          { exact: true },
        ),
        null,
      );
      view.unmount();
    });
  }
});

test("the default-assumptions disclosure identifies every centralized estimate", async () => {
  const user = setupUser();
  renderCalculator();
  const summary = screen.getByText("View default assumptions", { exact: true });
  const details = summary.closest("details");

  assert.ok(details);
  await user.click(summary);
  assert.equal(details.open, true);

  const disclosureText = details.textContent;
  getDefaultExpenseEntries().forEach(([label, amount]) => {
    assert.match(disclosureText, new RegExp(escapeRegExp(label)));
    assert.match(
      disclosureText,
      new RegExp(escapeRegExp(formatCanadianCurrency(amount))),
    );
  });
  assert.match(
    disclosureText,
    /starting points for planning|planning estimates|defaults/i,
  );
});

test("native controls support tab focus and keyboard activation", async () => {
  const user = setupUser();
  renderCalculator();
  const utilitiesInput = getExpenseInput("Utilities");
  const transitToggle = screen.getByRole("checkbox", {
    name: "Include Transit",
  });
  const resetButton = screen.getByRole("button", { name: "Reset to Defaults" });

  for (
    let attempt = 0;
    attempt < 12 && document.activeElement !== utilitiesInput;
    attempt += 1
  ) {
    await user.tab();
  }
  assert.equal(document.activeElement, utilitiesInput);

  transitToggle.focus();
  assert.equal(document.activeElement, transitToggle);
  await user.keyboard(" ");
  assert.equal(transitToggle.checked, false);
  assertDisplayedCalculation({ enabled: { transit: false } });

  resetButton.focus();
  await user.keyboard("{Enter}");
  assert.equal(transitToggle.checked, true);
  assertDisplayedCalculation();
});
