const mongoose = require("mongoose");
require("dotenv").config();

const Campus = require("../models/Campus");

const campuses = [
  {
    campusName: "St. George",
    institution: "University of Toronto",
    address: "27 King's College Circle, Toronto, ON M5S 1A1",
    location: { lat: 43.6629, lng: -79.3957 },
  },
  {
    campusName: "Scarborough",
    institution: "University of Toronto",
    address: "1265 Military Trail, Toronto, ON M1C 1A4",
    location: { lat: 43.7845, lng: -79.1864 },
  },
  {
    campusName: "Mississauga",
    institution: "University of Toronto",
    address: "3359 Mississauga Road, Mississauga, ON L5L 1C6",
    location: { lat: 43.5489, lng: -79.6625 },
  },
  {
    campusName: "Toronto Metropolitan University",
    institution: "Toronto Metropolitan University",
    address: "350 Victoria Street, Toronto, ON M5B 2K3",
    location: { lat: 43.6577, lng: -79.3788 },
  },
  {
    campusName: "York University",
    institution: "York University",
    address: "4700 Keele Street, Toronto, ON M3J 1P3",
    location: { lat: 43.7735, lng: -79.5019 },
  },
  {
    campusName: "Seneca Polytechnic",
    institution: "Seneca Polytechnic",
    address: "1750 Finch Avenue East, Toronto, ON M2J 2X5",
    location: { lat: 43.7960, lng: -79.3486 },
  },
];

async function seedCampuses() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    await Campus.deleteMany({});
    console.log("Cleared existing campuses");

    const result = await Campus.insertMany(campuses);
    console.log(`Seeded ${result.length} campuses`);

    await mongoose.disconnect();
    console.log("Done");
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }
}

seedCampuses();
