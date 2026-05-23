const express = require("express");

const Campus = require("../models/Campus");

const router = express.Router();

// GET /api/campuses
router.get("/", async (req, res) => {
  try {
    const campuses = await Campus.find().sort({
      institution: 1,
      campusName: 1,
    });

    return res.json({
      count: campuses.length,
      campuses,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error while loading campuses",
      error: error.message,
    });
  }
});

// GET /api/campuses/:id
router.get("/:id", async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id);

    if (!campus) {
      return res.status(404).json({ message: "Campus not found" });
    }

    return res.json(campus);
  } catch (error) {
    return res.status(500).json({
      message: "Server error while loading campus",
      error: error.message,
    });
  }
});

module.exports = router;
