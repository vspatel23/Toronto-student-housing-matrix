const express = require("express");

const Campus = require("../models/Campus");
const defaultCampuses = require("../data/defaultCampuses");

const router = express.Router();

const getCampuses = async () => {
  let campuses = await Campus.find().sort({
    institution: 1,
    campusName: 1,
  });

  if (campuses.length > 0) {
    return campuses;
  }

  await Campus.insertMany(defaultCampuses, { ordered: true });

  return Campus.find().sort({
    institution: 1,
    campusName: 1,
  });
};

// GET /api/campuses
router.get("/", async (req, res) => {
  try {
    const campuses = await getCampuses();

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
