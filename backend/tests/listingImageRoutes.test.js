const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const express = require("express");
const jwt = require("jsonwebtoken");

const Collection = require("../models/Collection");
const HousingListing = require("../models/HousingListing");
const SavedListing = require("../models/SavedListing");
const User = require("../models/User");
const collectionsRouter = require("../routes/collections");
const listingsRouter = require("../routes/listings");
const savedListingsRouter = require("../routes/savedListings");
const {
  FALLBACK_IMAGE,
  LISTING_FIELDS,
} = require("../utils/listingImages");
const {
  SUPPORTED_CAMPUS_LABELS,
  getCommuteMinutes,
} = require("../utils/commute");

const LISTING_ID = "64b000000000000000000001";
const SECOND_LISTING_ID = "64b000000000000000000002";
const USER_ID = "64b000000000000000000010";
const COLLECTION_ID = "64b000000000000000000020";
const JWT_SECRET = "listing-image-route-test-secret";

const app = express();
app.disable("x-powered-by");
app.use(express.json());
app.use("/api/listings", listingsRouter);
app.use("/api/saved-listings", savedListingsRouter);
app.use("/api/collections", collectionsRouter);

const listingImages = () => [
  {
    src: "/images/listings/demo/student-bedroom-01.webp",
    alt: "Generic project-generated furnished student bedroom",
    order: 3,
    isPrimary: false,
    width: 1200,
    height: 800,
  },
  {
    src: "/images/listings/demo/shared-house-01.webp",
    alt: "Generic project-generated shared student living room and kitchen",
    order: 0,
    isPrimary: true,
    width: 1200,
    height: 800,
  },
];

const listingObject = (overrides = {}) => ({
  _id: LISTING_ID,
  title: "Route Contract Test Listing",
  address: "100 Test Street, Toronto, ON",
  neighborhood: "The Annex",
  postalCode: "M5S 1A1",
  description: "A listing used to verify route-level image serialization.",
  monthlyRent: 1400,
  propertyType: "Room Rental",
  bedrooms: 1,
  bathrooms: 1,
  furnished: true,
  location: { lat: 43.66, lng: -79.4 },
  safety: { safetyScore: 82, crimeRateLevel: "Low" },
  commuteEstimates: [
    {
      campus: "University of Toronto — St. George",
      minutes: 12,
      isEstimated: true,
    },
  ],
  nearestTransit: { name: "Spadina Station", walkMinutes: 6 },
  amenities: ["WiFi", "Laundry", "Kitchen"],
  source: "Sample development data",
  isActive: true,
  images: listingImages(),
  ...overrides,
});

const listingDocument = (overrides = {}) => {
  const value = listingObject(overrides);
  return {
    toObject() {
      return structuredClone(value);
    },
  };
};

const replaceMethod = (target, methodName, replacement) => {
  const original = target[methodName];
  target[methodName] = replacement;
  return () => {
    target[methodName] = original;
  };
};

const restoreAll = (restores) => {
  [...restores].reverse().forEach((restore) => restore());
};

const withServer = async (callback) => {
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await callback(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
};

const requestJson = async (baseUrl, pathname, options = {}) => {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await response.json();
  return { response, body };
};

const getAuthContext = () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = JWT_SECRET;

  const restoreUser = replaceMethod(User, "findById", async (userId) => {
    assert.equal(String(userId), USER_ID);
    return { _id: USER_ID, name: "Route Test User" };
  });
  const token = jwt.sign({ userId: USER_ID }, JWT_SECRET);

  return {
    token,
    restore() {
      restoreUser();
      if (previousSecret === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = previousSecret;
      }
    },
  };
};

const assertProjectionIncludesImages = (projection) => {
  assert.equal(projection, LISTING_FIELDS);
  assert.match(projection, /(?:^|\s)images(?:\s|$)/);
};

