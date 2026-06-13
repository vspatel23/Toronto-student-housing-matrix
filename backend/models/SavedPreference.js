const mongoose = require("mongoose");

const savedPreferenceSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    selectedCampusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campus",
    },
    campus: {
      type: String,
      trim: true,
    },
    minRent: Number,
    maxRent: Number,
    maxBudget: Number,
    housingType: {
      type: String,
      enum: [
        "All types",
        "Apartment",
        "Shared House",
        "Studio",
        "Basement",
        "Room Rental",
        "Room",
        "Condo",
        "House",
      ],
    },
    maxCommute: Number,
    safetyLevel: {
      type: String,
      enum: ["Any", "Medium+", "High Only"],
      default: "Any",
    },
    minimumSafetyLevel: {
      type: String,
      enum: ["Low", "Medium", "High"],
    },
    amenities: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
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
savedPreferenceSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("SavedPreference", savedPreferenceSchema);
