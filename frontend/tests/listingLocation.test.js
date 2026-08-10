import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";

import React from "react";
import { createServer } from "vite";

import { installDom } from "./helpers/domHarness.js";

const CAMPUS_LABEL = "Toronto Metropolitan University";
const LISTING_ID = "64b000000000000000000068";
const NEARBY_CATEGORIES = [
  "transit",
  "grocery",
  "pharmacy",
  "library",
  "park",
  "gym",
  "clinic",
  "campus",
];

const createListing = (overrides = {}) => ({
  _id: LISTING_ID,
  title: "Downtown Room Near Jarvis",
  address: "184 Jarvis Street, Toronto, ON",
  neighborhood: "Downtown Toronto",
  monthlyRent: 1450,
  propertyType: "Room Rental",
  furnished: true,
  amenities: ["WiFi", "Laundry"],
  safety: { crimeRateLevel: "Low", safetyScore: 88 },
  commuteEstimates: [{ campus: CAMPUS_LABEL, minutes: 11 }],
  description: "A furnished room close to transit and campus.",
  location: { lat: 43.6567, lng: -79.3749 },
  images: [],
  ...overrides,
});

const createCampus = (overrides = {}) => ({
  _id: "campus-tmu",
  institution: CAMPUS_LABEL,
  campusName: CAMPUS_LABEL,
  address: "350 Victoria Street, Toronto, ON",
  location: { lat: 43.6577, lng: -79.3788 },
  ...overrides,
});

const createNearbyPlaces = () =>
  [0.2, 1.4, 0.5, 1.1, 0.8, 1.8, 0.3, 2.1].map(
    (distanceKm, index) => ({
      id: `nearby-place-${index + 1}`,
      name: `Nearby Place ${index + 1}`,
      category: NEARBY_CATEGORIES[index],
      distanceKm,
      address:
        index === 5 ? null : `${index + 1} Student Street, Toronto, ON`,
      latitude: index === 7 ? null : 43.6567 + (index + 1) * 0.0005,
      longitude: index === 7 ? null : -79.3749 - (index + 1) * 0.0004,
    }),
  );

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
};

const createMapMock = ({ activePointIsVisible = true } = {}) => {
  const calls = {
    fitBounds: [],
    panTo: [],
    setView: [],
  };

  const map = {
    activePointIsVisible,
    calls,
    fitBounds(...args) {
      calls.fitBounds.push(args);
    },
    getBounds() {
      return {
        pad() {
          return { contains: () => map.activePointIsVisible };
        },
      };
    },
    getContainer() {
      return document.querySelector('[data-testid="leaflet-map"]');
    },
    panTo(...args) {
      calls.panTo.push(args);
    },
    setView(...args) {
      calls.setView.push(args);
    },
  };

  return map;
};

const leafletModule = `
const toCoordinates = (value) => Array.isArray(value) ? value : value.coordinates;
const leaflet = {
  divIcon(options) {
    return options;
  },
  latLng(value) {
    const coordinates = toCoordinates(value);
    return {
      coordinates,
      distanceTo(other) {
        const destination = toCoordinates(other);
        const latitudeMetres = (destination[0] - coordinates[0]) * 111320;
        const longitudeMetres = (destination[1] - coordinates[1]) * 80900;
        return Math.hypot(latitudeMetres, longitudeMetres);
      },
    };
  },
  latLngBounds(points) {
    return {
      points,
      isValid() {
        return Array.isArray(points) && points.length > 0;
      },
    };
  },
};
export default leaflet;
`;

const reactLeafletModule = `
import React from "react";

export function MapContainer({
  children,
  center,
  keyboard,
  scrollWheelZoom,
  zoom,
  ...props
}) {
  return React.createElement(
    "div",
    {
      ...props,
      "data-center": JSON.stringify(center),
      "data-keyboard": String(Boolean(keyboard)),
      "data-testid": "leaflet-map",
      "data-zoom": String(zoom),
      tabIndex: keyboard ? 0 : undefined,
    },
    children,
  );
}

export function Marker({ children, eventHandlers, icon, position, title, zIndexOffset }) {
  return React.createElement(
    "div",
    {
      "data-icon-anchor": JSON.stringify(icon?.iconAnchor || null),
      "data-icon-class": icon?.className || "",
      "data-position": JSON.stringify(position),
      "data-testid": "map-marker",
      "data-z-index": String(zIndexOffset || 0),
      onClick: eventHandlers?.click,
      role: "button",
      tabIndex: 0,
      title,
    },
    children,
  );
}

export function Popup({ children }) {
  return React.createElement("div", { "data-testid": "map-popup" }, children);
}

export function TileLayer({ attribution, eventHandlers, url }) {
  globalThis.__latestTileEventHandlers = eventHandlers;

  return React.createElement(
    "div",
    null,
    React.createElement(
      "button",
      {
        "data-attribution": attribution,
        "data-testid": "tile-layer",
        "data-url": url,
        onClick: () => eventHandlers?.tileerror?.(),
        type: "button",
      },
      "Simulate tile failure",
    ),
    React.createElement(
      "button",
      {
        "data-testid": "tile-success",
        hidden: true,
        onClick: () => eventHandlers?.tileload?.(),
        type: "button",
      },
      "Simulate tile success",
    ),
    React.createElement(
      "button",
      {
        "data-testid": "tile-loading",
        hidden: true,
        onClick: () => eventHandlers?.loading?.(),
        type: "button",
      },
      "Simulate tile loading",
    ),
    React.createElement(
      "button",
      {
        "data-testid": "tile-layer-load",
        hidden: true,
        onClick: () => eventHandlers?.load?.(),
        type: "button",
      },
      "Simulate tile layer load",
    ),
  );
}

export function Tooltip({ children }) {
  return React.createElement("span", { "data-testid": "map-tooltip" }, children);
}

export function useMap() {
  return globalThis.__leafletMapMock;
}
`;

