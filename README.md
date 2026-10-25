# Casefile — AI Mystery Room

An AI powered mystery investigation experience. Give the application a fictional premise, receive a case with a fixed culprit and connected evidence, inspect the suspects and timeline, then submit an accusation.

## Requirements

- Node.js 20 or newer and npm
- MongoDB running locally, or a MongoDB connection string
- A Google Gemini API key

## Run locally

1. Copy `.env.example` to `.env` in the project root and set `GEMINI_API_KEY`, `JWT_SECRET`, and `MONGODB_URI`.
2. Install dependencies with `npm install`.
3. Start both applications with `npm run dev`.
4. Open `http://localhost:5173`.

The frontend runs on port 5173 and the API on port 5000. Set `VITE_API_URL` in a frontend `.env` file if the API uses another address.

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
