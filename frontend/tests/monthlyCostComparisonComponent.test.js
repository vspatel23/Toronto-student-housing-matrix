import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";

import React from "react";

import {
  createFrontendTestServer,
  installDom,
} from "./helpers/domHarness.js";

const LISTING_IDS = [
  "64b000000000000000000071",
  "64b000000000000000000072",
  "64b000000000000000000073",
];
const FOURTH_LISTING_ID = "64b000000000000000000074";
const CAMPUS = "University of Toronto - St. George";
const AUTH_TOKEN = "issue-71-component-test-token";

const LISTING_TITLES = [
  "Annex Student Room",
  "Kensington Studio",
  "Harbord Shared Home",
];

const createListing = (index, overrides = {}) => ({
  _id: LISTING_IDS[index],
  title: LISTING_TITLES[index],
  address: `${index + 1} College Street`,
  neighborhood: ["The Annex", "Kensington Market", "Harbord Village"][
    index
  ],
  monthlyRent: [1500, 1650, 1800][index],
  propertyType: ["Room Rental", "Studio", "Shared House"][index],
  furnished: index !== 1,
  amenities: [
    ["WiFi", "Laundry", "Kitchen", "Nearby Transit"],
    ["WiFi", "Kitchen"],
    ["WiFi", "Laundry", "Kitchen"],
  ][index],
  safety: {
    crimeRateLevel: ["Low", "Medium", "Low"][index],
    safetyScore: [88, 76, 83][index],
  },
  commuteEstimates: [{ campus: CAMPUS, minutes: [22, 14, 30][index] }],
  valueScore: [96, 90, 84][index],
  valueScoreBreakdown: {
    affordability: [96, 88, 80][index],
    commute: [86, 98, 74][index],
    safety: [88, 76, 83][index],
    amenities: [75, 50, 63][index],
  },
  images: [],
  ...overrides,
});

const ALL_LISTINGS = [0, 1, 2].map((index) => createListing(index));

const createRequestSpy = (implementation = () => new Promise(() => {})) => {
  const calls = [];
  const request = (...args) => {
    calls.push(args);
    return implementation(...args);
  };

  request.calls = calls;
  return request;
};

let restoreDom;
let viteServer;
let CompareListings;
let HOUSING_COST_DEFAULT_ENABLED;
let HOUSING_COST_DEFAULTS;
let HOUSING_COST_FIELDS;
let cleanup;
let render;
let screen;
let within;
let userEvent;

before(async () => {
  restoreDom = installDom();
  ({ cleanup, render, screen, within } = await import(
    "@testing-library/react"
  ));
  ({ default: userEvent } = await import("@testing-library/user-event"));

  viteServer = await createFrontendTestServer();
  ({
    HOUSING_COST_DEFAULT_ENABLED,
    HOUSING_COST_DEFAULTS,
    HOUSING_COST_FIELDS,
  } = await viteServer.ssrLoadModule("/src/utils/monthlyHousingCost.js"));
  ({ default: CompareListings } = await viteServer.ssrLoadModule(
    "/src/components/CompareListings.jsx",
  ));
});

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  localStorage.clear();
  localStorage.setItem("tshm_auth_token", AUTH_TOKEN);
});

afterEach(() => {
  cleanup?.();
});

after(async () => {
  await viteServer?.close();
  restoreDom?.();
});

const setupUser = () => userEvent.setup({ document: window.document });

const createCompareProps = (listings, overrides = {}) => ({
  listings,
  listingIds: listings.map((listing) => listing._id),
  availableListings: listings,
  campus: CAMPUS,
  compareStatus: { type: "", message: "" },
  maxCompareListings: 3,
  savedListingIds: new Set(),
  savingListingIds: new Set(),
  onToggleSave: () => {},
  onAddCompare: () => true,
  onRemoveCompare: () => {},
  onBackToResults: () => {},
  onDetails: () => {},
  requestRecommendation: createRequestSpy(),
  ...overrides,
});

const renderCompare = (listings = ALL_LISTINGS.slice(0, 2), overrides = {}) =>
  render(
    React.createElement(
      CompareListings,
      createCompareProps(listings, overrides),
    ),
  );

const getMonthlyCostSection = () => {
  const heading = screen.getByRole("heading", {
    name: "Estimated Monthly Cost",
  });
  const section = heading.closest("section");

  assert.ok(section);
  return section;
};

const getMonthlyCostView = () => within(getMonthlyCostSection());

const getAssumptionInput = (monthlyCostView, label) =>
  monthlyCostView.getByRole("textbox", { name: label });

