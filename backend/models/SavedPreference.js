const mongoose = require("mongoose");

const savedPreferenceSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
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

// Indexes support anonymous-session lookups and future search filtering.
savedPreferenceSchema.index({ sessionId: 1, createdAt: -1 });
savedPreferenceSchema.index({ campus: 1 });
savedPreferenceSchema.index({ campus: 1, housingType: 1 });
savedPreferenceSchema.index({ campus: 1, maxRent: 1 });
savedPreferenceSchema.index({ campus: 1, maxCommute: 1 });
savedPreferenceSchema.index({ campus: 1, safetyLevel: 1 });
savedPreferenceSchema.index({ createdAt: -1 });

module.exports = mongoose.model("SavedPreference", savedPreferenceSchema);
