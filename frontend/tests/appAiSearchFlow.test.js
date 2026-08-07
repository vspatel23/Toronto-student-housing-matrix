import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";

import React from "react";

import {
  createFrontendTestServer,
  installDom,
} from "./helpers/domHarness.js";

const CAMPUS_NAME = "Toronto Metropolitan University";
const DESCRIPTION =
  "I want a furnished apartment near Toronto Metropolitan University for between $1200 and $1800, within 30 minutes, with WiFi and Laundry.";

const authenticatedUser = {
  _id: "user-issue-61",
  name: "Ved Patel",
  email: "ved@example.test",
};

const campuses = [
  {
    _id: "campus-tmu",
    institution: CAMPUS_NAME,
    campusName: CAMPUS_NAME,
  },
];

const aiFilters = {
  campus: CAMPUS_NAME,
  minRent: 1200,
  maxRent: 1800,
  housingType: "Apartment",
  maxCommute: 30,
  safetyLevel: null,
  furnished: "Furnished",
  amenities: ["WiFi", "Laundry"],
};

const createListing = (overrides = {}) => ({
  _id: "64b000000000000000000061",
  title: "Matching Furnished TMU Apartment",
  address: "1 Victoria Street",
  neighborhood: "Downtown Toronto",
  monthlyRent: 1600,
  propertyType: "Apartment",
  furnished: true,
  bedrooms: 1,
  bathrooms: 1,
  amenities: ["WiFi", "Laundry", "Kitchen"],
  safety: { crimeRateLevel: "Low", safetyScore: 88 },
  commuteEstimates: [{ campus: CAMPUS_NAME, minutes: 24 }],
  description: "A furnished apartment near campus.",
  valueScore: 87,
  images: [],
  ...overrides,
});

const listingFixtures = [
  createListing(),
  createListing({
    _id: "64b000000000000000000062",
    title: "Unfurnished Near Campus Apartment",
    furnished: false,
  }),
  createListing({
    _id: "64b000000000000000000063",
    title: "Apartment Missing Laundry",
    amenities: ["WiFi", "Kitchen"],
  }),
  createListing({
    _id: "64b000000000000000000064",
    title: "Long Commute Furnished Apartment",
    commuteEstimates: [{ campus: CAMPUS_NAME, minutes: 45 }],
  }),
];

const initialRecentSearch = {
  _id: "recent-initial",
  campus: "University of Toronto -- St. George",
  minRent: 900,
  maxRent: 1500,
  housingType: "Room Rental",
  maxCommute: 40,
  updatedAt: "2026-08-01T12:00:00.000Z",
};

const confirmedRecentSearch = {
  _id: "recent-ai-confirmed",
  campus: CAMPUS_NAME,
  minRent: 1200,
  maxRent: 1800,
  housingType: "Apartment",
  maxCommute: 30,
  updatedAt: "2026-08-07T12:00:00.000Z",
};

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const parseBody = (body) => {
  if (typeof body !== "string" || body.length === 0) {
    return null;
  }

  return JSON.parse(body);
};

const createFetchMock = ({ listings = listingFixtures } = {}) => {
  const calls = [];
  let analyticsRecorded = false;

  const fetchMock = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    const method = (init.method || "GET").toUpperCase();
    const call = {
      method,
      pathname: url.pathname,
      searchParams: new URLSearchParams(url.search),
      headers: init.headers || {},
      body: parseBody(init.body),
    };
    calls.push(call);

    if (method === "GET" && url.pathname === "/api/auth/me") {
      return jsonResponse({ success: true, user: authenticatedUser });
    }

    if (method === "GET" && url.pathname === "/api/campuses") {
      return jsonResponse({ count: campuses.length, campuses });
    }

    if (method === "GET" && url.pathname === "/api/saved-listings") {
      return jsonResponse({ success: true, count: 0, listings: [] });
    }

    if (method === "GET" && url.pathname === "/api/analytics/recent") {
      const searches = analyticsRecorded
        ? [confirmedRecentSearch, initialRecentSearch]
        : [initialRecentSearch];
      return jsonResponse({ success: true, count: searches.length, searches });
    }

    if (method === "POST" && url.pathname === "/api/ai/search") {
      return jsonResponse({ success: true, filters: aiFilters });
    }

    if (method === "POST" && url.pathname === "/api/preferences") {
      return jsonResponse({ success: true, preferences: call.body }, 201);
    }

    if (method === "GET" && url.pathname === "/api/listings") {
      return jsonResponse({ count: listings.length, listings });
    }

    if (method === "POST" && url.pathname === "/api/analytics/search") {
      analyticsRecorded = true;
      return jsonResponse(
        { success: true, record: { ...confirmedRecentSearch, ...call.body } },
        201,
      );
    }

    throw new Error(`Unexpected fetch in App integration test: ${method} ${url}`);
  };

  fetchMock.calls = calls;
  fetchMock.findCalls = (method, pathname) =>
    calls.filter(
      (call) => call.method === method && call.pathname === pathname,
    );

  return fetchMock;
};

