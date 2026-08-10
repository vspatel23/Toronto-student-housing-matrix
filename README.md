# Toronto Student Housing Matrix

PRJ666 Team 04 - Toronto Student Housing Matrix

## Description

Toronto Student Housing Matrix is a university project that helps students compare housing options near Toronto campuses. The application includes a React frontend for preference entry and housing comparison, and an Express API backed by MongoDB/Mongoose for listings, campuses, and saved preferences.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express + MongoDB/Mongoose
- CI/CD: GitHub Actions

## Folder Structure

```text
.
|-- backend/              # Express API, Mongoose models, routes, scripts
|-- frontend/             # Vite + React application
|-- .github/workflows/    # GitHub Actions workflows
|-- .gitignore
`-- README.md
```

## Local Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm start
```

Before starting the backend, replace the placeholder MongoDB URI in `backend/.env` with a real local or hosted MongoDB connection string.

### OpenRouter AI setup

The shared AI infrastructure uses OpenRouter from the backend only. Issue #59
does not add a public AI search endpoint or frontend AI integration.

1. Create an OpenRouter API key at <https://openrouter.ai/keys>.
2. Add the key and a model slug to your local `backend/.env`:

   ```dotenv
   OPENROUTER_API_KEY=your_real_key_here
   OPENROUTER_MODEL=openai/gpt-4o-mini
   ```

3. Install and validate the backend configuration, then start the server:

   ```bash
   cd backend
   npm install
   npm run check:ai
   npm start
   ```

`npm run check:ai` validates the local configuration without making a paid AI
request or printing the API key; it does not authenticate against OpenRouter.
When `OPENROUTER_MODEL` is omitted, the
backend defaults to `openai/gpt-4o-mini`, a relatively inexpensive model that
supports structured JSON output. After the server starts, confirm existing
backend operation at <http://localhost:5000/api/health> (or the `PORT` value in
your environment).

The reusable housing-filter validator rejects unknown top-level fields and
invalid supported values. OpenRouter output is parsed as JSON and must pass
this application-side validator before an API route can use it.

Never commit `backend/.env`. Keep the OpenRouter key out of frontend variables,
Vite source code, logs, tests, and API responses.

### Natural-language housing search API

Issue #60 exposes the Issue #59 AI infrastructure through:

```http
POST /api/ai/search
Content-Type: application/json
```

The JSON body must contain only a string `description`:

```json
{
  "description": "I want a furnished apartment near Toronto Metropolitan University between $1200 and $1800, within 30 minutes, with WiFi and Laundry."
}
```

Leading and trailing whitespace is removed. The trimmed description must not be
empty or exceed 1,500 characters. A successful response contains only the
normalized Issue #59 housing-filter representation:

```json
{
  "success": true,
  "filters": {
    "campus": "Toronto Metropolitan University",
    "minRent": 1200,
    "maxRent": 1800,
    "housingType": "Apartment",
    "maxCommute": 30,
    "safetyLevel": null,
    "furnished": "Furnished",
    "amenities": ["WiFi", "Laundry"]
  }
}
```

