export const AUTH_TOKEN_KEY = "tshm_auth_token";
export const AUTH_USER_KEY = "tshm_auth_user";

export const housingTypes = [
  "All types",
  "Apartment",
  "Shared House",
  "Studio",
  "Basement",
  "Room Rental",
];

export const furnishedFilterOptions = ["Any", "Furnished", "Unfurnished"];

export const supportedAmenityFilters = [
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
];

export const advancedAmenityFilters = [
  "Laundry",
  "Parking",
  "Pet Friendly",
  "Kitchen",
  "Air Conditioning",
  "Nearby Transit",
];

export const safetyLevels = ["Any", "Medium+", "High Only"];

export const DEFAULT_VALUE_SCORE_WEIGHTS = {
  affordability: 35,
  commute: 25,
  safety: 25,
  amenities: 15,
};

export const defaultFormData = {
  campus: "",
  housingType: "All types",
  minRent: 500,
  maxRent: 2000,
  maxCommute: 30,
  safetyLevel: "Any",
  furnished: "Any",
  amenities: [],
  notes: "",
};

export const helpCards = [
  {
    icon: "commute",
    title: "TTC Commute Times",
    text: "Estimated transit commute to your selected campus",
    tone: "blue",
  },
  {
    icon: "safety",
    title: "Safety Data",
    text: "Neighbourhood crime statistics as relative safety indicators",
    tone: "green",
  },
  {
    icon: "browse",
    title: "Browse Results",
    text: "Responsive listing cards that summarize the key housing details",
    tone: "purple",
  },
  {
    icon: "details",
    title: "Listing Details",
    text: "Open a listing to review rent, safety, commute, and amenities",
    tone: "orange",
  },
];
