# Technical Documentation

This document describes the implemented Toronto Student Housing Matrix system as delivered for PRJ666. It is based on the source code in this repository and intentionally does not describe unimplemented services.

## System Overview

Toronto Student Housing Matrix is a client-server web application. The React browser client presents search, listing, map, comparison, and saved-data interfaces. An Express API validates requests, applies housing rules, persists account and housing data through Mongoose, and keeps private credentials on the server.

```text
Browser
  React 19 + React Router + React Leaflet
                  |
                  | HTTPS / JSON
                  v
          Node.js + Express 5
                  |
                  | Mongoose 9
                  v
             MongoDB Atlas
```

Public deployment separates the frontend and backend into two Vercel projects. Local development similarly runs Vite and Express as separate processes.

## Technology Inventory

| Layer | Confirmed technology | Role |
| --- | --- | --- |
| Frontend | React 19 | Component-based browser interface. |
| Frontend tooling | Vite 8 | Development server and production bundle. |
| Routing | React Router 7 | Search, results, comparison, listing, saved, collection, and shared routes. |
| Maps | Leaflet + React Leaflet | Listing and campus map display. |
| Map data | OpenStreetMap | Default tiles, attribution, and bundled nearby-place snapshot. |
| Optional map tiles | MapTiler | Browser result-map tiles when a protected key is configured. |
| External directions | Google Maps web directions | Opens a transit-directions page; no Google Maps JavaScript API is loaded. |
| Backend | Node.js + Express 5 | JSON REST API and application rules. |
| Database | MongoDB Atlas + Mongoose 9 | Listings, campuses, users, preferences, saved listings, collections, and search history. |
| Authentication | bcryptjs + JSON Web Tokens | Password hashing and seven-day bearer tokens. |
| AI provider | OpenRouter | Structured natural-language filter extraction and grounded comparison explanations. |
| Testing | Node test runner, Testing Library, jsdom | Backend unit/route tests and frontend unit/DOM tests. |
| CI | GitHub Actions, Node 24.x | Install, check, test, lint, and production-build validation. |
| Hosting | Vercel | Separate frontend and Express backend projects. |

There is no live TTC travel-time API, live property feed, or live nearby-place provider. Commute values, housing listings, images, safety indicators, and nearby student essentials are demonstration data managed by the project.

## Frontend Design

The frontend entry point is `frontend/src/main.jsx`; it creates a browser router around `App`. `frontend/src/App.jsx` owns authentication and cross-route application state, coordinates API calls, and restores shareable routes from their query parameters.

### Main routes

| Browser route | Purpose | Account required |
| --- | --- | --- |
| `/` | Login/registration gate and housing search dashboard. | Yes for the dashboard workflow. |
| `/results?...` | Shareable listing results and interactive map. | No. |
| `/compare?ids=...&campus=...` | Shareable comparison for up to three listings. | No for rule-based comparison; AI explanation requires login. |
| `/listings/:listingId?campus=...` | Shareable listing details, images, costs, map, and nearby places. | No. |
| `/saved` | User's saved listings/favourites. | Yes. |
| `/saved/collections` | Create, rename, open, and delete private collections. | Yes. |
| `/saved/collections/:collectionId` | Manage one owned collection and its sharing state. | Yes. |
| `/shared/collections/:token` | Public read-only collection view. | No. |

The frontend uses one API helper to build URLs, parse JSON, and normalize backend errors. JWTs and the safe current-user object are stored in browser local storage. Sensitive server configuration is never sent to or read by the frontend.

### Search and results

The manual advanced form supports campus, property type, rent range, maximum commute, safety, furnishing, and amenities. A successful manual search requests active listings from the backend, records recent-search analytics for the authenticated user, and persists the current preference in the backend. The application does not expose a separate saved-preference manager; its visible saved-data tools are Recent Searches, Saved Listings, and Collections. The result page applies interactive refinements and ranks visible listings using the selected Value Score weights.

The result cards and map share listing selection state. Users can save a listing, open details, or add up to three listings to a comparison. Search and comparison context is encoded in URLs so a refreshed or shared route can reconstruct its public data.

### Listing details, maps, and images

Listing details present rent, property data, furnishing, estimated commute, safety, amenities, Value Score factors, generated image galleries, monthly-cost assumptions, location context, and nearby student essentials.

