import { NEARBY_PLACE_CATEGORY_IDS } from "../utils/nearbyPlaceCategories.js";
import { CITYWIDE_NEARBY_PLACES } from "./citywideNearbyPlaces.js";

const {
  TRANSIT,
  GROCERY,
  PHARMACY,
  LIBRARY,
  PARK,
  GYM,
  CLINIC,
  CAMPUS,
} = NEARBY_PLACE_CATEGORY_IDS;

// Fixed Toronto points keep the demo deterministic without fabricating a
// location relative to each listing. Place records are a bundled snapshot of
// OpenStreetMap data; campus records reuse the project's campus seed data.
const DOWNTOWN_NEARBY_PLACES = Object.freeze(
  [
    {
      id: "osm-node-26240972",
      name: "TMU",
      category: TRANSIT,
      address: "3 Dundas Street East, Toronto, ON",
      latitude: 43.6565367,
      longitude: -79.3810223,
    },
    {
      id: "osm-node-34710078",
      name: "College",
      category: TRANSIT,
      address: "448 Yonge Street, Toronto, ON",
      latitude: 43.6606617,
      longitude: -79.3827952,
    },
    {
      id: "osm-node-254315320",
      name: "Metro",
      category: GROCERY,
      address: "89 Gould Street, Toronto, ON",
      latitude: 43.658216,
      longitude: -79.3768916,
    },
    {
      id: "osm-node-281361618",
      name: "Little Bee Supermarket",
      category: GROCERY,
      address: "140 Carlton Street, Toronto, ON",
      latitude: 43.6629585,
      longitude: -79.374966,
    },
    {
      id: "osm-node-253941150",
      name: "Shoppers Drug Mart",
      category: PHARMACY,
      address: "465 Yonge Street, Toronto, ON",
      latitude: 43.6615734,
      longitude: -79.3829277,
    },
    {
      id: "osm-node-380040875",
      name: "Toronto Public Library - St. Lawrence",
      category: LIBRARY,
      address: "171 Front Street East, Toronto, ON",
      latitude: 43.6499639,
      longitude: -79.3684534,
    },
    {
      id: "osm-way-224894996",
      name: "Allan Gardens",
      category: PARK,
      address: "160 Gerrard Street East, Toronto, ON",
      latitude: 43.6619333,
      longitude: -79.3744037,
    },
    {
      id: "osm-way-22913944",
      name: "College Park",
      category: PARK,
      address: "420 Yonge Street, Toronto, ON",
      latitude: 43.6595708,
      longitude: -79.3838363,
    },
    {
      id: "osm-node-2195060843",
      name: "Mattamy Athletic Centre",
      category: GYM,
      address: null,
      latitude: 43.6621946,
      longitude: -79.3802944,
    },
    {
      id: "osm-node-2674067744",
      name: "Cloud Care Clinic",
      category: CLINIC,
      address: "55 Dundas Street East, Toronto, ON",
      latitude: 43.6560308,
      longitude: -79.3787353,
    },
    {
      id: "campus-toronto-metropolitan-university",
      name: "Toronto Metropolitan University",
      category: CAMPUS,
      address: "350 Victoria Street, Toronto, ON",
      latitude: 43.6577,
      longitude: -79.3788,
    },
    {
      id: "campus-university-of-toronto-st-george",
      name: "University of Toronto - St. George",
      category: CAMPUS,
      address: "27 King's College Circle, Toronto, ON",
      latitude: 43.6629,
      longitude: -79.3957,
    },
  ].map((place) => Object.freeze(place)),
);

const placesById = new Map();

[...DOWNTOWN_NEARBY_PLACES, ...CITYWIDE_NEARBY_PLACES].forEach((place) => {
  if (!placesById.has(place.id)) {
    placesById.set(place.id, place);
  }
});

export const SEEDED_NEARBY_PLACES = Object.freeze([...placesById.values()]);
