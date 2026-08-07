const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const express = require("express");

const {
  MAX_HOUSING_DESCRIPTION_LENGTH,
} = require("../constants/aiSearch");
const HousingListing = require("../models/HousingListing");
const listingsRouter = require("../routes/listings");
const {
  createAiSearchRouter,
  handleAiSearchJsonBodyError,
} = require("../routes/aiSearch");
const {
  AIOutputValidationError,
  AIServiceConfigurationError,
  AIServiceUnavailableError,
} = require("../services/aiErrors");

const NO_BODY = Symbol("NO_BODY");

const validFilters = (overrides = {}) => ({
  campus: "Toronto Metropolitan University",
  minRent: 1200,
  maxRent: 1800,
  housingType: "Apartment",
  maxCommute: 30,
  safetyLevel: null,
  furnished: "Furnished",
  amenities: ["WiFi", "Laundry"],
  ...overrides,
});

const createServiceStub = (implementation) => {
  const calls = [];

  return {
    calls,
    async extractHousingFilters(description) {
      calls.push(description);
      return implementation(description);
    },
  };
};

const createTestApp = (service, { includeListings = false } = {}) => {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use("/api/ai", handleAiSearchJsonBodyError);
  app.use(
    "/api/ai",
    createAiSearchRouter({
      extractHousingFilters: service.extractHousingFilters.bind(service),
    }),
  );

  if (includeListings) {
    app.use("/api/listings", listingsRouter);
  }

  return app;
};

const withServer = async (app, callback) => {
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

const postDescription = async (baseUrl, body = NO_BODY) => {
  const options = { method: "POST" };

  if (body !== NO_BODY) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }

  return requestJson(baseUrl, "/api/ai/search", options);
};

const assertErrorResponse = ({ response, body }, status, code, message) => {
  assert.equal(response.status, status);
  assert.deepEqual(body, {
    success: false,
    error: { code, message },
  });
};

const replaceMethod = (target, methodName, replacement) => {
  const original = target[methodName];
  target[methodName] = replacement;
  return () => {
    target[methodName] = original;
  };
};

test("valid campus, budget, commute, and furnishing text returns normalized filters", async () => {
  const filters = validFilters();
  const service = createServiceStub(async () => filters);
  const app = createTestApp(service);

  await withServer(app, async (baseUrl) => {
    const result = await postDescription(baseUrl, {
      description:
        "I want a furnished apartment near Toronto Metropolitan University between $1200 and $1800, within 30 minutes, with WiFi and Laundry.",
    });

    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body, { success: true, filters });
    assert.equal(service.calls.length, 1);
  });
});

test("valid housing type and amenities text returns the approved representation", async () => {
  const filters = validFilters({
    campus: null,
    minRent: null,
    maxRent: null,
    housingType: "Shared House",
    maxCommute: null,
    furnished: null,
    amenities: ["Kitchen", "Parking", "Pet Friendly"],
  });
  const service = createServiceStub(async () => filters);

  await withServer(createTestApp(service), async (baseUrl) => {
    const result = await postDescription(baseUrl, {
      description: "A shared house with a kitchen, parking, and pets allowed.",
    });

    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body, { success: true, filters });
  });
});

test("valid input is trimmed before the AI service is called", async () => {
  const service = createServiceStub(async () => ({}));

  await withServer(createTestApp(service), async (baseUrl) => {
    const result = await postDescription(baseUrl, {
      description: "  A studio near campus.\n",
    });

    assert.equal(result.response.status, 200);
    assert.deepEqual(service.calls, ["A studio near campus."]);
  });
});

