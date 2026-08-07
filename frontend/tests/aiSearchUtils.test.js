import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const frontendRoot = fileURLToPath(new URL("../", import.meta.url));
const apiBaseUrl = "https://api.example.test";

let aiSearch;
let searchState;
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

  [aiSearch, searchState] = await Promise.all([
    vite.ssrLoadModule("/src/utils/aiSearch.js"),
    vite.ssrLoadModule("/src/utils/searchState.js"),
  ]);
});

test.after(async () => {
  await vite?.close();
});

test("maps an all-null AI response to neutral manual-search state", () => {
  assert.deepEqual(
    searchState.mapAiFiltersToSearchState({
      campus: null,
      minRent: null,
      maxRent: null,
      housingType: null,
      maxCommute: null,
      safetyLevel: null,
      furnished: null,
      amenities: [],
    }),
    {
      campus: "",
      minRent: "",
      maxRent: "",
      housingType: "All types",
      maxCommute: "",
      safetyLevel: "Any",
      furnished: "Any",
      amenities: [],
      notes: "",
    },
  );
});

test("keeps supported AI filters while sanitizing invalid values", () => {
  assert.deepEqual(
    searchState.mapAiFiltersToSearchState({
      campus: "Toronto Metropolitan University",
      minRent: "1200",
      maxRent: Number.POSITIVE_INFINITY,
      housingType: "Apartment",
      maxCommute: "30",
      safetyLevel: "Medium+",
      furnished: "Furnished",
      amenities: ["WiFi", "Swimming Pool", "Laundry", "WiFi", null],
    }),
    {
      campus: "Toronto Metropolitan University",
      minRent: 1200,
      maxRent: "",
      housingType: "Apartment",
      maxCommute: 30,
      safetyLevel: "Medium+",
      furnished: "Furnished",
      amenities: ["WiFi", "Laundry"],
      notes: "",
    },
  );

  assert.deepEqual(
    searchState.mapAiFiltersToSearchState({
      housingType: "Luxury Castle",
      safetyLevel: "Perfectly Safe",
      furnished: "Partially Furnished",
      amenities: "WiFi",
    }),
    {
      campus: "",
      minRent: "",
      maxRent: "",
      housingType: "All types",
      maxCommute: "",
      safetyLevel: "Any",
      furnished: "Any",
      amenities: [],
      notes: "",
    },
  );
});

test("creates safe results filters with neutral client safety filtering", () => {
  assert.deepEqual(
    searchState.createResultsFiltersFromSearch({
      minRent: "900",
      maxRent: "1800",
      housingType: "Apartment",
      maxCommute: "30",
      safetyLevel: "High Only",
      furnished: "Furnished",
      amenities: ["Laundry", "Unsupported", "Laundry", "WiFi"],
    }),
    {
      minRent: 900,
      maxRent: 1800,
      housingType: "Apartment",
      safetyLevel: "Any",
      maxCommute: 30,
      furnished: "Furnished",
      amenities: ["Laundry", "WiFi"],
    },
  );
});

test("maps housingType to the existing listings propertyType parameter", () => {
  assert.deepEqual(
    searchState.getListingQueryParams({
      campus: "York University",
      minRent: 1000,
      maxRent: 1600,
      housingType: "Shared House",
      safetyLevel: "Medium+",
    }),
    {
      campus: "York University",
      minRent: 1000,
      maxRent: 1600,
      propertyType: "Shared House",
      safetyLevel: "Medium+",
    },
  );

  assert.equal(
    searchState.getListingQueryParams({ housingType: "All types" })
      .propertyType,
    "",
  );
});

