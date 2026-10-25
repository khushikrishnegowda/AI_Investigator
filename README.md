# Casefile — AI Mystery Room

An AI powered mystery investigation experience. Give the application a fictional premise, receive a case with a fixed culprit and connected evidence, inspect the suspects and timeline, then submit an accusation.

## Requirements

- Node.js 24.22.1 (pinned by `.node-version`) and npm
- MongoDB running locally, or a MongoDB connection string
- A Google Gemini API key

## Run locally

1. Copy `.env.example` to `.env` in the project root and set `GEMINI_API_KEY`, `JWT_SECRET`, and `MONGODB_URI`.
2. Install dependencies with `npm install`.
3. Start both applications with `npm run dev`.
4. Open `http://localhost:5173`.

The frontend runs on port 5173 and the API on port 5000. Vite proxies `/api` requests to the local backend.

## Project structure

- `frontend/` — React, Vite, responsive investigation interface
- `backend/src/` — Express API, Gemini generation, MongoDB models, validation and game logic
- `spec.md` — product and implementation requirements

## Case integrity

The backend generates and validates each case before storing it. It fixes the culprit at generation time and keeps the solution and internal clue classifications out of normal case responses. The backend evaluates accusations and reveals the solution only after a correct accusation or an explicit reveal request following an accusation. Gemini credentials remain server side.

Guests can create and play a case using its case URL. Register or sign in before creating a case to save it in the account dashboard. Guest access depends on keeping the case URL.

## API overview

- `POST /api/mysteries/generate` — create and persist a mystery and investigation
- `GET /api/investigations/:id` — retrieve the playable case without its hidden solution
- `PATCH /api/investigations/:id/notes` — save private notes
- `PATCH /api/investigations/:id/evidence/:evidenceId` — record evidence review
- `POST /api/investigations/:id/accusation` — evaluate a suspect selection
- `POST /api/investigations/:id/reveal-solution` — reveal after an accusation
- `POST /api/auth/register`, `POST /api/auth/login` — account access
- `GET /api/investigations` — list saved investigations for the signed in user

AI generation returns a clear error when Gemini is not configured or when generated data fails validation. No prewritten mystery is substituted.

## Deploy to Render

The production setup uses one Render Node web service. Express serves the built React app and the API from the same origin, while MongoDB Atlas stores application data. The Gemini key remains on the server.

1. Push this repository to a private GitHub repository. Confirm `.env` is ignored by Git and do not add any secret values to GitHub.
2. In Render, choose **New → Web Service**, connect the repository, select the repository root as the root directory, and choose the Node runtime.
3. Set the build command to `npm ci --include=dev && npm run build` and the start command to `npm start`. Including development dependencies is needed because Vite builds the frontend.
4. Add these environment variables in Render’s Environment settings: `NODE_ENV=production`, `MONGODB_URI`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, and `JWT_SECRET`. Enter secret values directly in Render’s dashboard. Keep both Gemini model settings as model IDs, not keys.
5. Set the health check path to `/api/health`, choose a region, and deploy.
6. In the Render service details, copy the service’s outbound IP ranges. In MongoDB Atlas, add those ranges to the project IP access list and confirm the database user used by `MONGODB_URI` has access to the target database.
7. Open the deployed `onrender.com` URL. Check `/api/health`, create a mystery, open the investigation, and try notes and accusation flow.

The free Render web service sleeps after 15 minutes of inactivity and can take about a minute to wake. It is suitable for a demo, not dependable always-on production use. Render’s outbound IP ranges are region-specific; avoid adding `0.0.0.0/0` to the Atlas allowlist unless you intentionally accept access from any IP. See the official Render and Atlas deployment guidance before selecting a paid plan or changing network access.

## Production routing

In production, Express serves `frontend/dist` and sends non-API page routes back to the React entry point. The frontend uses same-origin `/api` requests, so no production CORS or client-side Gemini configuration is needed. `NODE_ENV=production` also makes startup fail clearly if `MONGODB_URI`, `GEMINI_API_KEY`, or `JWT_SECRET` is missing.
