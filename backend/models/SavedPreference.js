const mongoose = require("mongoose");

const savedPreferenceSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      trim: true,
    },
    selectedCampusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campus",
    },
    maxBudget: Number,
    housingType: {
      type: String,
      enum: ["Apartment", "Room", "Studio", "Condo", "House"],
    },
    maxCommute: Number,
    minimumSafetyLevel: {
      type: String,
      enum: ["Low", "Medium", "High"],
    },
    weights: {
      rent:      { type: Number, default: 40 },
      commute:   { type: Number, default: 30 },
      safety:    { type: Number, default: 20 },
      amenities: { type: Number, default: 10 },
    },
    favorites: [
      {
        listingId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "HousingListing",
        },
        savedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    compareList: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "HousingListing",
      },
    ],
  },
  {
    timestamps: true,
  }
);

savedPreferenceSchema.index({ sessionId: 1 });

module.exports = mongoose.model("SavedPreference", savedPreferenceSchema);