The map utilities validate coordinates before rendering them. The detail view calculates a Haversine straight-line distance between a valid listing coordinate and selected campus coordinate and labels it as straight-line distance, not route distance. The Open Directions action opens Google Maps with a transit-mode request. It does not send a Google API key from this project.

Result maps can use MapTiler tiles when `VITE_MAPTILER_KEY` is present. Otherwise they use OpenStreetMap. Detail maps use OpenStreetMap directly.

Listing image metadata is normalized by the API and browser. Invalid or missing images receive a project-owned fallback image. The complete schema, source policy, and asset process are in [Listing Image Guide](listing-images.md).

### Saved data and comparisons

Authenticated users can persist and revisit account-specific data:

- the current manual-search preference in the backend;
- recent-search records;
- individual listing favourites; and
- named collections of listings.

Collections can be shared through an opaque token. The public endpoint returns the collection's public name/description and listing data but not its owner.

The comparison interface presents rent, commute, safety, property details, amenity differences, calculated monthly costs, Value Score, and factor breakdowns. It works without AI. When an authenticated user requests an AI explanation, the backend loads authoritative listing data and recalculates the relevant scores before contacting OpenRouter.

## Backend Design

`backend/server.js` creates the Express application, connects to MongoDB, configures CORS and JSON parsing, mounts route modules, and exports the app for serverless deployment and tests. It starts a local listener unless Vercel has set its provider flag.

### Data models

| Model | Important stored data |
| --- | --- |
| `User` | Name, normalized unique email, bcrypt password hash. |
| `HousingListing` | Seed ID, property facts, location, safety data, per-campus commute estimates, transit, amenities, images, active status. |
| `Campus` | Institution, campus name, address, latitude, longitude. |
| `SavedPreference` | User, search criteria, notes, historical weighting/favourite fields. |
| `SavedListing` | Unique user/listing favourite and saved timestamp. |
| `Collection` | Owner, name, description, listing IDs, optional opaque share token. |
| `SearchAnalytics` | User and recent campus/rent/type/commute search fields. |

Mongoose schema validation constrains property and amenity values, numeric ranges, image metadata, and account fields. Database indexes cover common rent/type/safety/location, ownership, saved-listing uniqueness, and recent-search access patterns.

## AI Architecture

### Natural-language housing search

```text
User description
  -> POST /api/ai/search
  -> request shape and 1,500-character validation
  -> backend-only OpenRouter request
  -> strict JSON response
  -> application housing-filter validator
  -> normalized filters returned to React
  -> normal listing search flow
```

For example, a request such as “I need a furnished place near Seneca Newnham under $1,500 with parking” is translated into supported structured criteria. Unsupported or invented provider fields are rejected. This endpoint translates text into filters; it does not invent or directly modify housing listings.

### AI comparison explanation

`POST /api/ai/compare` accepts exactly two or three listing IDs plus the current campus and Value Score weights. It requires a bearer token. The backend validates identifiers, loads active listings from MongoDB, calculates scores using the same deterministic application logic, and constructs an allow-list of supported statements. OpenRouter selects from grounded facts; application validation rejects unknown listings, unsupported claims, contradictory winners, or malformed responses.

The rule-based comparison and its numeric facts remain available when OpenRouter is unavailable.

### AI safety and failure handling

- The OpenRouter key exists only in backend environment settings.
- Provider requests have a 20-second timeout.
- Invalid input, missing configuration, unavailable provider, timeout, rate limit, and invalid output use controlled error envelopes.
- The configuration check validates local formatting without making a paid request or printing the API key.
- Listing/user text is treated as untrusted data in comparison prompts.

## Commute Estimation

The backend owns commute normalization in `backend/utils/commute.js`. Every API listing response is normalized against the six supported campuses so result cards, filters, details, comparisons, recommendations, and Value Score receive the same applicable values.

For a supported selected campus, the backend follows this deterministic sequence:

1. Normalize campus punctuation and labels so compatible names resolve safely.
2. Preserve a valid stored estimate for the selected campus; stored fixture values remain authoritative.
3. If that campus estimate is missing, validate the listing and bundled campus `location.lat` and `location.lng` values. Numeric strings are accepted. Blank values, booleans, non-finite values, out-of-range values, and zero coordinates are rejected.
4. Calculate Haversine straight-line distance between the two coordinates.
5. Apply the planning heuristic: eight minutes for access/waiting plus travel at a blended 22 km/h, rounded to the nearest minute, with a ten-minute minimum.

