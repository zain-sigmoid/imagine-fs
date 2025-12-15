# Imagine (full-stack)

LLM-powered premium napkin designer with a React/Vite frontend and a FastAPI backend. Users pick a theme, tweak `palette/pattern/motif/style/finish filters`, and generate variants via streaming Gemini/OpenAI calls (with mock/local fallbacks) plus related/recent browsing.

## What’s inside
- React 19 + Vite UI (`frontend/`) with streaming generation, gallery, related/recent panes, downloads, edits, and selection-first flows.
- FastAPI service (`backend/src`) that streams generation events, serves paginated related/recent images, and supports downloads/deletes/edits.
- Post-processing and prompt utilities (OpenCV + Pillow), LLM combiner for defaulted selections, and metadata-backed storage.
- Inline mock paths remain available so the UI can run without external API costs.

### Mock Mode
- Set `RUN_MODE` as *mock* to run app without hitting gemini api, it will run using images from demo
- Set `RUN_MODe` as *actual* to run the actual app with fetching gemini or openai API

## Repository layout
```
.
├─ backend/                   # FastAPI app
│  ├─ README.md
│  ├─ requirements.txt
│  └─ src/
│     ├─ controller/          # Routers (generate/stream, related/recent, health)
│     ├─ services/            # generation, editing, post-processing, LLM combiner
│     ├─ models/              # Pydantic request/response schemas
│     ├─ config/              # Themes, options, templates
│     └─ utility/             # Paths, logging, helpers
└─ frontend/                  # React/Vite client
   ├─ README.md
   ├─ src/
   │  ├─ assets/              # static content
   │  ├─ pages/               # Home (streaming), Selections, Gallery, etc.
   │  ├─ components/          # Results gallery, sidebar, cards, etc.
   │  └─ context/             # userContext + UserState (API + paging/state)
   └─ public/ & index.html    # Static and inline assets
```

## Prerequisites
- Python 3.10+
- Node.js 18+ (tested with Vite 7/React 19)
- API keys (optional while using mock images):
  - `OPENAI_API_KEY`
  - `GEMINI_API_KEY`

## Backend setup (FastAPI)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env` for live generation:
```
OPENAI_API_KEY=sk-***
GEMINI_API_KEY=AIza***
```

Run the server (default port 8000):
```bash
uvicorn src.controller.main_controller:app --reload --port 8000
```

Notes:
- Streaming generation is at `/api/image/generate/stream`; synchronous at `/api/image/generate`.
- Related/recent paging is under `/api/image/related-images` and `/api/image/recent-images` (`offset`/`limit` supported).
- Images and metadata persist under `backend/data/outputs`; mock/demo runs can reuse any PNG/JPEG dropped there.

## Frontend setup (React/Vite)
```bash
cd frontend
npm install
```

Create `frontend/.env` (frontend defaults to `http://localhost:8000/api` if unset):
```
VITE_API_BASE_URL=http://localhost:8000/api
```

Run the client:
```bash
npm run dev
```

## Running the full stack locally
1. Start FastAPI: `uvicorn src.controller.main_controller:app --reload --port 8000` from `backend/`.
2. Start Vite: `npm run dev -- --host --port 5173` from `frontend/`.
3. Open the printed Vite URL (e.g., http://localhost:5173) and generate designs.

## API quick reference
- `GET /health` — service heartbeat.
- `POST /api/image/generate` — synchronous image generation, returns variants and IDs.
- `POST /api/image/generate/stream` — streams `prompt`, `image_variant`, `done` events as JSON lines.
- `POST /api/image/related-images` — paginated related images (requires `id`, `theme`, `type`, `selections`).
- `GET /api/image/recent-images` — paginated recent images.
- `GET /api/image/download` — download any variant by `imageId` and `level`.
- `DELETE /api/image/delete` or `/delete-all` — remove one or all generated assets.
- `POST /api/image/edit` — edit pipeline (Gemini/OpenAI capable).

## Customisation
- Prompt templates: `backend/src/config/templates.yml`
- Theme presets: `backend/src/config/themes.py`
- Dropdown options: `backend/src/config/options.py`
- Post-processing: `backend/src/services/post_service/post_processing.py`
- Frontend API base: `frontend/.env.local` (`VITE_API_BASE_URL`)

## Troubleshooting
- Empty options on load: `/api/image/options` falls back to defaults; confirm backend is reachable.
- No images returned: ensure `backend/data/outputs` has files (mock mode) or set API keys and enable live generation.
- OpenCV/Pillow import errors: reinstall with `pip install -r backend/requirements.txt` inside the virtual env (Apple Silicon may need `--no-binary opencv-python-headless`).
- Infinite paging calls: verify `offset`/`limit` passed from frontend and that `has_more`/`total` responses are used.

## License
This software is proprietary and confidential to Sigmoid Analytics, Inc.
Use, modification, or distribution outside Sigmoid is strictly prohibited.
