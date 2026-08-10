const MAX_COMPARISON_CAMPUS_LENGTH = 160;

const hasAsciiControlCharacter = (value) =>
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31 || codePoint === 127;
  });

export const normalizeComparisonCampus = (campus) => {
  if (typeof campus !== "string") {
    return "";
  }

  const normalizedCampus = campus.trim();
  return normalizedCampus.length <= MAX_COMPARISON_CAMPUS_LENGTH &&
    !hasAsciiControlCharacter(normalizedCampus)
    ? normalizedCampus
    : "";
};

export const resolveComparisonCampus = ({
  routeCampus,
  hasRouteCampus = false,
  activeCampus,
} = {}) =>
  normalizeComparisonCampus(hasRouteCampus ? routeCampus : activeCampus);

export const buildComparePath = (listingIds, campus) => {
  const normalizedIds = Array.isArray(listingIds)
    ? listingIds
        .filter((listingId) => typeof listingId === "string")
        .map((listingId) => listingId.trim())
        .filter(Boolean)
    : [];
  const normalizedCampus = normalizeComparisonCampus(campus);

  return `/compare?ids=${normalizedIds.join(",")}&campus=${encodeURIComponent(
    normalizedCampus,
  )}`;
};