let restoreDom;
let viteServer;
let App;
let MemoryRouter;
let cleanup;
let render;
let screen;
let waitFor;
let userEvent;

before(async () => {
  restoreDom = installDom();
  viteServer = await createFrontendTestServer({ stubListingsMap: true });

  ({ default: App } = await viteServer.ssrLoadModule("/src/App.jsx"));
  ({ MemoryRouter } = await import("react-router-dom"));
  ({ cleanup, render, screen, waitFor } = await import(
    "@testing-library/react"
  ));
  ({ default: userEvent } = await import("@testing-library/user-event"));
});

after(async () => {
  cleanup?.();
  await viteServer?.close();
  restoreDom?.();
});

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  localStorage.clear();
  localStorage.setItem("tshm_auth_token", "issue-61-test-token");
  localStorage.setItem("tshm_auth_user", JSON.stringify(authenticatedUser));
});

afterEach(() => {
  cleanup();
  delete globalThis.fetch;
});

const renderAuthenticatedApp = async (fetchMock) => {
  globalThis.fetch = fetchMock;
  const user = userEvent.setup({ document });

  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/"] },
      React.createElement(App),
    ),
  );

  const descriptionInput = await screen.findByRole("textbox", {
    name: "Housing description",
  });

  return { descriptionInput, user };
};

const getComposerSearchButton = (descriptionInput) => {
  const searchButton = descriptionInput
    .closest("form")
    ?.querySelector('button[type="submit"]');
  assert.ok(searchButton, "the AI composer should expose its submit button");
  return searchButton;
};

test("the dashboard remains protected when no authenticated session exists", () => {
  localStorage.clear();
  globalThis.fetch = async () => {
    assert.fail("the protected dashboard should not fetch before login");
  };

  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/"] },
      React.createElement(App),
    ),
  );

  assert.ok(screen.getByRole("heading", { name: "Log In" }));
  assert.ok(screen.getByRole("textbox", { name: /^Email/ }));
  assert.equal(
    screen.queryByRole("textbox", { name: "Housing description" }),
    null,
  );
});

test("authenticated AI extraction immediately reuses listing search and Modify Search restores the prompt", async () => {
  const fetchMock = createFetchMock();
  const { descriptionInput, user } = await renderAuthenticatedApp(fetchMock);

  assert.ok(
    screen.getByText("Ved Patel"),
    "the authenticated dashboard should preserve its signed-in account UI",
  );
  assert.equal(fetchMock.findCalls("GET", "/api/auth/me").length, 1);
  assert.match(
    fetchMock.findCalls("GET", "/api/auth/me")[0].headers.Authorization,
    /^Bearer /,
  );

  await user.type(descriptionInput, DESCRIPTION);
  const recentCallCountBeforeSearch = fetchMock.findCalls(
    "GET",
    "/api/analytics/recent",
  ).length;
  await user.click(getComposerSearchButton(descriptionInput));

  await screen.findByRole("heading", { name: "Browse Results" });
  assert.equal(screen.queryByText("Review your search"), null);
  assert.equal(screen.queryByRole("button", { name: "Confirm & Search" }), null);
  assert.equal(screen.queryByRole("button", { name: "Edit description" }), null);

  const aiCalls = fetchMock.findCalls("POST", "/api/ai/search");
  assert.equal(aiCalls.length, 1);
  assert.deepEqual(aiCalls[0].body, { description: DESCRIPTION });

  const listingCalls = fetchMock.findCalls("GET", "/api/listings");
  assert.equal(listingCalls.length, 1);
  assert.equal(listingCalls[0].searchParams.get("propertyType"), "Apartment");
  assert.equal(listingCalls[0].searchParams.has("housingType"), false);
  assert.equal(listingCalls[0].searchParams.get("campus"), CAMPUS_NAME);

  await screen.findByRole("heading", {
    name: "Matching Furnished TMU Apartment",
  });
  assert.equal(screen.queryByText("Unfurnished Near Campus Apartment"), null);
  assert.equal(screen.queryByText("Apartment Missing Laundry"), null);
  assert.equal(screen.queryByText("Long Commute Furnished Apartment"), null);

  await waitFor(() => {
    assert.equal(fetchMock.findCalls("POST", "/api/analytics/search").length, 1);
    assert.equal(
      fetchMock.findCalls("GET", "/api/analytics/recent").length,
      recentCallCountBeforeSearch + 1,
    );
  });

  const analyticsCall = fetchMock.findCalls(
    "POST",
    "/api/analytics/search",
  )[0];
  assert.deepEqual(analyticsCall.body, {
    campus: CAMPUS_NAME,
    minRent: 1200,
    maxRent: 1800,
    housingType: "Apartment",
    maxCommute: 30,
  });

  await user.click(screen.getByRole("button", { name: "Modify Search" }));
  const restoredInput = await screen.findByRole("textbox", {
    name: "Housing description",
  });
  assert.equal(restoredInput.value, DESCRIPTION);
  await screen.findByRole("heading", { name: "Recent Searches" });
  assert.ok(
    screen.getByRole("heading", { name: CAMPUS_NAME }),
    "the refreshed Recent Searches data should include the AI search",
  );
});

