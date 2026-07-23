const mongoose = require("mongoose");

const collectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    listingIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "HousingListing",
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

collectionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Collection", collectionSchema);
