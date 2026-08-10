import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const frontendRoot = fileURLToPath(new URL("../", import.meta.url));
const apiBaseUrl = "https://api.example.test";
const LISTING_ID_ONE = "64B000000000000000000001";
const LISTING_ID_TWO = "64b000000000000000000002";
const LISTING_ID_THREE = "64b000000000000000000003";
const UNKNOWN_LISTING_ID = "64b000000000000000000099";
const CANONICAL_LISTING_ID_ONE = LISTING_ID_ONE.toLowerCase();
const CAMPUS = "Toronto Metropolitan University";
const DEFAULT_VALUE_SCORE_WEIGHTS = {
  affordability: 35,
  commute: 25,
  safety: 25,
  amenities: 15,
};

const createRecommendation = (listingIds = [
  CANONICAL_LISTING_ID_ONE,
  LISTING_ID_TWO,
]) => ({
  bestOverall: {
    listingId: listingIds[0],
    reason: "This listing has the highest existing Value Score.",
  },
  bestBudget: {
    listingId: listingIds[0],
    reason: "This listing has the lowest supplied monthly rent.",
  },
  bestCommute: {
    listingId: listingIds[1],
    reason: "This listing has the shortest supplied commute.",
  },
  bestSafety: {
    listingId: null,
    reason: "The supplied listings do not include comparable safety data.",
  },
  listingInsights: listingIds.map((listingId, index) => ({
    listingId,
    advantage:
      index === 0
        ? "It lists 3 stored amenities, the most among the compared listings."
        : `Grounded advantage ${index + 1}.`,
    compromise:
      index === 1
        ? "It lists 1 fewer stored amenity than the compared listing with the most."
        : `Grounded compromise ${index + 1}.`,
  })),
  recommendation: `Choose listing ${listingIds[0]}, which has the highest existing Value Score.`,
});

let aiComparison;
let vite;

test.before(async () => {
  vite = await createServer({
    root: frontendRoot,
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    server: {
      middlewareMode: true,
      hmr: false,
    },
    optimizeDeps: {
      noDiscovery: true,
    },
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(apiBaseUrl),
    },
  });

  aiComparison = await vite.ssrLoadModule("/src/utils/aiComparison.js");
});

test.after(async () => {
  await vite?.close();
});

