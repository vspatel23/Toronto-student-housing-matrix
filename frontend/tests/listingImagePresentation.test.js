import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

import {
  createListingImageState,
  listingImageStateReducer,
} from "../src/utils/listingImageState.js";
import { LISTING_IMAGE_FALLBACK_SRC } from "../src/utils/listingImages.js";

const PRIMARY_IMAGE_SRC =
  "/images/listings/demo/listing-variants/listing-001-02.webp";
const ORDERED_IMAGE_SRC =
  "/images/listings/demo/listing-variants/listing-001-01.webp";

const createListing = (overrides = {}) => ({
  _id: "listing-001",
  title: "Bright Annex Studio",
  address: "123 Bloor Street West",
  neighborhood: "The Annex",
  monthlyRent: 1850,
  propertyType: "Studio",
  furnished: true,
  bedrooms: 1,
  bathrooms: 1,
  amenities: ["WiFi", "Laundry", "Nearby Transit"],
  safety: { crimeRateLevel: "Low", safetyScore: 84 },
  commuteEstimates: [{ campus: "Seneca Newnham", minutes: 24 }],
  valueScore: 88,
  primaryImage: {
    src: PRIMARY_IMAGE_SRC,
    alt: "Sunlit studio bedroom with a desk beside the window",
    order: 2,
    isPrimary: true,
    width: 1200,
    height: 800,
  },
  images: [
    {
      src: ORDERED_IMAGE_SRC,
      alt: "Studio living area with a sofa and coffee table",
      order: 0,
      isPrimary: false,
      width: 1200,
      height: 800,
    },
    {
      src: PRIMARY_IMAGE_SRC,
      alt: "Sunlit studio bedroom with a desk beside the window",
      order: 2,
      isPrimary: true,
      width: 1200,
      height: 800,
    },
  ],
  ...overrides,
});

const noop = () => {};

let viteServer;
let ListingImage;
let ListingCard;
let BrowseResults;
let SavedListings;
let CompareListings;
let CollectionDetail;

before(async () => {
  globalThis.window = { location: { origin: "http://localhost:5173" } };
  viteServer = await createServer({
    appType: "custom",
    logLevel: "silent",
    plugins: [
      {
        name: "test-listings-map-stub",
        enforce: "pre",
        resolveId(source, importer) {
          if (
            source === "./ListingsMap" &&
            importer?.endsWith("/BrowseResults.jsx")
          ) {
            return "\0test-listings-map-stub";
          }

          return null;
        },
        load(id) {
          return id === "\0test-listings-map-stub"
            ? "export default function ListingsMap() { return null; }"
            : null;
        },
      },
    ],
    server: { middlewareMode: true },
  });

  ({ default: ListingImage } = await viteServer.ssrLoadModule(
    "/src/components/ListingImage.jsx",
  ));
  ({ default: ListingCard } = await viteServer.ssrLoadModule(
    "/src/components/ListingCard.jsx",
  ));
  ({ default: BrowseResults } = await viteServer.ssrLoadModule(
    "/src/components/BrowseResults.jsx",
  ));
  ({ default: SavedListings } = await viteServer.ssrLoadModule(
    "/src/components/SavedListings.jsx",
  ));
  ({ default: CompareListings } = await viteServer.ssrLoadModule(
    "/src/components/CompareListings.jsx",
  ));
  ({ default: CollectionDetail } = await viteServer.ssrLoadModule(
    "/src/components/CollectionDetail.jsx",
  ));
});

after(async () => {
  await viteServer?.close();
  delete globalThis.window;
});

test("shared image renders the normalized primary image with lazy loading and a placeholder", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ListingImage, { listing: createListing() }),
  );

  assert.match(markup, /listing-image--card is-loading/);
  assert.match(markup, /listing-image__placeholder[^>]*aria-hidden="true"/);
  assert.match(markup, new RegExp(PRIMARY_IMAGE_SRC));
  assert.match(
    markup,
    /alt="Sunlit studio bedroom with a desk beside the window"/,
  );
  assert.match(markup, /loading="lazy"/);
  assert.match(markup, /decoding="async"/);
});

test("missing images render the shared fallback with contextual alt text", () => {
  const listing = createListing({ primaryImage: undefined, images: [] });
  const markup = renderToStaticMarkup(
    React.createElement(ListingImage, { listing }),
  );

  assert.match(markup, new RegExp(LISTING_IMAGE_FALLBACK_SRC));
  assert.match(
    markup,
    /alt="No property image available for Bright Annex Studio"/,
  );
});

test("broken sources switch to fallback once and a different source resets error state", () => {
  const brokenSource = "https://images.example.test/broken.webp";
  const nextSource = "https://images.example.test/recovered.webp";
  let state = createListingImageState(brokenSource);

  state = listingImageStateReducer(state, {
    type: "error",
    source: brokenSource,
    isFallbackSource: false,
  });
  assert.equal(state.hasFailed, true);
  assert.equal(state.isLoading, true);
  assert.equal(state.fallbackUnavailable, false);

  state = listingImageStateReducer(state, {
    type: "error",
    source: brokenSource,
    isFallbackSource: false,
  });
  assert.equal(state.fallbackUnavailable, true);
  assert.equal(state.isLoading, false);

  state = listingImageStateReducer(state, {
    type: "reset",
    source: nextSource,
  });
  assert.deepEqual(state, createListingImageState(nextSource));
});

