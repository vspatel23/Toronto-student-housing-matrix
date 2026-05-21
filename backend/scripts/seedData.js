const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config({ path: "../.env" });

const HousingListing = require("../models/HousingListing");
const Campus = require("../models/Campus");
const SavedPreference = require("../models/SavedPreference");

const campuses = [
  {
    campusName: "Seneca Newnham Campus",
    institution: "Seneca Polytechnic",
    address: "1750 Finch Ave E, Toronto, ON M2J 2X5",
    location: { lat: 43.7957, lng: -79.3492 },
  },
  {
    campusName: "Seneca King Campus",
    institution: "Seneca Polytechnic",
    address: "13990 Dufferin St, King City, ON L7B 1B3",
    location: { lat: 43.9265, lng: -79.5317 },
  },
];

const listings = [
  {
    title: "Cozy Studio near Finch Station",
    address: "123 Finch Ave E, Toronto, ON",
    neighborhood: "North York",
    postalCode: "M2J 1A1",
    monthlyRent: 1200,
    propertyType: "Studio",
    bedrooms: 0,
    bathrooms: 1,
    furnished: true,
    location: { lat: 43.7800, lng: -79.3500 },
    safety: {
      safetyScore: 72,
      crimeRateLevel: "Low",
      crimeRatePer1000: 18.4,
      dataSource: "TPS Open Data",
    },
    transitStops: [
      { stopName: "Finch Station", walkMinutes: 5 },
      { stopName: "Don Mills Bus Terminal", walkMinutes: 12 },
    ],
    amenities: ["Supermarket", "Pharmacy", "Library"],
    valueScore: 81,
    source: "https://www.realtor.ca/sample-1",
    isActive: true,
  },
  {
    title: "Spacious 1-Bedroom in Scarborough",
    address: "456 Sheppard Ave E, Scarborough, ON",
    neighborhood: "Agincourt",
    postalCode: "M1S 1T5",
    monthlyRent: 1500,
    propertyType: "Apartment",
    bedrooms: 1,
    bathrooms: 1,
    furnished: false,
    location: { lat: 43.7880, lng: -79.2660 },
    safety: {
      safetyScore: 65,
      crimeRateLevel: "Medium",
      crimeRatePer1000: 29.1,
      dataSource: "TPS Open Data",
    },
    transitStops: [
      { stopName: "Sheppard & McCowan", walkMinutes: 3 },
    ],
    amenities: ["Supermarket", "Park"],
    valueScore: 74,
    source: "https://www.realtor.ca/sample-2",
    isActive: true,
  },
  {
    title: "Budget Room in Shared House",
    address: "789 Jane St, Toronto, ON",
    neighborhood: "Black Creek",
    postalCode: "M6N 3T2",
    monthlyRent: 900,
    propertyType: "Room",
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    location: { lat: 43.6970, lng: -79.4820 },
    safety: {
      safetyScore: 48,
      crimeRateLevel: "High",
      crimeRatePer1000: 52.3,
      dataSource: "TPS Open Data",
    },
    transitStops: [
      { stopName: "Jane Station", walkMinutes: 8 },
    ],
    amenities: ["Pharmacy"],
    valueScore: 62,
    source: "https://www.realtor.ca/sample-3",
    isActive: true,
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB Atlas");

    // Clear existing data
    await HousingListing.deleteMany({});
    await Campus.deleteMany({});
    await SavedPreference.deleteMany({});
    console.log("Cleared existing collections");

    // Insert campuses first so we have IDs
    const insertedCampuses = await Campus.insertMany(campuses);
    console.log(`Inserted ${insertedCampuses.length} campuses`);

    // Insert listings
    const insertedListings = await HousingListing.insertMany(listings);
    console.log(`Inserted ${insertedListings.length} listings`);

    // Insert one sample saved preference
    await SavedPreference.create({
      sessionId: "session_seed_001",
      selectedCampusId: insertedCampuses[0]._id,
      maxBudget: 1500,
      housingType: "Apartment",
      maxCommute: 30,
      minimumSafetyLevel: "Medium",
      weights: { rent: 40, commute: 30, safety: 20, amenities: 10 },
      favorites: [{ listingId: insertedListings[0]._id }],
      compareList: [insertedListings[0]._id, insertedListings[1]._id],
    });
    console.log("Inserted sample saved preference");

    console.log("Seeding complete!");
    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();