const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const preferenceRoutes = require("./routes/preferences");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/preferences", preferenceRoutes);

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
