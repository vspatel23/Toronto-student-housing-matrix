const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const express = require("express");

const HousingListing = require("../models/HousingListing");
const {
  createAiCompareRouter,
  handleAiCompareJsonBodyError,
} = require("../routes/aiCompare");
const listingsRouter = require("../routes/listings");
const {
  AIOutputValidationError,
  AIServiceConfigurationError,
  AIServiceUnavailableError,
} = require("../services/aiErrors");
const {
  ComparisonServiceError,
} = require("../services/comparisonErrors");

const NO_BODY = Symbol("NO_BODY");
const LISTING_ID_ONE = "ABCDEFABCDEFABCDEFABCDEF";
const LISTING_ID_TWO = "0123456789abcdef01234567";
const LISTING_ID_THREE = "fedcba987654321001234567";
const CANONICAL_LISTING_ID_ONE = LISTING_ID_ONE.toLowerCase();
const USER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const SELECTED_CAMPUS = "Seneca Polytechnic -- Newnham";
const VALUE_SCORE_WEIGHTS = Object.freeze({
  affordability: 35,
  commute: 25,
  safety: 25,
  amenities: 15,
});

const withComparisonContext = (body) =>
  body &&
  typeof body === "object" &&
  !Array.isArray(body) &&
  Object.prototype.hasOwnProperty.call(body, "listingIds")
    ? {
        campus: SELECTED_CAMPUS,
        valueScoreWeights: { ...VALUE_SCORE_WEIGHTS },
        ...body,
      }
    : body;

const recommendationFixture = (listingIds) => ({
  bestOverall: {
    listingId: listingIds[0],
    reason: "This option has the highest existing Value Score.",
  },
  bestBudget: {
    listingId: listingIds[0],
    reason: "This option has the lowest supplied monthly rent.",
  },
  bestCommute: {
    listingId: listingIds[1],
    reason: "This option has the shortest supplied commute.",
  },
  bestSafety: {
    listingId: listingIds[1],
    reason: "This option has the highest supplied safety score.",
  },
  listingInsights: listingIds.map((listingId, index) => ({
    listingId,
    advantage: `Grounded advantage ${index + 1}.`,
    compromise: `Grounded compromise ${index + 1}.`,
  })),
  recommendation: "Choose the option that best matches the supplied priorities.",
});

const createServiceStub = (implementation) => {
  const calls = [];
  const recommendComparison = async (input) => {
    calls.push(input);
    return implementation(input);
  };

  return { calls, recommendComparison };
};

const createAuthStub = ({ userId = USER_ID, implementation } = {}) => {
  const calls = [];
  const middleware = (req, res, next) => {
    calls.push({ method: req.method, path: req.path });

    if (implementation) {
      return implementation(req, res, next);
    }

    req.user = { _id: userId, email: "private@example.test" };
    return next();
  };

  return { calls, middleware };
};