Errors use one safe envelope:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_DESCRIPTION",
    "message": "Housing description is required."
  }
}
```

| HTTP status | Error code | Common safe message |
| --- | --- | --- |
| `400` | `INVALID_DESCRIPTION` | `Housing description is required.` |
| `400` | `DESCRIPTION_TOO_LONG` | `Housing description must not exceed 1500 characters.` |
| `502` | `AI_OUTPUT_INVALID` | `AI service returned an invalid response.` |
| `503` | `AI_NOT_CONFIGURED` | `AI service is not configured.` |
| `503` | `AI_CONFIGURATION_INVALID` | `AI service configuration is invalid.` |
| `503` | `AI_SERVICE_UNAVAILABLE` | `AI service is temporarily unavailable.` |
| `504` | `AI_SERVICE_TIMEOUT` | `AI service request timed out.` |

Malformed JSON also uses `INVALID_DESCRIPTION`; parser-size failures use
`DESCRIPTION_TOO_LONG`. Both return the same JSON error envelope without a
stack trace.

The endpoint uses the backend-only OpenRouter configuration, prompt, error
types, and strict application-side filter validator established by Issue #59.
Unsupported criteria are omitted; a description with no supported criteria can
produce all `null` scalar filters and an empty `amenities` array. Invalid or
invented provider fields reject the provider output and are never returned.
This endpoint only translates text into filters. It does not query, create,
modify, recommend, or invent housing listings. Existing manual searches remain
on `GET /api/listings`; the frontend's established search mapping converts
`housingType` to that endpoint's `propertyType` query parameter.

### AI comparison recommendation API

Issue #63 adds a backend-only AI explanation layer for an existing comparison:

```http
POST /api/ai/compare
Authorization: Bearer <token>
Content-Type: application/json
```

The body must contain only `listingIds`, with exactly two or three unique,
valid MongoDB listing IDs:

```json
{
  "listingIds": [
    "64b000000000000000000001",
    "64b000000000000000000002"
  ]
}
```

The endpoint is authenticated so it can safely load the caller's newest saved
preference when one exists. A client cannot provide a user ID. An authenticated
user without a saved preference can still request a recommendation using the
listing data alone.

The server retrieves authoritative records from MongoDB and rejects missing or
inactive listings. OpenRouter receives only these sanitized listing fields:
`id`, `title`, `address`, `monthlyRent`, `propertyType`, `furnished`, the
applicable stored commute estimate, stored safety values, `amenities`, and the
existing application-calculated `valueScore`, `valueScoreBreakdown`, and an
optional `preferenceWeightedValueScore`. The latter maps the saved legacy
`rent` weight to the existing affordability component and normalizes the saved
weights application-side; it does not replace or mutate Value Score. OpenRouter
also receives the fixed Value Score weights. When available, the separate
sanitized saved-preference fields are `campus`, `minRent`, `maxRent`, `maxBudget`,
`housingType`, `maxCommute`, `safetyLevel`, `minimumSafetyLevel`, `amenities`,
and saved `weights`. Notes, account data, IDs, tokens, email, password data,
favorites, comparison history, and unrelated listing metadata are excluded.

A successful response uses this stable contract:

```json
{
  "success": true,
  "recommendation": {
    "bestOverall": {
      "listingId": "64b000000000000000000002",
      "reason": "This listing has the highest existing Value Score at 82/100 among the compared listings."
    },
    "bestBudget": {
      "listingId": "64b000000000000000000001",
      "reason": "This listing has the lowest supplied monthly rent at $1300 per month."
    },
    "bestCommute": {
      "listingId": "64b000000000000000000002",
      "reason": "This listing has the shortest supplied commute at 15 minutes for the applicable campus context."
    },
    "bestSafety": {
      "listingId": null,
      "reason": "The supplied listings do not include comparable safety data."
    },
    "listingInsights": [
      {
        "listingId": "64b000000000000000000001",
        "advantage": "It has the lowest supplied monthly rent at $1300 per month.",
        "compromise": "Its supplied commute is 10 minutes longer than the shortest compared commute."
      },
      {
        "listingId": "64b000000000000000000002",
        "advantage": "It has the highest existing Value Score at 82/100 among the compared listings.",
        "compromise": "It is stored as unfurnished in the listing data."
      }
    ],
    "recommendation": "Choose listing 64b000000000000000000002, which has the highest existing Value Score at 82/100. Important tradeoff: It is stored as unfurnished in the listing data."
  }
}
```

Budget, commute, safety, and overall IDs are checked against deterministic
application winners after the provider response. Equal metrics produce a
deterministic candidate set; the first submitted tied ID is the stable response
reference, and its application-rendered reason states the tie. When all compared listings lack usable
commute or safety data, that category's `listingId` is `null`. Neutral
missing-data fallbacks used inside Value Score are never presented as observed
facts.

Provider output must satisfy both OpenRouter's strict JSON Schema and a separate
application validator. The application first renders an allow-list of factual
category reasons, per-listing advantages/compromises, and final recommendation
sentences from stored/calculated data. The model selects exact strings from
that allow-list; invented or paraphrased prose is rejected. Unknown fields or
listing IDs, missing sections, duplicate or missing insights,
deterministic-winner contradictions, unapproved claims, and empty or oversized
text are returned as `AI_OUTPUT_INVALID`. Listing/user text is marked as
untrusted data in the prompt and cannot override the grounding rules.

Comparison request and lookup errors use the same safe error envelope as other
AI endpoints:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_COMPARISON_COUNT",
    "message": "Exactly 2 or 3 listing IDs are required."
  }
}
```

