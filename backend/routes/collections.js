const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");

const authenticateUser = require("../middleware/auth");
const Collection = require("../models/Collection");
const HousingListing = require("../models/HousingListing");
const {
  calculateValueScore,
  calculateValueScoreBreakdown,
} = require("../utils/valueScore");

const router = express.Router();

const LISTING_FIELDS =
  "_id title address neighborhood postalCode description monthlyRent propertyType bedrooms bathrooms furnished location safety commuteEstimates nearestTransit amenities valueScore source isActive";

const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 300;

const serializeCollectionSummary = (collection, previewTitle) => ({
  _id: collection._id,
  name: collection.name,
  description: collection.description,
  listingCount: collection.listingIds.length,
  previewTitle,
  createdAt: collection.createdAt,
  updatedAt: collection.updatedAt,
});

const parseCollectionInput = (req) => {
  const errors = [];
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const description =
    typeof req.body.description === "string"
      ? req.body.description.trim()
      : "";

  if (!name) {
    errors.push("Collection name is required.");
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.push(
      `Collection name must be ${MAX_NAME_LENGTH} characters or fewer.`,
    );
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(
      `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`,
    );
  }

  return { name, description, errors };
};

// Public, unauthenticated: looks up a collection by its opaque share
// token instead of ownership, and returns only read-only fields — no
// userId or other account information is ever included in the response.
router.get("/shared/:token", async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || typeof token !== "string") {
      return res.status(404).json({
        success: false,
        message: "This shared collection is unavailable.",
      });
    }

    const collection = await Collection.findOne({ shareToken: token }).populate(
      { path: "listingIds", select: LISTING_FIELDS },
    );

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "This shared collection is unavailable.",
      });
    }

    const listings = collection.listingIds
      .filter(Boolean)
      .map((listing) => {
        const listingObject = listing.toObject();

        return {
          ...listingObject,
          valueScore: calculateValueScore(listingObject, req.query.campus),
          valueScoreBreakdown: calculateValueScoreBreakdown(
            listingObject,
            req.query.campus,
          ),
        };
      });

    return res.json({
      success: true,
      collection: {
        name: collection.name,
        description: collection.description,
      },
      listings,
    });
  } catch (error) {
    console.error("Failed to load shared collection:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while loading shared collection",
    });
  }
});

router.use(authenticateUser);

router.post("/", async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, description, errors } = parseCollectionInput(req);

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const collection = await Collection.create({
      userId,
      name,
      description,
      listingIds: [],
    });

    return res.status(201).json({
      success: true,
      collection: serializeCollectionSummary(collection, null),
    });
  } catch (error) {
    console.error("Failed to create collection:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating collection",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const userId = req.user._id;
    const collections = await Collection.find({ userId }).sort({
      createdAt: -1,
    });

    const summaries = await Promise.all(
      collections.map(async (collection) => {
        let previewTitle = null;

        if (collection.listingIds.length > 0) {
          const previewListing = await HousingListing.findById(
            collection.listingIds[0],
          ).select("title");
          previewTitle = previewListing?.title || null;
        }

        return serializeCollectionSummary(collection, previewTitle);
      }),
    );

    return res.json({
      success: true,
      count: summaries.length,
      collections: summaries,
    });
  } catch (error) {
    console.error("Failed to load collections:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while loading collections",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid collection ID",
      });
    }

    const collection = await Collection.findOne({ _id: id, userId }).populate(
      { path: "listingIds", select: LISTING_FIELDS },
    );

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    const listings = collection.listingIds
      .filter(Boolean)
      .map((listing) => {
        const listingObject = listing.toObject();

        return {
          ...listingObject,
          valueScore: calculateValueScore(listingObject, req.query.campus),
          valueScoreBreakdown: calculateValueScoreBreakdown(
            listingObject,
            req.query.campus,
          ),
        };
      });

    return res.json({
      success: true,
      collection: {
        _id: collection._id,
        name: collection.name,
        description: collection.description,
        shareToken: collection.shareToken || null,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
      },
      listings,
    });
  } catch (error) {
    console.error("Failed to load collection:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while loading collection",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid collection ID",
      });
    }

    const { name, description, errors } = parseCollectionInput(req);

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const collection = await Collection.findOneAndUpdate(
      { _id: id, userId },
      { name, description },
      { new: true, runValidators: true },
    );

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    let previewTitle = null;
    if (collection.listingIds.length > 0) {
      const previewListing = await HousingListing.findById(
        collection.listingIds[0],
      ).select("title");
      previewTitle = previewListing?.title || null;
    }

    return res.json({
      success: true,
      collection: serializeCollectionSummary(collection, previewTitle),
    });
  } catch (error) {
    console.error("Failed to update collection:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating collection",
    });
  }
});

router.post("/:id/share", async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid collection ID",
      });
    }

    const collection = await Collection.findOne({ _id: id, userId });

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    if (!collection.shareToken) {
      collection.shareToken = crypto.randomBytes(24).toString("hex");
      await collection.save();
    }

    return res.json({ success: true, shareToken: collection.shareToken });
  } catch (error) {
    console.error("Failed to enable collection sharing:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while enabling sharing",
    });
  }
});

router.delete("/:id/share", async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid collection ID",
      });
    }

    const collection = await Collection.findOneAndUpdate(
      { _id: id, userId },
      { $unset: { shareToken: "" } },
      { new: true },
    );

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to disable collection sharing:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while disabling sharing",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid collection ID",
      });
    }

    const removed = await Collection.findOneAndDelete({ _id: id, userId });

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete collection:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting collection",
    });
  }
});

router.post("/:id/listings", async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { listingId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid collection ID",
      });
    }

    if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({
        success: false,
        message: "A valid listingId is required.",
      });
    }

    const listingExists = await HousingListing.exists({ _id: listingId });
    if (!listingExists) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    const collection = await Collection.findOneAndUpdate(
      { _id: id, userId },
      { $addToSet: { listingIds: listingId } },
      { new: true },
    );

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    return res.json({
      success: true,
      collection: serializeCollectionSummary(collection, null),
    });
  } catch (error) {
    console.error("Failed to add listing to collection:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while adding listing to collection",
    });
  }
});

router.delete("/:id/listings/:listingId", async (req, res) => {
  try {
    const userId = req.user._id;
    const { id, listingId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(listingId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid collection or listing ID",
      });
    }

    const collection = await Collection.findOneAndUpdate(
      { _id: id, userId },
      { $pull: { listingIds: listingId } },
      { new: true },
    );

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    return res.json({
      success: true,
      collection: serializeCollectionSummary(collection, null),
    });
  } catch (error) {
    console.error("Failed to remove listing from collection:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while removing listing from collection",
    });
  }
});

module.exports = router;
