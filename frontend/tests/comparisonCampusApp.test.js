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
];
const FIRST_CAMPUS = "Toronto Metropolitan University";
const SECOND_CAMPUS = "Seneca Polytechnic -- Newnham";

const createListing = (index) => ({
  _id: LISTING_IDS[index],
  title: ["Context Room", "Context Studio"][index],
  address: `${index + 1} Context Street`,
  neighborhood: "Toronto",
  monthlyRent: [1200, 1500][index],
  propertyType: ["Room Rental", "Studio"][index],
  furnished: true,
  amenities: ["WiFi", "Laundry", "Kitchen"],
  safety: { crimeRateLevel: "Low", safetyScore: 85 },
  commuteEstimates: [
    { campus: FIRST_CAMPUS, minutes: 20 + index },
    { campus: SECOND_CAMPUS, minutes: 40 + index },
  ],
  valueScore: 99,
  valueScoreBreakdown: {
    affordability: 99,
    commute: 99,
    safety: 99,
    amenities: 99,
  },
  images: [],
});

const jsonResponse = (body) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

let restoreDom;
let viteServer;
let App;
let MemoryRouter;
let useLocation;
let useNavigate;
let act;
let cleanup;
let render;
let screen;
let waitFor;
let userEvent;

before(async () => {
  restoreDom = installDom();
  viteServer = await createFrontendTestServer({ stubListingsMap: true });
  ({ default: App } = await viteServer.ssrLoadModule("/src/App.jsx"));
  ({ MemoryRouter, useLocation, useNavigate } = await import(
    "react-router-dom"
  ));
  ({ act, cleanup, render, screen, waitFor } = await import(
    "@testing-library/react"
  ));
  ({ default: userEvent } = await import("@testing-library/user-event"));
});

after(async () => {
  await viteServer?.close();
  restoreDom?.();
});

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  localStorage.clear();
});

afterEach(() => {
  cleanup?.();
  delete globalThis.fetch;
});

test("compare hydration refetches every selected listing for campus URL changes", async () => {
  const calls = [];
  const listings = LISTING_IDS.map((_, index) => createListing(index));

  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    calls.push(url);

    if (url.pathname === "/api/campuses") {
      return jsonResponse({ count: 0, campuses: [] });
    }

    const listingIndex = LISTING_IDS.findIndex(
      (listingId) => url.pathname === `/api/listings/${listingId}`,
    );
    if (listingIndex >= 0) {
      return jsonResponse(listings[listingIndex]);
    }

    throw new Error(`Unexpected compare fetch: ${url}`);
  };

  let navigate;
  let currentLocation;
  const RouterObserver = () => {
    navigate = useNavigate();
    currentLocation = useLocation();
    return null;
  };
  const initialPath = `/compare?ids=${LISTING_IDS.join(",")}&campus=${encodeURIComponent(
    FIRST_CAMPUS,
  )}`;

  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [initialPath] },
      React.createElement(RouterObserver),
      React.createElement(App),
    ),
  );

  await screen.findAllByRole("heading", { name: "Context Room" });
  await waitFor(() => {
    const listingCalls = calls.filter((url) =>
      url.pathname.startsWith("/api/listings/"),
    );
    assert.equal(listingCalls.length, 2);
    listingCalls.forEach((url) =>
      assert.equal(url.searchParams.get("campus"), FIRST_CAMPUS),
    );
  });

  await act(async () => {
    navigate(
      `/compare?ids=${LISTING_IDS.join(",")}&campus=${encodeURIComponent(
        SECOND_CAMPUS,
      )}`,
    );
  });

  await waitFor(() => {
    const listingCalls = calls.filter((url) =>
      url.pathname.startsWith("/api/listings/"),
    );
    assert.equal(listingCalls.length, 4);
    listingCalls.slice(2).forEach((url) =>
      assert.equal(url.searchParams.get("campus"), SECOND_CAMPUS),
    );
  });

  const user = userEvent.setup({ document });
  await user.click(screen.getAllByRole("button", { name: "Remove" })[0]);

  await waitFor(() => {
    assert.equal(currentLocation.pathname, "/compare");
    assert.equal(
      new URLSearchParams(currentLocation.search).get("campus"),
      SECOND_CAMPUS,
    );
    assert.deepEqual(
      new URLSearchParams(currentLocation.search).get("ids")?.split(","),
      [LISTING_IDS[1]],
    );
  });
});

test("an explicit no-campus comparison survives a listing-details round trip", async () => {
  const listings = LISTING_IDS.map((_, index) => createListing(index));
  const calls = [];

  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    calls.push(url);

    if (url.pathname === "/api/campuses") {
      return jsonResponse({ count: 0, campuses: [] });
    }

    if (url.pathname === "/api/listings") {
      return jsonResponse({ count: listings.length, listings });
    }

    const listingIndex = LISTING_IDS.findIndex(
      (listingId) => url.pathname === `/api/listings/${listingId}`,
    );
    if (listingIndex >= 0) {
      return jsonResponse(listings[listingIndex]);
    }

    throw new Error(`Unexpected compare fetch: ${url}`);
  };

  let navigate;
  let currentLocation;
  const RouterObserver = () => {
    navigate = useNavigate();
    currentLocation = useLocation();
    return null;
  };

  render(
    React.createElement(
      MemoryRouter,
      {
        initialEntries: [
          `/results?campus=${encodeURIComponent(FIRST_CAMPUS)}`,
        ],
      },
      React.createElement(RouterObserver),
      React.createElement(App),
    ),
  );

  await screen.findByRole("heading", { name: "Context Room" });
  await act(async () => {
    navigate(`/compare?ids=${LISTING_IDS.join(",")}&campus=`);
  });

  await screen.findAllByRole("heading", { name: "Context Room" });
  const user = userEvent.setup({ document });
  await user.click(screen.getAllByRole("button", { name: "View Details" })[0]);

  await waitFor(() => {
    assert.equal(currentLocation.pathname, `/listings/${LISTING_IDS[0]}`);
    const params = new URLSearchParams(currentLocation.search);
    assert.equal(params.has("campus"), true);
    assert.equal(params.get("campus"), "");
  });

  await screen.findByText("No campus selected");
  const detailCalls = calls.filter(
    (url) => url.pathname === `/api/listings/${LISTING_IDS[0]}`,
  );
  assert.ok(detailCalls.length >= 2);
  assert.equal(detailCalls.at(-1).searchParams.has("campus"), false);

  await user.click(await screen.findByRole("button", { name: "Back to Compare" }));

  await waitFor(() => {
    assert.equal(currentLocation.pathname, "/compare");
    const params = new URLSearchParams(currentLocation.search);
    assert.equal(params.has("campus"), true);
    assert.equal(params.get("campus"), "");
    assert.deepEqual(params.get("ids")?.split(","), LISTING_IDS);
  });
});