const mapStubPlugin = {
  name: "issue-68-leaflet-stubs",
  enforce: "pre",
  resolveId(source) {
    if (source === "leaflet") {
      return "\0issue-68-leaflet";
    }
    if (source === "react-leaflet") {
      return "\0issue-68-react-leaflet";
    }
    return null;
  },
  load(id) {
    if (id === "\0issue-68-leaflet") {
      return leafletModule;
    }
    if (id === "\0issue-68-react-leaflet") {
      return reactLeafletModule;
    }
    return null;
  },
};

let restoreDom;
let viteServer;
let ListingDetail;
let ListingLocationMap;
let ListingLocationSection;
let ListingLocationExperience;
let BrowseResults;
let App;
let MemoryRouter;
let cleanup;
let act;
let fireEvent;
let render;
let screen;
let waitFor;
let within;
let findCampusByLabel;

before(async () => {
  restoreDom = installDom();
  Element.prototype.scrollIntoView = () => {};
  viteServer = await createServer({
    appType: "custom",
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify("http://localhost:5001"),
      "import.meta.env.VITE_MAPTILER_KEY": JSON.stringify(""),
    },
    logLevel: "silent",
    plugins: [mapStubPlugin],
    server: { middlewareMode: true },
    ssr: { noExternal: ["leaflet", "react-leaflet"] },
  });

  ({ default: ListingLocationMap } = await viteServer.ssrLoadModule(
    "/src/components/ListingLocationMap.jsx",
  ));
  ({ default: ListingDetail } = await viteServer.ssrLoadModule(
    "/src/components/ListingDetail.jsx",
  ));
  ({ default: ListingLocationSection } = await viteServer.ssrLoadModule(
    "/src/components/ListingLocationSection.jsx",
  ));
  ({ default: ListingLocationExperience } = await viteServer.ssrLoadModule(
    "/src/components/ListingLocationExperience.jsx",
  ));
  ({ default: BrowseResults } = await viteServer.ssrLoadModule(
    "/src/components/BrowseResults.jsx",
  ));
  ({ default: App } = await viteServer.ssrLoadModule("/src/App.jsx"));
  ({ findCampusByLabel } = await viteServer.ssrLoadModule(
    "/src/utils/listingFormatters.js",
  ));
  ({ MemoryRouter } = await import("react-router-dom"));
  ({ act, cleanup, fireEvent, render, screen, waitFor, within } = await import(
    "@testing-library/react"
  ));
});

after(async () => {
  cleanup?.();
  await viteServer?.close();
  restoreDom?.();
  delete globalThis.__leafletMapMock;
});

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  localStorage.clear();
  globalThis.__leafletMapMock = createMapMock();
  delete globalThis.__latestTileEventHandlers;
});

afterEach(async () => {
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  cleanup();
  delete globalThis.fetch;
  delete globalThis.__latestTileEventHandlers;
});

test("Listing Details keeps its controlled loading state without flashing a map", () => {
  render(
    React.createElement(ListingDetail, {
      listing: null,
      campus: CAMPUS_LABEL,
      selectedCampus: null,
      isLoading: true,
      errorMessage: "",
      onBack() {},
    }),
  );

  assert.ok(
    screen.getByRole("heading", { name: "Loading listing details" }),
  );
  assert.equal(screen.queryByRole("heading", { name: "Location" }), null);
  assert.equal(screen.queryByTestId("leaflet-map"), null);
});

test("Listing Details renders the monthly cost estimate without disrupting core details or actions", async () => {
  const saveCalls = [];
  const compareCalls = [];
  const listing = createListing();

  render(
    React.createElement(ListingDetail, {
      listing,
      campus: CAMPUS_LABEL,
      selectedCampus: createCampus(),
      isLoading: false,
      errorMessage: "",
      onBack() {},
      onToggleSave(listingId) {
        saveCalls.push(listingId);
      },
      onCompareListing(listingId) {
        compareCalls.push(listingId);
      },
      loadNearbyPlaces: async () => [],
    }),
  );

  await screen.findByText(
    "No nearby student essentials were found for this listing.",
  );

  const calculatorTitle = screen.getByRole("heading", {
    name: "Monthly Housing Cost Estimate",
  });
  const calculator = calculatorTitle.closest("section");
  assert.ok(calculator);
  assert.ok(within(calculator).getAllByText("$1,450.00").length >= 1);

  fireEvent.click(screen.getByRole("button", { name: "Save Listing" }));
  fireEvent.click(screen.getByRole("button", { name: "Add to Compare" }));
  assert.deepEqual(saveCalls, [LISTING_ID]);
  assert.deepEqual(compareCalls, [LISTING_ID]);

  assert.ok(screen.getByRole("heading", { name: "About this listing" }));
  assert.ok(screen.getByRole("heading", { name: "Amenities" }));
  assert.ok(screen.getByRole("heading", { name: "Location" }));
  assert.ok(
    screen.getByRole("region", {
      name: "Map showing listing and selected campus",
    }),
  );
  assert.ok(screen.getByRole("link", { name: /Open directions from/ }));
});

