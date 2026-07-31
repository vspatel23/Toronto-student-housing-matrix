const test = require("node:test");
const assert = require("node:assert/strict");

const HousingListing = require("../models/HousingListing");
const {
  FALLBACK_IMAGE,
  isAllowedListingImageSource,
  normalizeListingImages,
  prepareListingImagesForStorage,
  serializeListingImages,
} = require("../utils/listingImages");

const validImage = (overrides = {}) => ({
  src: "/images/listings/demo/studio-01.webp",
  alt: "Generic project-generated studio apartment interior",
  order: 0,
  isPrimary: false,
  width: 1200,
  height: 800,
  ...overrides,
});

const validListing = (overrides = {}) => ({
  seedId: "test-listing-001",
  title: "Test Studio Listing",
  neighborhood: "Test Neighbourhood",
  monthlyRent: 1450,
  propertyType: "Studio",
  furnished: true,
  isActive: true,
  ...overrides,
});

test("approved local paths and credential-free HTTPS URLs are accepted", () => {
  const acceptedSources = [
    "/images/listings/demo/studio-01.webp",
    "/images/listings/fallback/property-placeholder.svg",
    "/images/listings/test-building/test-building-02.avif",
    "https://images.example.org/listings/room.webp",
    "  https://cdn.example.org/property/photo.jpg  ",
  ];

  acceptedSources.forEach((source) => {
    assert.equal(
      isAllowedListingImageSource(source),
      true,
      `${source} should be accepted`,
    );
  });
});

test("unsafe, private, malformed, and unapproved image sources are rejected", () => {
  const rejectedSources = [
    "",
    "   ",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "file:///Users/student/private.webp",
    "http://example.org/insecure.webp",
    "https://user:password@example.org/private.webp",
    "/Users/student/private.webp",
    "/images/listings/../private.webp",
    "/images/listings/demo/UPPERCASE.webp",
    "/images/listings/demo/studio-01.webp?cache=1",
  ];

  rejectedSources.forEach((source) => {
    assert.equal(
      isAllowedListingImageSource(source),
      false,
      `${source} should be rejected`,
    );
  });
});

test("strict storage preparation trims, orders, and selects one explicit primary image", () => {
  const input = [
    validImage({
      src: " /images/listings/demo/student-bedroom-01.webp ",
      alt: "  Generic project-generated furnished student bedroom  ",
      order: 4,
    }),
    validImage({
      src: "/images/listings/demo/shared-house-01.webp",
      alt: "Generic project-generated shared living room and kitchen",
      order: 1,
      isPrimary: true,
    }),
    validImage({
      src: "/images/listings/demo/studio-01.webp",
      alt: "Generic project-generated compact studio interior",
      order: 2,
    }),
  ];

  const prepared = prepareListingImagesForStorage(input);

  assert.deepEqual(
    prepared.map(({ src, order, isPrimary }) => ({ src, order, isPrimary })),
    [
      {
        src: "/images/listings/demo/shared-house-01.webp",
        order: 1,
        isPrimary: true,
      },
      {
        src: "/images/listings/demo/studio-01.webp",
        order: 2,
        isPrimary: false,
      },
      {
        src: "/images/listings/demo/student-bedroom-01.webp",
        order: 4,
        isPrimary: false,
      },
    ],
  );
  assert.equal(
    prepared[2].alt,
    "Generic project-generated furnished student bedroom",
  );
  assert.equal(prepared.filter((image) => image.isPrimary).length, 1);
});

test("strict storage preparation assigns omitted order values and makes a single image primary", () => {
  const prepared = prepareListingImagesForStorage([
    {
      src: "/images/listings/demo/student-bedroom-01.webp",
      alt: "Generic project-generated furnished student bedroom",
    },
  ]);

  assert.deepEqual(prepared, [
    {
      src: "/images/listings/demo/student-bedroom-01.webp",
      alt: "Generic project-generated furnished student bedroom",
      order: 0,
      isPrimary: true,
      width: null,
      height: null,
    },
  ]);
});

