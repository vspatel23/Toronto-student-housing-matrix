const hasCoordinateValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

export const getValidCoordinates = (entity) => {
  const rawLat = entity?.location?.lat;
  const rawLng = entity?.location?.lng;

  if (!hasCoordinateValue(rawLat) || !hasCoordinateValue(rawLng)) {
    return null;
  }

  const lat = Number(rawLat);
  const lng = Number(rawLng);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return [lat, lng];
};

export const getSafeListingMarkerLabel = (listing, listingId = "") => {
  const rent = Number(listing?.monthlyRent ?? listing?.rent);

  if (Number.isFinite(rent) && rent >= 0) {
    return `$${Math.round(rent).toLocaleString("en-CA")}`;
  }

  const safeId = String(listingId || listing?._id || listing?.id || "").trim();
  return safeId ? `#${safeId.slice(-6)}` : "Listing";
};