test("invalid request descriptions are rejected before the AI service is called", async (t) => {
  const cases = [
    {
      name: "missing request body",
      body: NO_BODY,
      message: "Housing description is required.",
    },
    {
      name: "missing description",
      body: {},
      message: "Housing description is required.",
    },
    {
      name: "empty description",
      body: { description: "" },
      message: "Housing description is required.",
    },
    {
      name: "whitespace-only description",
      body: { description: "  \n\t  " },
      message: "Housing description is required.",
    },
    {
      name: "non-string description",
      body: { description: 1600 },
      message: "Housing description must be a string.",
    },
    {
      name: "unexpected request field",
      body: { description: "A studio.", prompt: "Return anything" },
      message: "Request body must contain only a housing description.",
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const service = createServiceStub(async () => {
        assert.fail("AI service must not be called for invalid input.");
      });

      await withServer(createTestApp(service), async (baseUrl) => {
        const result = await postDescription(baseUrl, testCase.body);

        assertErrorResponse(
          result,
          400,
          "INVALID_DESCRIPTION",
          testCase.message,
        );
        assert.equal(service.calls.length, 0);
      });
    });
  }
});

test("a description exactly at the maximum length is accepted", async () => {
  const description = "a".repeat(MAX_HOUSING_DESCRIPTION_LENGTH);
  const service = createServiceStub(async () => ({}));

  await withServer(createTestApp(service), async (baseUrl) => {
    const result = await postDescription(baseUrl, { description });

    assert.equal(result.response.status, 200);
    assert.equal(service.calls[0].length, MAX_HOUSING_DESCRIPTION_LENGTH);
  });
});

test("a description above the maximum length is rejected before AI", async () => {
  const service = createServiceStub(async () => {
    assert.fail("AI service must not be called for over-limit input.");
  });

  await withServer(createTestApp(service), async (baseUrl) => {
    const result = await postDescription(baseUrl, {
      description: "a".repeat(MAX_HOUSING_DESCRIPTION_LENGTH + 1),
    });

    assertErrorResponse(
      result,
      400,
      "DESCRIPTION_TOO_LONG",
      `Housing description must not exceed ${MAX_HOUSING_DESCRIPTION_LENGTH} characters.`,
    );
    assert.equal(service.calls.length, 0);
  });
});

test("malformed JSON receives the safe error envelope without calling AI", async () => {
  const service = createServiceStub(async () => {
    assert.fail("AI service must not be called for malformed JSON.");
  });

  await withServer(createTestApp(service), async (baseUrl) => {
    const result = await requestJson(baseUrl, "/api/ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"description":',
    });

    assertErrorResponse(
      result,
      400,
      "INVALID_DESCRIPTION",
      "Request body must be a valid JSON object.",
    );
    assert.equal(service.calls.length, 0);
    assert.equal("stack" in result.body.error, false);
  });
});

test("a body above the JSON parser limit receives the documented length error", async () => {
  const service = createServiceStub(async () => {
    assert.fail("AI service must not be called for an oversized body.");
  });

  await withServer(createTestApp(service), async (baseUrl) => {
    const result = await postDescription(baseUrl, {
      description: "a".repeat(110_000),
    });

    assertErrorResponse(
      result,
      400,
      "DESCRIPTION_TOO_LONG",
      `Housing description must not exceed ${MAX_HOUSING_DESCRIPTION_LENGTH} characters.`,
    );
    assert.equal(service.calls.length, 0);
  });
});

test("unsupported or unsafe AI output cannot cross the HTTP boundary", async (t) => {
  const cases = [
    {
      name: "unsupported campus",
      filters: validFilters({ campus: "Invented Toronto Campus" }),
    },
    {
      name: "unsupported housing type",
      filters: validFilters({ housingType: "Luxury Castle" }),
    },
    {
      name: "unsupported amenity",
      filters: validFilters({ amenities: ["Swimming Pool"] }),
    },
    {
      name: "unsupported safety value",
      filters: validFilters({ safetyLevel: "Perfectly Safe" }),
    },
    {
      name: "unsupported furnishing value",
      filters: validFilters({ furnished: "Partially Furnished" }),
    },
    {
      name: "invalid rent value",
      filters: validFilters({ minRent: 1225 }),
    },
    {
      name: "invalid commute value",
      filters: validFilters({ maxCommute: 31 }),
    },
    {
      name: "invented top-level field",
      filters: { ...validFilters(), oceanView: true },
    },
    {
      name: "prompt-injection fields",
      filters: {
        ...validFilters(),
        adminAccess: true,
        databasePassword: "secret",
      },
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const service = createServiceStub(async () => testCase.filters);

      await withServer(createTestApp(service), async (baseUrl) => {
        const result = await postDescription(baseUrl, {
          description: "Untrusted housing search text.",
        });

        assertErrorResponse(
          result,
          502,
          "AI_OUTPUT_INVALID",
          "AI service returned an invalid response.",
        );
        assert.equal(JSON.stringify(result.body).includes("adminAccess"), false);
        assert.equal(
          JSON.stringify(result.body).includes("databasePassword"),
          false,
        );
        assert.equal(JSON.stringify(result.body).includes("oceanView"), false);
      });
    });
  }
});