const getListingCard = (monthlyCostView, title) =>
  within(monthlyCostView.getByRole("listitem", { name: title }));

const getListingOutput = (monthlyCostView, title, label) =>
  monthlyCostView.getByLabelText(`${title}, ${label}`);

const assertListingOutput = (monthlyCostView, title, label, expected) => {
  assert.equal(
    getListingOutput(monthlyCostView, title, label).textContent,
    expected,
  );
};

const assertListingCost = (
  monthlyCostView,
  title,
  { advertisedRent, additional, total, difference },
) => {
  assertListingOutput(
    monthlyCostView,
    title,
    "Advertised Rent",
    advertisedRent,
  );
  assertListingOutput(
    monthlyCostView,
    title,
    "Additional Estimated Monthly Expenses",
    additional,
  );
  assertListingOutput(
    monthlyCostView,
    title,
    "Estimated Monthly Total",
    total,
  );
  assertListingOutput(
    monthlyCostView,
    title,
    "Difference from Lowest",
    difference,
  );
};

const replaceInputValue = async (user, input, value) => {
  await user.clear(input);
  await user.type(input, value);
};

test("renders one shared assumption set and correct two-listing costs", () => {
  renderCompare();
  const monthlyCostView = getMonthlyCostView();

  assert.equal(
    monthlyCostView.getAllByRole("heading", {
      name: "Monthly Cost Assumptions",
    }).length,
    1,
  );
  assert.equal(
    monthlyCostView.getAllByRole("textbox").length,
    HOUSING_COST_FIELDS.length,
  );
  assert.equal(
    monthlyCostView.getAllByRole("checkbox").length,
    HOUSING_COST_FIELDS.filter(({ optional }) => optional).length,
  );

  HOUSING_COST_FIELDS.forEach((field) => {
    assert.equal(
      Number(getAssumptionInput(monthlyCostView, field.label).value),
      HOUSING_COST_DEFAULTS[field.key],
    );
  });

  assertListingCost(monthlyCostView, LISTING_TITLES[0], {
    advertisedRent: "$1,500.00",
    additional: "+$336.00",
    total: "$1,836.00",
    difference: "+$0.00",
  });
  assertListingCost(monthlyCostView, LISTING_TITLES[1], {
    advertisedRent: "$1,650.00",
    additional: "+$336.00",
    total: "$1,986.00",
    difference: "+$150.00",
  });

  assert.equal(
    monthlyCostView.getAllByText("Lowest Total", { exact: true }).length,
    1,
  );
  assert.ok(
    getListingCard(monthlyCostView, LISTING_TITLES[0]).getByText(
      "Lowest Total",
      { exact: true },
    ),
  );
  assert.equal(
    getListingCard(monthlyCostView, LISTING_TITLES[1]).queryByText(
      "Lowest Total",
      { exact: true },
    ),
    null,
  );
});

test("shows correct totals and differences across three listings", () => {
  renderCompare(ALL_LISTINGS);
  const monthlyCostView = getMonthlyCostView();

  [
    {
      title: LISTING_TITLES[0],
      rent: "$1,500.00",
      total: "$1,836.00",
      difference: "+$0.00",
    },
    {
      title: LISTING_TITLES[1],
      rent: "$1,650.00",
      total: "$1,986.00",
      difference: "+$150.00",
    },
    {
      title: LISTING_TITLES[2],
      rent: "$1,800.00",
      total: "$2,136.00",
      difference: "+$300.00",
    },
  ].forEach(({ title, rent, total, difference }) => {
    assertListingCost(monthlyCostView, title, {
      advertisedRent: rent,
      additional: "+$336.00",
      total,
      difference,
    });
  });

  assert.equal(
    monthlyCostView.getAllByText("Lowest Total", { exact: true }).length,
    1,
  );
});

test("marks every listing in two-way and three-way lowest-total ties", () => {
  const twoWayListings = ALL_LISTINGS.slice(0, 2).map((listing) => ({
    ...listing,
    monthlyRent: 1500,
  }));
  const view = renderCompare(twoWayListings);
  let monthlyCostView = getMonthlyCostView();

  assert.equal(
    monthlyCostView.getAllByText("Lowest Total — Tie", { exact: true }).length,
    2,
  );
  twoWayListings.forEach((listing) => {
    const card = getListingCard(monthlyCostView, listing.title);
    assert.ok(card.getByText("Lowest Total — Tie", { exact: true }));
    assertListingOutput(
      monthlyCostView,
      listing.title,
      "Difference from Lowest",
      "+$0.00",
    );
  });

  const threeWayListings = ALL_LISTINGS.map((listing) => ({
    ...listing,
    monthlyRent: 1500,
  }));
  view.rerender(
    React.createElement(
      CompareListings,
      createCompareProps(threeWayListings),
    ),
  );
  monthlyCostView = getMonthlyCostView();

  assert.equal(
    monthlyCostView.getAllByText("Lowest Total — Tie", { exact: true }).length,
    3,
  );
  threeWayListings.forEach((listing) => {
    assert.ok(
      getListingCard(monthlyCostView, listing.title).getByText(
        "Lowest Total — Tie",
        { exact: true },
      ),
    );
    assertListingOutput(
      monthlyCostView,
      listing.title,
      "Estimated Monthly Total",
      "$1,836.00",
    );
  });
});