test("Listing Details keeps details and actions available when advertised rent is missing", async () => {
  render(
    React.createElement(ListingDetail, {
      listing: createListing({ monthlyRent: null }),
      campus: CAMPUS_LABEL,
      selectedCampus: createCampus(),
      isLoading: false,
      errorMessage: "",
      onBack() {},
      onToggleSave() {},
      onCompareListing() {},
      loadNearbyPlaces: async () => [],
    }),
  );

  await screen.findByText(
    "No nearby student essentials were found for this listing.",
  );

  const calculatorTitle = screen.getByRole("heading", {
    name: "Monthly Housing Cost Estimate",
  });
  const calculator = calculatorTitle.closest("section");
  assert.ok(calculator);
  assert.ok(
    within(calculator).getByText(
      /Monthly cost estimate unavailable because this listing does not have a valid advertised rent\./i,
    ),
  );
  assert.ok(within(calculator).getByText("Estimated Monthly Total"));
  assert.ok(within(calculator).getByText("Difference from Advertised Rent"));
  assert.ok(
    within(calculator).getAllByText("Unavailable").length >= 2,
  );

  assert.ok(screen.getByText("Data unavailable"));
  assert.ok(screen.getByRole("button", { name: "Save Listing" }));
  assert.ok(screen.getByRole("button", { name: "Add to Compare" }));
  assert.ok(screen.getByRole("heading", { name: "About this listing" }));
  assert.ok(screen.getByRole("heading", { name: "Amenities" }));
  assert.ok(screen.getByRole("heading", { name: "Location" }));
  assert.ok(
    screen.getByRole("region", {
      name: "Map showing listing and selected campus",
    }),
  );
  assert.ok(screen.getByRole("link", { name: /Open directions from/ }));
});

test("Listing Details treats malformed advertised rent as unavailable everywhere", async () => {
  render(
    React.createElement(ListingDetail, {
      listing: createListing({ monthlyRent: "not-rent" }),
      campus: CAMPUS_LABEL,
      selectedCampus: createCampus(),
      isLoading: false,
      errorMessage: "",
      onBack() {},
      onToggleSave() {},
      onCompareListing() {},
      loadNearbyPlaces: async () => [],
    }),
  );

  await screen.findByText(
    "No nearby student essentials were found for this listing.",
  );

  const rentStat = screen.getByText("Monthly rent", { exact: true }).closest(
    ".detail-stat",
  );
  assert.match(rentStat?.textContent || "", /Monthly rentData unavailable/);

  const calculator = screen
    .getByRole("heading", { name: "Monthly Housing Cost Estimate" })
    .closest("section");
  assert.ok(calculator);
  assert.ok(within(calculator).getByText(/valid advertised rent/i));
  assert.ok(within(calculator).getAllByText("Unavailable").length >= 2);
});

test("renders the Location section, two markers, fitted bounds, distance, commute, directions, and attribution", async () => {
  const listing = createListing();
  const campus = createCampus();

  render(
    React.createElement(ListingLocationSection, {
      listing,
      campus: CAMPUS_LABEL,
      selectedCampus: campus,
    }),
  );

  assert.ok(screen.getByRole("heading", { name: "Location" }));
  const map = screen.getByRole("region", {
    name: "Map showing listing and selected campus",
  });
  assert.ok(map);
  assert.equal(screen.getByTestId("leaflet-map").tabIndex, 0);
  assert.equal(screen.getByTestId("leaflet-map").dataset.keyboard, "true");
  assert.equal(screen.getByTestId("leaflet-map").getAttribute("aria-busy"), "true");

  const markers = screen.getAllByTestId("map-marker");
  assert.equal(markers.length, 2);
  assert.equal(
    screen.getByTitle(`Housing listing: ${listing.title}`).dataset.position,
    JSON.stringify([43.6567, -79.3749]),
  );
  assert.equal(
    screen.getByTitle(`Selected campus: ${CAMPUS_LABEL}`).dataset.position,
    JSON.stringify([43.6577, -79.3788]),
  );

  await waitFor(() => {
    assert.equal(globalThis.__leafletMapMock.calls.fitBounds.length, 1);
  });
  const [bounds, options] =
    globalThis.__leafletMapMock.calls.fitBounds[0];
  assert.deepEqual(bounds.points, [
    [43.6567, -79.3749],
    [43.6577, -79.3788],
  ]);
  assert.deepEqual(options, {
    padding: [35, 35],
    maxZoom: 15,
    animate: false,
  });

  assert.ok(screen.getByText("Straight-line distance"));
  assert.ok(screen.getByText("0.3 km"));
  assert.ok(screen.getByText("Geographic distance, not route distance"));
  assert.ok(screen.getByText("11 min"));
  assert.ok(screen.getAllByText(CAMPUS_LABEL).length >= 1);

  const directions = screen.getByRole("link", { name: /Open directions from/ });
  const directionsUrl = new URL(directions.href);
  assert.equal(directions.target, "_blank");
  assert.equal(directions.rel, "noopener noreferrer");
  assert.equal(directionsUrl.searchParams.get("origin"), "43.6567,-79.3749");
  assert.equal(
    directionsUrl.searchParams.get("destination"),
    "43.6577,-79.3788",
  );

  const tileLayer = screen.getByTestId("tile-layer");
  assert.match(tileLayer.dataset.url, /tile\.openstreetmap\.org/);
  assert.match(tileLayer.dataset.attribution, /OpenStreetMap contributors/);

  fireEvent.click(screen.getByTestId("tile-success"));
  assert.ok(screen.getByText("Loading map tiles…"));
  assert.equal(screen.getByTestId("leaflet-map").getAttribute("aria-busy"), "true");

  fireEvent.click(screen.getByTestId("tile-layer-load"));
  assert.equal(screen.queryByText("Loading map tiles…"), null);
  assert.equal(screen.getByTestId("leaflet-map").hasAttribute("aria-busy"), false);
});

