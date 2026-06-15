export const DATA_UNAVAILABLE = "Data unavailable";

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const normalizeText = (value) =>
  hasValue(value) ? String(value).trim() : DATA_UNAVAILABLE;

export const normalizeCampusName = (value) =>
  hasValue(value)
    ? String(value)
        .replace(/--/g, "-")
        .replace(/[—–]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
    : "";

export const formatRent = (value) => {
  const rent = Number(value);

  if (!Number.isFinite(rent) || rent < 0) {
    return DATA_UNAVAILABLE;
  }

  return `$${rent.toLocaleString("en-CA")}/mo`;
};

export const formatFurnishedStatus = (value) => {
  if (typeof value === "boolean") {
    return value ? "Furnished" : "Unfurnished";
  }

  if (hasValue(value)) {
    return String(value);
  }

  return DATA_UNAVAILABLE;
};

export const getListingTitle = (listing) =>
  normalizeText(listing?.title || listing?.name);

export const getLocationLabel = (listing) =>
  normalizeText(listing?.neighborhood || listing?.neighbourhood || listing?.address);

export const getPropertyType = (listing) =>
  normalizeText(listing?.propertyType || listing?.housingType);

export const getSafetyLevel = (listing) =>
  normalizeText(
    listing?.safety?.crimeRateLevel ||
      listing?.safetyLevel ||
      listing?.crimeRateLevel,
  );

export const getDescription = (listing) => normalizeText(listing?.description);

export const getAmenities = (listing) =>
  Array.isArray(listing?.amenities)
    ? listing.amenities.filter((amenity) => hasValue(amenity))
    : [];

export const getCommuteMinutes = (listing, campus) => {
  if (!Array.isArray(listing?.commuteEstimates)) {
    return null;
  }

  const normalizedCampus = normalizeCampusName(campus);
  const commute =
    listing.commuteEstimates.find(
      (estimate) => normalizeCampusName(estimate?.campus) === normalizedCampus,
    ) || listing.commuteEstimates[0];

  const minutes = Number(commute?.minutes);
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
};

export const formatCommute = (listing, campus) => {
  const minutes = getCommuteMinutes(listing, campus);
  return minutes === null ? DATA_UNAVAILABLE : `${minutes} min`;
};

export const getListingId = (listing) => listing?._id || listing?.id || "";
