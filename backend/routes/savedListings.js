const express = require("express");
const mongoose = require("mongoose");

const authenticateUser = require("../middleware/auth");
const SavedListing = require("../models/SavedListing");
const HousingListing = require("../models/HousingListing");
const {
  LISTING_FIELDS,
  serializeListingImages,
} = require("../utils/listingImages");
const {
  calculateValueScore,
  calculateValueScoreBreakdown,
} = require("../utils/valueScore");

const router = express.Router();

router.use(authenticateUser);

router.post("/", async (req, res) => {
  try {
    const userId = req.user._id;
    const { listingId } = req.body;

    if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({
        success: false,
        message: "A valid listingId is required.",
      });
    }

    const listing = await HousingListing.findById(listingId).select("_id");
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    const savedListing = await SavedListing.findOneAndUpdate(
      { userId, listingId },
      { $setOnInsert: { userId, listingId, savedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return res.status(201).json({
      success: true,
      savedListing,
    });
  } catch (error) {
    console.error("Failed to save listing:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while saving listing",
    });
  }
});

router.delete("/:listingId", async (req, res) => {
  try {
    const userId = req.user._id;
    const { listingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing ID",
      });
    }

    const removed = await SavedListing.findOneAndDelete({ userId, listingId });

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: "Saved listing not found",
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to remove saved listing:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while removing saved listing",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const userId = req.user._id;

    const savedListings = await SavedListing.find({ userId })
      .sort({ savedAt: -1 })
      .populate({ path: "listingId", select: LISTING_FIELDS });

    const listings = savedListings
      .filter((saved) => saved.listingId)
      .map((saved) => {
        const listingObject = serializeListingImages(saved.listingId);

        return {
          ...listingObject,
          savedAt: saved.savedAt,
          valueScore: calculateValueScore(listingObject, req.query.campus),
          valueScoreBreakdown: calculateValueScoreBreakdown(
            listingObject,
            req.query.campus,
          ),
        };
      });

    return res.json({ success: true, count: listings.length, listings });
  } catch (error) {
    console.error("Failed to load saved listings:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while loading saved listings",
    });
  }
});

module.exports = router;
