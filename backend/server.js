const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const preferenceRoutes = require("./routes/preferences");
const listingsRoutes = require("./routes/listings");
const campusRoutes = require("./routes/campuses");
const analyticsRoutes = require("./routes/analytics");
const savedListingsRoutes = require("./routes/savedListings");

const app = express();

connectDB();

const configuredFrontendOrigins = (process.env.FRONTEND_URLS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL,
  ...configuredFrontendOrigins,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^https:\/\/frontend(?:-[a-z0-9-]+)?\.vercel\.app$/.test(origin) ||
        /^https:\/\/frontend-[a-z0-9-]+-vspatel23s-projects\.vercel\.app$/.test(
          origin,
        ) ||
        /^https:\/\/torontostudenthousingmatrix(?:-[a-z0-9-]+)?\.vercel\.app$/.test(
          origin,
        ) ||
        /^https:\/\/torontostudenthousingmatrix-[a-z0-9-]+-vspatel23s-projects\.vercel\.app$/.test(
          origin,
        )
      ) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/preferences", preferenceRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api/campuses", campusRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/saved-listings", savedListingsRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Toronto Student Housing Matrix API is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    service: "Toronto Student Housing Matrix Backend",
  });
});

const PORT = process.env.PORT || 5001;

if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
