const mongoose = require("mongoose");

const savedListingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HousingListing",
      required: true,
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

savedListingSchema.index({ userId: 1, listingId: 1 }, { unique: true });
savedListingSchema.index({ userId: 1, savedAt: -1 });

module.exports = mongoose.model("SavedListing", savedListingSchema);