const createTestApp = ({ service, auth, includeListings = false }) => {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use("/api/ai/compare", handleAiCompareJsonBodyError);
  app.use(
    "/api/ai",
    createAiCompareRouter({
      recommendComparison: service.recommendComparison,
      authenticateUserMiddleware: auth.middleware,
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

const postComparison = async (
  baseUrl,
  body = NO_BODY,
  pathname = "/api/ai/compare",
) => {
  const options = { method: "POST" };

  if (body !== NO_BODY) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(withComparisonContext(body));
  }

  return requestJson(baseUrl, pathname, options);
};

const assertErrorResponse = (result, status, code) => {
  assert.equal(result.response.status, status);
  assert.equal(result.body.success, false);
  assert.deepEqual(Object.keys(result.body), ["success", "error"]);
  assert.deepEqual(Object.keys(result.body.error), ["code", "message"]);
  assert.equal(result.body.error.code, code);
  assert.equal(typeof result.body.error.message, "string");
  assert.ok(result.body.error.message.length > 0);
  assert.equal("stack" in result.body.error, false);
};

const createControlledComparisonError = (message, code, statusCode) =>
  new ComparisonServiceError(message, { code, statusCode });

const replaceMethod = (target, methodName, replacement) => {
  const original = target[methodName];
  target[methodName] = replacement;
  return () => {
    target[methodName] = original;
  };
};

test("two listing IDs are canonicalized before the authenticated service call", async () => {
  const expectedIds = [CANONICAL_LISTING_ID_ONE, LISTING_ID_TWO];
  const recommendation = recommendationFixture(expectedIds);
  const service = createServiceStub(async () => recommendation);
  const auth = createAuthStub();

  await withServer(createTestApp({ service, auth }), async (baseUrl) => {
    const result = await postComparison(baseUrl, {
      listingIds: [LISTING_ID_ONE, LISTING_ID_TWO],
      valueScoreWeights: {
        affordability: 7,
        commute: 5,
        safety: 5,
        amenities: 3,
      },
    });

    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body, { success: true, recommendation });
    assert.equal(auth.calls.length, 1);
    assert.deepEqual(service.calls, [
      {
        listingIds: expectedIds,
        campus: SELECTED_CAMPUS,
        valueScoreWeights: VALUE_SCORE_WEIGHTS,
        userId: USER_ID,
      },
    ]);
  });
});

test("three listing IDs return the stable recommendation envelope", async () => {
  const expectedIds = [
    CANONICAL_LISTING_ID_ONE,
    LISTING_ID_TWO,
    LISTING_ID_THREE,
  ];
  const recommendation = recommendationFixture(expectedIds);
  const service = createServiceStub(async () => recommendation);
  const auth = createAuthStub();

  await withServer(createTestApp({ service, auth }), async (baseUrl) => {
    const result = await postComparison(baseUrl, {
      listingIds: [LISTING_ID_ONE, LISTING_ID_TWO, LISTING_ID_THREE],
    });

    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body, { success: true, recommendation });
    assert.deepEqual(service.calls[0].listingIds, expectedIds);
    assert.equal(service.calls[0].campus, SELECTED_CAMPUS);
    assert.deepEqual(
      service.calls[0].valueScoreWeights,
      VALUE_SCORE_WEIGHTS,
    );
    assert.equal(auth.calls.length, 1);
  });
});

test("invalid request shapes are rejected before authentication or service work", async (t) => {
  const cases = [
    { name: "missing body", body: NO_BODY },
    { name: "missing listingIds", body: {} },
    { name: "null body", body: null },
    { name: "array body", body: [] },
    { name: "string body", body: "listingIds" },
    {
      name: "unknown body field",
      body: {
        listingIds: [LISTING_ID_ONE, LISTING_ID_TWO],
        prompt: "recommend anything",
      },
    },
    {
      name: "request-controlled userId",
      body: {
        listingIds: [LISTING_ID_ONE, LISTING_ID_TWO],
        userId: "bbbbbbbbbbbbbbbbbbbbbbbb",
      },
    },
    { name: "non-array listingIds", body: { listingIds: LISTING_ID_ONE } },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const service = createServiceStub(async () => {
        assert.fail("Service must not run for an invalid request body.");
      });
      const auth = createAuthStub({
        implementation: () => {
          assert.fail("Authentication must not run for an invalid request body.");
        },
      });

      await withServer(createTestApp({ service, auth }), async (baseUrl) => {
        const result = await postComparison(baseUrl, testCase.body);

        assertErrorResponse(result, 400, "INVALID_COMPARISON_REQUEST");
        assert.equal(auth.calls.length, 0);
        assert.equal(service.calls.length, 0);
      });
    });
  }
});

test("the HTTP contract requires current context and rejects client-calculated data", async (t) => {
  const cases = [
    {
      name: "legacy IDs-only HTTP payload",
      body: { listingIds: [LISTING_ID_ONE, LISTING_ID_TWO] },
    },
    {
      name: "client-calculated score",
      body: {
        listingIds: [LISTING_ID_ONE, LISTING_ID_TWO],
        campus: SELECTED_CAMPUS,
        valueScoreWeights: VALUE_SCORE_WEIGHTS,
        valueScore: 99,
      },
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const service = createServiceStub(async () => {
        assert.fail("Service must not receive an invalid request.");
      });
      const auth = createAuthStub({
        implementation: () => {
          assert.fail("Authentication must not run for an invalid request.");
        },
      });

      await withServer(createTestApp({ service, auth }), async (baseUrl) => {
        const result = await requestJson(baseUrl, "/api/ai/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testCase.body),
        });

        assertErrorResponse(result, 400, "INVALID_COMPARISON_REQUEST");
        assert.equal(auth.calls.length, 0);
        assert.equal(service.calls.length, 0);
      });
    });
  }
});