test("listing card retains Details, Save, Compare, and collection actions beside the image", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ListingCard, {
      listing: createListing(),
      onDetails: noop,
      onToggleSave: noop,
      onCompareListing: noop,
      onAddToCollection: noop,
      onRemoveFromCollection: noop,
    }),
  );

  assert.match(markup, new RegExp(PRIMARY_IMAGE_SRC));
  [
    "View Details",
    "Save",
    "Compare",
    "Add to Collection",
    "Remove from Collection",
  ].forEach((label) => assert.match(markup, new RegExp(`>${label}<`)));
});

test("Browse and Saved Listings render the same normalized primary image", () => {
  const listing = createListing();
  const browseMarkup = renderToStaticMarkup(
    React.createElement(BrowseResults, {
      listings: [listing],
      search: {},
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
      onFilterChange: noop,
      onClearFilters: noop,
      onDetails: noop,
      onEditSearch: noop,
      onRetry: noop,
      savedListingIds: new Set(),
      savingListingIds: new Set(),
      onToggleSave: noop,
      onCompareListing: noop,
      onOpenCompare: noop,
    }),
  );
  const savedMarkup = renderToStaticMarkup(
    React.createElement(SavedListings, {
      listings: [listing],
      isLoading: false,
      errorMessage: "",
      onDetails: noop,
      onBack: noop,
      savedListingIds: new Set([listing._id]),
      savingListingIds: new Set(),
      onToggleSave: noop,
      onCompareListing: noop,
      onAddToCollection: noop,
    }),
  );

  assert.match(browseMarkup, new RegExp(PRIMARY_IMAGE_SRC));
  assert.match(savedMarkup, new RegExp(PRIMARY_IMAGE_SRC));
  assert.doesNotMatch(browseMarkup, new RegExp(`src="${ORDERED_IMAGE_SRC}"`));
  assert.doesNotMatch(savedMarkup, new RegExp(`src="${ORDERED_IMAGE_SRC}"`));
  assert.match(savedMarkup, />Remove saved</);
  assert.match(savedMarkup, />View Details</);
  assert.match(savedMarkup, />Compare</);
});

test("Compare renders compact images without removing comparison values or actions", () => {
  const firstListing = createListing();
  const secondListing = createListing({
    _id: "listing-002",
    title: "Quiet Yorkville Room",
    monthlyRent: 1950,
    primaryImage: {
      ...createListing().primaryImage,
      src: "/images/listings/demo/listing-variants/listing-002-01.webp",
    },
    images: [
      {
        ...createListing().primaryImage,
        src: "/images/listings/demo/listing-variants/listing-002-01.webp",
      },
    ],
  });
  const markup = renderToStaticMarkup(
    React.createElement(CompareListings, {
      listings: [firstListing, secondListing],
      availableListings: [firstListing, secondListing],
      savedListingIds: new Set(),
      savingListingIds: new Set(),
      onToggleSave: noop,
      onAddCompare: noop,
      onRemoveCompare: noop,
      onBackToResults: noop,
      onDetails: noop,
    }),
  );

  assert.match(markup, /compare-property-image/);
  assert.match(markup, /compare-mobile-image/);
  assert.match(markup, /Monthly Rent/);
  assert.match(markup, /TTC Commute/);
  assert.match(markup, /Safety Level/);
  assert.match(markup, /Amenities/);
  assert.match(markup, />Remove</);
  assert.match(markup, />View Details</);
});

test("private and public collection cards reuse the shared listing image", () => {
  const listing = createListing();
  const renderCollection = (readOnly) =>
    renderToStaticMarkup(
      React.createElement(CollectionDetail, {
        collection: { name: "Campus shortlist" },
        listings: [listing],
        isLoading: false,
        errorMessage: "",
        onDetails: noop,
        onBack: noop,
        savedListingIds: new Set([listing._id]),
        savingListingIds: new Set(),
        onToggleSave: readOnly ? undefined : noop,
        removingListingIds: new Set(),
        onRemoveFromCollection: readOnly ? undefined : noop,
        onCompareListing: noop,
        readOnly,
      }),
    );
  const privateMarkup = renderCollection(false);
  const publicMarkup = renderCollection(true);

  assert.match(privateMarkup, new RegExp(PRIMARY_IMAGE_SRC));
  assert.match(publicMarkup, new RegExp(PRIMARY_IMAGE_SRC));
  assert.match(privateMarkup, />Remove from Collection</);
  assert.match(privateMarkup, />Unsave Listing</);
  assert.match(publicMarkup, />View Details</);
});
