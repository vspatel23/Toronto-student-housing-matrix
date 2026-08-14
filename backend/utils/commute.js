const defaultCampuses = require("../data/defaultCampuses");

const EARTH_RADIUS_KM = 6371.0088;

// This is a deterministic planning estimate, not a live TTC route. It models
// an eight-minute access/wait allowance plus travel at a blended 22 km/h and
// rounds to the nearest whole minute. Valid stored estimates remain
// authoritative; this heuristic only fills a missing campus estimate.
const COMMUTE_ESTIMATION_CONSTANTS = Object.freeze({
  accessAndWaitMinutes: 8,
  averageTransitSpeedKmPerHour: 22,
  minimumMinutes: 10,
});

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const getCampusLabel = ({ institution, campusName }) =>
  institution === campusName
    ? institution
    : `${institution} -- ${campusName}`;

const SUPPORTED_CAMPUS_LABELS = Object.freeze(
  defaultCampuses.map(getCampusLabel),
);

const normalizeCampusName = (value) =>
  hasValue(value)
    ? String(value)
        .replace(/--/g, "-")
        .replace(/[—–]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
    : "";

const isMatchingCampusName = (estimateCampus, selectedCampus) => {
  const normalizedEstimateCampus = normalizeCampusName(estimateCampus);
  const normalizedSelectedCampus = normalizeCampusName(selectedCampus);

  if (!normalizedEstimateCampus || !normalizedSelectedCampus) {
    return false;
  }

  return (
    normalizedEstimateCampus === normalizedSelectedCampus ||
    normalizedSelectedCampus.startsWith(`${normalizedEstimateCampus} -`) ||
    normalizedEstimateCampus.startsWith(`${normalizedSelectedCampus} -`)
  );
};

const resolveCampus = (campusLabel) => {
  const normalizedCampusLabel = normalizeCampusName(campusLabel);

  if (!normalizedCampusLabel) {
    return null;
  }

  const exactMatch = defaultCampuses.find(
    (campus) =>
      normalizeCampusName(getCampusLabel(campus)) === normalizedCampusLabel,
  );

  if (exactMatch) {
    return exactMatch;
  }

  const compatibleMatches = defaultCampuses.filter((campus) =>
    isMatchingCampusName(getCampusLabel(campus), campusLabel),
  );

  return compatibleMatches.length === 1 ? compatibleMatches[0] : null;
};

const toCoordinateNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
};

const isValidCoordinatePair = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return false;
  }

  const [lat, lng] = coordinates;

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0 &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

const getValidCoordinates = (entity) => {
  const lat = toCoordinateNumber(entity?.location?.lat);
  const lng = toCoordinateNumber(entity?.location?.lng);
  const coordinates = [lat, lng];

  return isValidCoordinatePair(coordinates) ? coordinates : null;
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const calculateHaversineDistanceKm = (origin, destination) => {
  if (!isValidCoordinatePair(origin) || !isValidCoordinatePair(destination)) {
    return null;
  }

  const [originLat, originLng] = origin;
  const [destinationLat, destinationLng] = destination;

  const originLatitude = toRadians(originLat);
  const destinationLatitude = toRadians(destinationLat);
  const latitudeDelta = destinationLatitude - originLatitude;
  const longitudeDelta = toRadians(destinationLng - originLng);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const angularDistance = 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));

  return EARTH_RADIUS_KM * angularDistance;
};

const estimateCommuteMinutesFromDistance = (distanceKm) => {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return null;
  }

  const travelMinutes =
    (distanceKm /
      COMMUTE_ESTIMATION_CONSTANTS.averageTransitSpeedKmPerHour) *
    60;
  const estimatedMinutes = Math.round(
    COMMUTE_ESTIMATION_CONSTANTS.accessAndWaitMinutes + travelMinutes,
  );

  return Math.max(
    COMMUTE_ESTIMATION_CONSTANTS.minimumMinutes,
    estimatedMinutes,
  );
};

const getValidCommuteMinutes = (value) => {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    !hasValue(value)
  ) {
    return null;
  }

  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
};

const getStoredCommuteEstimate = (listing, campusLabel) => {
  if (!Array.isArray(listing?.commuteEstimates)) {
    return null;
  }

  for (const estimate of listing.commuteEstimates) {
    const estimateCampus = resolveCampus(estimate?.campus);

    if (
      !estimateCampus ||
      normalizeCampusName(getCampusLabel(estimateCampus)) !==
        normalizeCampusName(campusLabel)
    ) {
      continue;
    }

    const minutes = getValidCommuteMinutes(estimate?.minutes);

    if (minutes !== null) {
      return {
        campus: String(estimate.campus).trim(),
        minutes,
        isEstimated:
          typeof estimate.isEstimated === "boolean"
            ? estimate.isEstimated
            : true,
      };
    }
  }

  return null;
};

const getCommuteEstimate = (listing, campusLabel) => {
  const campus = resolveCampus(campusLabel);

  if (!campus) {
    return null;
  }

  const canonicalCampusLabel = getCampusLabel(campus);
  const storedEstimate = getStoredCommuteEstimate(
    listing,
    canonicalCampusLabel,
  );

  if (storedEstimate) {
    return storedEstimate;
  }

  const listingCoordinates = getValidCoordinates(listing);
  const campusCoordinates = getValidCoordinates(campus);

  if (!listingCoordinates || !campusCoordinates) {
    return null;
  }

  const distanceKm = calculateHaversineDistanceKm(
    listingCoordinates,
    campusCoordinates,
  );
  const minutes = estimateCommuteMinutesFromDistance(distanceKm);

  return minutes === null
    ? null
    : {
        campus: canonicalCampusLabel,
        minutes,
        isEstimated: true,
      };
};

const getCommuteMinutes = (listing, campusLabel) =>
  getCommuteEstimate(listing, campusLabel)?.minutes ?? null;

const normalizeListingCommuteEstimates = (listing) =>
  SUPPORTED_CAMPUS_LABELS.map((campusLabel) =>
    getCommuteEstimate(listing, campusLabel),
  ).filter(Boolean);

const enrichListingCommuteEstimates = (listing) => ({
  ...listing,
  commuteEstimates: normalizeListingCommuteEstimates(listing),
});

module.exports = {
  COMMUTE_ESTIMATION_CONSTANTS,
  SUPPORTED_CAMPUS_LABELS,
  calculateHaversineDistanceKm,
  enrichListingCommuteEstimates,
  estimateCommuteMinutesFromDistance,
  getCommuteEstimate,
  getCommuteMinutes,
  getValidCommuteMinutes,
  getValidCoordinates,
  isValidCoordinatePair,
  isMatchingCampusName,
  normalizeCampusName,
  normalizeListingCommuteEstimates,
  resolveCampus,
};