test("Advanced Search stays independent from AI and preserves the authenticated manual-search pipeline", async () => {
  const fetchMock = createFetchMock({ listings: [createListing()] });
  const { user } = await renderAuthenticatedApp(fetchMock);

  const advancedSearchToggle = screen.getByRole("button", {
    name: "Advanced Search",
  });
  assert.equal(advancedSearchToggle.getAttribute("aria-expanded"), "false");

  await user.click(advancedSearchToggle);
  assert.equal(advancedSearchToggle.getAttribute("aria-expanded"), "true");

  const campusSelect = await screen.findByLabelText("Campus");
  await waitFor(() => assert.equal(campusSelect.disabled, false));
  await user.selectOptions(campusSelect, CAMPUS_NAME);
  await user.selectOptions(screen.getByLabelText("Housing type"), "Apartment");
  const recentCallCountBeforeSearch = fetchMock.findCalls(
    "GET",
    "/api/analytics/recent",
  ).length;
  await user.click(screen.getByRole("button", { name: "Search listings" }));

  await screen.findByRole("heading", { name: "Browse Results" });
  await screen.findByRole("heading", {
    name: "Matching Furnished TMU Apartment",
  });
  assert.equal(fetchMock.findCalls("POST", "/api/ai/search").length, 0);

  const preferenceCalls = fetchMock.findCalls("POST", "/api/preferences");
  assert.equal(preferenceCalls.length, 1);
  assert.equal(preferenceCalls[0].body.campus, CAMPUS_NAME);
  assert.equal(preferenceCalls[0].body.housingType, "Apartment");

  const listingCalls = fetchMock.findCalls("GET", "/api/listings");
  assert.equal(listingCalls.length, 1);
  assert.equal(listingCalls[0].searchParams.get("propertyType"), "Apartment");
  assert.equal(listingCalls[0].searchParams.get("campus"), CAMPUS_NAME);

  await waitFor(() => {
    assert.equal(fetchMock.findCalls("POST", "/api/analytics/search").length, 1);
    assert.equal(
      fetchMock.findCalls("GET", "/api/analytics/recent").length,
      recentCallCountBeforeSearch + 1,
    );
  });
  assert.equal(
    fetchMock.findCalls("POST", "/api/analytics/search")[0].body.housingType,
    "Apartment",
  );

  await user.click(screen.getByRole("button", { name: "Search" }));
  await screen.findByRole("heading", { name: "Recent Searches" });
  assert.ok(screen.getByRole("heading", { name: CAMPUS_NAME }));

  const returnedAdvancedSearchToggle = screen.getByRole("button", {
    name: "Advanced Search",
  });
  await user.click(returnedAdvancedSearchToggle);
  assert.equal(screen.getByLabelText("Campus").value, CAMPUS_NAME);
  assert.equal(screen.getByLabelText("Housing type").value, "Apartment");
});