test("invalid campus or Value Score weights are rejected before authentication", async (t) => {
  const cases = [
    { name: "empty campus", campus: "" },
    { name: "untrimmed campus", campus: ` ${SELECTED_CAMPUS}` },
    { name: "non-object weights", valueScoreWeights: [] },
    {
      name: "missing weight",
      valueScoreWeights: { affordability: 35, commute: 25, safety: 25 },
    },
    {
      name: "unknown weight",
      valueScoreWeights: { ...VALUE_SCORE_WEIGHTS, rent: 40 },
    },
    {
      name: "non-numeric weight",
      valueScoreWeights: { ...VALUE_SCORE_WEIGHTS, commute: "25" },
    },
    {
      name: "all-zero weights",
      valueScoreWeights: {
        affordability: 0,
        commute: 0,
        safety: 0,
        amenities: 0,
      },
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const { name: _name, ...requestOverrides } = testCase;
      const service = createServiceStub(async () => {
        assert.fail("Service must not receive invalid comparison context.");
      });
      const auth = createAuthStub({
        implementation: () => {
          assert.fail("Authentication must not run for invalid context.");
        },
      });

      await withServer(createTestApp({ service, auth }), async (baseUrl) => {
        const result = await postComparison(baseUrl, {
          listingIds: [LISTING_ID_ONE, LISTING_ID_TWO],
          ...requestOverrides,
        });

        assertErrorResponse(result, 400, "INVALID_COMPARISON_CONTEXT");
        assert.equal(auth.calls.length, 0);
        assert.equal(service.calls.length, 0);
      });
    });
  }
});

test("invalid counts are rejected before authentication or service work", async (t) => {
  const cases = [
    { name: "zero IDs", listingIds: [] },
    { name: "one ID", listingIds: [LISTING_ID_ONE] },
    {
      name: "four IDs",
      listingIds: [
        LISTING_ID_ONE,
        LISTING_ID_TWO,
        LISTING_ID_THREE,
        "111111111111111111111111",
      ],
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const service = createServiceStub(async () => {
        assert.fail("Service must not run for an invalid comparison count.");
      });
      const auth = createAuthStub({
        implementation: () => {
          assert.fail("Authentication must not run for an invalid count.");
        },
      });

      await withServer(createTestApp({ service, auth }), async (baseUrl) => {
        const result = await postComparison(baseUrl, {
          listingIds: testCase.listingIds,
        });

        assertErrorResponse(result, 400, "INVALID_COMPARISON_COUNT");
        assert.equal(auth.calls.length, 0);
        assert.equal(service.calls.length, 0);
      });
    });
  }
});

test("invalid and duplicate IDs are rejected before authentication or service work", async (t) => {
  const cases = [
    {
      name: "malformed MongoDB ID",
      listingIds: [LISTING_ID_ONE, "not-a-mongodb-id"],
      code: "INVALID_LISTING_ID",
    },
    {
      name: "non-string ID",
      listingIds: [LISTING_ID_ONE, 123],
      code: "INVALID_LISTING_ID",
    },
    {
      name: "duplicate IDs",
      listingIds: [LISTING_ID_TWO, LISTING_ID_TWO],
      code: "DUPLICATE_LISTING_IDS",
    },
    {
      name: "case-insensitive duplicate IDs",
      listingIds: [LISTING_ID_ONE, CANONICAL_LISTING_ID_ONE],
      code: "DUPLICATE_LISTING_IDS",
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const service = createServiceStub(async () => {
        assert.fail("Service must not run for invalid listing IDs.");
      });
      const auth = createAuthStub({
        implementation: () => {
          assert.fail("Authentication must not run for invalid listing IDs.");
        },
      });

      await withServer(createTestApp({ service, auth }), async (baseUrl) => {
        const result = await postComparison(baseUrl, {
          listingIds: testCase.listingIds,
        });

        assertErrorResponse(result, 400, testCase.code);
        assert.equal(auth.calls.length, 0);
        assert.equal(service.calls.length, 0);
      });
    });
  }
});

