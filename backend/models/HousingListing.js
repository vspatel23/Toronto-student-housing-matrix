const mongoose = require("mongoose");

const housingListingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
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
    rent: Number,
    commuteMinutes: Number,
    safetyLevel: {
      type: String,
      enum: ["Any", "Medium+", "High Only"],
    },
    neighbourhood: {
      type: String,
      trim: true,
    },
    amenities: {
      type: [String],
      default: [],
    },
    valueScore: Number,
    latitude: Number,
    longitude: Number,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes prepare listing searches by campus, filters, and ranking.
housingListingSchema.index({ campus: 1, rent: 1 });
housingListingSchema.index({ campus: 1, commuteMinutes: 1 });
housingListingSchema.index({ campus: 1, safetyLevel: 1 });
housingListingSchema.index({ housingType: 1 });
housingListingSchema.index({ valueScore: -1 });
housingListingSchema.index({ isActive: 1, campus: 1 });

module.exports = mongoose.model("HousingListing", housingListingSchema);
