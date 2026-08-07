const mongoose = require("mongoose");
const {
  AMENITY_FILTER_VALUES,
  PROPERTY_TYPE_VALUES,
} = require("../constants/housingFilters");
const {
  isAllowedListingImageSource,
  MAX_IMAGE_ALT_LENGTH,
  MIN_IMAGE_ALT_LENGTH,
  prepareListingImagesForStorage,
} = require("../utils/listingImages");

const listingImageSchema = new mongoose.Schema(
  {
    src: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: isAllowedListingImageSource,
        message:
          "Image src must be an approved /images/listings/ path or an HTTPS URL.",
      },
    },
    alt: {
      type: String,
      required: true,
      trim: true,
      minlength: MIN_IMAGE_ALT_LENGTH,
      maxlength: MAX_IMAGE_ALT_LENGTH,
    },
    order: {
      type: Number,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Image order must be a non-negative integer.",
      },
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    width: {
      type: Number,
      min: 1,
      validate: {
        validator: (value) => value == null || Number.isInteger(value),
        message: "Image width must be a positive integer.",
      },
    },
    height: {
      type: Number,
      min: 1,
      validate: {
        validator: (value) => value == null || Number.isInteger(value),
        message: "Image height must be a positive integer.",
      },
    },
  },
  { _id: false },
);

const housingListingSchema = new mongoose.Schema(
  {
    seedId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
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
    description: {
      type: String,
      trim: true,
    },
    monthlyRent: {
      type: Number,
      required: true,
      min: 0,
    },
    propertyType: {
      type: String,
      required: true,
      enum: PROPERTY_TYPE_VALUES,
      trim: true,
    },
    bedrooms: {
      type: Number,
      min: 0,
    },
    bathrooms: {
      type: Number,
      min: 0,
    },
    furnished: {
      type: Boolean,
      required: true,
      default: false,
    },
    location: {
      lat: Number,
      lng: Number,
    },
    safety: {
      safetyScore: {
        type: Number,
        min: 0,
        max: 100,
      },
      crimeRateLevel: {
        type: String,
        enum: ["Low", "Medium", "High"],
      },
      crimeRatePer1000: Number,
      dataSource: String,
    },
    commuteEstimates: [
      {
        campus: String,
        minutes: {
          type: Number,
          min: 0,
        },
        isEstimated: {
          type: Boolean,
          default: true,
        },
      },
    ],
    nearestTransit: {
      name: String,
      walkMinutes: {
        type: Number,
        min: 0,
      },
    },
    amenities: {
      type: [
        {
          type: String,
          enum: AMENITY_FILTER_VALUES,
        },
      ],
      default: [],
    },
    images: {
      type: [listingImageSchema],
      default: undefined,
      validate: {
        validator(images) {
          if (!Array.isArray(images)) {
            return true;
          }

          const orders = images
            .map((image) => image.order)
            .filter((order) => order !== undefined && order !== null);
          const primaryCount = images.filter(
            (image) => image.isPrimary === true,
          ).length;

          return (
            new Set(orders).size === orders.length &&
            primaryCount <= 1
          );
        },
        message:
          "Listing images must use unique order values and include no more than one primary image.",
      },
    },
    valueScore: Number,
    source: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

housingListingSchema.pre("validate", function normalizeImages() {
  try {
    if (this.images !== undefined) {
      this.images = prepareListingImagesForStorage(this.images, {
        context: `Listing ${this.seedId || this.title || this._id || "unknown"}`,
      });
    }
  } catch (error) {
    this.invalidate("images", error.message);
  }

});

housingListingSchema.pre("validate", function checkLocationText() {
  if (!this.address && !this.neighborhood) {
    this.invalidate(
      "address",
      "A listing must include an address or neighborhood.",
    );
  }
});

housingListingSchema.index({ monthlyRent: 1 });
housingListingSchema.index({ propertyType: 1 });
housingListingSchema.index({ "safety.crimeRateLevel": 1 });
housingListingSchema.index({ isActive: 1 });
housingListingSchema.index({ "location.lat": 1, "location.lng": 1 });

module.exports = mongoose.model("HousingListing", housingListingSchema);
