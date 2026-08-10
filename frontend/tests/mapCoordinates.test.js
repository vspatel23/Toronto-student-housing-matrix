import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDirectionsUrl,
  calculateHaversineDistanceKm,
  formatStraightLineDistanceKm,
  getDirectionsLocation,
  getValidCoordinates,
  isValidCoordinatePair,
} from "../src/utils/mapCoordinates.js";

const listing = {
  address: "184 Jarvis Street, Toronto, ON",
  location: { lat: 43.6567, lng: -79.3749 },
};
const campus = {
  address: "350 Victoria Street, Toronto, ON",
  location: { lat: 43.6577, lng: -79.3788 },
};

test("validates the established location.lat and location.lng shape", () => {
  assert.deepEqual(getValidCoordinates(listing), [43.6567, -79.3749]);
  assert.deepEqual(
    getValidCoordinates({ location: { lat: " 43.6577 ", lng: "-79.3788" } }),
    [43.6577, -79.3788],
  );
  assert.equal(isValidCoordinatePair([-90, -180]), true);
  assert.equal(isValidCoordinatePair([90, 180]), true);
});

test("rejects absent, non-numeric, boolean, non-finite, and out-of-range coordinates", () => {
  [
    null,
    {},
    { location: { lat: null, lng: -79 } },
    { location: { lat: "", lng: -79 } },
    { location: { lat: false, lng: -79 } },
    { location: { lat: Number.NaN, lng: -79 } },
    { location: { lat: 91, lng: -79 } },
    { location: { lat: 43, lng: -181 } },
  ].forEach((value) => assert.equal(getValidCoordinates(value), null));
});

test("calculates the expected Haversine distance and is symmetric", () => {
  const listingCoordinates = getValidCoordinates(listing);
  const campusCoordinates = getValidCoordinates(campus);
  const forward = calculateHaversineDistanceKm(
    listingCoordinates,
    campusCoordinates,
  );
  const reverse = calculateHaversineDistanceKm(
    campusCoordinates,
    listingCoordinates,
  );

  assert.ok(Math.abs(forward - 0.332867) < 0.00001);
  assert.ok(Math.abs(forward - reverse) < Number.EPSILON);
  assert.equal(formatStraightLineDistanceKm(forward), "0.3 km");
});

test("handles identical and invalid Haversine inputs safely", () => {
  assert.equal(
    calculateHaversineDistanceKm([43.65, -79.38], [43.65, -79.38]),
    0,
  );
  assert.equal(calculateHaversineDistanceKm(null, [43.65, -79.38]), null);
  assert.equal(formatStraightLineDistanceKm(0), "0.0 km");
  assert.equal(formatStraightLineDistanceKm(0.02), "<0.1 km");
  assert.equal(formatStraightLineDistanceKm(null), "");
  assert.equal(formatStraightLineDistanceKm(-1), "");
});

test("builds a key-free transit directions URL from validated coordinates", () => {
  const directionsUrl = new URL(buildDirectionsUrl(listing, campus));

  assert.equal(directionsUrl.origin, "https://www.google.com");
  assert.equal(directionsUrl.pathname, "/maps/dir/");
  assert.equal(directionsUrl.searchParams.get("api"), "1");
  assert.equal(directionsUrl.searchParams.get("origin"), "43.6567,-79.3749");
  assert.equal(
    directionsUrl.searchParams.get("destination"),
    "43.6577,-79.3788",
  );
  assert.equal(directionsUrl.searchParams.get("travelmode"), "transit");
  assert.equal(directionsUrl.searchParams.has("key"), false);
});

test("safely encodes stored-address fallbacks without inventing a destination", () => {
  const addressOnlyListing = {
    address: "12 King's College Circle & College Street, Toronto, ON",
  };
  const addressOnlyCampus = {
    address: "Campus Centre, 100 University Ave #2, Toronto, ON",
  };
  const urlText = buildDirectionsUrl(addressOnlyListing, addressOnlyCampus);
  const directionsUrl = new URL(urlText);

  assert.match(urlText, /King%27s\+College\+Circle/);
  assert.match(urlText, /%26\+College\+Street/);
  assert.equal(
    directionsUrl.searchParams.get("origin"),
    addressOnlyListing.address,
  );
  assert.equal(
    directionsUrl.searchParams.get("destination"),
    addressOnlyCampus.address,
  );
  assert.equal(getDirectionsLocation({ address: "  10 Bay Street  " }), "10 Bay Street");
  assert.equal(buildDirectionsUrl({}, addressOnlyCampus), "");
  assert.equal(buildDirectionsUrl(addressOnlyListing, {}), "");
});
