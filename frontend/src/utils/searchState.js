import {
  furnishedFilterOptions,
  housingTypes,
  safetyLevels,
  supportedAmenityFilters,
} from "./constants";

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const toOptionalNumber = (value) => {
  if (!hasValue(value)) {
    return "";
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : "";
};

const normalizeAmenities = (amenities) => {
  if (!Array.isArray(amenities)) {
    return [];
  }

  return Array.from(
    new Set(
      amenities.filter((amenity) => supportedAmenityFilters.includes(amenity)),
    ),
  );
};

const getComparableAmenities = (search) =>
  normalizeAmenities(search?.amenities).sort().join("|");

export const createDefaultResultsFilters = () => ({
  minRent: "",
  maxRent: "",
  housingType: "All types",
  safetyLevel: "Any",
  maxCommute: "",
  furnished: "Any",
  amenities: [],
});

export const mapAiFiltersToSearchState = (filters = {}) => ({
  campus: typeof filters.campus === "string" ? filters.campus : "",
  minRent: toOptionalNumber(filters.minRent),
  maxRent: toOptionalNumber(filters.maxRent),
  housingType: housingTypes.includes(filters.housingType)
    ? filters.housingType
    : "All types",
  maxCommute: toOptionalNumber(filters.maxCommute),
  safetyLevel: safetyLevels.includes(filters.safetyLevel)
    ? filters.safetyLevel
    : "Any",
  furnished: furnishedFilterOptions.includes(filters.furnished)
    ? filters.furnished
    : "Any",
  amenities: normalizeAmenities(filters.amenities),
  notes: "",
});

export const createResultsFiltersFromSearch = (search = {}) => ({
  ...createDefaultResultsFilters(),
  minRent: toOptionalNumber(search.minRent),
  maxRent: toOptionalNumber(search.maxRent),
  housingType: housingTypes.includes(search.housingType)
    ? search.housingType
    : "All types",
  maxCommute: toOptionalNumber(search.maxCommute),
  furnished: furnishedFilterOptions.includes(search.furnished)
    ? search.furnished
    : "Any",
  amenities: normalizeAmenities(search.amenities),
  // Aggregate values such as Medium+ are applied by the listings endpoint.
  // BrowseResults expects exact Low/Medium/High values, so it must stay neutral.
  safetyLevel: "Any",
});

export const buildSearchQueryString = (searchData) => {
  if (!searchData) {
    return "";
  }

  const params = new URLSearchParams();

  if (hasValue(searchData.campus)) {
    params.set("campus", searchData.campus);
  }
  if (hasValue(searchData.minRent)) {
    params.set("minRent", searchData.minRent);
  }
  if (hasValue(searchData.maxRent)) {
    params.set("maxRent", searchData.maxRent);
  }
  if (searchData.housingType && searchData.housingType !== "All types") {
    params.set("housingType", searchData.housingType);
  }
  if (searchData.safetyLevel && searchData.safetyLevel !== "Any") {
    params.set("safetyLevel", searchData.safetyLevel);
  }
  if (hasValue(searchData.maxCommute)) {
    params.set("maxCommute", searchData.maxCommute);
  }
  if (searchData.furnished && searchData.furnished !== "Any") {
    params.set("furnished", searchData.furnished);
  }

  normalizeAmenities(searchData.amenities).forEach((amenity) => {
    params.append("amenity", amenity);
  });

  return params.toString();
};

export const buildResultsPath = (searchData) => {
  const queryString = buildSearchQueryString(searchData);
  return queryString ? `/results?${queryString}` : "/results";
};

export const parseSearchFromQuery = (searchParams) => {
  const supportedKeys = [
    "campus",
    "minRent",
    "maxRent",
    "housingType",
    "safetyLevel",
    "maxCommute",
    "furnished",
    "amenity",
  ];

  if (!supportedKeys.some((key) => searchParams.has(key))) {
    return null;
  }

  const housingType = searchParams.get("housingType") || "All types";
  const safetyLevel = searchParams.get("safetyLevel") || "Any";
  const furnished = searchParams.get("furnished") || "Any";

  return {
    campus: searchParams.get("campus") || "",
    minRent: toOptionalNumber(searchParams.get("minRent")),
    maxRent: toOptionalNumber(searchParams.get("maxRent")),
    maxCommute: toOptionalNumber(searchParams.get("maxCommute")),
    housingType: housingTypes.includes(housingType)
      ? housingType
      : "All types",
    safetyLevel: safetyLevels.includes(safetyLevel) ? safetyLevel : "Any",
    furnished: furnishedFilterOptions.includes(furnished) ? furnished : "Any",
    amenities: normalizeAmenities(searchParams.getAll("amenity")),
    notes: "",
  };
};

export const isSameSearch = (first, second) =>
  Boolean(first) &&
  Boolean(second) &&
  (first.campus || "") === (second.campus || "") &&
  toOptionalNumber(first.minRent) === toOptionalNumber(second.minRent) &&
  toOptionalNumber(first.maxRent) === toOptionalNumber(second.maxRent) &&
  toOptionalNumber(first.maxCommute) ===
    toOptionalNumber(second.maxCommute) &&
  (first.housingType || "All types") ===
    (second.housingType || "All types") &&
  (first.safetyLevel || "Any") === (second.safetyLevel || "Any") &&
  (first.furnished || "Any") === (second.furnished || "Any") &&
  getComparableAmenities(first) === getComparableAmenities(second);

export const getListingQueryParams = (searchData = {}) => ({
  campus: searchData.campus,
  minRent: searchData.minRent,
  maxRent: searchData.maxRent,
  propertyType:
    searchData.housingType === "All types" ? "" : searchData.housingType,
  safetyLevel:
    searchData.safetyLevel === "Any" ? "" : searchData.safetyLevel,
});
