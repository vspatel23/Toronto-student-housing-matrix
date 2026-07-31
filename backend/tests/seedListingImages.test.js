const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  FRONTEND_PUBLIC_DIR,
  listings,
  validateSeedListings,
} = require("../scripts/seedListings");

const existingLocalImage = (overrides = {}) => ({
  src: "/images/listings/demo/studio-01.webp",
  alt: "Generic project-generated studio apartment interior",
  order: 0,
  isPrimary: true,
  width: 1200,
  height: 800,
  ...overrides,
});

const seedListing = (images, overrides = {}) => ({
  seedId: "seed-validation-test",
  title: "Seed Validation Test Listing",
  images,
  ...overrides,
});

const readWebpDimensions = (filePath) => {
  const bytes = fs.readFileSync(filePath);

  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WEBP");

  const chunkType = bytes.toString("ascii", 12, 16);
  if (chunkType === "VP8 ") {
    assert.deepEqual(
      Array.from(bytes.subarray(23, 26)),
      [0x9d, 0x01, 0x2a],
      `${filePath} has an invalid VP8 frame header`,
    );
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunkType === "VP8L") {
    assert.equal(bytes[20], 0x2f, `${filePath} has an invalid VP8L signature`);
    const packedDimensions = bytes.readUInt32LE(21);
    return {
      width: (packedDimensions & 0x3fff) + 1,
      height: ((packedDimensions >> 14) & 0x3fff) + 1,
    };
  }

  if (chunkType === "VP8X") {
    return {
      width: bytes.readUIntLE(24, 3) + 1,
      height: bytes.readUIntLE(27, 3) + 1,
    };
  }

  assert.fail(`${filePath} uses unsupported WebP chunk type ${chunkType}`);
};

test("every real seed listing has a distinct ordered three-image gallery", () => {
  const validated = validateSeedListings(listings);

  assert.equal(validated.length, 30);
  assert.equal(new Set(validated.map((listing) => listing.seedId)).size, 30);
  assert.equal(
    validated.filter((listing) => listing.isActive === true).length,
    27,
  );
  assert.equal(
    validated.filter((listing) => listing.isActive === false).length,
    3,
  );

  const inspectedAssets = new Map();

  validated.forEach((listing) => {
    assert.ok(Array.isArray(listing.images));

    assert.equal(listing.images.length, 3);

    assert.equal(
      listing.images.filter((image) => image.isPrimary).length,
      1,
      `${listing.seedId} should have exactly one primary image`,
    );
    assert.deepEqual(
      listing.images.map((image) => image.order),
      [...listing.images].map((image) => image.order).sort((a, b) => a - b),
      `${listing.seedId} images should be stably ordered`,
    );
    assert.equal(
      new Set(listing.images.map((image) => image.order)).size,
      listing.images.length,
      `${listing.seedId} should not have duplicate image orders`,
    );

    listing.images.forEach((image) => {
      assert.match(image.src, /^\/images\/listings\//);
      assert.match(
        image.src,
        new RegExp(
          `^/images/listings/demo/listing-variants/${listing.seedId}-0[1-3]\\.webp$`,
        ),
      );
      assert.ok(image.alt.trim().length >= 5);

      const filePath = path.resolve(
        FRONTEND_PUBLIC_DIR,
        image.src.slice(1),
      );
      assert.ok(
        filePath.startsWith(`${path.resolve(FRONTEND_PUBLIC_DIR)}${path.sep}`),
      );
      assert.equal(fs.statSync(filePath).isFile(), true);

      if (!inspectedAssets.has(image.src)) {
        inspectedAssets.set(image.src, readWebpDimensions(filePath));
      }

      assert.deepEqual(
        { width: image.width, height: image.height },
        inspectedAssets.get(image.src),
        `${listing.seedId} metadata should match ${image.src}`,
      );
    });
  });

  assert.equal(inspectedAssets.size, 90);
  assert.equal(validated[0].seedId, "listing-001");
  assert.equal(validated[0].images.length, 3);
  assert.deepEqual(
    validated[0].images.map((image) => image.order),
    [0, 1, 2],
  );
  assert.equal(
    new Set(validated.map((listing) => listing.images[0].src)).size,
    30,
  );
});

test("seed validation reports a missing local path with listing identity and image index", () => {
  assert.throws(
    () =>
      validateSeedListings([
        seedListing([
          existingLocalImage({
            src: "/images/listings/demo/does-not-exist.webp",
          }),
        ]),
      ]),
    (error) => {
      assert.match(error.message, /seed-validation-test/);
      assert.match(error.message, /Seed Validation Test Listing/);
      assert.match(error.message, /image 0/);
      assert.match(error.message, /does-not-exist\.webp/);
      assert.match(error.message, /local image file does not exist/);
      return true;
    },
  );
});

test("seed validation rejects multiple primary images", () => {
  assert.throws(
    () =>
      validateSeedListings([
        seedListing([
          existingLocalImage({ order: 0, isPrimary: true }),
          existingLocalImage({
            src: "/images/listings/demo/shared-house-01.webp",
            alt: "Generic project-generated shared student living room",
            order: 1,
            isPrimary: true,
          }),
        ]),
      ]),
    /Listing seed-validation-test .* no more than one image may be primary/,
  );
});

test("seed validation rejects duplicate image order values", () => {
  assert.throws(
    () =>
      validateSeedListings([
        seedListing([
          existingLocalImage({ order: 4, isPrimary: false }),
          existingLocalImage({
            src: "/images/listings/demo/shared-house-01.webp",
            alt: "Generic project-generated shared student living room",
            order: 4,
            isPrimary: true,
          }),
        ]),
      ]),
    /image 1: order 4 is duplicated/,
  );
});

test("seed validation rejects non-integer and negative order values", async (t) => {
  const cases = [
    { name: "fraction", order: 1.5 },
    { name: "numeric string", order: "1" },
    { name: "negative integer", order: -1 },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, () => {
      assert.throws(
        () =>
          validateSeedListings([
            seedListing([existingLocalImage({ order: testCase.order })]),
          ]),
        /image 0: order must be a non-negative integer/,
      );
    });
  }
});