| HTTP status | Error code | Meaning |
| --- | --- | --- |
| `400` | `INVALID_COMPARISON_REQUEST` | The JSON body is malformed or contains fields other than `listingIds`. |
| `400` | `INVALID_COMPARISON_COUNT` | The request does not contain exactly two or three IDs. |
| `400` | `INVALID_LISTING_ID` | At least one ID is not a valid MongoDB ObjectId. |
| `400` | `DUPLICATE_LISTING_IDS` | The same listing was supplied more than once. |
| `404` | `LISTING_NOT_FOUND` | At least one authoritative listing does not exist. |
| `409` | `LISTING_INACTIVE` | At least one selected listing is inactive. |
| `502` | `AI_OUTPUT_INVALID` | Provider output failed parsing, schema, grounding-ID, or winner validation. |
| `503` | `AI_NOT_CONFIGURED` | The backend OpenRouter key is missing. |
| `503` | `AI_CONFIGURATION_INVALID` | The configured OpenRouter key/model is invalid. |
| `503` | `AI_SERVICE_UNAVAILABLE` | OpenRouter is temporarily unavailable or rate limited. |
| `504` | `AI_SERVICE_TIMEOUT` | The provider request exceeded the configured timeout. |
| `500` | `COMPARISON_SERVICE_UNAVAILABLE` | An unexpected internal comparison lookup/orchestration failure was safely hidden. |

Authentication failures preserve the existing authentication middleware
contract: HTTP `401` with `{ "message": "Invalid or expired token." }`.

This endpoint reuses the backend-only Issue #59 OpenRouter configuration and
does not create, update, or delete listings. It is an optional enhancement:
the public rule-based comparison page, numeric comparison values, Value Score,
manual listing APIs, and deterministic recommendation badges do not call or
depend on OpenRouter.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The frontend reads `VITE_API_URL` to connect to the backend API. For local development, the example value points to `http://localhost:5000`.

### Interactive Maps and Directions

Browse Results and individual Listing Details use React Leaflet with OpenStreetMap data to visualize listings and the selected campus. Listing Details labels its calculated geographic distance as straight-line distance; it is not route distance. Its Open Directions action opens a standard external Google Maps transit-directions URL and does not load the Google Maps JavaScript API or require a Google API key.

Set `VITE_MAPTILER_KEY` in the frontend environment to enable MapTiler raster tiles on Browse Results. When the key is omitted, Browse Results uses OpenStreetMap tiles so local builds and CI are not blocked. The Listing Details map uses OpenStreetMap tiles directly and requires no map key.

Configure the MapTiler key in the frontend deployment environment only. Because Vite embeds browser environment variables at build time, redeploy the frontend after adding or changing `VITE_MAPTILER_KEY`.

## Environment Variables

Environment examples are provided in:

- `frontend/.env.example`
- `backend/.env.example`

Do not commit real `.env` files, MongoDB URIs, API keys, passwords, or production environment values. Deployment providers should store production environment variables in their own environment settings.

## CI/CD

GitHub Actions is configured in `.github/workflows/ci.yml` for pushes to `main` and pull requests targeting `main`.

The workflow validates:

- Frontend dependency installation with `npm ci`
- Frontend linting with `npm run lint`
- Frontend production build with `npm run build`
- Backend dependency installation with `npm ci`
- Backend syntax validation with `npm run check`

The backend validation does not start the Express server and does not require a live MongoDB connection, so CI can run without committing or exposing database credentials.

## Sprint 3 Demo Scenarios

Commute validation scenarios are documented in [`docs/sprint-3-commute-validation-scenarios.md`](docs/sprint-3-commute-validation-scenarios.md). These scenarios show how commute time affects ranking, filtering, Value Score, recommendations, and comparison during the Sprint 3 review.

## Listing Image Assets

The listing image schema, fallback behavior, asset conventions, seed workflow,
and source policy are documented in
[`docs/listing-images.md`](docs/listing-images.md).

## Deployment Notes

The production frontend is deployed on Vercel:

- Frontend: <https://frontend-navy-one-si4pieuraf.vercel.app>
- Backend API: <https://toronto-student-housing-backend.vercel.app>

The frontend Vercel project must use `frontend` as its root directory, `npm run build` as the build command, and `dist` as the output directory. Set `VITE_API_URL` to the deployed backend API URL so the frontend can communicate with the deployed Express service.

The backend can be deployed to Vercel with `backend/vercel.json`, or to Render or a similar Node/Express hosting provider. Production `MONGO_URI` and `JWT_SECRET` must be configured in the deployment provider's environment settings and must not be committed to GitHub. Existing local setups that use `MONGODB_URI` are also supported.

## Issue Completion Note

This deployment and CI/CD preparation completes GitHub Issue #9 for the Sprint 1 technical foundation milestone.