The heuristic converts geographic distance into a consistent demonstration estimate; it is not a measured route and does not query TTC, Google, or another routing API. An unknown or missing campus, malformed listing, or unavailable coordinate pair returns `Data unavailable` instead of crashing or fabricating a value.

All 27 active seed listings have sufficient location data to produce an estimate for all six supported campuses. `listing-021`, **Affordable Scarborough Basement**, has no stored commute estimates and therefore exercises the coordinate-derived fallback from its representative Munham Gate location. `listing-024`, **Etobicoke Shared House Room**, uses the corrected approximate location **Mabelle Avenue near Islington Station, Toronto, ON** at `43.6463, -79.5254`.

Map distance is a related but distinct UI value. It reports the Haversine result directly as straight-line distance; commute uses that distance only as input to the access/wait-and-speed heuristic. Neither value is walking, driving, or actual transit route distance.

## API Reference

Unless otherwise stated, request and response bodies use JSON. Authenticated routes require `Authorization: Bearer <token>`.

### System and authentication

| Method | Route | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/` | No | API availability message. |
| `GET` | `/api/health` | No | Backend health response. |
| `POST` | `/api/auth/register` | No | Create a user, hash the password, and return a JWT. |
| `POST` | `/api/auth/login` | No | Validate credentials and return a JWT. |
| `GET` | `/api/auth/me` | Yes | Return the safe current-user profile. |

Registration requires `name`, `email`, and a password of at least six characters. Login requires `email` and `password`. JWTs expire after seven days.

### Listings and campuses

| Method | Route | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/listings` | No | Return active listings with normalized images and calculated scores. |
| `GET` | `/api/listings/:id` | No | Return one listing with normalized images and calculated score. |
| `GET` | `/api/campuses` | No | List campuses; insert bundled defaults when the collection is empty. |
| `GET` | `/api/campuses/:id` | No | Return one campus. |

`GET /api/listings` supports `minRent`, `maxRent`, `propertyType`, `safetyLevel`, and `campus`. The campus determines applicable commute scoring. Additional furnishing, amenity, and maximum-commute refinements are applied consistently in the results interface.

### Preferences and search history

| Method | Route | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/preferences` | Yes | Save a user's search preference. |
| `PUT` | `/api/preferences/:preferenceId` | Yes | Update an owned preference. |
| `GET` | `/api/preferences` | Yes | List the current user's preferences, newest first. |
| `POST` | `/api/analytics/search` | Yes | Record or refresh a recent search. |
| `GET` | `/api/analytics/recent` | Yes | Return up to ten recent searches. |

### Saved listings and collections

| Method | Route | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/saved-listings` | Yes | Save a listing idempotently. |
| `DELETE` | `/api/saved-listings/:listingId` | Yes | Remove a saved listing. |
| `GET` | `/api/saved-listings` | Yes | Return the user's saved listing data. |
| `POST` | `/api/collections` | Yes | Create a named collection. |
| `GET` | `/api/collections` | Yes | List owned collection summaries. |
| `GET` | `/api/collections/:id` | Yes | Return one owned collection and listings. |
| `PUT` | `/api/collections/:id` | Yes | Rename/update an owned collection. |
| `DELETE` | `/api/collections/:id` | Yes | Delete an owned collection. |
| `POST` | `/api/collections/:id/share` | Yes | Create or return an opaque share token. |
| `DELETE` | `/api/collections/:id/share` | Yes | Disable public sharing. |
| `POST` | `/api/collections/:id/listings` | Yes | Add a listing to an owned collection. |
| `DELETE` | `/api/collections/:id/listings/:listingId` | Yes | Remove a listing from an owned collection. |
| `GET` | `/api/collections/shared/:token` | No | Return a public read-only shared collection. |

### AI

| Method | Route | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/ai/search` | No | Convert one housing description into validated filters. |
| `POST` | `/api/ai/compare` | Yes | Generate a grounded explanation for two or three authoritative listings. |

Natural-language search accepts only `{ "description": "..." }`. AI comparison accepts exactly `listingIds`, `campus`, and `valueScoreWeights`.

Natural-language search example:

```http
POST /api/ai/search
Content-Type: application/json

