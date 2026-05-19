const express = require("express");
const crypto = require("crypto");

const SavedPreference = require("../models/SavedPreference");

const router = express.Router();
const SAFETY_LEVELS = ["Any", "Medium+", "High Only"];

const createSessionId = () => `anon_${crypto.randomUUID()}`;

const toOptionalNumber = (value, fieldName, errors) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    errors.push(`${fieldName} must be a number`);
    return undefined;
  }

  return numberValue;
};

const normalizeAmenities = (amenities) => {
  if (!Array.isArray(amenities)) {
    return [];
  }

  return amenities
    .filter((amenity) => typeof amenity === "string")
    .map((amenity) => amenity.trim())
    .filter(Boolean);
};

router.post("/", async (req, res) => {
  try {
    const errors = [];
    const minRent = toOptionalNumber(req.body.minRent, "minRent", errors);
    const maxRent = toOptionalNumber(req.body.maxRent, "maxRent", errors);
    const maxCommute = toOptionalNumber(
      req.body.maxCommute,
      "maxCommute",
      errors,
    );
    const safetyLevel = req.body.safetyLevel || "Any";

    if (
      minRent !== undefined &&
      maxRent !== undefined &&
      maxRent < minRent
    ) {
      errors.push("maxRent should not be below minRent");
    }

    if (!SAFETY_LEVELS.includes(safetyLevel)) {
      errors.push("safetyLevel should be one of: Any, Medium+, High Only");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    const sessionId =
      typeof req.body.sessionId === "string" && req.body.sessionId.trim()
        ? req.body.sessionId.trim()
        : createSessionId();

    const preference = await SavedPreference.create({
      sessionId,
      campus: req.body.campus,
      housingType: req.body.housingType,
      minRent,
      maxRent,
      maxCommute,
      safetyLevel,
      amenities: normalizeAmenities(req.body.amenities),
      notes: req.body.notes,
    });

    return res.status(201).json({
      success: true,
      sessionId,
      preference,
    });
  } catch (error) {
    console.error("Failed to save preference:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while saving preferences",
    });
  }
});

router.get("/:sessionId", async (req, res) => {
  try {
    const preferences = await SavedPreference.find({
      sessionId: req.params.sessionId,
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      sessionId: req.params.sessionId,
      preferences,
    });
  } catch (error) {
    console.error("Failed to load preferences:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while loading preferences",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const preferences = await SavedPreference.find()
      .sort({ createdAt: -1 })
      .limit(20);

    return res.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error("Failed to list preferences:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while listing preferences",
    });
  }
});

module.exports = router;
