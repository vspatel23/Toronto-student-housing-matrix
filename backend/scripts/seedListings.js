const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const HousingListing = require("../models/HousingListing");
const {
  prepareListingImagesForStorage,
} = require("../utils/listingImages");

const baseListings = [
  {
    seedId: "listing-001",
    title: "Furnished Annex Room Near Bloor",
    address: "214 Major Street, Toronto, ON",
    neighborhood: "The Annex",
    postalCode: "M5S 2L4",
    description: "Bright room in a student shared house close to cafes and campus libraries.",
    monthlyRent: 980,
    propertyType: "Room Rental",
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    location: { lat: 43.6655, lng: -79.4071 },
    safety: {
      safetyScore: 82,
      crimeRateLevel: "Low",
      crimeRatePer1000: 18.6,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — St. George", minutes: 12, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 24, isEstimated: true },
      { campus: "York University", minutes: 48, isEstimated: true },
    ],
    nearestTransit: { name: "Spadina Station", walkMinutes: 7 },
    amenities: ["WiFi", "Laundry", "Kitchen", "Nearby Transit", "Study Area"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-002",
    title: "Kensington Market Studio Loft",
    address: "78 Nassau Street, Toronto, ON",
    neighborhood: "Kensington Market",
    postalCode: "M5T 1M5",
    description: "Compact studio above a quiet storefront with easy access to groceries and streetcars.",
    monthlyRent: 1680,
    propertyType: "Studio",
    bedrooms: 0,
    bathrooms: 1,
    furnished: false,
    location: { lat: 43.6559, lng: -79.4024 },
    safety: {
      safetyScore: 76,
      crimeRateLevel: "Medium",
      crimeRatePer1000: 26.8,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — St. George", minutes: 16, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 20, isEstimated: true },
      { campus: "Seneca Polytechnic", minutes: 62, isEstimated: true },
    ],
    nearestTransit: { name: "College Streetcar", walkMinutes: 4 },
    amenities: ["Kitchen", "Nearby Transit", "Air Conditioning"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-003",
    title: "Little Italy Shared Main Floor",
    address: "331 Montrose Avenue, Toronto, ON",
    neighborhood: "Little Italy",
    postalCode: "M6G 3G9",
    description: "Main-floor room in a shared house near College Street restaurants and bike routes.",
    monthlyRent: 1125,
    propertyType: "Shared House",
    bedrooms: 4,
    bathrooms: 2,
    furnished: true,
    location: { lat: 43.6592, lng: -79.4191 },
    safety: {
      safetyScore: 79,
      crimeRateLevel: "Low",
      crimeRatePer1000: 21.3,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — St. George", minutes: 19, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 28, isEstimated: true },
      { campus: "University of Toronto — Mississauga", minutes: 68, isEstimated: true },
    ],
    nearestTransit: { name: "College Streetcar", walkMinutes: 5 },
    amenities: ["WiFi", "Laundry", "Kitchen", "Backyard Access", "Nearby Transit"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-004",
    title: "Chinatown Walk-Up Apartment",
    address: "42 Huron Street, Toronto, ON",
    neighborhood: "Chinatown",
    postalCode: "M5T 2A5",
    description: "One-bedroom walk-up with a simple layout close to Spadina and Queen transit.",
    monthlyRent: 2050,
    propertyType: "Apartment",
    bedrooms: 1,
    bathrooms: 1,
    furnished: false,
    location: { lat: 43.6522, lng: -79.3983 },
    safety: {
      safetyScore: 70,
      crimeRateLevel: "Medium",
      crimeRatePer1000: 31.2,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — St. George", minutes: 18, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 16, isEstimated: true },
      { campus: "York University", minutes: 55, isEstimated: true },
    ],
    nearestTransit: { name: "Spadina Avenue Streetcar", walkMinutes: 3 },
    amenities: ["Kitchen", "Laundry", "Nearby Transit", "Balcony"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-005",
    title: "Trinity Bellwoods Basement Suite",
    address: "119 Gore Vale Avenue, Toronto, ON",
    neighborhood: "Trinity Bellwoods",
    postalCode: "M6J 2R5",
    description: "Lower-level suite with private entrance near the park and Queen West.",
    monthlyRent: 1450,
    propertyType: "Basement",
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    location: { lat: 43.6472, lng: -79.4134 },
    safety: {
      safetyScore: 74,
      crimeRateLevel: "Medium",
      crimeRatePer1000: 28.4,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — St. George", minutes: 25, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 26, isEstimated: true },
      { campus: "University of Toronto — Mississauga", minutes: 70, isEstimated: true },
    ],
    nearestTransit: { name: "Queen Streetcar", walkMinutes: 6 },
    amenities: ["WiFi", "Kitchen", "Laundry", "Utilities Included"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-006",
    title: "Christie Pits Room With Study Nook",
    address: "86 Pendrith Street, Toronto, ON",
    neighborhood: "Christie Pits",
    postalCode: "M6G 1S1",
    description: "Furnished room in a calm house with a small study nook and shared kitchen.",
    monthlyRent: 925,
    propertyType: "Room Rental",
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    location: { lat: 43.6651, lng: -79.4217 },
    safety: {
      safetyScore: 81,
      crimeRateLevel: "Low",
      crimeRatePer1000: 19.7,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — St. George", minutes: 21, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 31, isEstimated: true },
      { campus: "York University", minutes: 44, isEstimated: true },
    ],
    nearestTransit: { name: "Christie Station", walkMinutes: 6 },
    amenities: ["WiFi", "Kitchen", "Laundry", "Study Area", "Nearby Transit"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-007",
    title: "North York Two-Bed Near Finch",
    address: "31 Lorraine Drive, Toronto, ON",
    neighborhood: "North York",
    postalCode: "M2N 7H2",
    description: "Two-bedroom apartment suited for roommates near subway access and grocery stores.",
    monthlyRent: 2450,
    propertyType: "Apartment",
    bedrooms: 2,
    bathrooms: 1,
    furnished: false,
    location: { lat: 43.7807, lng: -79.4149 },
    safety: {
      safetyScore: 77,
      crimeRateLevel: "Low",
      crimeRatePer1000: 22.9,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "York University", minutes: 34, isEstimated: true },
      { campus: "Seneca Polytechnic", minutes: 32, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 42, isEstimated: true },
    ],
    nearestTransit: { name: "Finch Station", walkMinutes: 8 },
    amenities: ["Laundry", "Kitchen", "Nearby Transit", "Parking", "Balcony"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-008",
    title: "Scarborough Shared Townhouse Room",
    address: "17 Packard Boulevard, Toronto, ON",
    neighborhood: "Scarborough",
    postalCode: "M1P 4K4",
    description: "Affordable room in a shared townhouse with bus connections to Scarborough campuses.",
    monthlyRent: 780,
    propertyType: "Room Rental",
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    location: { lat: 43.7581, lng: -79.2718 },
    safety: {
      safetyScore: 63,
      crimeRateLevel: "Medium",
      crimeRatePer1000: 36.5,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — Scarborough", minutes: 33, isEstimated: true },
      { campus: "Seneca Polytechnic", minutes: 45, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 58, isEstimated: true },
    ],
    nearestTransit: { name: "Lawrence East Bus", walkMinutes: 4 },
    amenities: ["WiFi", "Kitchen", "Laundry", "Parking", "Nearby Transit"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-009",
    title: "Downtown Furnished Studio",
    address: "210 Mutual Street, Toronto, ON",
    neighborhood: "Downtown Toronto",
    postalCode: "M5B 2B4",
    description: "Furnished studio close to downtown campuses with building security.",
    monthlyRent: 2200,
    propertyType: "Studio",
    bedrooms: 0,
    bathrooms: 1,
    furnished: true,
    location: { lat: 43.6603, lng: -79.3789 },
    safety: {
      safetyScore: 68,
      crimeRateLevel: "Medium",
      crimeRatePer1000: 34.1,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "Toronto Metropolitan University", minutes: 10, isEstimated: true },
      { campus: "University of Toronto — St. George", minutes: 22, isEstimated: true },
      { campus: "York University", minutes: 62, isEstimated: true },
    ],
    nearestTransit: { name: "College Station", walkMinutes: 6 },
    amenities: ["WiFi", "Laundry", "Kitchen", "Security", "Gym", "Air Conditioning"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-010",
    title: "Etobicoke Basement Near Humber Bay",
    address: "64 Milton Street, Toronto, ON",
    neighborhood: "Etobicoke",
    postalCode: "M8Y 2X9",
    description: "Quiet basement apartment with utilities included and access to Lakeshore transit.",
    monthlyRent: 1350,
    propertyType: "Basement",
    bedrooms: 1,
    bathrooms: 1,
    furnished: false,
    location: { lat: 43.6304, lng: -79.4914 },
    safety: {
      safetyScore: 73,
      crimeRateLevel: "Low",
      crimeRatePer1000: 24.3,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — Mississauga", minutes: 48, isEstimated: true },
      { campus: "University of Toronto — St. George", minutes: 52, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 58, isEstimated: true },
    ],
    nearestTransit: { name: "Royal York Bus", walkMinutes: 7 },
    amenities: ["Kitchen", "Laundry", "Utilities Included", "Storage"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-011",
    title: "York Village Shared House",
    address: "23 Sentinel Road, Toronto, ON",
    neighborhood: "York",
    postalCode: "M3J 1T1",
    description: "Shared house with multiple student rooms within a short trip of York University.",
    monthlyRent: 875,
    propertyType: "Shared House",
    bedrooms: 5,
    bathrooms: 2,
    furnished: true,
    location: { lat: 43.7663, lng: -79.4989 },
    safety: {
      safetyScore: 58,
      crimeRateLevel: "High",
      crimeRatePer1000: 49.5,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "York University", minutes: 16, isEstimated: true },
      { campus: "Seneca Polytechnic", minutes: 50, isEstimated: true },
      { campus: "University of Toronto — St. George", minutes: 60, isEstimated: true },
    ],
    nearestTransit: { name: "Finch West Station", walkMinutes: 12 },
    amenities: ["WiFi", "Kitchen", "Laundry", "Parking", "Nearby Transit"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-012",
    title: "East York Garden Basement",
    address: "142 Mortimer Avenue, Toronto, ON",
    neighborhood: "East York",
    description: "Simple garden-level basement suite near bus routes and local shops.",
    monthlyRent: 1280,
    propertyType: "Basement",
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    location: { lat: 43.6894, lng: -79.3378 },
    safety: {
      safetyScore: 80,
      crimeRateLevel: "Low",
      crimeRatePer1000: 20.2,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "Toronto Metropolitan University", minutes: 36, isEstimated: true },
      { campus: "University of Toronto — St. George", minutes: 43, isEstimated: true },
      { campus: "University of Toronto — Scarborough", minutes: 54, isEstimated: true },
    ],
    nearestTransit: { name: "Pape Bus", walkMinutes: 5 },
    amenities: ["Kitchen", "Laundry", "Backyard Access", "Utilities Included"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-013",
    title: "Parkdale Bachelor Apartment",
    address: "151 Dunn Avenue, Toronto, ON",
    neighborhood: "Parkdale",
    postalCode: "M6K 2R8",
    description: "Bachelor apartment in a small building close to Queen West and the lake.",
    monthlyRent: 1580,
    propertyType: "Apartment",
    bedrooms: 0,
    bathrooms: 1,
    furnished: false,
    location: { lat: 43.6377, lng: -79.4334 },
    safety: {
      safetyScore: 61,
      crimeRateLevel: "Medium",
      crimeRatePer1000: 39.4,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — St. George", minutes: 34, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 40, isEstimated: true },
      { campus: "University of Toronto — Mississauga", minutes: 66, isEstimated: true },
    ],
    nearestTransit: { name: "Queen Streetcar", walkMinutes: 4 },
    amenities: ["Kitchen", "Nearby Transit", "Pet Friendly"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-014",
    title: "Bloor West Village Upper Room",
    neighborhood: "Bloor West Village",
    postalCode: "M6S 1P3",
    description: "Upper-floor room in a shared home near parks, shops, and the Bloor subway line.",
    monthlyRent: 1050,
    propertyType: "Room Rental",
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    location: { lat: 43.6509, lng: -79.4797 },
    safety: {
      safetyScore: 85,
      crimeRateLevel: "Low",
      crimeRatePer1000: 16.9,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — St. George", minutes: 33, isEstimated: true },
      { campus: "University of Toronto — Mississauga", minutes: 55, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 45, isEstimated: true },
    ],
    nearestTransit: { name: "Runnymede Station", walkMinutes: 8 },
    amenities: ["WiFi", "Kitchen", "Laundry", "Nearby Transit", "Study Area"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-015",
    title: "The Beaches Studio With Balcony",
    address: "32 Wineva Avenue, Toronto, ON",
    neighborhood: "The Beaches",
    postalCode: "M4E 2T2",
    description: "Small studio with a balcony close to Queen East shops and waterfront trails.",
    monthlyRent: 1725,
    propertyType: "Studio",
    bedrooms: 0,
    bathrooms: 1,
    furnished: false,
    location: { lat: 43.6717, lng: -79.2967 },
    commuteEstimates: [
      { campus: "Toronto Metropolitan University", minutes: 44, isEstimated: true },
      { campus: "University of Toronto — St. George", minutes: 52, isEstimated: true },
      { campus: "University of Toronto — Scarborough", minutes: 58, isEstimated: true },
    ],
    nearestTransit: { name: "Queen Streetcar", walkMinutes: 6 },
    amenities: ["Kitchen", "Laundry", "Balcony", "Nearby Transit"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-016",
    title: "Liberty Village One-Bed Condo-Style Apartment",
    address: "55 East Liberty Street, Toronto, ON",
    neighborhood: "Liberty Village",
    postalCode: "M6K 3P9",
    description: "Modern one-bedroom apartment with gym access and quick streetcar connections.",
    monthlyRent: 2380,
    propertyType: "Apartment",
    bedrooms: 1,
    bathrooms: 1,
    furnished: false,
    location: { lat: 43.6386, lng: -79.4168 },
    safety: {
      safetyScore: 72,
      crimeRateLevel: "Medium",
      crimeRatePer1000: 29.7,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — St. George", minutes: 31, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 35, isEstimated: true },
      { campus: "University of Toronto — Mississauga", minutes: 63, isEstimated: true },
    ],
    nearestTransit: { name: "King Streetcar", walkMinutes: 5 },
    amenities: ["Laundry", "Kitchen", "Gym", "Security", "Air Conditioning", "Balcony"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-017",
    title: "Davisville Furnished Basement",
    address: "91 Balliol Street, Toronto, ON",
    neighborhood: "Davisville",
    postalCode: "M4S 1C2",
    description: "Furnished lower-level unit in a residential area near Davisville Station.",
    monthlyRent: 1500,
    propertyType: "Basement",
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    location: { lat: 43.6986, lng: -79.3952 },
    safety: {
      safetyScore: 86,
      crimeRateLevel: "Low",
      crimeRatePer1000: 15.8,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — St. George", minutes: 28, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 32, isEstimated: true },
      { campus: "York University", minutes: 58, isEstimated: true },
    ],
    nearestTransit: { name: "Davisville Station", walkMinutes: 9 },
    amenities: ["WiFi", "Kitchen", "Laundry", "Utilities Included", "Nearby Transit"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-018",
    title: "Yonge and Eglinton Shared Apartment Room",
    address: "43 Orchard View Boulevard, Toronto, ON",
    neighborhood: "Yonge and Eglinton",
    postalCode: "M4R 1B9",
    description: "Private room in a shared apartment with a private bathroom and subway nearby.",
    monthlyRent: 1325,
    propertyType: "Room Rental",
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    location: { lat: 43.7077, lng: -79.3984 },
    safety: {
      safetyScore: 83,
      crimeRateLevel: "Low",
      crimeRatePer1000: 17.4,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — St. George", minutes: 31, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 35, isEstimated: true },
      { campus: "Seneca Polytechnic", minutes: 46, isEstimated: true },
    ],
    nearestTransit: { name: "Eglinton Station", walkMinutes: 7 },
    amenities: ["WiFi", "Kitchen", "Laundry", "Private Bathroom", "Nearby Transit"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-019",
    title: "Leslieville Main-Floor Studio",
    address: "102 Morse Street, Toronto, ON",
    neighborhood: "Leslieville",
    postalCode: "M4M 2P8",
    description: "Main-floor studio in the east end with nearby cafes and streetcar service.",
    monthlyRent: 1625,
    propertyType: "Studio",
    bedrooms: 0,
    bathrooms: 1,
    furnished: true,
    location: { lat: 43.6622, lng: -79.3343 },
    safety: {
      safetyScore: 78,
      crimeRateLevel: "Low",
      crimeRatePer1000: 22.1,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "Toronto Metropolitan University", minutes: 30, isEstimated: true },
      { campus: "University of Toronto — St. George", minutes: 40, isEstimated: true },
      { campus: "University of Toronto — Scarborough", minutes: 55, isEstimated: true },
    ],
    nearestTransit: { name: "Queen Streetcar", walkMinutes: 5 },
    amenities: ["WiFi", "Kitchen", "Laundry", "Air Conditioning", "Nearby Transit"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-020",
    title: "Roncesvalles Shared House Room",
    address: "38 Geoffrey Street, Toronto, ON",
    neighborhood: "Roncesvalles",
    postalCode: "M6R 1P3",
    description: "Room in a shared house with backyard access near Dundas West transit.",
    monthlyRent: 1100,
    propertyType: "Shared House",
    bedrooms: 4,
    bathrooms: 2,
    furnished: false,
    location: { lat: 43.6488, lng: -79.4495 },
    safety: {
      safetyScore: 80,
      crimeRateLevel: "Low",
      crimeRatePer1000: 20.6,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — St. George", minutes: 32, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 42, isEstimated: true },
      { campus: "University of Toronto — Mississauga", minutes: 61, isEstimated: true },
    ],
    nearestTransit: { name: "Dundas West Station", walkMinutes: 10 },
    amenities: ["Kitchen", "Laundry", "Backyard Access", "Storage", "Nearby Transit"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-021",
    title: "Affordable Scarborough Basement",
    neighborhood: "Scarborough",
    description: "Budget basement unit in a quiet residential pocket with shared laundry.",
    monthlyRent: 1025,
    propertyType: "Basement",
    bedrooms: 1,
    bathrooms: 1,
    furnished: false,
    safety: {
      safetyScore: 66,
      crimeRateLevel: "Medium",
      crimeRatePer1000: 34.8,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — Scarborough", minutes: 28, isEstimated: true },
      { campus: "Seneca Polytechnic", minutes: 52, isEstimated: true },
    ],
    nearestTransit: { name: "Ellesmere Bus", walkMinutes: 9 },
    amenities: ["Kitchen", "Laundry", "Utilities Included"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-022",
    title: "Downtown Room Near Jarvis",
    address: "184 Jarvis Street, Toronto, ON",
    neighborhood: "Downtown Toronto",
    postalCode: "M5B 2B7",
    description: "Simple furnished room close to downtown classrooms and late-night transit.",
    monthlyRent: 1180,
    propertyType: "Room Rental",
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    location: { lat: 43.6567, lng: -79.3749 },
    commuteEstimates: [
      { campus: "Toronto Metropolitan University", minutes: 11, isEstimated: true },
      { campus: "University of Toronto — St. George", minutes: 23, isEstimated: true },
      { campus: "York University", minutes: 65, isEstimated: true },
    ],
    nearestTransit: { name: "Dundas Station", walkMinutes: 8 },
    amenities: ["WiFi", "Kitchen", "Nearby Transit", "Security"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-023",
    title: "North York Unfurnished Studio",
    address: "12 Poyntz Avenue, Toronto, ON",
    neighborhood: "North York",
    postalCode: "M2N 1H4",
    description: "Unfurnished studio near Sheppard-Yonge with room for a compact work setup.",
    monthlyRent: 1850,
    propertyType: "Studio",
    bedrooms: 0,
    bathrooms: 1,
    furnished: false,
    location: { lat: 43.7612, lng: -79.4118 },
    safety: {
      safetyScore: 75,
      crimeRateLevel: "Low",
      crimeRatePer1000: 23.6,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "York University", minutes: 36, isEstimated: true },
      { campus: "Seneca Polytechnic", minutes: 34, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 39, isEstimated: true },
    ],
    amenities: ["Kitchen", "Laundry", "Air Conditioning", "Storage"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-024",
    title: "Etobicoke Shared House Room",
    neighborhood: "Etobicoke",
    description: "Furnished room in a shared west-end home for students who prefer a quieter area.",
    monthlyRent: 895,
    propertyType: "Shared House",
    bedrooms: 5,
    bathrooms: 2,
    furnished: true,
    safety: {
      safetyScore: 71,
      crimeRateLevel: "Medium",
      crimeRatePer1000: 30.1,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — Mississauga", minutes: 44, isEstimated: true },
      { campus: "University of Toronto — St. George", minutes: 58, isEstimated: true },
    ],
    nearestTransit: { name: "Islington Bus", walkMinutes: 11 },
    amenities: ["WiFi", "Kitchen", "Laundry", "Parking"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-025",
    title: "York Basement With Parking",
    address: "71 Eglinton Avenue West, Toronto, ON",
    neighborhood: "York",
    postalCode: "M6E 2H1",
    description: "Basement suite with parking and storage in a central-west neighborhood.",
    monthlyRent: 1400,
    propertyType: "Basement",
    bedrooms: 1,
    bathrooms: 1,
    furnished: false,
    location: { lat: 43.6934, lng: -79.4556 },
    safety: {
      safetyScore: 60,
      crimeRateLevel: "High",
      crimeRatePer1000: 47.2,
      dataSource: "Sample development estimate",
    },
    nearestTransit: { name: "Eglinton West Station", walkMinutes: 13 },
    amenities: ["Kitchen", "Parking", "Storage", "Laundry"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-026",
    title: "East York Two-Bed Apartment",
    address: "24 Cosburn Avenue, Toronto, ON",
    neighborhood: "East York",
    postalCode: "M4K 2E7",
    description: "Two-bedroom apartment for roommates with transit links to downtown and Scarborough.",
    monthlyRent: 2325,
    propertyType: "Apartment",
    bedrooms: 2,
    bathrooms: 1,
    furnished: false,
    location: { lat: 43.6902, lng: -79.3494 },
    safety: {
      safetyScore: 79,
      crimeRateLevel: "Low",
      crimeRatePer1000: 21.1,
      dataSource: "Sample development estimate",
    },
    nearestTransit: { name: "Coxwell Bus", walkMinutes: 6 },
    amenities: ["Kitchen", "Laundry", "Balcony", "Nearby Transit", "Pet Friendly"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-027",
    title: "Parkdale Shared Room In Older Home",
    address: "9 Cowan Avenue, Toronto, ON",
    neighborhood: "Parkdale",
    postalCode: "M6K 2N1",
    description: "Low-cost shared-house room in an older home near Queen Street transit.",
    monthlyRent: 700,
    propertyType: "Room Rental",
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    location: { lat: 43.6396, lng: -79.4316 },
    safety: {
      safetyScore: 55,
      crimeRateLevel: "High",
      crimeRatePer1000: 53.9,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — St. George", minutes: 38, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 44, isEstimated: true },
    ],
    amenities: ["WiFi", "Kitchen", "Laundry", "Nearby Transit"],
    source: "Sample development data",
    isActive: true,
  },
  {
    seedId: "listing-028",
    title: "Inactive Annex Apartment Sample",
    address: "18 Madison Avenue, Toronto, ON",
    neighborhood: "The Annex",
    postalCode: "M5R 2S1",
    description: "Inactive sample apartment retained for testing active-listing filters.",
    monthlyRent: 2600,
    propertyType: "Apartment",
    bedrooms: 2,
    bathrooms: 1,
    furnished: false,
    location: { lat: 43.6702, lng: -79.4049 },
    safety: {
      safetyScore: 84,
      crimeRateLevel: "Low",
      crimeRatePer1000: 17.1,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "University of Toronto — St. George", minutes: 14, isEstimated: true },
      { campus: "Toronto Metropolitan University", minutes: 27, isEstimated: true },
    ],
    nearestTransit: { name: "Spadina Station", walkMinutes: 5 },
    amenities: ["Kitchen", "Laundry", "Balcony", "Nearby Transit"],
    source: "Sample development data",
    isActive: false,
  },
  {
    seedId: "listing-029",
    title: "Inactive Leslieville Studio Sample",
    address: "49 Carlaw Avenue, Toronto, ON",
    neighborhood: "Leslieville",
    postalCode: "M4M 2R6",
    description: "Inactive sample studio for checking that unavailable listings stay hidden.",
    monthlyRent: 1540,
    propertyType: "Studio",
    bedrooms: 0,
    bathrooms: 1,
    furnished: true,
    location: { lat: 43.6569, lng: -79.3411 },
    safety: {
      safetyScore: 77,
      crimeRateLevel: "Low",
      crimeRatePer1000: 23.2,
      dataSource: "Sample development estimate",
    },
    commuteEstimates: [
      { campus: "Toronto Metropolitan University", minutes: 32, isEstimated: true },
      { campus: "University of Toronto — Scarborough", minutes: 57, isEstimated: true },
    ],
    nearestTransit: { name: "Queen Streetcar", walkMinutes: 7 },
    amenities: ["WiFi", "Kitchen", "Air Conditioning", "Nearby Transit"],
    source: "Sample development data",
    isActive: false,
  },
  {
    seedId: "listing-030",
    title: "Inactive Yonge and Eglinton Room Sample",
    neighborhood: "Yonge and Eglinton",
    description: "Inactive room-rental sample with intentionally sparse optional data.",
    monthlyRent: 990,
    propertyType: "Room Rental",
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    amenities: ["WiFi", "Kitchen", "Study Area"],
    source: "Sample development data",
    isActive: false,
  },
];

const DEMO_IMAGE_BY_PROPERTY_TYPE = {
  Apartment: {
    src: "/images/listings/demo/studio-01.webp",
    alt: "Generic project-generated apartment room and kitchenette interior",
  },
  Basement: {
    src: "/images/listings/demo/studio-01.webp",
    alt: "Generic project-generated open rental room and kitchenette interior",
  },
  "Room Rental": {
    src: "/images/listings/demo/student-bedroom-01.webp",
    alt: "Generic project-generated furnished student bedroom interior",
  },
  "Shared House": {
    src: "/images/listings/demo/shared-house-01.webp",
    alt: "Generic project-generated shared student living room and kitchen",
  },
  Studio: {
    src: "/images/listings/demo/studio-01.webp",
    alt: "Generic project-generated open studio apartment interior",
  },
};

const listings = baseListings.map((listing) => {
  const primaryImage = DEMO_IMAGE_BY_PROPERTY_TYPE[listing.propertyType];
  const images = [
    {
      ...primaryImage,
      order: 0,
      isPrimary: true,
      width: 1200,
      height: 800,
    },
  ];

  if (listing.seedId === "listing-001") {
    images.push({
      src: "/images/listings/demo/shared-house-01.webp",
      alt: "Generic project-generated shared student living room and kitchen",
      order: 1,
      isPrimary: false,
      width: 1200,
      height: 800,
    });
  }

  return { ...listing, images };
});

const FRONTEND_PUBLIC_DIR = path.resolve(
  __dirname,
  "../../frontend/public",
);

const hasExpectedFileSignature = (filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  const header = fs.readFileSync(filePath).subarray(0, 512);

  if (extension === ".webp") {
    return (
      header.length >= 12 &&
      header.toString("ascii", 0, 4) === "RIFF" &&
      header.toString("ascii", 8, 12) === "WEBP"
    );
  }

  if (extension === ".svg") {
    return header.toString("utf8").includes("<svg");
  }

  if (extension === ".png") {
    return header.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8;
  }

  if (extension === ".avif") {
    return header.length >= 12 && header.toString("ascii", 4, 12).includes("ftyp");
  }

  return false;
};

const validateSeedListings = (
  seedListings,
  { publicDirectory = FRONTEND_PUBLIC_DIR } = {},
) =>
  seedListings.map((listing) => {
    const listingIdentity = `${listing.seedId || "unknown seed"} (${
      listing.title || "Untitled listing"
    })`;
    const images = prepareListingImagesForStorage(listing.images, {
      context: `Listing ${listingIdentity}`,
    });

    images.forEach((image, index) => {
      if (!image.src.startsWith("/")) {
        return;
      }

      const publicRoot = path.resolve(publicDirectory);
      const filePath = path.resolve(publicRoot, image.src.slice(1));
      const requiredPrefix = `${publicRoot}${path.sep}`;

      if (!filePath.startsWith(requiredPrefix)) {
        throw new Error(
          `Listing ${listingIdentity}, image ${index} (${image.src}): path escapes the frontend public directory.`,
        );
      }

      if (!fs.existsSync(filePath)) {
        throw new Error(
          `Listing ${listingIdentity}, image ${index} (${image.src}): local image file does not exist.`,
        );
      }

      if (!fs.statSync(filePath).isFile()) {
        throw new Error(
          `Listing ${listingIdentity}, image ${index} (${image.src}): local image path is not a file.`,
        );
      }

      if (!hasExpectedFileSignature(filePath)) {
        throw new Error(
          `Listing ${listingIdentity}, image ${index} (${image.src}): file contents do not match the extension.`,
        );
      }
    });

    return { ...listing, images };
  });

const seedListings = async ({ validateOnly = false } = {}) => {
  const validatedListings = validateSeedListings(listings);

  if (validateOnly) {
    console.log(
      `Validated image metadata and local assets for ${validatedListings.length} housing listings.`,
    );
    return;
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("Missing MONGO_URI or MONGODB_URI environment variable.");
  }

  let inserted = 0;
  let updated = 0;
  const optionalFields = [
    "address",
    "postalCode",
    "location",
    "safety",
    "commuteEstimates",
    "nearestTransit",
    "valueScore",
    "images",
  ];

  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    for (const listing of validatedListings) {
      const unset = {};

      optionalFields.forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(listing, field)) {
          unset[field] = "";
        }
      });

      const result = await HousingListing.updateOne(
        { seedId: listing.seedId },
        { $set: listing, $unset: unset },
        { upsert: true, runValidators: true },
      );

      if (result.upsertedCount > 0) {
        inserted += 1;
      } else {
        updated += 1;
      }
    }

    console.log(
      `Seeded ${validatedListings.length} housing listings: ${inserted} inserted, ${updated} updated.`,
    );
  } catch (error) {
    console.error("Failed to seed housing listings:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
};

if (require.main === module) {
  seedListings({
    validateOnly: process.argv.includes("--validate-only"),
  });
}

module.exports = {
  FRONTEND_PUBLIC_DIR,
  listings,
  seedListings,
  validateSeedListings,
};
