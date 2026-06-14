const mongoose = require("mongoose");

const propertyTypes = [
  "Apartment",
  "Shared House",
  "Studio",
  "Basement",
  "Room Rental",
];

const amenityValues = [
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

const housingListingSchema = new mongoose.Schema(
  {
    seedId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    neighborhood: {
      type: String,
      trim: true,
    },
    postalCode: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    monthlyRent: {
      type: Number,
      required: true,
      min: 0,
    },
    propertyType: {
      type: String,
      required: true,
      enum: propertyTypes,
      trim: true,
    },
    bedrooms: {
      type: Number,
      min: 0,
    },
    bathrooms: {
      type: Number,
      min: 0,
    },
    furnished: {
      type: Boolean,
      required: true,
      default: false,
    },
    location: {
      lat: Number,
      lng: Number,
    },
    safety: {
      safetyScore: {
        type: Number,
        min: 0,
        max: 100,
      },
      crimeRateLevel: {
        type: String,
        enum: ["Low", "Medium", "High"],
      },
      crimeRatePer1000: Number,
      dataSource: String,
    },
    commuteEstimates: [
      {
        campus: String,
        minutes: {
          type: Number,
          min: 0,
        },
        isEstimated: {
          type: Boolean,
          default: true,
        },
      },
    ],
    nearestTransit: {
      name: String,
      walkMinutes: {
        type: Number,
        min: 0,
      },
    },
    amenities: {
      type: [
        {
          type: String,
          enum: amenityValues,
        },
      ],
      default: [],
    },
    valueScore: Number,
    source: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

housingListingSchema.pre("validate", function checkLocationText(next) {
  if (!this.address && !this.neighborhood) {
    this.invalidate(
      "address",
      "A listing must include an address or neighborhood.",
    );
  }

  next();
});

housingListingSchema.index({ monthlyRent: 1 });
housingListingSchema.index({ propertyType: 1 });
housingListingSchema.index({ "safety.crimeRateLevel": 1 });
housingListingSchema.index({ isActive: 1 });
housingListingSchema.index({ "location.lat": 1, "location.lng": 1 });

module.exports = mongoose.model("HousingListing", housingListingSchema);
