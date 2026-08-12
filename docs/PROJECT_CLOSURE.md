# PRJ666 Project Closure Artifacts

This document records the final delivery, PRJ566 scope comparison, public-server instructions, and instructor-access requirements for Toronto Student Housing Matrix.

## Artifact Availability

The GitHub repository at <https://github.com/vspatel23/Toronto-student-housing-matrix> is the authoritative project artifact location.

| PRJ666 requirement | Delivered artifact |
| --- | --- |
| Project source code | `frontend/` React/Vite client and `backend/` Node/Express API. |
| Project technical documents | [Technical Documentation](TECHNICAL_DOCUMENTATION.md), [Listing Image Guide](listing-images.md), and [Commute Validation Scenarios](sprint-3-commute-validation-scenarios.md). |
| Installation instructions | Root [README — Local Installation](../README.md#local-installation). |
| PRJ566 deviations | [Deviations and Enhancements](#deviations-and-enhancements-from-prj566-proposal) below. |
| Public server instructions | [Public Deployment / Running the System](#public-deployment--running-the-system) below. |
| Instructor test credentials | [Demo / Test Account](#demo--test-account) below. |

## Final Delivered Scope

The final system provides:

- a React/Vite browser application and Express/Mongoose backend;
- MongoDB Atlas persistence for accounts, listings, campuses, preferences, favourites, collections, and search history;
- JWT-based registration and login;
- manual advanced search and AI-assisted natural-language search;
- ranked listing cards, result refinement, listing details, generated image galleries, and safe image fallbacks;
- configurable Value Score priorities and recommendation indicators;
- listing/campus maps, straight-line location context, and external transit directions;
- deterministic campus commute estimates with explicit missing-data handling;
- backend persistence of the current manual-search preference, plus visible recent searches, saved listings/favourites, named collections, and read-only shared collections;
- listing comparison, cost estimation, cost comparison, and optional grounded AI comparison explanations; and
- bundled nearby student essentials for listing-location context.

The project uses demonstration housing, commute, safety, nearby-place, and generated-image data. It does not claim a live rental marketplace feed, live TTC travel predictions, or a live nearby-place service.

## Deviations and Enhancements from PRJ566 Proposal

The final implementation did not contain any significant deviations from the system proposed during PRJ566. The original project scope and primary objectives were maintained throughout development. However, several enhancements were added beyond the initial proposal to improve usability and the overall student housing search experience.

### Retained core objectives

The application continues to centre on helping Toronto students compare housing using more than rent alone. It retains housing search, campus context, affordability, commute, safety, amenities, listing review, and comparison as the primary decision-support workflow.

### Enhancements delivered beyond the initial proposal

#### AI-Powered Natural Language Search

Users can describe their housing requirements in normal language, for example:

> “I need a furnished place near Seneca Newnham under $1,500 with parking.”

The frontend sends the description to the backend AI endpoint. The backend uses its OpenRouter integration to convert the text into a strict, supported housing-filter structure. The application validates the provider response before applying the filters to the normal search flow; it does not allow the AI to invent listings.

#### Listing Images

Housing listing images were added to improve browsing and comparison. Result cards include compact galleries, while listing details include thumbnails and a full-size keyboard-accessible viewer. API and frontend normalization provide safe fallbacks for missing or invalid image data. The current images are original generated demo assets, not verified photographs of actual properties.

#### Interactive Maps and Directions

Browse Results links cards and markers on an interactive React Leaflet map. Listing Details shows valid listing and campus coordinates, labels calculated geographic distance as straight-line distance, and opens an external Google Maps transit-direction URL. OpenStreetMap is the default map source, with optional MapTiler result-map tiles.

#### Advanced Search and Filtering

The search experience was expanded with rent range, housing type, campus, maximum commute, safety, furnishing, and amenity criteria. Results can be refined without leaving the page, and active filters are clearly summarized.

#### Improved Listing Details and Decision Support

Listing Details now combines images, rent, commute, safety, amenities, Value Score factors, nearby essentials, map context, and a configurable monthly housing-cost calculator. The details view maintains graceful unavailable-data states instead of fabricating missing information.

#### Saved Preferences, Favourites, and Collections

Each authenticated manual search persists the user's current preference in the backend. The visible account tools let users revisit recent searches, favourite individual listings, and organize listings into named collections; there is no separate saved-preference manager. Collection owners can enable an opaque public share token that exposes only a read-only collection view.

#### Authentication and Shareable Routes

Registration and login use hashed passwords and JWT bearer tokens. Public searches, listing details, comparisons, and shared collections have stable URLs that can be copied and reopened without exposing private account data.

#### Comparison and Cost Tools

Users can compare up to three listings side by side. The comparison includes rent, commute, safety, property details, amenities, Value Score factors, and configurable monthly costs. An optional authenticated OpenRouter feature produces a grounded explanation from authoritative listing facts, while the deterministic comparison remains usable without AI.

These additions are enhancements to the retained PRJ566 concept, not replacements for its original requirements.

## Public Deployment / Running the System

### Current public deployment

| Service | Public URL |
| --- | --- |
| Frontend | <https://torontostudenthousingmatrix.vercel.app> |
| Backend API | <https://toronto-student-housing-backend.vercel.app> |
| Backend health | <https://toronto-student-housing-backend.vercel.app/api/health> |

The frontend and backend are independent Vercel projects from the same GitHub repository. This keeps browser assets and the Express API separately configurable while allowing the frontend to call the backend over HTTPS.

### Required external services

1. **MongoDB Atlas** stores production application data. Create a database user with an appropriately scoped password, choose the target database in the URI, and configure Atlas network access so the Vercel backend can connect. Store the URI only in backend deployment settings.
2. **OpenRouter** supplies natural-language filter extraction and grounded AI comparison explanations. Create a provider key and store it only in the backend deployment. Non-AI search, listings, maps, saved data, scoring, and deterministic comparison do not require OpenRouter.
3. **Vercel** builds and serves the two projects. Connect both to this repository and configure their root directories independently.
4. **MapTiler is optional.** A protected browser key enables its result-map tiles. Without it, the application falls back to OpenStreetMap; the details map already uses OpenStreetMap directly.

### Deploy the backend to Vercel

1. Import the GitHub repository as a new Vercel project.
2. Set the project root directory to `backend`.
3. Keep [`backend/vercel.json`](../backend/vercel.json), which builds `server.js` with the Vercel Node runtime and routes all requests to it.
4. Configure these backend environment variables for the appropriate Production and Preview environments:

   ```dotenv
   MONGO_URI=mongodb+srv://<username>:<password>@<cluster-host>/<database-name>
   JWT_SECRET=<long-random-secret>
   OPENROUTER_API_KEY=<openrouter-api-key>
   OPENROUTER_MODEL=openai/gpt-4o-mini
   FRONTEND_URL=https://<production-frontend-domain>
   FRONTEND_URLS=https://<optional-preview-or-custom-origin>,https://<another-origin>
   ```

   `MONGODB_URI` is supported instead of `MONGO_URI`. `OPENROUTER_MODEL` can be omitted to use the application default. `FRONTEND_URLS` is optional and accepts comma-separated origins. Vercel controls the serverless runtime and port; do not put provider-injected runtime flags in source-controlled files.

5. Deploy and verify both the API root and `/api/health`.
6. From a trusted local machine with the production MongoDB URI configured in an ignored `backend/.env`, validate and seed listing data:

   ```bash
   cd backend
   npm install
   npm run seed:listings -- --validate-only
   npm run seed:listings
   ```

7. Request `/api/campuses` once if the campus collection is new; the API inserts the bundled default campus records when that collection is empty.

### Deploy the frontend to Vercel

1. Import the same GitHub repository as a second Vercel project.
2. Set the root directory to `frontend`.
3. Use `npm run build` as the build command and `dist` as the output directory. These settings are also recorded in [`frontend/vercel.json`](../frontend/vercel.json).
4. Configure frontend environment variables:

   ```dotenv
   VITE_API_URL=https://<deployed-backend-domain>
   VITE_MAPTILER_KEY=<optional-origin-restricted-browser-key>
   ```

5. Deploy the frontend. Because Vite embeds `VITE_` variables in the bundle, redeploy after changing either value.
6. If a new custom or preview frontend origin is used, add its exact origin to the backend's `FRONTEND_URL` or `FRONTEND_URLS` and redeploy the backend.

Never copy a MongoDB URI, JWT secret, OpenRouter key, personal token, or password into a `VITE_` variable. Browser variables are public.

### Optional Render backend deployment

[`backend/render.yaml`](../backend/render.yaml) provides an alternative Node web-service blueprint. A Render service must set the backend directory as its root or otherwise execute the blueprint within `backend`, then provide the same MongoDB, JWT, OpenRouter, and frontend-origin variables described above. After deployment, set the Vercel frontend's `VITE_API_URL` to the Render service URL and rebuild the frontend.

### Production verification checklist

- [ ] Frontend root loads over HTTPS.
- [ ] Backend root and `/api/health` return JSON successfully.
- [ ] Registration and login work with the dedicated demo account.
- [ ] Campuses and active listings load.
- [ ] Manual and AI searches complete.
- [ ] Results, listing details, maps, images, and commute values render.
- [ ] Saving a preference and favourite works after login.
- [ ] Collections can be created, populated, shared, and opened read-only.
- [ ] Comparison works without AI; the AI explanation works when OpenRouter is configured.
- [ ] No secret appears in GitHub, browser source, frontend variables, or logs.

## Demo / Test Account

```text
Name: Demo Account
Email: tshm.demo@gmail.com
Password: Thsm@123
```

A dedicated demonstration account is provided for instructor testing. These credentials are intended only for evaluation of the deployed application.

The evaluator can also open the public result, listing, comparison, and shared-collection routes without an account, but the demo account is required to exercise saved preferences, recent searches, favourites, private collections, and authenticated AI comparison.

## Security Review for Submission

Before the final GitHub submission:

- [ ] Confirm only placeholder `.env.example` files are tracked.
- [ ] Confirm no personal password or personal test account is documented.
- [ ] Confirm no OpenRouter API key, MongoDB password/URI, JWT secret, deployment token, or authentication token is tracked.
- [ ] Confirm production secrets exist only in Vercel/Render environment settings.
- [ ] Confirm `VITE_` variables contain no private server credential.
- [ ] Run a repository secret scan appropriate to the team's workflow.
- [ ] Run `git diff --check`, both test suites, frontend lint/build, and backend syntax validation.

## Known Data and Service Boundaries

- Listing and campus records are controlled project fixtures, not a live marketplace feed.
- A valid stored campus commute remains authoritative. When that value is missing, the backend can derive a deterministic planning estimate from validated coordinates: eight minutes of access/wait time plus straight-line distance at a blended 22 km/h, rounded with a ten-minute minimum. It is not a live TTC result.
- `listing-021`, **Affordable Scarborough Basement**, intentionally lacks location and commute data to demonstrate `Data unavailable`; the other 26 active fixtures can estimate every supported campus.
- Map distance is the straight-line Haversine value itself. Commute uses it only as an input to the planning heuristic; neither is walking, driving, or actual transit route distance.
- Nearby student essentials are a bundled demo snapshot rather than a live business directory.
- Listing images are generated for this course project and are not verified property photographs.
- Safety fields are demonstration indicators and should not be treated as real-time safety guarantees.

These boundaries preserve a clear distinction between the implemented academic decision-support system and information that would require licensed live providers in a production commercial application.
