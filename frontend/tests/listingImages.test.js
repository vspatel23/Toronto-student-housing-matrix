import test from "node:test";
import assert from "node:assert/strict";

import {
  getPrimaryListingImage,
  isValidListingImageAlt,
  isValidListingImageSource,
  LISTING_IMAGE_FALLBACK,
} from "../src/utils/listingImages.js";

const image = (overrides = {}) => ({
  src: "/images/listings/campus-one/campus-one-01.webp",
  alt: "Bright furnished bedroom with a desk and large window",
  order: 0,
  isPrimary: false,
  width: 1200,
  height: 800,
  ...overrides,
});

test("returns the approved fallback for absent or malformed image collections", () => {
  assert.equal(getPrimaryListingImage(null), LISTING_IMAGE_FALLBACK);
  assert.equal(
    getPrimaryListingImage({ images: null }),
    LISTING_IMAGE_FALLBACK,
  );
  assert.equal(
    getPrimaryListingImage({ images: [{ src: "", alt: "" }] }),
    LISTING_IMAGE_FALLBACK,
  );
});

test("prefers a valid normalized primaryImage convenience field", () => {
  const selected = getPrimaryListingImage({
    primaryImage: image({
      src: "  https://images.example.test/rooms/primary.webp  ",
      alt: "  Sunlit studio living area with a dining table  ",
      order: 7,
      isPrimary: true,
    }),
    images: [image({ isPrimary: true })],
  });

  assert.equal(selected.src, "https://images.example.test/rooms/primary.webp");
  assert.equal(selected.alt, "Sunlit studio living area with a dining table");
  assert.equal(selected.order, 7);
  assert.equal(selected.isPrimary, true);
});

test("selects an explicit array primary after stable ordering", () => {
  const selected = getPrimaryListingImage({
    images: [
      image({
        src: "/images/listings/campus-one/campus-one-03.webp",
        alt: "Shared kitchen with white cabinets and an island",
        order: 3,
        isPrimary: true,
      }),
      image({
        src: "/images/listings/campus-one/campus-one-01.webp",
        alt: "Furnished bedroom with a window and study desk",
        order: 1,
      }),
    ],
  });

  assert.equal(
    selected.src,
    "/images/listings/campus-one/campus-one-03.webp",
  );
});

test("uses the first valid ordered image when none is explicitly primary", () => {
  const selected = getPrimaryListingImage({
    images: [
      image({
        src: "/images/listings/campus-one/campus-one-02.webp",
        alt: "Living room with a sofa and coffee table",
        order: 2,
      }),
      image({
        src: "/images/listings/campus-one/campus-one-01.webp",
        alt: "Bedroom with neutral bedding and a study desk",
        order: 0,
      }),
    ],
  });

  assert.equal(
    selected.src,
    "/images/listings/campus-one/campus-one-01.webp",
  );
});

test("resolves duplicate legacy primary flags deterministically", () => {
  const selected = getPrimaryListingImage({
    images: [
      image({
        src: "/images/listings/campus-one/campus-one-02.webp",
        alt: "Second bedroom with a wardrobe and side table",
        order: 2,
        isPrimary: true,
      }),
      image({
        src: "/images/listings/campus-one/campus-one-01.webp",
        alt: "First bedroom with a desk beside the window",
        order: 1,
        isPrimary: true,
      }),
    ],
  });

  assert.equal(
    selected.src,
    "/images/listings/campus-one/campus-one-01.webp",
  );
});

test("skips unsafe sources and entries without meaningful alt text", () => {
  const selected = getPrimaryListingImage({
    primaryImage: image({
      src: "javascript:alert(1)",
      alt: "Unsafe source",
    }),
    images: [
      image({
        src: "data:image/svg+xml;base64,PHN2Zy8+",
        alt: "Embedded source",
        isPrimary: true,
      }),
      image({
        src: "/images/listings/campus-one/campus-one-01.webp",
        alt: "   ",
      }),
      image({
        src: "https://images.example.test/rooms/safe.webp",
        alt: "Furnished bedroom with blue bedding and a reading lamp",
        order: 4,
      }),
    ],
  });

  assert.equal(selected.src, "https://images.example.test/rooms/safe.webp");
});

test("validates only approved local paths or credential-free HTTPS URLs", () => {
  assert.equal(
    isValidListingImageSource(
      "/images/listings/fallback/property-placeholder.svg",
    ),
    true,
  );
  assert.equal(
    isValidListingImageSource("https://cdn.example.test/room.webp?size=large"),
    true,
  );
  assert.equal(isValidListingImageSource("http://example.test/room.webp"), false);
  assert.equal(isValidListingImageSource("//example.test/room.webp"), false);
  assert.equal(isValidListingImageSource("file:///tmp/room.webp"), false);
  assert.equal(
    isValidListingImageSource("/images/listings/../private/room.webp"),
    false,
  );
  assert.equal(
    isValidListingImageSource("https://user:secret@example.test/room.webp"),
    false,
  );
});

test("validates non-empty, reasonably bounded alternative text", () => {
  assert.equal(isValidListingImageAlt("Bright bedroom with a study desk"), true);
  assert.equal(isValidListingImageAlt("   "), false);
  assert.equal(isValidListingImageAlt("Room"), false);
  assert.equal(isValidListingImageAlt("x".repeat(241)), false);
});