test("utilities and internet edits immediately update every listing", async () => {
  const user = setupUser();
  renderCompare(ALL_LISTINGS);
  const monthlyCostView = getMonthlyCostView();

  await replaceInputValue(
    user,
    getAssumptionInput(monthlyCostView, "Utilities"),
    "120",
  );

  ["$1,876.00", "$2,026.00", "$2,176.00"].forEach((total, index) => {
    assertListingOutput(
      monthlyCostView,
      LISTING_TITLES[index],
      "Additional Estimated Monthly Expenses",
      "+$376.00",
    );
    assertListingOutput(
      monthlyCostView,
      LISTING_TITLES[index],
      "Estimated Monthly Total",
      total,
    );
  });

  await replaceInputValue(
    user,
    getAssumptionInput(monthlyCostView, "Internet"),
    "75",
  );

  ["$1,901.00", "$2,051.00", "$2,201.00"].forEach((total, index) => {
    assertListingOutput(
      monthlyCostView,
      LISTING_TITLES[index],
      "Additional Estimated Monthly Expenses",
      "+$401.00",
    );
    assertListingOutput(
      monthlyCostView,
      LISTING_TITLES[index],
      "Estimated Monthly Total",
      total,
    );
  });

  assertListingOutput(
    monthlyCostView,
    LISTING_TITLES[1],
    "Difference from Lowest",
    "+$150.00",
  );
  assertListingOutput(
    monthlyCostView,
    LISTING_TITLES[2],
    "Difference from Lowest",
    "+$300.00",
  );
});

test("shared transit toggle and Reset work from the keyboard for every listing", async () => {
  const user = setupUser();
  renderCompare();
  const monthlyCostView = getMonthlyCostView();
  const transitToggle = monthlyCostView.getByRole("checkbox", {
    name: "Include Transit for all listings",
  });
  const transitInput = getAssumptionInput(monthlyCostView, "Transit");

  assert.equal(transitToggle.checked, true);
  transitToggle.focus();
  assert.equal(document.activeElement, transitToggle);
  await user.keyboard(" ");

  assert.equal(transitToggle.checked, false);
  assert.equal(transitInput.disabled, true);
  assert.equal(Number(transitInput.value), HOUSING_COST_DEFAULTS.transit);
  ["$1,680.00", "$1,830.00"].forEach((total, index) => {
    assertListingOutput(
      monthlyCostView,
      LISTING_TITLES[index],
      "Additional Estimated Monthly Expenses",
      "+$180.00",
    );
    assertListingOutput(
      monthlyCostView,
      LISTING_TITLES[index],
      "Estimated Monthly Total",
      total,
    );
  });

  await user.keyboard(" ");
  assert.equal(transitToggle.checked, true);
  assert.equal(transitInput.disabled, false);
  assert.equal(Number(transitInput.value), HOUSING_COST_DEFAULTS.transit);
  assertListingOutput(
    monthlyCostView,
    LISTING_TITLES[0],
    "Estimated Monthly Total",
    "$1,836.00",
  );
  assertListingOutput(
    monthlyCostView,
    LISTING_TITLES[1],
    "Estimated Monthly Total",
    "$1,986.00",
  );

  await replaceInputValue(
    user,
    getAssumptionInput(monthlyCostView, "Utilities"),
    "120",
  );
  const parkingToggle = monthlyCostView.getByRole("checkbox", {
    name: "Include Parking for all listings",
  });
  await user.click(parkingToggle);
  await replaceInputValue(
    user,
    getAssumptionInput(monthlyCostView, "Parking"),
    "90",
  );

  const resetButton = monthlyCostView.getByRole("button", {
    name: "Reset to Defaults",
  });
  resetButton.focus();
  assert.equal(document.activeElement, resetButton);
  await user.keyboard("{Enter}");

  HOUSING_COST_FIELDS.forEach((field) => {
    assert.equal(
      Number(getAssumptionInput(monthlyCostView, field.label).value),
      HOUSING_COST_DEFAULTS[field.key],
    );
    if (field.optional) {
      assert.equal(
        monthlyCostView.getByRole("checkbox", {
          name: `Include ${field.label} for all listings`,
        }).checked,
        HOUSING_COST_DEFAULT_ENABLED[field.key],
      );
    }
  });
  assertListingOutput(
    monthlyCostView,
    LISTING_TITLES[0],
    "Estimated Monthly Total",
    "$1,836.00",
  );
  assertListingOutput(
    monthlyCostView,
    LISTING_TITLES[1],
    "Estimated Monthly Total",
    "$1,986.00",
  );
});