test("missing and invalid listing coordinates show a controlled fallback without hiding other details", () => {
  for (const location of [undefined, { lat: 95, lng: -79.37 }]) {
    const view = render(
      React.createElement(ListingLocationSection, {
        listing: createListing({ location }),
        campus: CAMPUS_LABEL,
        selectedCampus: createCampus(),
      }),
    );

    assert.ok(screen.getByRole("heading", { name: "Map unavailable" }));
    assert.ok(
      screen.getByText(
        "Location coordinates are not available for this listing.",
      ),
    );
    assert.equal(screen.queryByTestId("leaflet-map"), null);
    assert.equal(screen.queryByText("Straight-line distance"), null);
    assert.ok(screen.getByText("11 min"));

    const directions = screen.getByRole("link", { name: /Open directions from/ });
    assert.equal(
      new URL(directions.href).searchParams.get("origin"),
      "184 Jarvis Street, Toronto, ON",
    );
    view.unmount();
  }
});

test("missing or invalid campus coordinates keep the listing marker and use stored address directions", () => {
  for (const location of [undefined, { lat: 43.65, lng: -200 }]) {
    const view = render(
      React.createElement(ListingLocationSection, {
        listing: createListing(),
        campus: CAMPUS_LABEL,
        selectedCampus: createCampus({ location }),
      }),
    );

    assert.ok(
      screen.getByRole("region", { name: "Map showing listing location" }),
    );
    assert.equal(screen.getAllByTestId("map-marker").length, 1);
    assert.match(
      screen.getByText(
        /Location coordinates are not available for Toronto Metropolitan University/,
      ).textContent,
      /The listing marker is still shown/,
    );
    assert.equal(screen.queryByText("Straight-line distance"), null);
    assert.ok(screen.getByText("11 min"));

    const directionsUrl = new URL(
      screen.getByRole("link", { name: /Open directions from/ }).href,
    );
    assert.equal(
      directionsUrl.searchParams.get("destination"),
      "350 Victoria Street, Toronto, ON",
    );
    view.unmount();
  }
});

test("no selected campus shows one marker, no fallback commute, and no directions", () => {
  render(
    React.createElement(ListingLocationSection, {
      listing: createListing(),
      campus: "",
      selectedCampus: null,
    }),
  );

  assert.equal(screen.getAllByTestId("map-marker").length, 1);
  assert.ok(screen.getByText("No campus selected"));
  assert.ok(screen.getByText("Data unavailable"));
  assert.ok(screen.getByText(/Select a campus to compare/));
  assert.equal(screen.queryByRole("link", { name: /Open directions/ }), null);
  assert.ok(screen.getByText(/Directions become available/));
});

test("campus loading and lookup failure remain controlled while preserving the selected label and commute", () => {
  const loadingView = render(
    React.createElement(ListingLocationSection, {
      listing: createListing(),
      campus: CAMPUS_LABEL,
      selectedCampus: null,
      isLoadingCampus: true,
    }),
  );

  assert.equal(screen.getAllByTestId("map-marker").length, 1);
  assert.ok(screen.getAllByText(CAMPUS_LABEL).length >= 1);
  assert.ok(screen.getByText("11 min"));
  assert.ok(screen.getByText(/Loading the selected campus/));
  loadingView.unmount();

  render(
    React.createElement(ListingLocationSection, {
      listing: createListing(),
      campus: CAMPUS_LABEL,
      selectedCampus: null,
      campusError: "Campus API unavailable",
    }),
  );

  assert.match(
    screen.getByText(/campus details could not be loaded/).textContent,
    /campus details could not be loaded/,
  );
  assert.ok(screen.getByText("11 min"));
});