test("valid IDs reach authentication before the recommendation service", async () => {
  const service = createServiceStub(async () => {
    assert.fail("Service must not run when authentication rejects the request.");
  });
  const auth = createAuthStub({
    implementation: (_req, res) =>
      res.status(401).json({ message: "Invalid or expired token." }),
  });

  await withServer(createTestApp({ service, auth }), async (baseUrl) => {
    const result = await postComparison(baseUrl, {
      listingIds: [LISTING_ID_ONE, LISTING_ID_TWO],
    });

    assert.equal(result.response.status, 401);
    assert.deepEqual(result.body, { message: "Invalid or expired token." });
    assert.equal(auth.calls.length, 1);
    assert.equal(service.calls.length, 0);
  });
});

test("service userId comes only from authentication and ignores query parameters", async () => {
  const recommendation = recommendationFixture([
    CANONICAL_LISTING_ID_ONE,
    LISTING_ID_TWO,
  ]);
  const service = createServiceStub(async () => recommendation);
  const auth = createAuthStub();

  await withServer(createTestApp({ service, auth }), async (baseUrl) => {
    const result = await postComparison(
      baseUrl,
      { listingIds: [LISTING_ID_ONE, LISTING_ID_TWO] },
      "/api/ai/compare?userId=bbbbbbbbbbbbbbbbbbbbbbbb",
    );

    assert.equal(result.response.status, 200);
    assert.deepEqual(Object.keys(service.calls[0]), [
      "listingIds",
      "campus",
      "valueScoreWeights",
      "userId",
    ]);
    assert.equal(service.calls[0].userId, USER_ID);
    assert.notEqual(service.calls[0].userId, "bbbbbbbbbbbbbbbbbbbbbbbb");
  });
});

test("missing and inactive listing errors preserve controlled mappings", async (t) => {
  const cases = [
    {
      name: "missing listing",
      error: createControlledComparisonError(
        "A selected listing could not be found.",
        "LISTING_NOT_FOUND",
        404,
      ),
      status: 404,
      code: "LISTING_NOT_FOUND",
    },
    {
      name: "inactive listing",
      error: createControlledComparisonError(
        "A selected listing is inactive.",
        "LISTING_INACTIVE",
        409,
      ),
      status: 409,
      code: "LISTING_INACTIVE",
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const service = createServiceStub(async () => {
        throw testCase.error;
      });
      const auth = createAuthStub();

      await withServer(createTestApp({ service, auth }), async (baseUrl) => {
        const result = await postComparison(baseUrl, {
          listingIds: [LISTING_ID_ONE, LISTING_ID_TWO],
        });

        assertErrorResponse(result, testCase.status, testCase.code);
        assert.equal(result.body.error.message, testCase.error.message);
        assert.equal(auth.calls.length, 1);
        assert.equal(service.calls.length, 1);
      });
    });
  }
});

test("AI failures use the established safe status and error contracts", async (t) => {
  const cases = [
    {
      name: "missing configuration",
      error: new AIServiceConfigurationError(
        "AI service is not configured.",
        "AI_NOT_CONFIGURED",
      ),
      status: 503,
      code: "AI_NOT_CONFIGURED",
    },
    {
      name: "invalid configuration",
      error: new AIServiceConfigurationError(),
      status: 503,
      code: "AI_CONFIGURATION_INVALID",
    },
    {
      name: "provider unavailable",
      error: new AIServiceUnavailableError(),
      status: 503,
      code: "AI_SERVICE_UNAVAILABLE",
    },
    {
      name: "provider timeout",
      error: new AIServiceUnavailableError(
        "AI service request timed out.",
        "AI_SERVICE_TIMEOUT",
      ),
      status: 504,
      code: "AI_SERVICE_TIMEOUT",
    },
    {
      name: "invalid provider output",
      error: new AIOutputValidationError(),
      status: 502,
      code: "AI_OUTPUT_INVALID",
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const service = createServiceStub(async () => {
        throw testCase.error;
      });
      const auth = createAuthStub();

      await withServer(createTestApp({ service, auth }), async (baseUrl) => {
        const result = await postComparison(baseUrl, {
          listingIds: [LISTING_ID_ONE, LISTING_ID_TWO],
        });

        assertErrorResponse(result, testCase.status, testCase.code);
        assert.equal(result.body.error.message, testCase.error.message);
        assert.equal(JSON.stringify(result.body).includes("Authorization"), false);
      });
    });
  }
});

