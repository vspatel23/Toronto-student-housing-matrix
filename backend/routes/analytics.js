const express = require("express");

const authenticateUser = require("../middleware/auth");
const SearchAnalytics = require("../models/SearchAnalytics");

const router = express.Router();
const RECENT_LIMIT = 10;

const toOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const buildSearchPayload = (req) => ({
  campus: typeof req.body.campus === "string" ? req.body.campus.trim() : "",
  minRent: toOptionalNumber(req.body.minRent),
  maxRent: toOptionalNumber(req.body.maxRent),
  housingType:
    typeof req.body.housingType === "string" ? req.body.housingType.trim() : "",
  maxCommute: toOptionalNumber(req.body.maxCommute),
});

const isSameSearch = (a, b) =>
  (a.campus || "") === (b.campus || "") &&
  a.minRent === b.minRent &&
  a.maxRent === b.maxRent &&
  (a.housingType || "") === (b.housingType || "") &&
  a.maxCommute === b.maxCommute;

router.use(authenticateUser);

router.post("/search", async (req, res) => {
  try {
    const userId = req.user._id;
    const searchPayload = buildSearchPayload(req);

    const mostRecent = await SearchAnalytics.findOne({ userId }).sort({
      updatedAt: -1,
    });

    if (mostRecent && isSameSearch(mostRecent, searchPayload)) {
      mostRecent.updatedAt = new Date();
      await mostRecent.save();

      return res.status(200).json({ success: true, record: mostRecent });
    }

    const record = await SearchAnalytics.create({
      userId,
      ...searchPayload,
    });

    return res.status(201).json({ success: true, record });
  } catch (error) {
    console.error("Failed to record search analytics:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while recording search analytics",
    });
  }
});

router.get("/recent", async (req, res) => {
  try {
    const userId = req.user._id;

    const records = await SearchAnalytics.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(RECENT_LIMIT);

    return res.json({ success: true, count: records.length, searches: records });
  } catch (error) {
    console.error("Failed to load recent search analytics:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while loading recent searches",
    });
  }
});

module.exports = router;