test("tile-provider failures recover across navigation, retry, and later map movement", () => {
  const view = render(
    React.createElement(ListingLocationSection, {
      listing: createListing(),
      campus: CAMPUS_LABEL,
      selectedCampus: createCampus(),
    }),
  );
  const staleTileHandlers = globalThis.__latestTileEventHandlers;

  fireEvent.click(screen.getByTestId("tile-layer"));
  assert.equal(screen.queryByRole("alert"), null);

  fireEvent.click(screen.getByTestId("tile-layer"));
  fireEvent.click(screen.getByTestId("tile-layer"));
  assert.equal(screen.queryByRole("alert"), null);
  fireEvent.click(screen.getByTestId("tile-layer-load"));

  assert.ok(screen.getByRole("heading", { name: "The map could not be loaded" }));
  assert.match(screen.getByRole("alert").textContent, /Open Directions/);
  assert.ok(screen.getByTestId("leaflet-map"));
  assert.ok(screen.getAllByText(createListing().title).length >= 2);
  assert.ok(screen.getByRole("link", { name: /Open directions from/ }));

  const nextListing = createListing({
    _id: "64b000000000000000000070",
    title: "Next Listing",
    location: { lat: 43.669, lng: -79.38 },
  });
  view.rerender(
    React.createElement(ListingLocationSection, {
      listing: nextListing,
      campus: CAMPUS_LABEL,
      selectedCampus: createCampus(),
    }),
  );

  assert.equal(screen.queryByRole("alert"), null);
  assert.ok(screen.getByText("Loading map tiles…"));

  act(() => {
    staleTileHandlers.loading();
    staleTileHandlers.tileload();
    staleTileHandlers.load();
  });
  assert.ok(screen.getByText("Loading map tiles…"));

  fireEvent.click(screen.getByTestId("tile-layer"));
  fireEvent.click(screen.getByTestId("tile-layer"));
  fireEvent.click(screen.getByTestId("tile-layer"));
  fireEvent.click(screen.getByTestId("tile-layer-load"));
  assert.ok(screen.getByRole("alert"));

  const retryButton = screen.getByRole("button", { name: "Retry map" });
  retryButton.focus();
  fireEvent.click(retryButton);
  assert.equal(screen.queryByRole("alert"), null);
  assert.ok(screen.getByText("Loading map tiles…"));
  assert.equal(document.activeElement, screen.getByTestId("leaflet-map"));

  fireEvent.click(screen.getByTestId("tile-layer"));
  fireEvent.click(screen.getByTestId("tile-success"));
  assert.ok(screen.getByText("Loading map tiles…"));
  fireEvent.click(screen.getByTestId("tile-layer-load"));
  assert.equal(screen.queryByText("Loading map tiles…"), null);
  assert.equal(screen.queryByRole("alert"), null);

  fireEvent.click(screen.getByTestId("tile-loading"));
  assert.ok(screen.getByText("Loading map tiles…"));
  fireEvent.click(screen.getByTestId("tile-layer"));
  fireEvent.click(screen.getByTestId("tile-layer"));
  fireEvent.click(screen.getByTestId("tile-layer"));
  fireEvent.click(screen.getByTestId("tile-layer-load"));
  assert.ok(
    screen.getByRole("heading", {
      name: "The current map area could not be loaded",
    }),
  );

  fireEvent.click(screen.getByTestId("tile-loading"));
  fireEvent.click(screen.getByTestId("tile-success"));
  fireEvent.click(screen.getByTestId("tile-layer-load"));
  assert.equal(screen.queryByText("Loading map tiles…"), null);
  assert.equal(screen.queryByRole("alert"), null);
});

test("a stalled initial tile set times out but can recover after a late layer load", () => {
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);
  const providerTimerId = 68012;
  let providerTimeout;

  window.setTimeout = (callback, delay, ...args) => {
    if (delay === 12000) {
      providerTimeout = callback;
      return providerTimerId;
    }

    return nativeSetTimeout(callback, delay, ...args);
  };
  window.clearTimeout = (timerId) => {
    if (timerId !== providerTimerId) {
      nativeClearTimeout(timerId);
    }
  };

  try {
    render(
      React.createElement(ListingLocationMap, {
        listing: createListing(),
        selectedCampus: createCampus(),
      }),
    );

    assert.equal(typeof providerTimeout, "function");
    act(() => providerTimeout());
    assert.ok(screen.getByRole("alert"));

    fireEvent.click(screen.getByTestId("tile-success"));
    assert.ok(screen.getByRole("alert"));
    fireEvent.click(screen.getByTestId("tile-layer-load"));

    assert.equal(screen.queryByRole("alert"), null);
    assert.equal(screen.queryByText("Loading map tiles…"), null);
  } finally {
    window.setTimeout = nativeSetTimeout;
    window.clearTimeout = nativeClearTimeout;
  }
});

test("identical coordinates keep both labelled markers visible and avoid unsafe bounds zoom", async () => {
  const sharedLocation = { lat: 43.6577, lng: -79.3788 };

  render(
    React.createElement(ListingLocationMap, {
      listing: createListing({ location: sharedLocation }),
      selectedCampus: createCampus({ location: sharedLocation }),
    }),
  );

  const markers = screen.getAllByTestId("map-marker");
  assert.equal(markers.length, 2);
  assert.notEqual(markers[0].dataset.iconAnchor, markers[1].dataset.iconAnchor);
  assert.ok(screen.getByText("Listing"));
  assert.ok(screen.getByText("Campus"));

  await waitFor(() => {
    assert.equal(globalThis.__leafletMapMock.calls.setView.length, 1);
  });
  assert.deepEqual(globalThis.__leafletMapMock.calls.setView[0], [
    [43.6577, -79.3788],
    14,
    { animate: false },
  ]);
  assert.equal(globalThis.__leafletMapMock.calls.fitBounds.length, 0);
});

