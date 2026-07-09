const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const HousingListing = require("../models/HousingListing");
const {
  calculateValueScore,
  calculateValueScoreBreakdown,
} = require("../utils/valueScore");

const propertyTypes = [
  "Apartment",
  "Shared House",
  "Studio",
  "Basement",
  "Room Rental",
];

const safetyLevelMap = {
  "Medium+": ["Low", "Medium"],
  "High Only": ["Low"],
};

// GET /api/listings
// Query params: minRent, maxRent, propertyType, safetyLevel, campus
router.get("/", async (req, res) => {
  try {
    const filter = { isActive: true };

    if (req.query.minRent || req.query.maxRent) {
      const minRent = Number(req.query.minRent);
      const maxRent = Number(req.query.maxRent);

      if (req.query.minRent && isNaN(minRent)) {
        return res.status(400).json({ message: "minRent must be a valid number" });
      }
      if (req.query.maxRent && isNaN(maxRent)) {
        return res.status(400).json({ message: "maxRent must be a valid number" });
      }

      filter.monthlyRent = {};
      if (req.query.minRent) filter.monthlyRent.$gte = minRent;
      if (req.query.maxRent) filter.monthlyRent.$lte = maxRent;
    }

    if (
      req.query.propertyType &&
      propertyTypes.includes(req.query.propertyType)
    ) {
      filter.propertyType = req.query.propertyType;
    }

    if (req.query.safetyLevel) {
      const crimeRateLevels =
        safetyLevelMap[req.query.safetyLevel] ??
        (["Low", "Medium", "High"].includes(req.query.safetyLevel)
          ? [req.query.safetyLevel]
          : null);

      if (crimeRateLevels) {
        filter["safety.crimeRateLevel"] = { $in: crimeRateLevels };
      }
    }

    const listings = await HousingListing.find(filter).select(
      "_id title address neighborhood postalCode description monthlyRent propertyType bedrooms bathrooms furnished location safety commuteEstimates nearestTransit amenities valueScore source isActive",
    );

    const scoredListings = listings
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
      })
      .sort((firstListing, secondListing) => {
        const scoreDifference =
          secondListing.valueScore - firstListing.valueScore;

        if (scoreDifference !== 0) {
          return scoreDifference;
        }

        const firstRent = Number.isFinite(Number(firstListing.monthlyRent))
          ? Number(firstListing.monthlyRent)
          : Number.POSITIVE_INFINITY;
        const secondRent = Number.isFinite(Number(secondListing.monthlyRent))
          ? Number(secondListing.monthlyRent)
          : Number.POSITIVE_INFINITY;
        const rentDifference = firstRent - secondRent;

        if (rentDifference !== 0) {
          return rentDifference;
        }

        return String(firstListing.title || "").localeCompare(
          String(secondListing.title || ""),
        );
      });

    res.json({ count: scoredListings.length, listings: scoredListings });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET /api/listings/:id
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid listing ID" });
    }

    const listing = await HousingListing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    const listingObject = listing.toObject();
    res.json({
      ...listingObject,
      valueScore: calculateValueScore(listingObject, req.query.campus),
      valueScoreBreakdown: calculateValueScoreBreakdown(
        listingObject,
        req.query.campus,
      ),
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
