# Imagine Frontend
React + Vite client for the Imagine app. Streams image generation results from the backend, manages combos in context, and provides gallery, related, and recent views.

## Features
- Streaming render flow: shows variants as soon as the backend yields `image_variant` events.
- Context-driven state (`UserState`) for image sets, related/recent paging, and downloads.
- Gallery with tabbed variants, related images, recent images, and pagination (6 per page).
- Selections page for building prompts; Home flow for live generation; edit/download actions wired to the API.

## Folder structure
```
frontend/
├─ index.html               # Root HTML (includes inline logo)
├─ src/
│  ├─ main.jsx              # React entry, wraps App
│  ├─ App.jsx               # Routes and layout shell
│  ├─ context/              # userContext + UserState providers
│  ├─ services/api.js       # Thin API helpers (used by context)
│  ├─ components/           # Shared UI (cards, sidebar, gallery widgets)
│  ├─ pages/
│  │  ├─ Home.jsx           # Streaming generation experience
│  │  ├─ Selections.jsx     # Selection-first flow for prompts
│  │  └─ gallery/           # Gallery, Related, Previous, Sidebar, styling
│  ├─ assets/               # Static assets (icons/images)
│  ├─ config/               # Frontend config helpers
│  └─ styles (App.css/index.css) # Global styling
└─ public/                  # Static files served by Vite
```

## Running locally
```bash
cd frontend
npm install
npm run dev   # Vite dev server
```
The frontend expects the backend at `VITE_API_BASE_URL` (defaults to `http://localhost:8000/api`).

## Notes
- Related and recent images are fetched in pages of 6; already-fetched pages are cached in state to avoid duplicate calls.
- Streaming generation emits prompt and variant updates; the UI appends variants in real time and preserves combo metadata (including IDs).
- Update `.env` (or `frontend/.env`) to point to a non-default backend URL when needed.
