const mongoose = require("mongoose");

const campusSchema = new mongoose.Schema(
  {
    campusName: {
      type: String,
      required: true,
      trim: true,
    },
    institution: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Campus", campusSchema);