test("invalid shared assumptions expose associated feedback and withhold all totals", async () => {
  const user = setupUser();
  renderCompare(ALL_LISTINGS);
  const monthlyCostView = getMonthlyCostView();
  const utilitiesInput = getAssumptionInput(monthlyCostView, "Utilities");

  await replaceInputValue(user, utilitiesInput, "-1");

  assert.equal(utilitiesInput.getAttribute("aria-invalid"), "true");
  const describedIds = (utilitiesInput.getAttribute("aria-describedby") || "")
    .split(/\s+/)
    .filter(Boolean);
  assert.equal(
    describedIds.some(
      (id) =>
        document.getElementById(id)?.textContent ===
        "Amount cannot be negative.",
    ),
    true,
  );

  ALL_LISTINGS.forEach((listing) => {
    assertListingOutput(
      monthlyCostView,
      listing.title,
      "Advertised Rent",
      `$${listing.monthlyRent.toLocaleString("en-CA", {
        minimumFractionDigits: 2,
      })}`,
    );
    [
      "Additional Estimated Monthly Expenses",
      "Estimated Monthly Total",
      "Difference from Lowest",
    ].forEach((label) => {
      assertListingOutput(monthlyCostView, listing.title, label, "Unavailable");
    });
  });
  assert.equal(
    monthlyCostView.queryByText(/Lowest Total(?: — Tie)?/, { exact: true }),
    null,
  );
  assert.ok(
    monthlyCostView.getByText(/No valid estimated monthly totals are available/i),
  );
});

test("null, malformed, and negative rents are unavailable without breaking valid listings", () => {
  const invalidRentCases = [
    { label: "null", value: null },
    { label: "malformed", value: "not-a-rent" },
    { label: "negative", value: -1 },
  ];

  invalidRentCases.forEach(({ label, value }, index) => {
    const validListing = createListing(0);
    const invalidListing = createListing(1, {
      _id: `64b00000000000000000008${index}`,
      title: `${label} rent listing`,
      monthlyRent: value,
    });
    const view = renderCompare([validListing, invalidListing]);
    const monthlyCostSection = getMonthlyCostSection();
    const monthlyCostView = within(monthlyCostSection);

    assertListingOutput(
      monthlyCostView,
      validListing.title,
      "Estimated Monthly Total",
      "$1,836.00",
    );
    assertListingOutput(
      monthlyCostView,
      invalidListing.title,
      "Advertised Rent",
      "Unavailable",
    );
    assertListingOutput(
      monthlyCostView,
      invalidListing.title,
      "Estimated Monthly Total",
      "Unavailable",
    );
    assert.ok(
      getListingCard(monthlyCostView, invalidListing.title).getByText(
        /does not have a valid advertised rent/i,
      ),
    );
    assert.ok(
      getListingCard(monthlyCostView, validListing.title).getByText(
        "Lowest Total",
        { exact: true },
      ),
    );
    assert.equal(monthlyCostSection.textContent.includes("NaN"), false);
    view.unmount();
  });
});

test("all missing rents render a clean unavailable state with no lowest listing", () => {
  const missingRentListings = ALL_LISTINGS.map((listing) => ({
    ...listing,
    monthlyRent: undefined,
    rent: undefined,
  }));
  renderCompare(missingRentListings);
  const monthlyCostSection = getMonthlyCostSection();
  const monthlyCostView = within(monthlyCostSection);

  missingRentListings.forEach((listing) => {
    ["Advertised Rent", "Estimated Monthly Total", "Difference from Lowest"].forEach(
      (label) => {
        assertListingOutput(monthlyCostView, listing.title, label, "Unavailable");
      },
    );
  });
  assert.equal(
    monthlyCostView.queryByText(/Lowest Total(?: — Tie)?/, { exact: true }),
    null,
  );
  assert.ok(
    monthlyCostView.getByText(/No valid estimated monthly totals are available/i),
  );
  assert.equal(monthlyCostSection.textContent.includes("NaN"), false);
});

