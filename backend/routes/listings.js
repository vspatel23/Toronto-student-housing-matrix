const express = require("express");
const router = express.Router();
const HousingListing = require("../models/HousingListing");

// GET /api/listings
// Query params: minRent, maxRent, propertyType
router.get("/", async (req, res) => {
  try {
    const filter = { isActive: true };

    if (req.query.minRent || req.query.maxRent) {
      filter.monthlyRent = {};
      if (req.query.minRent) filter.monthlyRent.$gte = Number(req.query.minRent);
      if (req.query.maxRent) filter.monthlyRent.$lte = Number(req.query.maxRent);
    }

    if (req.query.propertyType) {
      filter.propertyType = req.query.propertyType;
    }

    if (req.query.safetyLevel) {
      filter["safety.crimeRateLevel"] = req.query.safetyLevel;
    }

    const listings = await HousingListing.find(filter)
      .select(
        "_id title address monthlyRent propertyType bedrooms bathrooms furnished location safety.crimeRateLevel transitStops valueScore neighborhood"
      )
      .sort({ valueScore: -1 });

    res.json({ count: listings.length, listings });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET /api/listings/:id
router.get("/:id", async (req, res) => {
  try {
    const listing = await HousingListing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }
    res.json(listing);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;