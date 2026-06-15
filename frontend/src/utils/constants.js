export const AUTH_TOKEN_KEY = "tshm_auth_token";
export const AUTH_USER_KEY = "tshm_auth_user";

export const campuses = [
  "University of Toronto -- St. George",
  "University of Toronto -- Scarborough",
  "University of Toronto -- Mississauga",
  "Toronto Metropolitan University",
  "York University",
  "Seneca Polytechnic",
];

export const housingTypes = [
  "All types",
  "Apartment",
  "Shared House",
  "Studio",
  "Basement",
  "Room Rental",
];

export const safetyLevels = ["Any", "Medium+", "High Only"];

export const defaultFormData = {
  campus: "",
  housingType: "All types",
  minRent: 500,
  maxRent: 2000,
  maxCommute: 30,
  safetyLevel: "Any",
  amenities: [],
  notes: "",
};

export const helpCards = [
  {
    icon: "◷",
    title: "TTC Commute Times",
    text: "Estimated transit commute to your selected campus",
    tone: "blue",
  },
  {
    icon: "⌂",
    title: "Safety Data",
    text: "Neighbourhood crime statistics as relative safety indicators",
    tone: "green",
  },
  {
    icon: "☷",
    title: "Browse Results",
    text: "Responsive listing cards that summarize the key housing details",
    tone: "purple",
  },
  {
    icon: "⌖",
    title: "Listing Details",
    text: "Open a listing to review rent, safety, commute, and amenities",
    tone: "orange",
  },
];
