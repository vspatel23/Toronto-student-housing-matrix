const mongoose = require("mongoose");
require("dotenv").config();

const SavedPreference = require("../models/SavedPreference");
const HousingListing = require("../models/HousingListing");

const printIndexes = async (model, label) => {
  await model.createIndexes();
  const indexes = await model.collection.indexes();

  console.log(`\n${label} indexes:`);
  indexes.forEach((index) => {
    console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
  });
};

const checkIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log("MongoDB connected successfully");

    await printIndexes(SavedPreference, "SavedPreference");
    await printIndexes(HousingListing, "HousingListing");
  } catch (error) {
    console.error("Index check failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

checkIndexes();