test("strict storage preparation rejects ambiguous or malformed metadata", async (t) => {
  const cases = [
    {
      name: "multiple primary images",
      images: [
        validImage({ order: 0, isPrimary: true }),
        validImage({
          src: "/images/listings/demo/shared-house-01.webp",
          alt: "Generic project-generated shared student living room",
          order: 1,
          isPrimary: true,
        }),
      ],
      pattern: /no more than one image may be primary/,
    },
    {
      name: "duplicate order values",
      images: [
        validImage({ order: 2 }),
        validImage({
          src: "/images/listings/demo/shared-house-01.webp",
          alt: "Generic project-generated shared student living room",
          order: 2,
        }),
      ],
      pattern: /order 2 is duplicated/,
    },
    {
      name: "unsafe protocol",
      images: [validImage({ src: "javascript:alert(1)" })],
      pattern: /approved \/images\/listings\/ path or an HTTPS URL/,
    },
    {
      name: "whitespace-only alt text",
      images: [validImage({ alt: "   " })],
      pattern: /alt text is required/,
    },
    {
      name: "non-integer order",
      images: [validImage({ order: 1.5 })],
      pattern: /order must be a non-negative integer/,
    },
    {
      name: "negative order",
      images: [validImage({ order: -1 })],
      pattern: /order must be a non-negative integer/,
    },
    {
      name: "invalid width",
      images: [validImage({ width: 0 })],
      pattern: /width must be a positive integer/,
    },
    {
      name: "non-object metadata",
      images: ["not-an-image-object"],
      pattern: /image metadata must be an object/,
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, () => {
      assert.throws(
        () =>
          prepareListingImagesForStorage(testCase.images, {
            context: "Test listing",
          }),
        testCase.pattern,
      );
    });
  }
});

test("normalization returns the documented fallback for missing or wholly invalid legacy data", () => {
  const missingCases = [
    undefined,
    null,
    {},
    [],
    [
      null,
      "bad metadata",
      validImage({ src: "file:///private/room.webp" }),
      validImage({ alt: "" }),
      validImage({ order: -3 }),
    ],
  ];

  missingCases.forEach((images) => {
    const normalized = normalizeListingImages(images);
    assert.deepEqual(normalized.images, []);
    assert.deepEqual(normalized.primaryImage, FALLBACK_IMAGE);
    assert.notStrictEqual(normalized.primaryImage, FALLBACK_IMAGE);
  });
});

test("legacy normalization filters malformed entries, remains stable, and demotes extra primaries", () => {
  const normalized = normalizeListingImages([
    validImage({
      src: "/images/listings/demo/studio-01.webp",
      alt: "Generic project-generated first studio interior",
      order: 2,
      isPrimary: true,
    }),
    null,
    validImage({
      src: "/images/listings/demo/shared-house-01.webp",
      alt: "Generic project-generated shared living room interior",
      order: 0,
      isPrimary: true,
      width: -1,
      height: "800",
    }),
    validImage({
      src: "data:image/png;base64,AAAA",
      alt: "Unsafe legacy data image that must be removed",
      order: 1,
    }),
    validImage({
      src: "/images/listings/demo/student-bedroom-01.webp",
      alt: "Generic project-generated second bedroom interior",
      order: 2,
    }),
  ]);

  assert.deepEqual(
    normalized.images.map(({ src, order, isPrimary }) => ({
      src,
      order,
      isPrimary,
    })),
    [
      {
        src: "/images/listings/demo/shared-house-01.webp",
        order: 0,
        isPrimary: true,
      },
      {
        src: "/images/listings/demo/studio-01.webp",
        order: 2,
        isPrimary: false,
      },
      {
        src: "/images/listings/demo/student-bedroom-01.webp",
        order: 2,
        isPrimary: false,
      },
    ],
  );
  assert.equal(normalized.images[0].width, null);
  assert.equal(normalized.images[0].height, null);
  assert.equal(normalized.images.filter((image) => image.isPrimary).length, 1);
  assert.equal(
    normalized.primaryImage.src,
    "/images/listings/demo/shared-house-01.webp",
  );
  assert.equal(normalized.primaryImage.isFallback, false);
});

