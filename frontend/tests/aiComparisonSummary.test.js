import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";

import React from "react";

import {
  createFrontendTestServer,
  installDom,
} from "./helpers/domHarness.js";

const LISTING_IDS = [
  "64b000000000000000000001",
  "64b000000000000000000002",
  "64b000000000000000000003",
];
const UNKNOWN_LISTING_ID = "64b000000000000000000099";
const FOURTH_LISTING_ID = "64b000000000000000000004";
const AUTH_TOKEN = "issue-64-test-token";
const CAMPUS = "Toronto Metropolitan University";

const createListing = (index, overrides = {}) => ({
  _id: LISTING_IDS[index],
  title: [
    "Annex Student Room",
    "Kensington Studio",
    "Cabbagetown Shared Home",
  ][index],
  address: `${index + 1} Example Street`,
  neighborhood: ["The Annex", "Kensington Market", "Cabbagetown"][index],
  monthlyRent: [1100, 1450, 1325][index],
  propertyType: ["Room Rental", "Studio", "Shared House"][index],
  furnished: index !== 1,
  amenities: [
    ["WiFi", "Laundry", "Kitchen", "Nearby Transit"],
    ["WiFi", "Kitchen"],
    ["WiFi", "Laundry", "Kitchen"],
  ][index],
  safety: {
    crimeRateLevel: ["Low", "Medium", "Low"][index],
    safetyScore: [86, 75, 82][index],
  },
  commuteEstimates: [{ campus: CAMPUS, minutes: [28, 18, 24][index] }],
  valueScore: [89, 78, 84][index],
  valueScoreBreakdown: {
    affordability: [96, 82, 87][index],
    commute: [80, 95, 88][index],
    safety: [86, 75, 82][index],
    amenities: [50, 25, 38][index],
  },
  images: [],
  ...overrides,
});

const ALL_LISTINGS = [0, 1, 2].map((index) => createListing(index));

const createRecommendation = (listingIds = LISTING_IDS.slice(0, 2)) => ({
  bestOverall: {
    listingId: listingIds[0],
    reason:
      "This listing has the highest existing Value Score at 89/100 among the compared listings.",
  },
  bestBudget: {
    listingId: listingIds[0],
    reason: "This listing has the lowest supplied monthly rent at $1100 per month.",
  },
  bestCommute: {
    listingId: listingIds[1],
    reason:
      "This listing has the shortest supplied commute at 18 minutes for the applicable campus context.",
  },
  bestSafety: {
    listingId: listingIds[0],
    reason:
      "This listing has the highest available application safety comparison value at 86/100.",
  },
  listingInsights: listingIds.map((listingId, index) => ({
    listingId,
    advantage:
      index === 0
        ? "It lists 4 stored amenities, the most among the compared listings."
        : `Grounded advantage for listing ${index + 1}.`,
    compromise:
      index === 1
        ? "It lists 2 fewer stored amenities than the compared listing with the most."
        : `Grounded compromise for listing ${index + 1}.`,
  })),
  recommendation: `Choose listing ${listingIds[0]}, which has the highest existing Value Score at 89/100.`,
});

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

const createRequestSpy = (implementation = async () => undefined) => {
  let currentImplementation = implementation;
  const calls = [];
  const request = (...args) => {
    calls.push(args);
    return currentImplementation(...args);
  };

  request.calls = calls;
  request.setImplementation = (nextImplementation) => {
    currentImplementation = nextImplementation;
  };
  return request;
};

const createAiError = (code) => Object.assign(new Error(code), { code });

let restoreDom;
let viteServer;
let AiComparisonSummary;
let CompareListings;
let act;
let cleanup;
let render;
let screen;
let waitFor;
let within;
let userEvent;