test("unsupported-only criteria return predictable empty approved filters", async () => {
  const service = createServiceStub(async () => ({}));

  await withServer(createTestApp(service), async (baseUrl) => {
    const result = await postDescription(baseUrl, {
      description:
        "I want a swimming pool, ocean view, private chef, and helicopter landing pad.",
    });

    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body, {
      success: true,
      filters: {
        campus: null,
        minRent: null,
        maxRent: null,
        housingType: null,
        maxCommute: null,
        safetyLevel: null,
        furnished: null,
        amenities: [],
      },
    });
  });
});

test("supported criteria are preserved while unsupported criteria are omitted", async () => {
  const service = createServiceStub(async () => ({
    campus: "Toronto Metropolitan University",
    housingType: "Apartment",
  }));

  await withServer(createTestApp(service), async (baseUrl) => {
    const result = await postDescription(baseUrl, {
      description:
        "I want an apartment near TMU with a swimming pool, ocean view, private chef, and helicopter landing pad.",
    });

    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.filters, {
      campus: "Toronto Metropolitan University",
      minRent: null,
      maxRent: null,
      housingType: "Apartment",
      maxCommute: null,
      safetyLevel: null,
      furnished: null,
      amenities: [],
    });
    assert.doesNotMatch(
      JSON.stringify(result.body),
      /swimming|ocean|chef|helicopter/i,
    );
  });
});

test("AI service failures use controlled status and error contracts", async (t) => {
  const cases = [
    {
      name: "missing configuration",
      error: new AIServiceConfigurationError(
        "AI service is not configured.",
        "AI_NOT_CONFIGURED",
      ),
      status: 503,
      code: "AI_NOT_CONFIGURED",
      message: "AI service is not configured.",
    },
    {
      name: "invalid configuration",
      error: new AIServiceConfigurationError(),
      status: 503,
      code: "AI_CONFIGURATION_INVALID",
      message: "AI service configuration is invalid.",
    },
    {
      name: "provider unavailable",
      error: new AIServiceUnavailableError(),
      status: 503,
      code: "AI_SERVICE_UNAVAILABLE",
      message: "AI service is temporarily unavailable.",
    },
    {
      name: "provider timeout",
      error: new AIServiceUnavailableError(
        "AI service request timed out.",
        "AI_SERVICE_TIMEOUT",
      ),
      status: 504,
      code: "AI_SERVICE_TIMEOUT",
      message: "AI service request timed out.",
    },
    {
      name: "invalid AI output",
      error: new AIOutputValidationError(),
      status: 502,
      code: "AI_OUTPUT_INVALID",
      message: "AI service returned an invalid response.",
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const service = createServiceStub(async () => {
        throw testCase.error;
      });

      await withServer(createTestApp(service), async (baseUrl) => {
        const result = await postDescription(baseUrl, {
          description: "A valid housing request.",
        });

        assertErrorResponse(
          result,
          testCase.status,
          testCase.code,
          testCase.message,
        );
        assert.equal("stack" in result.body.error, false);
      });
    });
  }
});

test("malformed AI output does not crash Express or expose raw output", async () => {
  const service = createServiceStub(async () => "not a filter object");

  await withServer(createTestApp(service), async (baseUrl) => {
    const result = await postDescription(baseUrl, {
      description: "A studio near campus.",
    });

    assertErrorResponse(
      result,
      502,
      "AI_OUTPUT_INVALID",
      "AI service returned an invalid response.",
    );
    assert.equal(JSON.stringify(result.body).includes("not a filter object"), false);
  });
});