test("posts ordered listing IDs with the trimmed campus and normalized score weights", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const controller = new AbortController();
  const listingIds = [LISTING_ID_ONE, LISTING_ID_TWO];
  const recommendation = createRecommendation();

  globalThis.fetch = async (...args) => {
    calls.push(args);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, recommendation }),
    };
  };

  try {
    assert.deepEqual(
      await aiComparison.requestAiComparisonRecommendation(listingIds, {
        authToken: "  existing-token  ",
        signal: controller.signal,
        campus: `  ${CAMPUS}  `,
        valueScoreWeights: {
          affordability: 70,
          commute: 50,
          safety: 50,
          amenities: 30,
          ignored: 999,
        },
      }),
      recommendation,
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], `${apiBaseUrl}/api/ai/compare`);
    assert.deepEqual(calls[0][1], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer existing-token",
      },
      body: JSON.stringify({
        listingIds,
        campus: CAMPUS,
        valueScoreWeights: DEFAULT_VALUE_SCORE_WEIGHTS,
      }),
      signal: controller.signal,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("always supplies an explicit deterministic context without client-calculated scores", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const listingIds = [LISTING_ID_ONE, LISTING_ID_TWO];
  const recommendation = createRecommendation();

  globalThis.fetch = async (...args) => {
    calls.push(args);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, recommendation }),
    };
  };

  try {
    await aiComparison.requestAiComparisonRecommendation(listingIds, {
      authToken: "existing-token",
      campus: "   ",
      valueScoreWeights: {
        affordability: 0,
        commute: 0,
        safety: 0,
        amenities: 0,
      },
    });

    const body = JSON.parse(calls[0][1].body);
    assert.deepEqual(body, {
      listingIds,
      campus: null,
      valueScoreWeights: DEFAULT_VALUE_SCORE_WEIGHTS,
    });
    assert.equal("valueScore" in body, false);
    assert.equal("valueScoreBreakdown" in body, false);
    assert.equal("estimatedMonthlyCost" in body, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("accepts an exact three-listing response and preserves insight order from the backend", async () => {
  const originalFetch = globalThis.fetch;
  const listingIds = [LISTING_ID_ONE, LISTING_ID_TWO, LISTING_ID_THREE];
  const recommendation = createRecommendation([
    CANONICAL_LISTING_ID_ONE,
    LISTING_ID_TWO,
    LISTING_ID_THREE,
  ]);

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true, recommendation }),
  });

  try {
    assert.deepEqual(
      await aiComparison.requestAiComparisonRecommendation(listingIds, {
        authToken: "existing-token",
      }),
      recommendation,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects missing auth locally without reading storage or calling the backend", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("fetch should not run");
  };

  try {
    await assert.rejects(
      aiComparison.requestAiComparisonRecommendation(
        [LISTING_ID_ONE, LISTING_ID_TWO],
      ),
      (error) => {
        assert.equal(error.name, "AiComparisonError");
        assert.equal(error.code, "AI_AUTH_REQUIRED");
        assert.equal(error.status, 401);
        return true;
      },
    );
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects invalid counts, malformed IDs, and case-insensitive duplicates before fetch", async (t) => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  globalThis.fetch = async () => {
    fetchCount += 1;
    throw new Error("fetch should not run");
  };

  const cases = [
    {
      name: "one listing",
      listingIds: [LISTING_ID_ONE],
      code: "INVALID_COMPARISON_COUNT",
    },
    {
      name: "malformed listing",
      listingIds: [LISTING_ID_ONE, "not-an-object-id"],
      code: "INVALID_LISTING_ID",
    },
    {
      name: "case-insensitive duplicate",
      listingIds: [LISTING_ID_ONE, CANONICAL_LISTING_ID_ONE],
      code: "DUPLICATE_LISTING_IDS",
    },
  ];

  try {
    for (const testCase of cases) {
      await t.test(testCase.name, async () => {
        await assert.rejects(
          aiComparison.requestAiComparisonRecommendation(testCase.listingIds, {
            authToken: "existing-token",
          }),
          (error) => error.code === testCase.code,
        );
      });
    }

    assert.equal(fetchCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("validates category IDs, the exact insight ID set, text, and unknown IDs", async (t) => {
  const listingIds = [LISTING_ID_ONE, LISTING_ID_TWO];
  const cases = [
    {
      name: "unknown category ID",
      mutate: (recommendation) => {
        recommendation.bestBudget.listingId = UNKNOWN_LISTING_ID;
      },
    },
    {
      name: "duplicate insight ID",
      mutate: (recommendation) => {
        recommendation.listingInsights[1].listingId =
          CANONICAL_LISTING_ID_ONE;
      },
    },
    {
      name: "empty insight text",
      mutate: (recommendation) => {
        recommendation.listingInsights[0].advantage = "   ";
      },
    },
    {
      name: "empty final recommendation",
      mutate: (recommendation) => {
        recommendation.recommendation = "";
      },
    },
    {
      name: "unknown ID embedded in prose",
      mutate: (recommendation) => {
        recommendation.recommendation =
          `Choose listing ${UNKNOWN_LISTING_ID}.`;
      },
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, () => {
      const recommendation = createRecommendation();
      testCase.mutate(recommendation);

      assert.throws(
        () =>
          aiComparison.validateAiComparisonRecommendation(
            recommendation,
            listingIds,
          ),
        (error) => error.code === "AI_OUTPUT_INVALID",
      );
    });
  }
});

test("maps backend and local failures to concise safe retry behavior", () => {
  const cases = [
    {
      error: { code: "AI_AUTH_REQUIRED" },
      message: "Sign in to generate an AI recommendation.",
      retryable: false,
    },
    {
      error: { status: 401 },
      message: "Sign in to generate an AI recommendation.",
      retryable: false,
    },
    {
      error: { code: "AI_NOT_CONFIGURED" },
      message: "AI recommendations are temporarily unavailable.",
      retryable: true,
    },
    {
      error: { code: "AI_CONFIGURATION_INVALID" },
      message: "AI recommendations are temporarily unavailable.",
      retryable: true,
    },
    {
      error: { code: "AI_SERVICE_UNAVAILABLE" },
      message: "The AI service is unavailable right now. Please try again.",
      retryable: true,
    },
    {
      error: { code: "AI_SERVICE_TIMEOUT" },
      message: "The AI recommendation took too long. Please retry.",
      retryable: true,
    },
    {
      error: { code: "AI_OUTPUT_INVALID" },
      message: "We couldn't generate a reliable recommendation. Please try again.",
      retryable: true,
    },
    {
      error: { code: "INVALID_COMPARISON_CONTEXT" },
      message:
        "The current campus or Value Score weights cannot be used for this AI comparison.",
      retryable: false,
    },
  ];

  for (const testCase of cases) {
    assert.deepEqual(
      aiComparison.getAiComparisonErrorPresentation(testCase.error),
      {
        message: testCase.message,
        retryable: testCase.retryable,
      },
    );
    assert.equal(testCase.message.includes(testCase.error.code), false);
  }

  assert.deepEqual(
    aiComparison.getAiComparisonErrorPresentation({
      code: "LISTING_INACTIVE",
    }),
    {
      message:
        "The selected listings are no longer available for this AI comparison.",
      retryable: false,
    },
  );
});

test("replaces selected ObjectIds with titles without exposing unresolved IDs", () => {
  const text =
    `Choose listing ${CANONICAL_LISTING_ID_ONE}; compare it with ${LISTING_ID_TWO}. ` +
    `Ignore stale ${UNKNOWN_LISTING_ID}.`;

  assert.equal(
    aiComparison.formatAiComparisonText(
      text,
      new Map([
        [LISTING_ID_ONE, "Annex Student Room"],
        [LISTING_ID_TWO, "Kensington Studio"],
      ]),
    ),
    "Choose listing Annex Student Room; compare it with Kensington Studio. Ignore stale selected listing.",
  );
  assert.equal(aiComparison.formatAiComparisonText(null, {}), "");
});

test("returns only exact backend insight text that explicitly mentions amenities", () => {
  const recommendation = createRecommendation();

  assert.deepEqual(aiComparison.getAmenityInsights(recommendation), [
    {
      listingId: CANONICAL_LISTING_ID_ONE,
      type: "advantage",
      text: "It lists 3 stored amenities, the most among the compared listings.",
    },
    {
      listingId: LISTING_ID_TWO,
      type: "compromise",
      text: "It lists 1 fewer stored amenity than the compared listing with the most.",
    },
  ]);

  assert.deepEqual(
    aiComparison.getAmenityInsights({
      listingInsights: [
        {
          listingId: LISTING_ID_ONE,
          advantage: "Highest Value Score.",
          compromise: "Longer commute.",
        },
      ],
    }),
    [],
  );
});