{
  "description": "I need a furnished place near Seneca Newnham under $1,500 with parking."
}
```

Successful responses contain `success: true` and the normalized filter object. Scalar criteria that were not supplied are `null`, and amenities default to an empty array. The description is trimmed, must not be empty, and cannot exceed 1,500 characters.

AI comparison example:

```http
POST /api/ai/compare
Authorization: Bearer <token>
Content-Type: application/json

{
  "listingIds": [
    "<listing-object-id-1>",
    "<listing-object-id-2>"
  ],
  "campus": "Seneca Polytechnic -- Newnham",
  "valueScoreWeights": {
    "affordability": 35,
    "commute": 25,
    "safety": 25,
    "amenities": 15
  }
}
```

AI route failures use a safe envelope and never include the provider key, stack trace, or raw provider response:

```json
{
  "success": false,
  "error": {
    "code": "AI_SERVICE_UNAVAILABLE",
    "message": "AI service is temporarily unavailable."
  }
}
```

Controlled codes distinguish invalid descriptions/comparison requests, missing or invalid AI configuration, invalid provider output, provider unavailability, and timeouts. Authentication failures retain the authentication middleware's HTTP 401 response.

## Environment Configuration

Use the committed placeholder templates; never commit real `.env` files.

### Backend variables

| Variable | Required | Details |
| --- | --- | --- |
| `MONGO_URI` | Yes | MongoDB URI used by the public deployment and scripts. |
| `MONGODB_URI` | Alternative | Supported fallback alias for existing/local configurations. |
| `JWT_SECRET` | For authentication | Long random token-signing secret. |
| `OPENROUTER_API_KEY` | For AI features | Private server-only provider credential. |
| `OPENROUTER_MODEL` | No | Valid model slug; omission selects `openai/gpt-4o-mini`. |
| `PORT` | No | Local listener port; provider may inject it. |
| `FRONTEND_URL` | As needed | One allowed frontend CORS origin. |
| `FRONTEND_URLS` | No | Comma-separated additional allowed origins. |

Vercel injects its own runtime indicator. It is implementation detail and does not belong in a developer `.env` file.

### Frontend variables

| Variable | Required | Details |
| --- | --- | --- |
| `VITE_API_URL` | Yes in deployment | Absolute backend base URL. |
| `VITE_MAPTILER_KEY` | No | Origin-restricted browser key for optional tiles. |

All `VITE_` values are public at build time. Do not put a database URI, JWT secret, OpenRouter key, personal token, or password in a frontend variable.

## Data Seeding

`backend/scripts/seedListings.js` is the source-controlled listing fixture. It validates metadata and image files, then upserts records by stable `seedId`; it does not delete unrelated database records. Active records are returned by the listing API, while inactive samples exercise active-listing behavior.

From `backend/`:

```bash
npm run seed:listings -- --validate-only
npm run seed:listings
```

The second command requires `MONGO_URI` or `MONGODB_URI`. Default campus records are stored in `backend/data/defaultCampuses.js` and inserted by the campus API only when the campus collection is empty.

## Verification Commands

Backend:

```bash
cd backend
npm test
npm run check
```

Frontend:

```bash
cd frontend
npm test
npm run lint
npm run build
```

Repository whitespace validation:

```bash
git diff --check
```

See the root [README](../README.md#local-installation) for complete fresh-clone installation instructions and [Project Closure Artifacts](PROJECT_CLOSURE.md#public-deployment--running-the-system) for public deployment steps.

## Security Boundaries

- Passwords are stored as bcrypt hashes and omitted from normal Mongoose queries and JSON serialization.
- JWT authentication loads the current user from the token subject rather than accepting a client-supplied user ID.
- Preferences, saved listings, analytics, and private collections scope database operations to the authenticated user.
- Shared collections use an opaque share token and return no owner account data.
- Listing image sources reject unsafe protocols, credentials in URLs, traversal, and private filesystem paths.
- AI secrets remain on the backend; provider failures use safe response messages.
- Real production values belong in Vercel/Render settings or an ignored local `.env`, never GitHub.