before(async () => {
  restoreDom = installDom();
  ({ act, cleanup, render, screen, waitFor, within } = await import(
    "@testing-library/react"
  ));
  ({ default: userEvent } = await import("@testing-library/user-event"));

  viteServer = await createFrontendTestServer();
  ({ default: AiComparisonSummary } = await viteServer.ssrLoadModule(
    "/src/components/AiComparisonSummary.jsx",
  ));
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

const renderAiSummary = ({
  listings = ALL_LISTINGS.slice(0, 2),
  listingIds = listings.map((listing) => listing._id),
  requestRecommendation = createRequestSpy(),
} = {}) =>
  render(
    React.createElement(AiComparisonSummary, {
      listings,
      listingIds,
      requestRecommendation,
    }),
  );

const getAiSection = () =>
  screen
    .getByRole("heading", { name: "AI Comparison Summary" })
    .closest("section");

const createCompareProps = (overrides = {}) => ({
  listings: ALL_LISTINGS.slice(0, 2),
  listingIds: LISTING_IDS.slice(0, 2),
  availableListings: ALL_LISTINGS,
  campus: CAMPUS,
  maxCompareListings: 3,
  savedListingIds: new Set(),
  savingListingIds: new Set(),
  onToggleSave: () => {},
  onAddCompare: () => true,
  onRemoveCompare: () => {},
  onBackToResults: () => {},
  onDetails: () => {},
  ...overrides,
});

test("Generate is always rendered and is enabled only for two or three resolved selections", async (t) => {
  const cases = [
    { count: 0, disabled: true },
    { count: 1, disabled: true },
    { count: 2, disabled: false },
    { count: 3, disabled: false },
  ];

  for (const testCase of cases) {
    await t.test(`${testCase.count} selected`, () => {
      const listings = ALL_LISTINGS.slice(0, testCase.count);
      const view = renderAiSummary({ listings });
      const button = view.getByRole("button", {
        name: "Generate AI Recommendation",
      });

      assert.equal(button.disabled, testCase.disabled);
      if (testCase.count < 2) {
        assert.ok(
          view.getByText(
            "Select at least 2 listings to generate an AI recommendation.",
          ),
        );
      }

      view.unmount();
    });
  }
});

test("missing authentication stays inside the optional AI section without hiding comparison data", async () => {
  localStorage.clear();
  const requestRecommendation = createRequestSpy(async (_listingIds, options) => {
    assert.equal(options.authToken, "");
    throw createAiError("AI_AUTH_REQUIRED");
  });
  const user = setupUser();

  render(
    React.createElement(
      CompareListings,
      createCompareProps({ requestRecommendation }),
    ),
  );

  await user.click(
    screen.getByRole("button", { name: "Generate AI Recommendation" }),
  );

  assert.match((await screen.findByRole("alert")).textContent, /sign in/i);
  assert.equal(screen.queryByRole("button", { name: "Retry" }), null);
  assert.ok(screen.getByRole("table", { name: "Listing comparison" }));
  assert.ok(
    screen.getByRole("heading", { name: "Current Value Score leader" }),
  );
});

test("generation sends exact ordered IDs and exposes accessible loading without removing normal comparison", async () => {
  const deferred = createDeferred();
  const requestRecommendation = createRequestSpy(() => deferred.promise);
  const user = setupUser();

  render(
    React.createElement(
      CompareListings,
      createCompareProps({
        listingIds: [LISTING_IDS[1], LISTING_IDS[0]],
        requestRecommendation,
      }),
    ),
  );

  const generateButton = screen.getByRole("button", {
    name: "Generate AI Recommendation",
  });
  await user.click(generateButton);

  assert.equal(requestRecommendation.calls.length, 1);
  assert.deepEqual(requestRecommendation.calls[0][0], [
    LISTING_IDS[1],
    LISTING_IDS[0],
  ]);
  assert.equal(requestRecommendation.calls[0][1].authToken, AUTH_TOKEN);
  assert.equal(requestRecommendation.calls[0][1].signal.aborted, false);
  assert.equal(generateButton.disabled, true);
  assert.equal(getAiSection().getAttribute("aria-busy"), "true");

  const loadingStatus = screen.getByText("Generating AI comparison...");
  assert.equal(loadingStatus.closest('[role="status"]')?.getAttribute("aria-live"), "polite");
  assert.ok(screen.getByRole("table", { name: "Listing comparison" }));
  assert.ok(
    screen.getByRole("heading", {
      name: "Current Value Score leader",
    }),
  );
  assert.ok(screen.getAllByText("Value Score").length > 0);
  assert.ok(screen.getAllByText("Best Value").length > 0);

  await act(async () => {
    deferred.resolve(createRecommendation([LISTING_IDS[1], LISTING_IDS[0]]));
    await deferred.promise;
  });
});

test("success is visually separated and renders every supported grounded section using titles", async () => {
  const recommendation = createRecommendation();
  const requestRecommendation = createRequestSpy(async () => recommendation);
  const user = setupUser();
  renderAiSummary({ requestRecommendation });

  await user.click(
    screen.getByRole("button", { name: "Generate AI Recommendation" }),
  );

  const section = getAiSection();
  const ai = within(section);
  await ai.findByRole("heading", { name: "Best overall" });

  [
    "Best for budget",
    "Best for commute",
    "Best for safety",
    "Amenity insight",
    "Listing insights",
    "Recommendation",
  ].forEach((heading) => {
    assert.ok(ai.getByRole("heading", { name: heading }));
  });

  assert.ok(ai.getAllByText("Annex Student Room").length > 0);
  assert.ok(ai.getAllByText("Kensington Studio").length > 0);
  assert.ok(
    ai.getAllByText(
      "It lists 4 stored amenities, the most among the compared listings.",
    ).length > 0,
  );
  assert.ok(
    ai.getAllByText(
      "It lists 2 fewer stored amenities than the compared listing with the most.",
    ).length > 0,
  );
  assert.equal(ai.getAllByText(/Main advantage/i).length, 2);
  assert.equal(ai.getAllByText(/Main compromise/i).length, 2);
  assert.ok(
    ai.getByText(
      "Choose listing Annex Student Room, which has the highest existing Value Score at 89/100.",
    ),
  );
  LISTING_IDS.forEach((listingId) => {
    assert.equal(section.textContent.includes(listingId), false);
  });
  assert.ok(section.classList.contains("ai-comparison-section"));
  assert.equal(screen.queryByRole("table", { name: "Listing comparison" }), null);
  assert.ok(ai.getByRole("button", { name: "Regenerate" }));
});

test("three-listing generation renders one safe insight for every current listing", async () => {
  const listingIds = [...LISTING_IDS];
  const requestRecommendation = createRequestSpy(async () =>
    createRecommendation(listingIds),
  );
  const user = setupUser();
  renderAiSummary({
    listings: ALL_LISTINGS,
    listingIds,
    requestRecommendation,
  });

  await user.click(
    screen.getByRole("button", { name: "Generate AI Recommendation" }),
  );

  await screen.findByRole("heading", { name: "Listing insights" });
  assert.equal(
    document.querySelectorAll(".ai-comparison__insight-card").length,
    3,
  );
  ALL_LISTINGS.forEach((listing) => {
    assert.ok(screen.getAllByText(listing.title).length > 0);
  });
  LISTING_IDS.forEach((listingId) => {
    assert.equal(getAiSection().textContent.includes(listingId), false);
  });
});

test("a safe error offers Retry and Retry resends the same current IDs", async () => {
  const recommendation = createRecommendation();
  let attempt = 0;
  const requestRecommendation = createRequestSpy(async () => {
    attempt += 1;
    if (attempt === 1) {
      throw createAiError("AI_SERVICE_UNAVAILABLE");
    }
    return recommendation;
  });
  const user = setupUser();
  render(
    React.createElement(
      CompareListings,
      createCompareProps({ requestRecommendation }),
    ),
  );

  await user.click(
    screen.getByRole("button", { name: "Generate AI Recommendation" }),
  );

  const alert = await screen.findByRole("alert");
  assert.match(alert.textContent, /AI service is unavailable right now/i);
  assert.equal(alert.textContent.includes("OPENROUTER"), false);
  assert.equal(alert.textContent.includes("AI_SERVICE_UNAVAILABLE"), false);
  assert.ok(screen.getByRole("table", { name: "Listing comparison" }));
  assert.ok(
    screen.getByRole("heading", {
      name: "Current Value Score leader",
    }),
  );
  assert.ok(screen.getAllByText("Best Value").length > 0);

  const retryButton = screen.getByRole("button", { name: "Retry" });
  retryButton.focus();
  await user.keyboard("{Enter}");
  await screen.findByRole("heading", { name: "Recommendation" });

  assert.equal(requestRecommendation.calls.length, 2);
  assert.deepEqual(requestRecommendation.calls[0][0], LISTING_IDS.slice(0, 2));
  assert.deepEqual(requestRecommendation.calls[1][0], LISTING_IDS.slice(0, 2));
});

test("Regenerate makes a fresh request and preserves the last success while loading or failing", async () => {
  const firstRecommendation = createRecommendation();
  const secondRequest = createDeferred();
  let attempt = 0;
  const requestRecommendation = createRequestSpy(() => {
    attempt += 1;
    return attempt === 1
      ? Promise.resolve(firstRecommendation)
      : secondRequest.promise;
  });
  const user = setupUser();
  renderAiSummary({ requestRecommendation });

  await user.click(
    screen.getByRole("button", { name: "Generate AI Recommendation" }),
  );
  const displayedRecommendation = await screen.findByText(
    "Choose listing Annex Student Room, which has the highest existing Value Score at 89/100.",
  );

  const regenerateButton = screen.getByRole("button", { name: "Regenerate" });
  await user.click(regenerateButton);

  assert.equal(requestRecommendation.calls.length, 2);
  assert.deepEqual(requestRecommendation.calls[1][0], LISTING_IDS.slice(0, 2));
  assert.equal(regenerateButton.disabled, true);
  assert.ok(displayedRecommendation.isConnected);
  assert.ok(screen.getByText("Generating AI comparison..."));

  await act(async () => {
    secondRequest.reject(createAiError("AI_SERVICE_TIMEOUT"));
    await secondRequest.promise.catch(() => undefined);
  });

  assert.match(
    (await screen.findByRole("alert")).textContent,
    /took too long/i,
  );
  assert.ok(
    screen.getByText(
      "Choose listing Annex Student Room, which has the highest existing Value Score at 89/100.",
    ),
  );
});

test("successful Regenerate replaces the old result and focuses the refreshed summary", async () => {
  const initialRecommendation = createRecommendation();
  const refreshedRecommendation = createRecommendation();
  refreshedRecommendation.recommendation =
    `Choose listing ${LISTING_IDS[1]}, from the refreshed backend recommendation.`;
  let attempt = 0;
  const requestRecommendation = createRequestSpy(async () => {
    attempt += 1;
    return attempt === 1 ? initialRecommendation : refreshedRecommendation;
  });
  const user = setupUser();
  renderAiSummary({ requestRecommendation });

  await user.click(
    screen.getByRole("button", { name: "Generate AI Recommendation" }),
  );
  const oldText =
    "Choose listing Annex Student Room, which has the highest existing Value Score at 89/100.";
  await screen.findByText(oldText);
  await waitFor(() =>
    assert.equal(document.activeElement?.id, "ai-comparison-title"),
  );

  const regenerateButton = screen.getByRole("button", { name: "Regenerate" });
  regenerateButton.focus();
  await user.keyboard("{Enter}");

  await screen.findByText(
    "Choose listing Kensington Studio, from the refreshed backend recommendation.",
  );
  assert.equal(screen.queryByText(oldText), null);
  assert.equal(requestRecommendation.calls.length, 2);
  await waitFor(() =>
    assert.equal(document.activeElement?.id, "ai-comparison-title"),
  );
});

test("selection changes clear prior success and error immediately and update Generate state", async () => {
  const initialRecommendation = createRecommendation();
  const requestRecommendation = createRequestSpy(async () => initialRecommendation);
  const user = setupUser();
  const view = renderAiSummary({ requestRecommendation });

  await user.click(
    screen.getByRole("button", { name: "Generate AI Recommendation" }),
  );
  await screen.findByText(
    "Choose listing Annex Student Room, which has the highest existing Value Score at 89/100.",
  );

  const replacementListings = [ALL_LISTINGS[0], ALL_LISTINGS[2]];
  const replacementIds = [LISTING_IDS[0], LISTING_IDS[2]];
  view.rerender(
    React.createElement(AiComparisonSummary, {
      listings: replacementListings,
      listingIds: replacementIds,
      requestRecommendation,
    }),
  );

  assert.equal(screen.queryByRole("heading", { name: "Best overall" }), null);
  assert.equal(screen.queryByRole("alert"), null);
  assert.equal(
    screen.getByRole("button", { name: "Generate AI Recommendation" }).disabled,
    false,
  );

  requestRecommendation.setImplementation(async () => {
    throw createAiError("AI_SERVICE_TIMEOUT");
  });
  await user.click(
    screen.getByRole("button", { name: "Generate AI Recommendation" }),
  );
  await screen.findByRole("alert");

  view.rerender(
    React.createElement(AiComparisonSummary, {
      listings: [ALL_LISTINGS[1], ALL_LISTINGS[2]],
      listingIds: [LISTING_IDS[1], LISTING_IDS[2]],
      requestRecommendation,
    }),
  );
  assert.equal(screen.queryByRole("alert"), null);

  view.rerender(
    React.createElement(AiComparisonSummary, {
      listings: [ALL_LISTINGS[0]],
      listingIds: [LISTING_IDS[0]],
      requestRecommendation,
    }),
  );
  assert.equal(
    screen.getByRole("button", { name: "Generate AI Recommendation" }).disabled,
    true,
  );
  assert.ok(
    screen.getByText(
      "Select at least 2 listings to generate an AI recommendation.",
    ),
  );
});

test("an old in-flight response is aborted and ignored after selection replacement", async () => {
  const staleRequest = createDeferred();
  const freshRecommendation = createRecommendation([
    LISTING_IDS[0],
    LISTING_IDS[2],
  ]);
  const requestRecommendation = createRequestSpy((listingIds) =>
    listingIds[1] === LISTING_IDS[1]
      ? staleRequest.promise
      : Promise.resolve(freshRecommendation),
  );
  const user = setupUser();
  const view = renderAiSummary({ requestRecommendation });

  await user.click(
    screen.getByRole("button", { name: "Generate AI Recommendation" }),
  );
  const staleSignal = requestRecommendation.calls[0][1].signal;

  view.rerender(
    React.createElement(AiComparisonSummary, {
      listings: [ALL_LISTINGS[0], ALL_LISTINGS[2]],
      listingIds: [LISTING_IDS[0], LISTING_IDS[2]],
      requestRecommendation,
    }),
  );
  assert.equal(staleSignal.aborted, true);

  await act(async () => {
    staleRequest.resolve(createRecommendation());
    await staleRequest.promise;
  });
  assert.equal(screen.queryByRole("heading", { name: "Best overall" }), null);
  assert.equal(
    screen.queryByText(
      "Choose listing Annex Student Room, which has the highest existing Value Score at 89/100.",
    ),
    null,
  );

  await user.click(
    screen.getByRole("button", { name: "Generate AI Recommendation" }),
  );
  await screen.findByRole("heading", { name: "Best overall" });
  assert.deepEqual(requestRecommendation.calls[1][0], [
    LISTING_IDS[0],
    LISTING_IDS[2],
  ]);
});

test("existing badges, scores, rows, rule summary, removal, and three-listing limit stay intact", () => {
  const unselectedFourthListing = createListing(2, {
    _id: FOURTH_LISTING_ID,
    title: "Fourth Available Listing",
  });
  const view = render(
    React.createElement(
      CompareListings,
      createCompareProps({
        listings: ALL_LISTINGS,
        listingIds: LISTING_IDS,
        availableListings: [...ALL_LISTINGS, unselectedFourthListing],
      }),
    ),
  );

  assert.ok(view.getByRole("heading", { name: "Current Value Score leader" }));
  assert.ok(view.getByRole("table", { name: "Listing comparison" }));
  [
    "Value Score",
    "Monthly Rent",
    "TTC Commute",
    "Safety Level",
    "Amenities",
  ].forEach((rowLabel) => assert.ok(view.getAllByText(rowLabel).length > 0));
  assert.ok(view.getAllByText("Best Value").length > 0);
  assert.ok(view.getAllByText("Highest Value Score").length > 0);
  assert.ok(view.getAllByRole("button", { name: "Remove" }).length >= 3);
  assert.equal(view.queryByRole("button", { name: "Add Listing" }), null);
  assert.ok(
    view.getByRole("button", { name: "Generate AI Recommendation" }),
  );
});

test("Generate is keyboard reachable and activates with Enter", async () => {
  const requestRecommendation = createRequestSpy(async () =>
    createRecommendation(),
  );
  const user = setupUser();
  renderAiSummary({ requestRecommendation });
  const generateButton = screen.getByRole("button", {
    name: "Generate AI Recommendation",
  });

  await user.tab();
  assert.equal(document.activeElement, generateButton);
  await user.keyboard("{Enter}");

  await waitFor(() => assert.equal(requestRecommendation.calls.length, 1));
  await screen.findByRole("button", { name: "Regenerate" });
});

test("null category IDs render safely and unknown response IDs never render", async () => {
  const nullRecommendation = createRecommendation();
  nullRecommendation.bestSafety = {
    listingId: null,
    reason: "The supplied listings do not include comparable safety data.",
  };
  const requestRecommendation = createRequestSpy(async () => nullRecommendation);
  const user = setupUser();
  const view = renderAiSummary({ requestRecommendation });

  await user.click(
    screen.getByRole("button", { name: "Generate AI Recommendation" }),
  );
  const safetyHeading = await screen.findByRole("heading", {
    name: "Best for safety",
  });
  assert.match(safetyHeading.parentElement.textContent, /not determined|unavailable/i);
  assert.match(
    safetyHeading.parentElement.textContent,
    /do not include comparable safety data/i,
  );

  const invalidRecommendation = createRecommendation();
  invalidRecommendation.bestBudget.listingId = UNKNOWN_LISTING_ID;
  requestRecommendation.setImplementation(async () => invalidRecommendation);
  await user.click(screen.getByRole("button", { name: "Regenerate" }));

  await screen.findByRole("alert");
  assert.equal(getAiSection().textContent.includes(UNKNOWN_LISTING_ID), false);
  assert.equal(view.queryByText(UNKNOWN_LISTING_ID), null);
});