test("round-trips campus-less searches, furnishing, repeated amenities, and numeric zero", () => {
  const original = {
    campus: "",
    minRent: 0,
    maxRent: 1800,
    housingType: "Apartment",
    safetyLevel: "Medium+",
    maxCommute: 0,
    furnished: "Furnished",
    amenities: ["WiFi", "Laundry", "WiFi"],
  };

  const queryString = searchState.buildSearchQueryString(original);
  const query = new URLSearchParams(queryString);

  assert.equal(query.has("campus"), false);
  assert.equal(query.get("minRent"), "0");
  assert.equal(query.get("maxCommute"), "0");
  assert.equal(query.get("furnished"), "Furnished");
  assert.deepEqual(query.getAll("amenity"), ["WiFi", "Laundry"]);

  assert.deepEqual(searchState.parseSearchFromQuery(query), {
    campus: "",
    minRent: 0,
    maxRent: 1800,
    maxCommute: 0,
    housingType: "Apartment",
    safetyLevel: "Medium+",
    furnished: "Furnished",
    amenities: ["WiFi", "Laundry"],
    notes: "",
  });
});

test("returns no parsed search when the URL has no supported search keys", () => {
  assert.equal(
    searchState.parseSearchFromQuery(
      new URLSearchParams("unrelated=value&another=value"),
    ),
    null,
  );
});

test("presents friendly retryable messages for temporary AI failures", () => {
  for (const code of [
    "AI_SERVICE_TIMEOUT",
    "AI_SERVICE_UNAVAILABLE",
    "AI_OUTPUT_INVALID",
  ]) {
    const presentation = aiSearch.getAiSearchErrorPresentation({ code });

    assert.equal(presentation.retryable, true, code);
    assert.equal(presentation.message.includes(code), false, code);
    assert.match(presentation.message, /description has been kept|search response/);
  }

  assert.deepEqual(
    aiSearch.getAiSearchErrorPresentation({ code: "DESCRIPTION_TOO_LONG" }),
    {
      message: "Keep your description to 1500 characters or fewer.",
      retryable: false,
    },
  );
});

test("does not classify configuration or input errors as retryable", () => {
  for (const code of [
    "INVALID_DESCRIPTION",
    "DESCRIPTION_TOO_LONG",
    "AI_NOT_CONFIGURED",
    "AI_CONFIGURATION_INVALID",
  ]) {
    const presentation = aiSearch.getAiSearchErrorPresentation({ code });

    assert.equal(presentation.retryable, false, code);
    assert.equal(presentation.message.includes(code), false, code);
  }

  assert.deepEqual(aiSearch.getAiSearchErrorPresentation(new Error("boom")), {
    message:
      "We couldn't process your search right now. Your description has been kept.",
    retryable: true,
  });
});

test("posts the exact AI search request and returns extracted filters", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const filters = {
    campus: "Toronto Metropolitan University",
    minRent: 1200,
    maxRent: 1800,
    housingType: "Apartment",
    maxCommute: 30,
    safetyLevel: null,
    furnished: "Furnished",
    amenities: ["WiFi", "Laundry"],
  };

  globalThis.fetch = async (...args) => {
    calls.push(args);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, filters }),
    };
  };

  try {
    const description =
      "A furnished apartment near TMU with WiFi and laundry.";

    assert.deepEqual(
      await aiSearch.requestAiSearchFilters(description),
      filters,
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], `${apiBaseUrl}/api/ai/search`);
    assert.deepEqual(calls[0][1], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description }),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("preserves backend AI error code, safe message, and HTTP status", async () => {
  const originalFetch = globalThis.fetch;
  const responseBody = {
    success: false,
    error: {
      code: "AI_SERVICE_UNAVAILABLE",
      message: "AI service is temporarily unavailable.",
    },
  };

  globalThis.fetch = async () => ({
    ok: false,
    status: 503,
    text: async () => JSON.stringify(responseBody),
  });

  try {
    await assert.rejects(
      aiSearch.requestAiSearchFilters("Find a furnished apartment near TMU."),
      (error) => {
        assert.equal(error.name, "ApiRequestError");
        assert.equal(error.code, "AI_SERVICE_UNAVAILABLE");
        assert.equal(error.status, 503);
        assert.equal(
          error.message,
          `API request failed: ${apiBaseUrl}/api/ai/search. HTTP 503 - AI service is temporarily unavailable.`,
        );
        assert.deepEqual(error.data, responseBody);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
