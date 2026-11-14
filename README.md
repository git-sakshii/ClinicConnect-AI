# ClinicConnect AI

Multi-clinic appointment discovery and booking. This is a student pilot prototype; deployment and real patient use still need external setup and review.

## Current milestone

- The live deployment is currently in `demo-memory` mode. The MongoDB Atlas connection settings are present, but TLS connection attempts fail, so accounts, clinic applications, and appointments can be temporary. The app now warns users when the API reports temporary storage. Do not use real patient information until `/api/health` reports `mongodb` and persistence has been verified.
- Optional hosted AI matching is currently disabled on the live deployment because no OpenAI API key is configured there. The local rules-based matcher still handles a limited set of common requests.

- React + Vite patient discovery interface.
- Express API with user-triggered OpenStreetMap/Nominatim clinic searches, an interactive OSM map centered on Delhi NCR, and supported area searches for NCR and Bengaluru.
- In OSM mode, search by area and service, with an optional clinic name. Results show public listings, map pins and any contact details available in OSM; they do not have booking slots or clinic verification. Bookings are only available with approved ClinicConnect partners.
- Saved clinics persist in the browser using local storage.
- Clinic operators can register, sign in, edit their clinic profile, set open weekdays and appointment times, and review their own booking requests.
- New clinic profiles stay private until an administrator approves them. Admin sign-in is configured with environment variables.
- Patients can create accounts to request appointments with approved ClinicConnect partners. Requests are visible to the patient, that clinic and the administrator; they are not sent by email or WhatsApp yet.
- Passwords are hashed with Node's scrypt; the app uses signed HTTP-only, same-site cookies, login throttling and role-based data scoping.
- Browser speech-to-text input for English (India), Hindi and Kannada, with a local multilingual rules fallback for common appointment requests.
- Common acne/pimple wording in English and Hindi can suggest Dermatology; the assistant does not diagnose. The user confirms the suggested service before the clinic search applies it.
- Patients can type an area, choose a listed area, or select Any area. This prototype uses that area field rather than device GPS for nearby results.
- Optional OpenAI request matching through the Responses API. It is only enabled when the server has a key, and the patient must opt in before their text is sent. It suggests a service for the patient to confirm; it does not diagnose, check availability, or book.
- Sample bookings remain available for the classroom demo. MongoDB Atlas persistence can be enabled with `MONGODB_URI`; a replica set is required for atomic slot reservations.
- Live directory results are public OpenStreetMap data and may be incomplete or outdated. The prototype uses OSM's public Nominatim and map tile services without an API key; comply with the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) and [tile usage policy](https://operations.osmfoundation.org/policies/tiles/). Do not enter real patient or health information into the prototype until the remaining privacy, operational and deployment work is complete.

## Requirements

- Node.js 22.12+ (Node 24 LTS is suitable).
- npm 10+.
- MongoDB Atlas or a MongoDB replica-set deployment for persistent accounts and bookings. The API uses a transaction to reserve a slot and create a booking atomically.

## Run locally

```bash
npm install
npm install --prefix server
npm run dev
```

- Web app: <http://localhost:5173>
- API health: <http://localhost:3001/api/health>

Without a database connection, users, clinic applications and bookings are held in memory and may disappear when the API restarts or runs in another instance. Check `/api/health`; `mode: "mongodb"` indicates the API connected to MongoDB, while `demo-memory` means data is temporary. For local persistence, copy `.env.example` to `server/.env`, add `MONGODB_URI`, `MONGODB_DATABASE`, a long random `AUTH_SECRET`, and `ADMIN_EMAIL` plus `ADMIN_PASSWORD`, then restart the API. Add `OPENAI_API_KEY` to enable optional AI matching. Never commit `.env` or share its values. Sign in to the clinic portal with the configured admin email and password to approve clinic applications. Live OpenStreetMap lookup requires internet access. Searches are user-triggered, cached for one hour and limited to one Nominatim request per second; only the category and area are sent upstream. See the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/).

## Useful commands

```bash
npm run dev       # Start web and API together
npm run build     # Build the frontend
npm run lint      # Lint frontend source
npm start         # Start the API (for a separately served frontend)
```

## Remaining before a real pilot

- The current admin approval is an internal status toggle; it does not verify clinic registration, licenses or staff identity against official records.
- Account email verification and password recovery are not connected. Clinic and patient accounts are suitable for a controlled prototype only.
- Clinic schedules currently use a set of daily times and open weekdays. Appointment duration, breaks, holidays, doctor-level capacity and rescheduling rules still need implementation.
- Partner appointment requests require a patient account and an available clinic slot on the selected date. Admin and clinic accounts do not book as patients.
- Booking notifications, patient cancellation, reminders, audit history and operational support are not connected.
- WhatsApp Cloud API and voice-note ingestion are not connected. Browser voice input is not WhatsApp voice-note integration.
- OpenStreetMap listings are not ClinicConnect partners and cannot be booked. Sample profiles and times are synthetic.
- Before any real patient pilot: configure hosted MongoDB and HTTPS, set production secrets, add email verification and recovery, complete a privacy/consent and retention review, recruit and manually verify clinics, and test recovery, backups and incident handling.

See [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) for the end-to-end implementation roadmap.
