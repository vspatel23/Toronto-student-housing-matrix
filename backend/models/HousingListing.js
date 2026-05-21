const mongoose = require("mongoose");

const housingListingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
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
    monthlyRent: {
      type: Number,
    },
    propertyType: {
      type: String,
      enum: ["Apartment", "Room", "Studio", "Condo", "House"],
      trim: true,
    },
    bedrooms: Number,
    bathrooms: Number,
    furnished: {
      type: Boolean,
      default: false,
    },
    location: {
      lat: Number,
      lng: Number,
    },
    safety: {
      safetyScore: Number,
      crimeRateLevel: {
        type: String,
        enum: ["Low", "Medium", "High"],
      },
      crimeRatePer1000: Number,
      dataSource: {
        type: String,
        default: "TPS Open Data",
      },
    },
    transitStops: [
      {
        stopName: String,
        walkMinutes: Number,
      },
    ],
    amenities: {
      type: [String],
      default: [],
    },
    valueScore: Number,
    source: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

housingListingSchema.index({ monthlyRent: 1 });
housingListingSchema.index({ propertyType: 1 });
housingListingSchema.index({ "safety.crimeRateLevel": 1 });
housingListingSchema.index({ valueScore: -1 });
housingListingSchema.index({ isActive: 1 });
housingListingSchema.index({ "location.lat": 1, "location.lng": 1 });

module.exports = mongoose.model("HousingListing", housingListingSchema);