test("Nearby Student Essentials renders normalized details and supports filtering, sorting, and unique Show More results", async () => {
  const places = createNearbyPlaces();

  render(
    React.createElement(ListingLocationExperience, {
      listing: createListing(),
      campus: CAMPUS_LABEL,
      selectedCampus: createCampus(),
      loadNearbyPlaces: async () => [...places, { ...places[0] }],
    }),
  );

  assert.ok(
    screen.getByText("Finding nearby student essentials..."),
  );
  assert.ok(screen.getByTitle(`Housing listing: ${createListing().title}`));
  assert.ok(screen.getByTitle(`Selected campus: ${CAMPUS_LABEL}`));

  const nearbyList = await screen.findByRole("list", {
    name: "Nearby student essentials",
  });
  let visibleRows = within(nearbyList).getAllByRole("button");
  assert.equal(visibleRows.length, 6);
  assert.equal(
    visibleRows[0].textContent.includes("Nearby Place 1"),
    true,
  );

  const firstRow = within(nearbyList).getByRole("button", {
    name: /Nearby Place 1/,
  });
  assert.match(firstRow.textContent, /Public Transit/);
  assert.match(firstRow.textContent, /0\.2 km/);
  assert.match(firstRow.textContent, /1 Student Street/);
  assert.equal(firstRow.tabIndex, 0);

  const categoryButtons = [
    "All",
    "Public Transit",
    "Grocery Stores",
    "Pharmacies",
    "Libraries",
    "Parks",
    "Gyms",
    "Clinics",
    "Campus Locations",
  ].map((name) => screen.getByRole("button", { name }));
  assert.equal(categoryButtons.every((button) => button.tabIndex === 0), true);
  assert.equal(categoryButtons[0].getAttribute("aria-pressed"), "true");

  const showMore = screen.getByRole("button", { name: "Show More" });
  assert.equal(showMore.tabIndex, 0);
  fireEvent.click(showMore);
  visibleRows = within(nearbyList).getAllByRole("button");
  assert.equal(visibleRows.length, 8);
  assert.equal(
    new Set(visibleRows.map((row) => row.textContent)).size,
    visibleRows.length,
  );
  assert.equal(screen.queryByRole("button", { name: "Show More" }), null);

  const markerlessRow = within(nearbyList).getByRole("button", {
    name: /Nearby Place 8/,
  });
  assert.equal(screen.queryByTitle(/Nearby Campus Locations: Nearby Place 8/), null);
  fireEvent.click(markerlessRow);
  assert.equal(markerlessRow.getAttribute("aria-pressed"), "true");
  assert.ok(screen.getByTitle(`Housing listing: ${createListing().title}`));
  assert.ok(screen.getByTitle(`Selected campus: ${CAMPUS_LABEL}`));

  fireEvent.click(screen.getByRole("button", { name: "Grocery Stores" }));
  visibleRows = within(nearbyList).getAllByRole("button");
  assert.equal(visibleRows.length, 1);
  assert.match(visibleRows[0].textContent, /Nearby Place 2/);
  assert.equal(
    screen.getByRole("button", { name: "Grocery Stores" }).getAttribute(
      "aria-pressed",
    ),
    "true",
  );

  fireEvent.click(screen.getByRole("button", { name: "All" }));
  assert.equal(within(nearbyList).getAllByRole("button").length, 6);

  const sortControl = screen.getByRole("combobox", {
    name: "Sort by distance",
  });
  assert.equal(sortControl.tabIndex, 0);
  fireEvent.change(sortControl, { target: { value: "farthest" } });
  visibleRows = within(nearbyList).getAllByRole("button");
  assert.equal(visibleRows.length, 6);
  assert.match(visibleRows[0].textContent, /Nearby Place 8/);
  assert.equal(sortControl.value, "farthest");
});

test("nearby list and map selections stay synchronized without changing listing-campus bounds", async () => {
  const places = createNearbyPlaces();
  const scrolledPlaceIds = [];
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  Element.prototype.scrollIntoView = function scrollIntoView() {
    scrolledPlaceIds.push(this.textContent);
  };
  globalThis.__leafletMapMock.activePointIsVisible = false;

  try {
    render(
      React.createElement(ListingLocationExperience, {
        listing: createListing(),
        campus: CAMPUS_LABEL,
        selectedCampus: createCampus(),
        loadNearbyPlaces: async () => places,
      }),
    );

    const nearbyList = await screen.findByRole("list", {
      name: "Nearby student essentials",
    });
    const listSelectedPlace = within(nearbyList).getByRole("button", {
      name: /Nearby Place 7/,
    });

    fireEvent.click(listSelectedPlace);
    await waitFor(() => {
      assert.equal(listSelectedPlace.getAttribute("aria-pressed"), "true");
      assert.match(
        screen.getByTitle(/Nearby Clinics: Nearby Place 7/).dataset.iconClass,
        /active/,
      );
    });
    assert.equal(globalThis.__leafletMapMock.calls.panTo.length, 1);

    const hiddenRowMarker = screen.getByTitle(
      "Nearby Gyms: Nearby Place 6",
    );
    fireEvent.click(hiddenRowMarker);
    await act(
      () =>
        new Promise((resolve) => {
          window.requestAnimationFrame(resolve);
        }),
    );

    const revealedRow = within(nearbyList).getByRole("button", {
      name: /Nearby Place 6/,
    });
    assert.equal(revealedRow.getAttribute("aria-pressed"), "true");
    assert.equal(document.activeElement, revealedRow);
    assert.equal(scrolledPlaceIds.some((text) => text.includes("Nearby Place 6")), true);
    assert.match(
      screen.getByTitle(/Nearby Gyms: Nearby Place 6/).dataset.iconClass,
      /active/,
    );
    assert.equal(globalThis.__leafletMapMock.calls.panTo.length, 2);

    assert.ok(screen.getByTitle(`Housing listing: ${createListing().title}`));
    assert.ok(screen.getByTitle(`Selected campus: ${CAMPUS_LABEL}`));
    assert.equal(globalThis.__leafletMapMock.calls.fitBounds.length, 1);
    assert.deepEqual(
      globalThis.__leafletMapMock.calls.fitBounds[0][0].points,
      [
        [43.6567, -79.3749],
        [43.6577, -79.3788],
      ],
    );
  } finally {
    Element.prototype.scrollIntoView = originalScrollIntoView;
  }
});

