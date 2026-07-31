import test from "node:test";
import assert from "node:assert/strict";

import {
  clampListingImageIndex,
  getAdjacentListingImageIndex,
  getInitialListingImageIndex,
  LISTING_IMAGE_FALLBACK_SRC,
  normalizeListingImages,
} from "../src/utils/listingImages.js";

const image = (overrides = {}) => ({
  src: "/images/listings/demo/student-bedroom-01.webp",
  alt: "Generic project-generated furnished student bedroom interior",
  order: 0,
  isPrimary: false,
  width: 1200,
  height: 800,
  ...overrides,
});

test("normalizes valid images in explicit order without mutating the listing", () => {
  const listing = {
    _id: "listing-001",
    title: "Furnished Annex Room Near Bloor",
    images: [
      image({
        src: "/images/listings/demo/student-bathroom-01.webp",
        alt: "Generic project-generated compact rental bathroom interior",
        order: 3,
      }),
      image({
        src: "/images/listings/demo/shared-house-01.webp",
        alt: "Generic project-generated shared living room and kitchen",
        order: 1,
      }),
      image({
        src: "/images/listings/demo/student-bedroom-01.webp",
        order: 0,
        isPrimary: true,
      }),
    ],
  };
  const originalListing = structuredClone(listing);

  const normalized = normalizeListingImages(listing);

  assert.deepEqual(
    normalized.map(({ src, order }) => ({ src, order })),
    [
      {
        src: "/images/listings/demo/student-bedroom-01.webp",
        order: 0,
      },
      {
        src: "/images/listings/demo/shared-house-01.webp",
        order: 1,
      },
      {
        src: "/images/listings/demo/student-bathroom-01.webp",
        order: 3,
      },
    ],
  );
  assert.deepEqual(listing, originalListing);
});

test("uses the API primaryImage field to select the matching ordered image", () => {
  const primaryImage = image({
    src: "/images/listings/demo/shared-house-01.webp",
    alt: "Generic project-generated shared living room and kitchen",
    order: 2,
    isPrimary: true,
  });
  const normalized = normalizeListingImages({
    title: "Shared Kensington House",
    primaryImage,
    images: [
      image({
        src: "/images/listings/demo/student-bedroom-01.webp",
        order: 0,
        isPrimary: true,
      }),
      primaryImage,
    ],
  });

  assert.deepEqual(
    normalized.map(({ order, isPrimary }) => ({ order, isPrimary })),
    [
      { order: 0, isPrimary: false },
      { order: 2, isPrimary: true },
    ],
  );
  assert.equal(getInitialListingImageIndex(normalized), 1);
});

test("filters malformed entries while keeping usable images and stable ids", () => {
  const normalized = normalizeListingImages({
    title: "Safe Image Listing",
    images: [
      null,
      image({ src: "javascript:alert(1)", order: 0 }),
      image({ alt: "   ", order: 1 }),
      image({
        src: "https://cdn.example.test/listings/kitchen.webp",
        alt: "Bright shared kitchen with white cabinets and a dining table",
        order: 4,
      }),
    ],
  });

  assert.equal(normalized.length, 1);
  assert.equal(
    normalized[0].src,
    "https://cdn.example.test/listings/kitchen.webp",
  );
  assert.equal(
    normalized[0].id,
    "https://cdn.example.test/listings/kitchen.webp::4",
  );
  assert.equal(normalized[0].isPrimary, true);
});

test("returns a contextual shared fallback when no usable images remain", () => {
  const normalized = normalizeListingImages({
    title: "Quiet Campus Studio",
    images: [{ src: "", alt: "", order: 0 }],
  });

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].src, LISTING_IMAGE_FALLBACK_SRC);
  assert.equal(
    normalized[0].alt,
    "No property image available for Quiet Campus Studio",
  );
  assert.equal(normalized[0].isFallback, true);
});

test("one valid image produces one selected primary gallery item", () => {
  const normalized = normalizeListingImages({
    title: "One Image Listing",
    images: [
      image({
        order: 7,
        isPrimary: false,
      }),
    ],
  });

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].isPrimary, true);
  assert.equal(getInitialListingImageIndex(normalized), 0);
});

test("adds a valid primary convenience image when a legacy array omits it", () => {
  const normalized = normalizeListingImages({
    title: "Legacy Listing",
    primaryImage: image({
      src: "/images/listings/demo/shared-house-01.webp",
      alt: "Generic project-generated shared living room and kitchen",
      order: 2,
      isPrimary: true,
    }),
    images: [
      image({
        src: "/images/listings/demo/student-bedroom-01.webp",
        order: 0,
      }),
    ],
  });

  assert.deepEqual(
    normalized.map(({ order, isPrimary }) => ({ order, isPrimary })),
    [
      { order: 0, isPrimary: false },
      { order: 2, isPrimary: true },
    ],
  );
});

test("clamps navigation at boundaries and never leaves a one-image gallery", () => {
  assert.equal(clampListingImageIndex(-10, 4), 0);
  assert.equal(clampListingImageIndex(10, 4), 3);
  assert.equal(clampListingImageIndex("invalid", 4), 0);
  assert.equal(getAdjacentListingImageIndex(0, -1, 4), 0);
  assert.equal(getAdjacentListingImageIndex(0, 1, 4), 1);
  assert.equal(getAdjacentListingImageIndex(3, 1, 4), 3);
  assert.equal(getAdjacentListingImageIndex(2, -1, 4), 1);
  assert.equal(getAdjacentListingImageIndex(0, 1, 1), 0);
  assert.equal(getAdjacentListingImageIndex(0, -1, 1), 0);
  assert.equal(getAdjacentListingImageIndex(0, 1, 0), 0);
});