test("seed validation rejects non-positive and non-integer dimensions", async (t) => {
  const cases = [
    { name: "zero width", metadata: { width: 0 } },
    { name: "negative height", metadata: { height: -800 } },
    { name: "fractional width", metadata: { width: 1199.5 } },
    { name: "string height", metadata: { height: "800" } },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, () => {
      assert.throws(
        () =>
          validateSeedListings([
            seedListing([existingLocalImage(testCase.metadata)]),
          ]),
        /image 0: (?:width|height) must be a positive integer/,
      );
    });
  }
});

test("seed validation rejects unsafe and unapproved protocols", async (t) => {
  const sources = [
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "file:///Users/student/private.webp",
    "http://images.example.org/insecure.webp",
    "/Users/student/private.webp",
  ];

  for (const source of sources) {
    await t.test(source, () => {
      assert.throws(
        () =>
          validateSeedListings([
            seedListing([existingLocalImage({ src: source })]),
          ]),
        /src must be an approved \/images\/listings\/ path or an HTTPS URL/,
      );
    });
  }
});

test("seed validation reports missing source and alternative text clearly", async (t) => {
  const cases = [
    {
      name: "missing source",
      image: existingLocalImage({ src: "" }),
      pattern: /image 0: src is required/,
    },
    {
      name: "missing alt",
      image: existingLocalImage({ alt: undefined }),
      pattern: /image 0: alt text is required/,
    },
    {
      name: "whitespace alt",
      image: existingLocalImage({ alt: "   " }),
      pattern: /image 0: alt text is required/,
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, () => {
      assert.throws(
        () => validateSeedListings([seedListing([testCase.image])]),
        testCase.pattern,
      );
    });
  }
});

test("HTTPS seed images are validated as metadata without a local filesystem lookup", () => {
  const validated = validateSeedListings([
    seedListing([
      existingLocalImage({
        src: "https://cdn.example.org/approved-demo/studio.webp",
      }),
    ]),
  ]);

  assert.equal(
    validated[0].images[0].src,
    "https://cdn.example.org/approved-demo/studio.webp",
  );
  assert.equal(validated[0].images[0].isPrimary, true);
});

test("seed validation detects a local file whose contents do not match its extension", () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "listing-image-seed-test-"),
  );

  try {
    const imageDirectory = path.join(
      temporaryRoot,
      "images",
      "listings",
      "demo",
    );
    fs.mkdirSync(imageDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(imageDirectory, "not-really-an-image.webp"),
      "plain text pretending to be a WebP image",
    );

    assert.throws(
      () =>
        validateSeedListings(
          [
            seedListing([
              existingLocalImage({
                src: "/images/listings/demo/not-really-an-image.webp",
              }),
            ]),
          ],
          { publicDirectory: temporaryRoot },
        ),
      /file contents do not match the extension/,
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
