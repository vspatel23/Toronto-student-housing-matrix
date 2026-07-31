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

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The frontend reads `VITE_API_URL` to connect to the backend API. For local development, the example value points to `http://localhost:5000`.

### Interactive Results Map

The Browse Results page uses React Leaflet to visualize listings and the selected campus. Set `VITE_MAPTILER_KEY` in the frontend environment to enable MapTiler raster tiles. When the key is omitted, the frontend uses OpenStreetMap tiles as a development fallback so local builds and CI are not blocked.

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
