# Toronto Student Housing Matrix

PRJ666 Team 04 — Final Project

Toronto Student Housing Matrix is a decision-support web application for students comparing rental options near Toronto-area campuses. It combines rent, campus commute estimates, neighbourhood safety indicators, amenities, furnishing, and an adjustable Value Score in one searchable interface.

## Public System

| Service | URL |
| --- | --- |
| Web application | <https://torontostudenthousingmatrix.vercel.app> |
| Backend API | <https://toronto-student-housing-backend.vercel.app> |
| API health check | <https://toronto-student-housing-backend.vercel.app/api/health> |

The frontend and backend are separate Vercel projects connected to MongoDB Atlas. The URLs above were verified during project closure.

## Project Artifacts

All required PRJ666 closure artifacts are available in this repository:

| Required artifact | Location |
| --- | --- |
| Project source code | [`frontend/`](frontend/) and [`backend/`](backend/) |
| Technical documentation | [`docs/TECHNICAL_DOCUMENTATION.md`](docs/TECHNICAL_DOCUMENTATION.md) |
| Installation and verification instructions | [Local Installation](#local-installation) |
| PRJ566 deviations and enhancements | [`docs/PROJECT_CLOSURE.md`](docs/PROJECT_CLOSURE.md#deviations-and-enhancements-from-prj566-proposal) |
| Public deployment instructions | [`docs/PROJECT_CLOSURE.md`](docs/PROJECT_CLOSURE.md#public-deployment--running-the-system) |
| Demo account instructions | [Demo / Test Account](#demo--test-account) |
| Listing-image specification | [`docs/listing-images.md`](docs/listing-images.md) |
| Commute demonstration scenarios | [`docs/sprint-3-commute-validation-scenarios.md`](docs/sprint-3-commute-validation-scenarios.md) |

## Implemented Functionality

- Account registration and login with bcrypt password hashing and JWT authentication.
- Campus, rent, housing type, safety, furnishing, amenity, and maximum-commute search criteria.
- AI-powered natural-language search that converts a housing description into validated filters through the backend OpenRouter integration.
- Listing cards, ranked results, result refinement, adjustable Value Score priorities, and recommendation badges.
- Listing details with ordered image galleries, safe image fallbacks, amenities, safety context, commute information, and score breakdowns.
- Interactive React Leaflet maps using OpenStreetMap data, optional MapTiler tiles, straight-line campus distance, and external Google Maps transit-direction links.
- Manual searches persist the authenticated user's current preference in the backend. The visible account tools include recent searches, saved listings/favourites, named collections, and public read-only collection sharing.
- Side-by-side comparison for up to three listings, monthly-cost comparison, and an authenticated AI comparison explanation.
- Monthly housing-cost calculator and deterministic nearby student essentials on listing details.
- Shareable URLs for searches, listings, comparisons, and shared collections.

Commute values are deterministic planning estimates rather than live TTC predictions. A valid stored estimate for the selected campus remains authoritative; otherwise, the backend can derive an estimate from validated listing and campus coordinates using straight-line distance plus a documented transit-planning heuristic. The system does not call a live TTC or routing API. Nearby-place data is also a bundled demo snapshot rather than a live business directory. Listing images are generated course-project imagery and are not verified photographs of the named properties.

## Architecture

```text
React + Vite frontend
        |
        | HTTPS / JSON
        v
Node.js + Express API
        |
        | Mongoose
        v
MongoDB Atlas

Natural-language search:
Frontend -> Express AI endpoint -> OpenRouter -> validated housing filters
```

The backend is the only component that receives the MongoDB URI, JWT secret, or OpenRouter key. Vite variables are embedded in the browser bundle and must never contain private server secrets. See [Technical Documentation](docs/TECHNICAL_DOCUMENTATION.md) for component, data-flow, endpoint, and security details.

## Repository Structure

```text
.
|-- .github/workflows/       # GitHub Actions validation
|-- backend/
|   |-- config/              # MongoDB and OpenRouter configuration
|   |-- constants/           # Supported filters and AI limits
|   |-- data/                # Default campus data
|   |-- middleware/          # JWT authentication
|   |-- models/              # Mongoose data models
|   |-- prompts/             # Grounded OpenRouter prompts
|   |-- routes/              # Express API endpoints
|   |-- scripts/             # Validation, index, and listing seed scripts
|   |-- services/            # AI orchestration and safe errors
|   |-- tests/               # Backend automated tests
|   |-- utils/               # Commute, scoring, image, filter, and comparison helpers
|   |-- render.yaml          # Optional Render backend blueprint
|   |-- server.js            # Express application entry point
|   `-- vercel.json          # Backend Vercel routing
|-- docs/                    # Technical and project-closure documents
|-- frontend/
|   |-- public/images/       # Listing assets and fallback image
|   |-- scripts/             # Image optimization utility
|   |-- src/components/      # Search, results, details, maps, saved, and compare UI
|   |-- src/data/            # Bundled nearby-place demo data
|   |-- src/styles/          # Feature-specific styles
|   |-- src/utils/           # API, map, scoring, image, and search helpers
|   |-- tests/               # Frontend unit and DOM tests
|   `-- vercel.json          # SPA build and route rewrites
`-- README.md                # Project entry point
```

## Local Installation

### Prerequisites

- Git.
- Node.js 24.x and npm. Node 24.x is the version used by the repository's GitHub Actions workflow.
- A MongoDB deployment. MongoDB Atlas is used for the public system; a reachable local MongoDB server can also be used for development.
- An OpenRouter account and API key to exercise AI search and AI comparison. The rest of the application can run without OpenRouter, but AI requests will return a controlled unavailable response.

### 1. Clone the repository

```bash
git clone https://github.com/vspatel23/Toronto-student-housing-matrix.git
cd Toronto-student-housing-matrix
```

### 2. Configure and run the backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env` and replace placeholders. At minimum, set:

```dotenv
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-host>/<database-name>
JWT_SECRET=<long-random-secret>
OPENROUTER_API_KEY=<openrouter-api-key>
OPENROUTER_MODEL=openai/gpt-4o-mini
FRONTEND_URL=http://localhost:5173
```

`MONGODB_URI` is accepted as an alternative to `MONGO_URI`. Do not commit `backend/.env`.

Validate the bundled listing data and then seed the configured database:

```bash
npm run seed:listings -- --validate-only
npm run seed:listings
```

The seed script upserts the sample listings. When the campuses collection is empty, the campus API inserts the bundled default campuses on its first request.

Start the development server:

```bash
npm run dev
```

For a production-style local start, use `npm start`. With the example port, the health check is <http://localhost:5000/api/health>.

### 3. Configure and run the frontend

Open another terminal from the repository root:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The example configuration points `VITE_API_URL` to `http://localhost:5000`. Vite normally serves the frontend at <http://localhost:5173>.

### Nearby Student Essentials

Listing Details uses a deterministic bundled OpenStreetMap snapshot to show
transit, groceries, pharmacies, libraries, parks, gyms, and clinics within a
2.5 km straight-line radius. The snapshot covers every active demo listing;
it is not a live business directory or routing service. The UI credits
[OpenStreetMap contributors](https://www.openstreetmap.org/copyright), and
distances use the same Haversine calculation as the listing map.

Existing environments must rerun `npm run seed:listings` from `backend` after
demo listing locations change. The seeder updates matching records by `seedId`
so their stored coordinates stay aligned with the bundled snapshot.

## Environment Variables

Placeholder-only templates are committed at [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example).

### Backend

| Variable | Requirement | Purpose |
| --- | --- | --- |
| `MONGO_URI` | Required | MongoDB connection string. |
| `MONGODB_URI` | Alternative | Backward-compatible alternative to `MONGO_URI`. |
| `JWT_SECRET` | Required for accounts | Signs and verifies login tokens. |
| `OPENROUTER_API_KEY` | Required for AI | Server-only OpenRouter credential. |
| `OPENROUTER_MODEL` | Optional | Structured-output model slug; defaults to `openai/gpt-4o-mini`. |
| `PORT` | Optional | Local server port; deployment providers may set it. |
| `FRONTEND_URL` | Production/custom origins | One additional allowed CORS origin. |
| `FRONTEND_URLS` | Optional | Comma-separated additional allowed CORS origins. |

### Frontend

| Variable | Requirement | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | Required outside matching defaults | Express API base URL. |
| `VITE_MAPTILER_KEY` | Optional | Protected browser key for MapTiler result-map tiles; OpenStreetMap is the fallback. |

Never place `MONGO_URI`, `MONGODB_URI`, `JWT_SECRET`, or `OPENROUTER_API_KEY` in a `VITE_` variable.

## Tests, Lint, and Build

Run backend verification from `backend/`:

```bash
npm test
npm run check
```

After configuring OpenRouter, `npm run check:ai` validates the key/model format without making a paid provider request or printing the key. `npm run check:indexes` connects to MongoDB and verifies indexes. The backend has no separate lint script; `npm run check` is its syntax-validation command.

Run frontend verification from `frontend/`:

```bash
npm test
npm run lint
npm run build
```

From the repository root, use `git diff --check` before submitting changes. GitHub Actions repeats frontend install/lint/test/build and backend install/check/test for pushes and pull requests targeting `main`.

## Public Deployment / Running the System

Production uses two Vercel projects from this repository:

1. The backend project uses `backend` as its root directory and [`backend/vercel.json`](backend/vercel.json) to route requests to Express.
2. The frontend project uses `frontend` as its root directory, `npm run build` as its build command, and `dist` as its output directory. [`frontend/vercel.json`](frontend/vercel.json) rewrites SPA routes to `index.html`.
3. MongoDB Atlas must provide a database user and network access that permits connections from the backend deployment.
4. Backend environment settings must contain the MongoDB URI and JWT secret. OpenRouter settings are required for the two AI features. Configure `FRONTEND_URL` or `FRONTEND_URLS` for any new/custom frontend origin.
5. Frontend environment settings must set `VITE_API_URL` to the deployed backend URL. `VITE_MAPTILER_KEY` is optional.
6. Redeploy after changing any frontend `VITE_` variable because Vite embeds it at build time.

Complete provider setup, verification, and alternative Render instructions are in [Project Closure Artifacts](docs/PROJECT_CLOSURE.md#public-deployment--running-the-system).

## Demo / Test Account

```text
Name: Demo Account
Email: tshm.demo@gmail.com
Password: Thsm@123
```

A dedicated demonstration account is provided for instructor testing. These credentials are intended only for evaluation of the deployed application.

## Security and Data Notes

- Real `.env` files are ignored; only placeholder `.env.example` files belong in Git.
- API keys, MongoDB credentials, JWT secrets, personal passwords, and authentication tokens must remain in local or deployment-provider environment settings.
- Passwords are hashed before storage, and authenticated API routes require a bearer token.
- Public collection sharing uses an opaque token and does not expose the owning user.
- Housing, safety, commute, image, and nearby-place records are course-project demonstration data. Users should independently verify a property, route, schedule, cost, and neighbourhood before making a housing decision.

## Additional Documentation

- [Technical Documentation](docs/TECHNICAL_DOCUMENTATION.md)
- [Project Closure Artifacts](docs/PROJECT_CLOSURE.md)
- [Listing Image Guide](docs/listing-images.md)
- [Sprint 3 Commute Validation Scenarios](docs/sprint-3-commute-validation-scenarios.md)