test("malformed JSON returns a safe comparison request error before authentication", async () => {
  const service = createServiceStub(async () => {
    assert.fail("Service must not run for malformed JSON.");
  });
  const auth = createAuthStub({
    implementation: () => {
      assert.fail("Authentication must not run for malformed JSON.");
    },
  });

  await withServer(createTestApp({ service, auth }), async (baseUrl) => {
    const result = await requestJson(baseUrl, "/api/ai/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"listingIds":',
    });

    assertErrorResponse(result, 400, "INVALID_COMPARISON_REQUEST");
    assert.equal(result.body.error.message, "Request body must be a valid JSON object.");
    assert.equal(auth.calls.length, 0);
    assert.equal(service.calls.length, 0);
  });
});

test("oversized JSON returns a safe comparison request error before authentication", async () => {
  const service = createServiceStub(async () => {
    assert.fail("Service must not run for oversized JSON.");
  });
  const auth = createAuthStub({
    implementation: () => {
      assert.fail("Authentication must not run for oversized JSON.");
    },
  });

  await withServer(createTestApp({ service, auth }), async (baseUrl) => {
    const result = await postComparison(baseUrl, {
      listingIds: [LISTING_ID_ONE, "a".repeat(110_000)],
    });

    assertErrorResponse(result, 400, "INVALID_COMPARISON_REQUEST");
    assert.equal(result.body.error.message, "Request body must be a valid JSON object.");
    assert.equal(auth.calls.length, 0);
    assert.equal(service.calls.length, 0);
  });
});

test("unexpected service failures become a generic non-leaking error", async () => {
  const privateDetail = "raw provider body with private database details";
  const service = createServiceStub(async () => {
    throw new Error(privateDetail);
  });
  const auth = createAuthStub();

  await withServer(createTestApp({ service, auth }), async (baseUrl) => {
    const result = await postComparison(baseUrl, {
      listingIds: [LISTING_ID_ONE, LISTING_ID_TWO],
    });

    assertErrorResponse(result, 500, "COMPARISON_SERVICE_UNAVAILABLE");
    assert.equal(
      result.body.error.message,
      "Comparison service is temporarily unavailable.",
    );
    assert.doesNotMatch(JSON.stringify(result.body), new RegExp(privateDetail));
    assert.equal("provider" in result.body, false);
    assert.equal("recommendation" in result.body, false);
  });
});

test("AI comparison failure does not block ordinary rule-based listing calculations", async () => {
  const listing = {
    _id: LISTING_ID_TWO,
    title: "Rule-based listing remains available",
    address: "100 Test Street",
    monthlyRent: 1_500,
    propertyType: "Apartment",
    furnished: true,
    safety: { safetyScore: 82, crimeRateLevel: "Low" },
    commuteEstimates: [
      {
        campus: "Toronto Metropolitan University",
        minutes: 20,
        isEstimated: true,
      },
    ],
    amenities: ["WiFi", "Laundry"],
    isActive: true,
    images: [],
  };
  const restoreFind = replaceMethod(HousingListing, "find", () => ({
    select: async () => [
      {
        toObject: () => structuredClone(listing),
      },
    ],
  }));
  const service = createServiceStub(async () => {
    throw new AIServiceUnavailableError();
  });
  const auth = createAuthStub();

  try {
    await withServer(
      createTestApp({ service, auth, includeListings: true }),
      async (baseUrl) => {
        const failedAiResult = await postComparison(baseUrl, {
          listingIds: [LISTING_ID_ONE, LISTING_ID_TWO],
        });
        assertErrorResponse(
          failedAiResult,
          503,
          "AI_SERVICE_UNAVAILABLE",
        );

        const listingResult = await requestJson(
          baseUrl,
          "/api/listings?campus=Toronto%20Metropolitan%20University",
        );
        assert.equal(listingResult.response.status, 200);
        assert.equal(listingResult.body.count, 1);
        assert.equal(listingResult.body.listings[0].title, listing.title);
        assert.equal(
          typeof listingResult.body.listings[0].valueScore,
          "number",
        );
        assert.deepEqual(
          Object.keys(listingResult.body.listings[0].valueScoreBreakdown),
          ["affordability", "commute", "safety", "amenities"],
        );
        assert.equal(service.calls.length, 1);
      },
    );
  } finally {
    restoreFind();
  }
});