test("nearby loading failures stay isolated and Retry reattempts only nearby data", async () => {
  const firstAttempt = createDeferred();
  const places = createNearbyPlaces();
  let loadCalls = 0;
  const loadNearbyPlaces = () => {
    loadCalls += 1;
    return loadCalls === 1 ? firstAttempt.promise : Promise.resolve(places);
  };

  render(
    React.createElement(ListingLocationExperience, {
      listing: createListing(),
      campus: CAMPUS_LABEL,
      selectedCampus: createCampus(),
      loadNearbyPlaces,
    }),
  );

  assert.ok(screen.getByText("Finding nearby student essentials..."));
  assert.ok(screen.getByTestId("leaflet-map"));
  assert.ok(screen.getByRole("link", { name: /Open directions from/ }));

  await act(async () => {
    firstAttempt.reject(new Error("Seed loader failed"));
    await firstAttempt.promise.catch(() => {});
  });

  const nearbyAlert = await screen.findByRole("alert");
  assert.match(nearbyAlert.textContent, /couldn't load nearby places right now/);
  assert.ok(screen.getByTestId("leaflet-map"));
  assert.ok(screen.getByTitle(`Housing listing: ${createListing().title}`));
  assert.ok(screen.getByTitle(`Selected campus: ${CAMPUS_LABEL}`));

  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  assert.ok(screen.getByText("Finding nearby student essentials..."));
  await screen.findByRole("list", { name: "Nearby student essentials" });
  assert.equal(loadCalls, 2);
  assert.ok(screen.getByRole("link", { name: /Open directions from/ }));
});

test("nearby empty and missing-listing-coordinate states preserve Listing Details", async (t) => {
  await t.test("empty data", async () => {
    const view = render(
      React.createElement(ListingLocationExperience, {
        listing: createListing(),
        campus: CAMPUS_LABEL,
        selectedCampus: createCampus(),
        loadNearbyPlaces: async () => [],
      }),
    );

    await screen.findByText(
      "No nearby student essentials were found for this listing.",
    );
    assert.ok(screen.getByTestId("leaflet-map"));
    assert.ok(screen.getByTitle(`Housing listing: ${createListing().title}`));
    assert.ok(screen.getByTitle(`Selected campus: ${CAMPUS_LABEL}`));
    assert.ok(screen.getByRole("link", { name: /Open directions from/ }));
    view.unmount();
  });

  await t.test("missing listing coordinates", async () => {
    let loadCalls = 0;
    render(
      React.createElement(ListingLocationExperience, {
        listing: createListing({ location: undefined }),
        campus: CAMPUS_LABEL,
        selectedCampus: createCampus(),
        loadNearbyPlaces: async () => {
          loadCalls += 1;
          return createNearbyPlaces();
        },
      }),
    );

    assert.ok(
      screen.getByText(
        "Nearby places are unavailable because this listing has no location coordinates.",
      ),
    );
    assert.equal(loadCalls, 0);
    assert.ok(screen.getByRole("heading", { name: "Map unavailable" }));
    assert.ok(screen.getByText("11 min"));
    assert.ok(screen.getByRole("link", { name: /Open directions from/ }));
  });
});

test("Browse Results preserves marker-to-card and card-to-marker synchronization", async () => {
  const firstListing = createListing();
  const secondListing = createListing({
    _id: "64b000000000000000000069",
    title: "Second Downtown Listing",
    address: "210 Mutual Street, Toronto, ON",
    location: { lat: 43.6603, lng: -79.3789 },
  });

  render(
    React.createElement(BrowseResults, {
      listings: [firstListing, secondListing],
      search: { campus: CAMPUS_LABEL },
      selectedCampus: createCampus(),
      filters: {
        minRent: "",
        maxRent: "",
        housingType: "All types",
        safetyLevel: "Any",
        maxCommute: "",
        furnished: "Any",
        amenities: [],
      },
      isLoading: false,
      errorMessage: "",
      onFilterChange() {},
      onClearFilters() {},
      onDetails() {},
      onEditSearch() {},
      onRetry() {},
      savedListingIds: new Set(),
      savingListingIds: new Set(),
    }),
  );

  assert.equal(screen.getAllByTestId("map-marker").length, 3);
  assert.ok(
    screen.getByRole("region", {
      name: "Interactive map of filtered housing listings and selected campus",
    }),
  );
  assert.match(
    screen.getByTestId("tile-layer").dataset.attribution,
    /OpenStreetMap contributors/,
  );

  await waitFor(() => {
    assert.equal(globalThis.__leafletMapMock.calls.fitBounds.length, 1);
  });
  assert.deepEqual(globalThis.__leafletMapMock.calls.fitBounds[0][0].points, [
    [43.6567, -79.3749],
    [43.6603, -79.3789],
    [43.6577, -79.3788],
  ]);

  fireEvent.click(screen.getByTitle(`Housing listing: ${firstListing.title}`));
  await waitFor(() => {
    assert.ok(
      screen.getByLabelText(
        `${firstListing.title} listing card, selected on map`,
      ),
    );
  });
  assert.match(
    screen.getByTitle(`Housing listing: ${firstListing.title}`).dataset.iconClass,
    /active/,
  );
  assert.equal(globalThis.__leafletMapMock.calls.panTo.length, 0);

  globalThis.__leafletMapMock.activePointIsVisible = false;
  fireEvent.click(
    screen.getByLabelText(`${secondListing.title} listing card`),
  );
  await waitFor(() => {
    assert.match(
      screen.getByTitle(`Housing listing: ${secondListing.title}`).dataset.iconClass,
      /active/,
    );
  });
  assert.equal(globalThis.__leafletMapMock.calls.panTo.length, 1);
  assert.deepEqual(
    globalThis.__leafletMapMock.calls.panTo[0][0].coordinates,
    [43.6603, -79.3789],
  );
  assert.deepEqual(globalThis.__leafletMapMock.calls.panTo[0][1], {
    animate: true,
    duration: 0.45,
  });
});

test("campus resolution supports one unambiguous legacy label without guessing among branches", () => {
  const york = createCampus({
    institution: "York University",
    campusName: "Keele",
  });
  const uoftCampuses = ["St. George", "Scarborough", "Mississauga"].map(
    (campusName) =>
      createCampus({ institution: "University of Toronto", campusName }),
  );

  assert.equal(findCampusByLabel([york, ...uoftCampuses], "York University"), york);
  assert.equal(
    findCampusByLabel(
      [york, ...uoftCampuses],
      "University of Toronto -- Scarborough",
    ),
    uoftCampuses[1],
  );
  assert.equal(
    findCampusByLabel([york, ...uoftCampuses], "University of Toronto"),
    null,
  );
});

test("a public detail deep link loads and resolves the exact query campus used for commute", async () => {
  const listing = createListing();
  const campus = createCampus();
  const calls = [];
  const jsonResponse = (body) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    calls.push(url);

    if (url.pathname === "/api/campuses") {
      return jsonResponse({ count: 1, campuses: [campus] });
    }
    if (url.pathname === `/api/listings/${LISTING_ID}`) {
      return jsonResponse(listing);
    }
    throw new Error(`Unexpected public detail fetch: ${url}`);
  };

  render(
    React.createElement(
      MemoryRouter,
      {
        initialEntries: [
          `/listings/${LISTING_ID}?campus=${encodeURIComponent(CAMPUS_LABEL)}`,
        ],
      },
      React.createElement(App),
    ),
  );

  await screen.findByRole("heading", { name: listing.title });
  await screen.findByRole("region", {
    name: "Map showing listing and selected campus",
  });

  assert.equal(
    calls.filter((url) => url.pathname === "/api/campuses").length,
    1,
  );
  const listingCall = calls.find(
    (url) => url.pathname === `/api/listings/${LISTING_ID}`,
  );
  assert.ok(listingCall);
  assert.equal(listingCall.searchParams.get("campus"), CAMPUS_LABEL);
  assert.ok(screen.getByTitle(`Housing listing: ${listing.title}`));
  assert.ok(screen.getByTitle(`Selected campus: ${CAMPUS_LABEL}`));
  assert.ok(screen.getAllByTitle(/^Nearby /).length > 0);
  assert.ok(screen.getAllByText("11 min").length >= 2);
  assert.ok(screen.getAllByText(CAMPUS_LABEL).length >= 2);
});