test("serialization preserves existing listing fields, removes stale primaryImage data, and does not mutate input", () => {
  const input = {
    _id: "listing-object-id",
    seedId: "listing-001",
    title: "Preserved Listing Title",
    address: "100 Test Street",
    monthlyRent: 1325,
    amenities: ["WiFi", "Laundry"],
    customLegacyField: "preserved",
    primaryImage: {
      src: "file:///private/stale.webp",
      alt: "Unsafe stale primary image",
    },
    images: [
      validImage({
        src: "/images/listings/demo/student-bedroom-01.webp",
        alt: "Generic project-generated furnished student bedroom",
        order: 3,
      }),
    ],
  };
  const snapshot = structuredClone(input);
  const serialized = serializeListingImages({
    toObject() {
      return input;
    },
  });

  assert.equal(serialized._id, input._id);
  assert.equal(serialized.seedId, input.seedId);
  assert.equal(serialized.title, input.title);
  assert.equal(serialized.address, input.address);
  assert.equal(serialized.monthlyRent, input.monthlyRent);
  assert.deepEqual(serialized.amenities, input.amenities);
  assert.equal(serialized.customLegacyField, "preserved");
  assert.equal(serialized.images.length, 1);
  assert.equal(serialized.images[0].isPrimary, true);
  assert.equal(
    serialized.primaryImage.src,
    "/images/listings/demo/student-bedroom-01.webp",
  );
  assert.equal(serialized.primaryImage.isFallback, false);
  assert.deepEqual(input, snapshot);
});

test("HousingListing accepts old records without image data", async () => {
  const listing = new HousingListing(validListing());

  await listing.validate();

  assert.equal(listing.images, undefined);
});

test("HousingListing strictly normalizes valid image subdocuments without adding image IDs", async () => {
  const listing = new HousingListing(
    validListing({
      images: [
        validImage({
          src: " /images/listings/demo/studio-01.webp ",
          alt: "  Generic project-generated bright studio apartment  ",
          order: 3,
        }),
        validImage({
          src: "/images/listings/demo/shared-house-01.webp",
          alt: "Generic project-generated shared living room and kitchen",
          order: 0,
          isPrimary: true,
        }),
      ],
    }),
  );

  await listing.validate();

  assert.deepEqual(
    listing.images.map((image) => ({
      src: image.src,
      alt: image.alt,
      order: image.order,
      isPrimary: image.isPrimary,
      imageId: image._id,
    })),
    [
      {
        src: "/images/listings/demo/shared-house-01.webp",
        alt: "Generic project-generated shared living room and kitchen",
        order: 0,
        isPrimary: true,
        imageId: undefined,
      },
      {
        src: "/images/listings/demo/studio-01.webp",
        alt: "Generic project-generated bright studio apartment",
        order: 3,
        isPrimary: false,
        imageId: undefined,
      },
    ],
  );
});

test("HousingListing makes its only valid image primary", async () => {
  const listing = new HousingListing(
    validListing({
      seedId: "test-listing-single-image",
      images: [
        validImage({
          isPrimary: false,
          order: undefined,
          width: undefined,
          height: undefined,
        }),
      ],
    }),
  );

  await listing.validate();

  assert.equal(listing.images.length, 1);
  assert.equal(listing.images[0].order, 0);
  assert.equal(listing.images[0].isPrimary, true);
});

test("HousingListing produces controlled validation errors for invalid image metadata", async (t) => {
  const cases = [
    {
      name: "multiple primaries",
      images: [
        validImage({ isPrimary: true }),
        validImage({
          src: "/images/listings/demo/shared-house-01.webp",
          alt: "Generic project-generated shared student living room",
          order: 1,
          isPrimary: true,
        }),
      ],
      pattern: /no more than one image may be primary/,
    },
    {
      name: "unsafe source",
      images: [validImage({ src: "javascript:alert(1)" })],
      pattern: /approved \/images\/listings\/ path or an HTTPS URL/,
    },
    {
      name: "duplicate order",
      images: [
        validImage({ order: 1 }),
        validImage({
          src: "/images/listings/demo/shared-house-01.webp",
          alt: "Generic project-generated shared student living room",
          order: 1,
        }),
      ],
      pattern: /order 1 is duplicated/,
    },
    {
      name: "invalid dimensions",
      images: [validImage({ height: 0 })],
      pattern: /height must be a positive integer/,
    },
  ];

  for (const [index, testCase] of cases.entries()) {
    await t.test(testCase.name, async () => {
      const listing = new HousingListing(
        validListing({
          seedId: `test-invalid-${index}`,
          images: testCase.images,
        }),
      );

      await assert.rejects(() => listing.validate(), testCase.pattern);
    });
  }
});
