const getCoordinateNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
};

export const isValidCoordinatePair = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return false;
  }

  const [lat, lng] = coordinates;

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

export const getValidCoordinates = (entity) => {
  const lat = getCoordinateNumber(entity?.location?.lat);
  const lng = getCoordinateNumber(entity?.location?.lng);
  const coordinates = [lat, lng];

  return isValidCoordinatePair(coordinates) ? coordinates : null;
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;

export const calculateHaversineDistanceKm = (origin, destination) => {
  if (
    !isValidCoordinatePair(origin) ||
    !isValidCoordinatePair(destination)
  ) {
    return null;
  }

  const [originLat, originLng] = origin.map(toRadians);
  const [destinationLat, destinationLng] = destination.map(toRadians);
  const latitudeDelta = destinationLat - originLat;
  const longitudeDelta = destinationLng - originLng;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLat) *
      Math.cos(destinationLat) *
      Math.sin(longitudeDelta / 2) ** 2;
  const angularDistance = 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));

  return 6371.0088 * angularDistance;
};

export const formatStraightLineDistanceKm = (distanceKm) => {
  if (
    distanceKm === null ||
    distanceKm === undefined ||
    (typeof distanceKm === "string" && distanceKm.trim() === "")
  ) {
    return "";
  }

  const distance = Number(distanceKm);

  if (!Number.isFinite(distance) || distance < 0) {
    return "";
  }

  if (distance > 0 && distance < 0.05) {
    return "<0.1 km";
  }

  return `${distance.toFixed(1)} km`;
};

const getStoredAddress = (entity) =>
  typeof entity?.address === "string" ? entity.address.trim() : "";

export const getDirectionsLocation = (entity) => {
  const coordinates = getValidCoordinates(entity);

  if (coordinates) {
    return coordinates.join(",");
  }

  return getStoredAddress(entity);
};

export const buildDirectionsUrl = (origin, destination) => {
  const originLocation = getDirectionsLocation(origin);
  const destinationLocation = getDirectionsLocation(destination);

  if (!originLocation || !destinationLocation) {
    return "";
  }

  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", originLocation);
  url.searchParams.set("destination", destinationLocation);
  url.searchParams.set("travelmode", "transit");

  return url.toString();
};

export const getSafeListingMarkerLabel = (listing, listingId = "") => {
  const rent = Number(listing?.monthlyRent ?? listing?.rent);

  if (Number.isFinite(rent) && rent >= 0) {
    return `$${Math.round(rent).toLocaleString("en-CA")}`;
  }

  const safeId = String(listingId || listing?._id || listing?.id || "").trim();
  return safeId ? `#${safeId.slice(-6)}` : "Listing";
};
