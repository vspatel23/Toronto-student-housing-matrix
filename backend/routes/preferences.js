const express = require("express");

const authenticateUser = require("../middleware/auth");
const SavedPreference = require("../models/SavedPreference");

const router = express.Router();
const SAFETY_LEVELS = ["Any", "Medium+", "High Only"];

const getAuthenticatedUserId = (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    res.status(401).json({
      message: "Authentication required.",
    });
    return null;
  }

  return userId;
};

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

const buildPreferencePayload = (req, errors, userId) => {
  const minRent = toOptionalNumber(req.body.minRent, "minRent", errors);
  const maxRent = toOptionalNumber(req.body.maxRent, "maxRent", errors);
  const maxCommute = toOptionalNumber(
    req.body.maxCommute,
    "maxCommute",
    errors,
  );
  const safetyLevel = req.body.safetyLevel || "Any";

  if (minRent !== undefined && maxRent !== undefined && maxRent < minRent) {
    errors.push("maxRent should not be below minRent");
  }

  if (!SAFETY_LEVELS.includes(safetyLevel)) {
    errors.push("safetyLevel should be one of: Any, Medium+, High Only");
  }

  return {
    userId,
    campus: req.body.campus,
    housingType: req.body.housingType,
    minRent,
    maxRent,
    maxCommute,
    safetyLevel,
    amenities: normalizeAmenities(req.body.amenities),
    notes: req.body.notes,
  };
};

router.use(authenticateUser);

router.post("/", async (req, res) => {
  try {
    const errors = [];
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) {
      return;
    }

    const preferencePayload = buildPreferencePayload(req, errors, userId);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    const preference = await SavedPreference.create(preferencePayload);

    return res.status(201).json({
      success: true,
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

router.put("/:preferenceId", async (req, res) => {
  try {
    const errors = [];
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) {
      return;
    }

    const preferencePayload = buildPreferencePayload(req, errors, userId);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    const preference = await SavedPreference.findOneAndUpdate(
      { _id: req.params.preferenceId, userId },
      preferencePayload,
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    if (!preference) {
      return res.status(404).json({
        success: false,
        message: "Saved preference not found",
      });
    }

    return res.json({
      success: true,
      preference,
    });
  } catch (error) {
    console.error("Failed to update preference:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating preferences",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) {
      return;
    }

    const preferences = await SavedPreference.find({
      userId,
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
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

module.exports = router;