test("a public detail deep link resolves an unambiguous legacy campus label", async () => {
  const legacyCampusLabel = "York University";
  const campus = createCampus({
    _id: "campus-york-keele",
    institution: legacyCampusLabel,
    campusName: "Keele",
    address: "4700 Keele Street, Toronto, ON",
    location: { lat: 43.7735, lng: -79.5019 },
  });
  const listing = createListing({
    commuteEstimates: [{ campus: legacyCampusLabel, minutes: 16 }],
  });
  const jsonResponse = (body) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url);

    if (url.pathname === "/api/campuses") {
      return jsonResponse({ count: 1, campuses: [campus] });
    }
    if (url.pathname === `/api/listings/${LISTING_ID}`) {
      return jsonResponse(listing);
    }
    throw new Error(`Unexpected public detail fetch: ${url}`);
  };

  render(
    React.createElement(
      MemoryRouter,
      {
        initialEntries: [
          `/listings/${LISTING_ID}?campus=${encodeURIComponent(legacyCampusLabel)}`,
        ],
      },
      React.createElement(App),
    ),
  );

  await screen.findByTitle("Selected campus: York University -- Keele");
  await screen.findByRole("list", { name: "Nearby student essentials" });
  assert.ok(screen.getAllByText("16 min").length >= 2);

  const directions = screen.getByRole("link", { name: /Open directions from/ });
  assert.equal(
    new URL(directions.href).searchParams.get("destination"),
    "43.7735,-79.5019",
  );
});