test("selection changes preserve shared edits and recalculate the replacement listing", async () => {
  const user = setupUser();
  const requestRecommendation = createRequestSpy();
  const view = renderCompare(ALL_LISTINGS.slice(0, 2), {
    requestRecommendation,
  });
  let monthlyCostView = getMonthlyCostView();

  await replaceInputValue(
    user,
    getAssumptionInput(monthlyCostView, "Utilities"),
    "120",
  );
  assertListingOutput(
    monthlyCostView,
    LISTING_TITLES[1],
    "Estimated Monthly Total",
    "$2,026.00",
  );

  const replacementListings = [ALL_LISTINGS[0], ALL_LISTINGS[2]];
  view.rerender(
    React.createElement(
      CompareListings,
      createCompareProps(replacementListings, { requestRecommendation }),
    ),
  );
  monthlyCostView = getMonthlyCostView();

  assert.equal(
    getAssumptionInput(monthlyCostView, "Utilities").value,
    "120",
  );
  assertListingOutput(
    monthlyCostView,
    LISTING_TITLES[0],
    "Estimated Monthly Total",
    "$1,876.00",
  );
  assertListingOutput(
    monthlyCostView,
    LISTING_TITLES[2],
    "Estimated Monthly Total",
    "$2,176.00",
  );
  assertListingOutput(
    monthlyCostView,
    LISTING_TITLES[2],
    "Difference from Lowest",
    "+$300.00",
  );
  assert.equal(
    monthlyCostView.queryByRole("listitem", { name: LISTING_TITLES[1] }),
    null,
  );
});

test("existing comparison rows, badges, summary, controls, and limit remain visible", () => {
  const fourthListing = {
    ...createListing(2),
    _id: FOURTH_LISTING_ID,
    title: "Fourth Available Listing",
    monthlyRent: 2200,
    valueScore: 70,
    amenities: ["WiFi"],
  };
  const view = renderCompare(ALL_LISTINGS, {
    availableListings: [...ALL_LISTINGS, fourthListing],
  });

  assert.ok(view.getByRole("heading", { name: "Current Value Score leader" }));
  assert.ok(view.getByRole("heading", { name: "AI Comparison Summary" }));
  assert.ok(view.getByRole("button", { name: "Generate AI Recommendation" }));
  assert.ok(view.getByRole("table", { name: "Listing comparison" }));
  [
    "Value Score",
    "Monthly Rent",
    "TTC Commute",
    "Safety Level",
    "Amenities",
  ].forEach((rowLabel) => {
    assert.ok(view.getAllByText(rowLabel, { exact: true }).length > 0);
  });
  assert.ok(view.getAllByText("Best Value", { exact: true }).length > 0);
  assert.ok(
    view.getAllByText("Highest Value Score", { exact: true }).length > 0,
  );
  assert.ok(view.getAllByRole("button", { name: "Remove" }).length >= 3);
  assert.ok(view.getByText("3/3 selected", { exact: true }));
  assert.equal(view.queryByRole("button", { name: "Add Listing" }), null);
});

test("AI generation remains independent and receives only ordered IDs plus options", async () => {
  const user = setupUser();
  const requestRecommendation = createRequestSpy();
  const orderedListings = [ALL_LISTINGS[2], ALL_LISTINGS[0], ALL_LISTINGS[1]];
  renderCompare(orderedListings, { requestRecommendation });
  const monthlyCostView = getMonthlyCostView();

  await replaceInputValue(
    user,
    getAssumptionInput(monthlyCostView, "Utilities"),
    "-1",
  );
  await user.click(
    screen.getByRole("button", { name: "Generate AI Recommendation" }),
  );

  assert.equal(requestRecommendation.calls.length, 1);
  assert.equal(requestRecommendation.calls[0].length, 2);
  assert.deepEqual(
    requestRecommendation.calls[0][0],
    orderedListings.map((listing) => listing._id),
  );
  const requestOptions = requestRecommendation.calls[0][1];
  assert.deepEqual(Object.keys(requestOptions).sort(), ["authToken", "signal"]);
  assert.equal(requestOptions.authToken, AUTH_TOKEN);
  assert.equal(requestOptions.signal instanceof AbortSignal, true);
  assert.equal("estimatedMonthlyCost" in requestOptions, false);
  assert.equal("monthlyCostAssumptions" in requestOptions, false);
});
