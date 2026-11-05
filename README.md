# ClinicConnect AI

Multi-clinic appointment discovery and booking. This repository currently contains the first interactive student-prototype milestone.

## Current milestone

- React + Vite patient discovery interface.
- Express API with sample clinic profiles, service filters, sample availability and appointment status updates.
- A rules-based booking helper that maps a few phrases to clinic-listed services. It is explicitly a demo matcher; no LLM is connected yet.
- Patient booking requests and a clinic portal demo with confirm/decline actions.
- In-memory data by default. MongoDB Atlas persistence can be enabled with `MONGODB_URI`.
- All clinic profiles and bookings are synthetic demo data. Do not enter real patient or health information.

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

Without a database connection, the API starts in temporary in-memory demo mode. Bookings disappear when the API restarts. To enable MongoDB, copy `.env.example` to `server/.env`, set `MONGODB_URI` and `MONGODB_DATABASE`, then restart the API. Never commit `.env` or share a database URI.

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
- WhatsApp Cloud API, bilingual message handling and voice transcription are planned, not connected.
- Sample clinic names and appointment times do not represent real providers or availability.

See [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) for the end-to-end implementation roadmap.
