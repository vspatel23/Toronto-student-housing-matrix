const mongoose = require("mongoose");

const savedPreferenceSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    campus: {
      type: String,
      trim: true,
    },
    housingType: {
      type: String,
      trim: true,
    },
    minRent: Number,
    maxRent: Number,
    maxCommute: Number,
    safetyLevel: {
      type: String,
      enum: ["Any", "Medium+", "High Only"],
      default: "Any",
    },
    amenities: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("SavedPreference", savedPreferenceSchema);