const assertValidImageContract = (listing) => {
  assert.ok(Array.isArray(listing.images));
  assert.deepEqual(
    listing.images.map(({ src, order, isPrimary }) => ({
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
        src: "/images/listings/demo/student-bedroom-01.webp",
        order: 3,
        isPrimary: false,
      },
    ],
  );
  assert.equal(listing.images.filter((image) => image.isPrimary).length, 1);
  assert.equal(
    listing.primaryImage.src,
    "/images/listings/demo/shared-house-01.webp",
  );
  assert.equal(listing.primaryImage.alt.length > 0, true);
  assert.equal(listing.primaryImage.isPrimary, true);
  assert.equal(listing.primaryImage.isFallback, false);
};

const assertNormalizedCommuteContract = (listing) => {
  assert.equal(listing.commuteEstimates.length, SUPPORTED_CAMPUS_LABELS.length);
  assert.equal(
    getCommuteMinutes(listing, "University of Toronto -- St. George"),
    12,
  );

  SUPPORTED_CAMPUS_LABELS.forEach((campus) => {
    assert.equal(Number.isFinite(getCommuteMinutes(listing, campus)), true);
  });
};

test("browse listings includes the image projection and normalized image contract", async () => {
  let observedFilter;
  let observedProjection;
  const restores = [
    replaceMethod(HousingListing, "find", (filter) => {
      observedFilter = filter;
      return {
        select(projection) {
          observedProjection = projection;
          return Promise.resolve([listingDocument()]);
        },
      };
    }),
  ];

  try {
    await withServer(async (baseUrl) => {
      const { response, body } = await requestJson(
        baseUrl,
        "/api/listings?campus=University%20of%20Toronto%20%E2%80%94%20St.%20George",
      );

      assert.equal(response.status, 200);
      assert.deepEqual(observedFilter, { isActive: true });
      assertProjectionIncludesImages(observedProjection);
      assert.equal(body.count, 1);
      assert.equal(body.listings[0].title, "Route Contract Test Listing");
      assert.equal(body.listings[0].monthlyRent, 1400);
      assert.equal(typeof body.listings[0].valueScore, "number");
      assert.equal(
        typeof body.listings[0].valueScoreBreakdown.affordability,
        "number",
      );
      assertValidImageContract(body.listings[0]);
      assertNormalizedCommuteContract(body.listings[0]);
    });
  } finally {
    restoreAll(restores);
  }
});

test("listing detail normalizes malformed legacy data to a safe fallback while preserving fields", async () => {
  let observedListingId;
  const restores = [
    replaceMethod(HousingListing, "findById", async (listingId) => {
      observedListingId = listingId;
      return listingDocument({
        images: [
          null,
          {
            src: "javascript:alert(1)",
            alt: "Unsafe image metadata",
            order: 0,
            isPrimary: true,
          },
          {
            src: "/images/listings/demo/studio-01.webp",
            alt: "   ",
            order: 1,
          },
        ],
        primaryImage: {
          src: "file:///Users/student/private.webp",
          alt: "Stale private image",
        },
      });
    }),
  ];

  try {
    await withServer(async (baseUrl) => {
      const { response, body } = await requestJson(
        baseUrl,
        `/api/listings/${LISTING_ID}`,
      );

      assert.equal(response.status, 200);
      assert.equal(observedListingId, LISTING_ID);
      assert.equal(body._id, LISTING_ID);
      assert.equal(body.title, "Route Contract Test Listing");
      assert.equal(body.address, "100 Test Street, Toronto, ON");
      assert.deepEqual(body.images, []);
      assert.deepEqual(body.primaryImage, FALLBACK_IMAGE);
      assert.equal(JSON.stringify(body).includes("/Users/"), false);
      assert.equal(JSON.stringify(body).includes("javascript:"), false);
      assertNormalizedCommuteContract(body);
    });
  } finally {
    restoreAll(restores);
  }
});

test("saved listings populate images and return the same normalized contract", async () => {
  let observedFindFilter;
  let observedSort;
  let observedPopulate;
  const savedAt = new Date("2026-07-30T01:02:03.000Z");
  const auth = getAuthContext();
  const restores = [
    replaceMethod(SavedListing, "find", (filter) => {
      observedFindFilter = filter;
      return {
        sort(sort) {
          observedSort = sort;
          return this;
        },
        populate(populate) {
          observedPopulate = populate;
          return Promise.resolve([
            {
              listingId: listingDocument(),
              savedAt,
            },
          ]);
        },
      };
    }),
  ];

  try {
    await withServer(async (baseUrl) => {
      const { response, body } = await requestJson(
        baseUrl,
        "/api/saved-listings",
        {
          headers: { Authorization: `Bearer ${auth.token}` },
        },
      );

      assert.equal(response.status, 200);
      assert.deepEqual(observedFindFilter, { userId: USER_ID });
      assert.deepEqual(observedSort, { savedAt: -1 });
      assert.equal(observedPopulate.path, "listingId");
      assertProjectionIncludesImages(observedPopulate.select);
      assert.equal(body.success, true);
      assert.equal(body.count, 1);
      assert.equal(body.listings[0].savedAt, savedAt.toISOString());
      assert.equal(body.listings[0].title, "Route Contract Test Listing");
      assertValidImageContract(body.listings[0]);
      assertNormalizedCommuteContract(body.listings[0]);
    });
  } finally {
    restoreAll(restores);
    auth.restore();
  }
});

test("private collection detail populates images and returns the normalized contract", async () => {
  let observedFilter;
  let observedPopulate;
  const auth = getAuthContext();
  const collection = {
    _id: COLLECTION_ID,
    name: "Private Test Collection",
    description: "Private collection route image contract",
    shareToken: "existing-share-token",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-29T00:00:00.000Z"),
    listingIds: [listingDocument()],
  };
  const restores = [
    replaceMethod(Collection, "findOne", (filter) => {
      observedFilter = filter;
      return {
        populate(populate) {
          observedPopulate = populate;
          return Promise.resolve(collection);
        },
      };
    }),
  ];

  try {
    await withServer(async (baseUrl) => {
      const { response, body } = await requestJson(
        baseUrl,
        `/api/collections/${COLLECTION_ID}`,
        {
          headers: { Authorization: `Bearer ${auth.token}` },
        },
      );

      assert.equal(response.status, 200);
      assert.deepEqual(observedFilter, {
        _id: COLLECTION_ID,
        userId: USER_ID,
      });
      assert.equal(observedPopulate.path, "listingIds");
      assertProjectionIncludesImages(observedPopulate.select);
      assert.equal(body.success, true);
      assert.equal(body.collection._id, COLLECTION_ID);
      assert.equal(body.collection.name, "Private Test Collection");
      assert.equal(body.listings.length, 1);
      assertValidImageContract(body.listings[0]);
      assertNormalizedCommuteContract(body.listings[0]);
    });
  } finally {
    restoreAll(restores);
    auth.restore();
  }
});

test("public shared collection populates images without authentication or private account data", async () => {
  let observedFilter;
  let observedPopulate;
  const sharedCollection = {
    name: "Public Test Collection",
    description: "Shared collection route image contract",
    userId: USER_ID,
    listingIds: [
      listingDocument({
        _id: SECOND_LISTING_ID,
        title: "Shared Route Listing",
      }),
    ],
  };
  const restores = [
    replaceMethod(Collection, "findOne", (filter) => {
      observedFilter = filter;
      return {
        populate(populate) {
          observedPopulate = populate;
          return Promise.resolve(sharedCollection);
        },
      };
    }),
  ];

  try {
    await withServer(async (baseUrl) => {
      const { response, body } = await requestJson(
        baseUrl,
        "/api/collections/shared/opaque-share-token",
      );

      assert.equal(response.status, 200);
      assert.deepEqual(observedFilter, {
        shareToken: "opaque-share-token",
      });
      assert.equal(observedPopulate.path, "listingIds");
      assertProjectionIncludesImages(observedPopulate.select);
      assert.equal(body.success, true);
      assert.deepEqual(body.collection, {
        name: "Public Test Collection",
        description: "Shared collection route image contract",
      });
      assert.equal("userId" in body.collection, false);
      assert.equal(body.listings[0]._id, SECOND_LISTING_ID);
      assert.equal(body.listings[0].title, "Shared Route Listing");
      assertValidImageContract(body.listings[0]);
      assertNormalizedCommuteContract(body.listings[0]);
    });
  } finally {
    restoreAll(restores);
  }
});
