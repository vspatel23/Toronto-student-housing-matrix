import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const frontendRoot = fileURLToPath(new URL("../", import.meta.url));
const CAMPUS = "Seneca Polytechnic -- Newnham";

let comparisonContext;
let listingFormatters;
let vite;

test.before(async () => {
  vite = await createServer({
    root: frontendRoot,
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true },
  });

  comparisonContext = await vite.ssrLoadModule(
    "/src/utils/comparisonContext.js",
  );
  listingFormatters = await vite.ssrLoadModule(
    "/src/utils/listingFormatters.js",
  );
});

test.after(async () => {
  await vite?.close();
});

test("comparison paths preserve one normalized campus, including explicit no-campus", () => {
  const listingIds = [
    "64b000000000000000000001",
    "64b000000000000000000002",
  ];

  assert.equal(
    comparisonContext.buildComparePath(listingIds, `  ${CAMPUS}  `),
    `/compare?ids=${listingIds.join(",")}&campus=${encodeURIComponent(CAMPUS)}`,
  );
  assert.equal(
    comparisonContext.buildComparePath(listingIds, ""),
    `/compare?ids=${listingIds.join(",")}&campus=`,
  );
  assert.equal(
    comparisonContext.resolveComparisonCampus({
      routeCampus: "",
      hasRouteCampus: true,
      activeCampus: CAMPUS,
    }),
    "",
  );
  assert.equal(
    comparisonContext.resolveComparisonCampus({
      hasRouteCampus: false,
      activeCampus: ` ${CAMPUS} `,
    }),
    CAMPUS,
  );
  assert.equal(comparisonContext.normalizeComparisonCampus("Unsafe\nCampus"), "");
});

test("the selected campus recomputes stale saved and direct listing score data", () => {
  const staleListing = {
    _id: "64b000000000000000000001",
    monthlyRent: 780,
    amenities: ["WiFi", "Laundry", "Kitchen", "Transit", "Storage"],
    safety: { safetyScore: 63, crimeRateLevel: "Medium" },
    commuteEstimates: [
      { campus: "Toronto Metropolitan University", minutes: 33 },
      { campus: CAMPUS, minutes: 45 },
    ],
    valueScore: 78,
    valueScoreBreakdown: {
      affordability: 100,
      commute: 72,
      safety: 63,
      amenities: 63,
    },
  };

  assert.deepEqual(
    listingFormatters.getValueScoreBreakdown(staleListing, CAMPUS),
    {
      affordability: 100,
      commute: 53,
      safety: 63,
      amenities: 63,
    },
  );
  assert.equal(listingFormatters.getValueScore(staleListing, CAMPUS), 73);
  assert.equal(
    listingFormatters.getWeightedValueScore(staleListing, CAMPUS, {
      affordability: 35,
      commute: 25,
      safety: 25,
      amenities: 15,
    }),
    73,
  );

  assert.deepEqual(listingFormatters.getValueScoreBreakdown(staleListing, ""), {
    affordability: 100,
    commute: 72,
    safety: 63,
    amenities: 63,
  });
  assert.equal(listingFormatters.getValueScore(staleListing, ""), 78);
});

test("fractional comparison weights stay stable at the shared rounding boundary", () => {
  const weights = {
    affordability: 33,
    commute: 33,
    safety: 0,
    amenities: 4,
  };
  const normalizedWeights =
    listingFormatters.normalizeValueScoreWeights(weights);
  const boundaryListing = {
    monthlyRent: 2500,
    commuteEstimates: [{ campus: CAMPUS, minutes: 37.5 }],
    safety: { safetyScore: 20 },
    amenities: [],
  };

  assert.deepEqual(
    listingFormatters.getValueScoreBreakdown(boundaryListing, CAMPUS),
    { affordability: 40, commute: 65, safety: 20, amenities: 0 },
  );
  assert.deepEqual(
    listingFormatters.normalizeValueScoreWeights(normalizedWeights),
    normalizedWeights,
  );
  assert.equal(
    listingFormatters.getWeightedValueScore(
      boundaryListing,
      CAMPUS,
      weights,
    ),
    50,
  );
  assert.equal(
    listingFormatters.getWeightedValueScore(
      boundaryListing,
      CAMPUS,
      normalizedWeights,
    ),
    50,
  );
});

test("canonical Value Score weights use the same stable rounding path", () => {
  const boundaryListing = {
    monthlyRent: 2925,
    commuteEstimates: [{ campus: CAMPUS, minutes: 60 }],
    safety: { safetyScore: 2 },
    amenities: ["WiFi", "Laundry", "Kitchen", "Transit", "Storage"],
  };

  assert.deepEqual(
    listingFormatters.getValueScoreBreakdown(boundaryListing, CAMPUS),
    { affordability: 23, commute: 30, safety: 2, amenities: 63 },
  );
  assert.equal(listingFormatters.getValueScore(boundaryListing, CAMPUS), 26);
});
