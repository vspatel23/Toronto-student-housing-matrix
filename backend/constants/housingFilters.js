const defaultCampuses = require("../data/defaultCampuses");

const getCampusLabel = ({ institution, campusName }) =>
  institution === campusName
    ? institution
    : `${institution} -- ${campusName}`;

const CAMPUS_FILTER_VALUES = Object.freeze(
  defaultCampuses.map(getCampusLabel),
);

const PROPERTY_TYPE_VALUES = Object.freeze([
  "Apartment",
  "Shared House",
  "Studio",
  "Basement",
  "Room Rental",
]);

const HOUSING_TYPE_FILTER_VALUES = Object.freeze([
  "All types",
  ...PROPERTY_TYPE_VALUES,
]);

const SAFETY_FILTER_VALUES = Object.freeze([
  "Any",
  "Medium+",
  "High Only",
]);

const FURNISHING_FILTER_VALUES = Object.freeze([
  "Any",
  "Furnished",
  "Unfurnished",
]);

const AMENITY_FILTER_VALUES = Object.freeze([
  "WiFi",
  "Laundry",
  "Kitchen",
  "Parking",
  "Storage",
  "Nearby Transit",
  "Pet Friendly",
  "Backyard Access",
  "Gym",
  "Air Conditioning",
  "Utilities Included",
  "Private Bathroom",
  "Study Area",
  "Balcony",
  "Security",
]);

// These limits match the application's primary manual search controls.
const RENT_FILTER_LIMITS = Object.freeze({
  minimum: 500,
  maximum: 3000,
  step: 50,
});

const COMMUTE_FILTER_LIMITS = Object.freeze({
  minimum: 10,
  maximum: 60,
  step: 5,
});

module.exports = {
  AMENITY_FILTER_VALUES,
  CAMPUS_FILTER_VALUES,
  COMMUTE_FILTER_LIMITS,
  FURNISHING_FILTER_VALUES,
  HOUSING_TYPE_FILTER_VALUES,
  PROPERTY_TYPE_VALUES,
  RENT_FILTER_LIMITS,
  SAFETY_FILTER_VALUES,
};