test("unexpected service errors become a generic safe availability response", async () => {
  const service = createServiceStub(async () => {
    throw new Error("provider response body with internal details");
  });

  await withServer(createTestApp(service), async (baseUrl) => {
    const result = await postDescription(baseUrl, {
      description: "A room near campus.",
    });

    assertErrorResponse(
      result,
      503,
      "AI_SERVICE_UNAVAILABLE",
      "AI service is temporarily unavailable.",
    );
    assert.doesNotMatch(JSON.stringify(result.body), /internal details/);
  });
});

test("the AI endpoint cannot create or modify listings and returns filters only", async () => {
  let listingWriteCalls = 0;
  const guardedMethods = [
    "find",
    "findOne",
    "findById",
    "create",
    "insertMany",
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "replaceOne",
    "deleteOne",
    "deleteMany",
  ];
  const restores = guardedMethods.map((methodName) =>
    replaceMethod(HousingListing, methodName, async () => {
      listingWriteCalls += 1;
      throw new Error(`Unexpected HousingListing.${methodName} call`);
    }),
  );
  restores.push(
    replaceMethod(HousingListing.prototype, "save", async () => {
      listingWriteCalls += 1;
      throw new Error("Unexpected HousingListing.save call");
    }),
  );

  try {
    const filters = validFilters();
    const service = createServiceStub(async () => filters);

    await withServer(createTestApp(service), async (baseUrl) => {
      const result = await postDescription(baseUrl, {
        description: "A furnished apartment near TMU.",
      });

      assert.equal(result.response.status, 200);
      assert.deepEqual(Object.keys(result.body), ["success", "filters"]);
      assert.deepEqual(result.body.filters, filters);
      assert.equal("listings" in result.body, false);
      assert.equal("listing" in result.body, false);
      assert.equal("provider" in result.body, false);
      assert.equal("prompt" in result.body, false);
      assert.equal(listingWriteCalls, 0);
    });
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("manual listing search keeps its database query and response contract without AI", async () => {
  let observedFilter;
  let observedProjection;
  const service = createServiceStub(async () => {
    assert.fail("Manual listing search must not call the AI service.");
  });
  const listing = {
    _id: "64b000000000000000000001",
    title: "Manual Search Database Listing",
    address: "100 Test Street, Toronto, ON",
    neighborhood: "Downtown",
    postalCode: "M5B 1A1",
    description: "Stored application listing.",
    monthlyRent: 1500,
    propertyType: "Apartment",
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    location: { lat: 43.6577, lng: -79.3788 },
    safety: { safetyScore: 85, crimeRateLevel: "Low" },
    commuteEstimates: [
      {
        campus: "Toronto Metropolitan University",
        minutes: 10,
        isEstimated: true,
      },
    ],
    nearestTransit: { name: "Dundas Station", walkMinutes: 5 },
    amenities: ["WiFi", "Laundry"],
    source: "Database fixture",
    isActive: true,
    images: [],
  };
  const restoreFind = replaceMethod(HousingListing, "find", (filter) => {
    observedFilter = filter;
    return {
      select(projection) {
        observedProjection = projection;
        return Promise.resolve([
          {
            toObject: () => structuredClone(listing),
          },
        ]);
      },
    };
  });

  try {
    await withServer(
      createTestApp(service, { includeListings: true }),
      async (baseUrl) => {
        const { response, body } = await requestJson(
          baseUrl,
          "/api/listings?campus=Toronto%20Metropolitan%20University&minRent=1200&maxRent=1800&propertyType=Apartment&safetyLevel=Medium%2B",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(observedFilter, {
          isActive: true,
          monthlyRent: { $gte: 1200, $lte: 1800 },
          propertyType: "Apartment",
          "safety.crimeRateLevel": { $in: ["Low", "Medium"] },
        });
        assert.match(observedProjection, /(?:^|\s)images(?:\s|$)/);
        assert.deepEqual(Object.keys(body), ["count", "listings"]);
        assert.equal(body.count, 1);
        assert.equal(body.listings[0].title, listing.title);
        assert.equal(body.listings[0].monthlyRent, listing.monthlyRent);
        assert.equal(service.calls.length, 0);
      },
    );
  } finally {
    restoreFind();
  }
});
