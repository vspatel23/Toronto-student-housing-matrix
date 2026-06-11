const jwt = require("jsonwebtoken");

const User = require("../models/User");

const authenticateUser = async (req, res, next) => {
  const authHeader = req.get("Authorization") || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      message: "Authentication is not configured. JWT_SECRET is missing.",
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);

    if (!user) {
      return res.status(401).json({ message: "Invalid or expired token." });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

module.exports = authenticateUser;
