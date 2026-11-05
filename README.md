# ClinicConnect AI

Multi-clinic appointment discovery and booking. This repository currently contains the first interactive student-prototype milestone.

## Current milestone

- React + Vite patient discovery interface.
- Express API with a live, user-triggered OpenStreetMap/Nominatim clinic search for Indiranagar, Koramangala and Whitefield, plus a clearly separated sample-data mode.
- Live listings include OpenStreetMap links and map directions. The prototype does not invent live schedules, contact details or verification; contact a provider directly to confirm them.
- Saved clinics persist in the browser using local storage.
- Browser speech-to-text input for English (India) and Kannada, with simple bilingual concern-to-speciality keyword matching. This is not an LLM or medical advice.
- A rules-based booking helper that maps a few phrases to clinic-listed services. It is explicitly a demo matcher; no LLM is connected yet.
- Patient booking requests and a clinic portal demo with confirm/decline actions.
- In-memory data by default. MongoDB Atlas persistence can be enabled with `MONGODB_URI`.
- The sample directory and bookings are synthetic. Live directory results are public OpenStreetMap data and may be incomplete or outdated. Do not enter real patient or health information into this student prototype.

## Requirements

- Node.js 22.12+ (Node 24 LTS is suitable).
- npm 10+.
- Optional: MongoDB Atlas or a MongoDB replica-set deployment for persistent bookings. The API uses a transaction to reserve a slot and create a booking atomically.

## Run locally

```bash
npm install
npm install --prefix server
npm run dev
```

- Web app: <http://localhost:5173>
- API health: <http://localhost:3001/api/health>

Without a database connection, the API starts in temporary in-memory demo mode. Bookings disappear when the API restarts. To enable MongoDB, copy `.env.example` to `server/.env`, set `MONGODB_URI` and `MONGODB_DATABASE`, then restart the API. Never commit `.env` or share a database URI. Live OpenStreetMap lookup requires internet access. Searches are user-triggered, cached in the server for one hour, rate-limited to at most one request per second, and send only a generic clinic/service category and area to Nominatim; the free-text search stays in the app. See the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/).

## Useful commands

```bash
npm run dev       # Start web and API together
npm run build     # Build the frontend
npm run lint      # Lint frontend source
npm start         # Start the API (for a separately served frontend)
```

## Current limitations

- Login, roles and clinic onboarding are not implemented yet; the clinic portal is a demo view.
- Schedule rules and profile editing are the next backend milestone.
- Assistant matching uses a small hard-coded keyword map. It is not AI, diagnosis or medical advice.
- WhatsApp Cloud API is planned, not connected. Browser voice input is not WhatsApp voice-note integration.
- Sample clinic names and appointment times do not represent real providers or availability. Live OpenStreetMap directory entries are not onboarded ClinicConnect partners and cannot be booked through this prototype.

See [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) for the end-to-end implementation roadmap.
