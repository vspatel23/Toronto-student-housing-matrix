const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const authenticateUser = require("../middleware/auth");
const User = require("../models/User");

const router = express.Router();
const TOKEN_EXPIRES_IN = "7d";
const MIN_PASSWORD_LENGTH = 6;

const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

const safeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
});

const ensureJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET_MISSING");
  }
};

const createToken = (user) => {
  ensureJwtSecret();
  return jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRES_IN,
  });
};

router.post("/register", async (req, res) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body.password === "string" ? req.body.password : "";

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: "Please enter a valid email address.",
      });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long.",
      });
    }

    ensureJwtSecret();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });
    const token = createToken(user);

    return res.status(201).json({
      token,
      user: safeUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    if (error.message === "JWT_SECRET_MISSING") {
      return res.status(500).json({
        message: "Authentication is not configured. JWT_SECRET is missing.",
      });
    }

    return res.status(500).json({
      message: "Server error while registering.",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body.password === "string" ? req.body.password : "";

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: "Please enter a valid email address.",
      });
    }

    ensureJwtSecret();

    const user = await User.findOne({ email }).select("+password");
    const passwordMatches =
      user && (await bcrypt.compare(password, user.password));

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const token = createToken(user);

    return res.json({
      token,
      user: safeUser(user),
    });
  } catch (error) {
    if (error.message === "JWT_SECRET_MISSING") {
      return res.status(500).json({
        message: "Authentication is not configured. JWT_SECRET is missing.",
      });
    }

    return res.status(500).json({
      message: "Server error while logging in.",
    });
  }
});

router.get("/me", authenticateUser, (req, res) => {
  return res.json({
    user: safeUser(req.user),
  });
});

module.exports = router;
