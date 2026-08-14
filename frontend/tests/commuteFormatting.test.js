import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const frontendRoot = fileURLToPath(new URL("../", import.meta.url));
const CAMPUS = "Seneca Polytechnic -- Newnham";

let formatters;
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

  formatters = await vite.ssrLoadModule("/src/utils/listingFormatters.js");
});

test.after(async () => {
  await vite?.close();
});

test("formats normalized numeric and numeric-string commute estimates", () => {
  const numericListing = {
    commuteEstimates: [{ campus: "Seneca Polytechnic - Newnham", minutes: 24 }],
  };
  const stringListing = {
    commuteEstimates: [{ campus: CAMPUS, minutes: " 31 " }],
  };

  assert.equal(formatters.getCommuteMinutes(numericListing, CAMPUS), 24);
  assert.equal(formatters.formatCommute(numericListing, CAMPUS), "24 min");
  assert.equal(formatters.getCommuteMinutes(stringListing, CAMPUS), 31);
  assert.equal(formatters.formatCommute(stringListing, CAMPUS), "31 min");
});

test("keeps a genuine zero-minute estimate valid", () => {
  const listing = {
    commuteEstimates: [{ campus: CAMPUS, minutes: 0 }],
  };

  assert.equal(formatters.getCommuteMinutes(listing, CAMPUS), 0);
  assert.equal(formatters.formatCommute(listing, CAMPUS), "0 min");
});

test("requires an explicitly selected matching campus", () => {
  const listing = {
    commuteEstimates: [{ campus: CAMPUS, minutes: 24 }],
  };

  assert.equal(formatters.getCommuteMinutes(listing, ""), null);
  assert.equal(formatters.getCommuteMinutes(listing), null);
  assert.equal(formatters.getCommuteMinutes(listing, "Unknown Campus"), null);
  assert.equal(formatters.formatCommute(listing, ""), "Data unavailable");
  assert.equal(
    formatters.formatCommute(listing, "Unknown Campus"),
    "Data unavailable",
  );
});

test("rejects an ambiguous institution label instead of choosing its first campus", () => {
  const listing = {
    commuteEstimates: [
      { campus: "University of Toronto -- St. George", minutes: 18 },
      { campus: "University of Toronto -- Scarborough", minutes: 42 },
      { campus: "University of Toronto -- Mississauga", minutes: 55 },
    ],
  };

  assert.equal(
    formatters.getCommuteMinutes(listing, "University of Toronto"),
    null,
  );
  assert.equal(
    formatters.formatCommute(listing, "University of Toronto"),
    "Data unavailable",
  );
});

test("rejects missing and malformed commute values instead of coercing them to zero", () => {
  const invalidMinutes = [
    undefined,
    null,
    "",
    "   ",
    false,
    true,
    "not-a-number",
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1,
  ];

  invalidMinutes.forEach((minutes) => {
    const listing = {
      commuteEstimates: [{ campus: CAMPUS, minutes }],
    };

    assert.equal(formatters.getCommuteMinutes(listing, CAMPUS), null);
    assert.equal(
      formatters.formatCommute(listing, CAMPUS),
      "Data unavailable",
    );
  });
});

test("handles missing and malformed commute collections safely", () => {
  [
    null,
    {},
    { commuteEstimates: null },
    { commuteEstimates: {} },
    { commuteEstimates: [null] },
  ].forEach((listing) => {
    assert.equal(formatters.getCommuteMinutes(listing, CAMPUS), null);
    assert.equal(
      formatters.formatCommute(listing, CAMPUS),
      "Data unavailable",
    );
  });
});
