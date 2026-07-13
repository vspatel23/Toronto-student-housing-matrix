const mongoose = require("mongoose");

const searchAnalyticsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    campus: {
      type: String,
      trim: true,
    },
    minRent: Number,
    maxRent: Number,
    housingType: {
      type: String,
      trim: true,
    },
    maxCommute: Number,
  },
  {
    timestamps: true,
  }
);

searchAnalyticsSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model("SearchAnalytics", searchAnalyticsSchema);
