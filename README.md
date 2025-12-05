# Imagine (full-stack)

LLM-powered premium napkin designer with a React/Vite frontend and a FastAPI backend. Users pick a theme, tweak palette/pattern/motif/style/finish filters, and generate variants with optional Gemini/OpenAI image calls or a built-in mock pipeline.

## What’s inside
- React 19 + Vite UI (`frontend/`) with a prompt builder, gallery, and sidebar for history and edit prompts.
- FastAPI service (`backend/api_server.py`) that builds prompts from `backend/core`, generates images (mocked by default), and returns enhanced variants.
- Post-processing and prompt utilities in `backend/core` (OpenCV, Pillow, YAML-based prompt templates).
- Sample renders and metadata under `backend/src/outputs` (latest saved to `backend/src/outputs/now`).

## Repository layout
```
.
├─ backend/          # FastAPI app + image/prompt core
│  ├─ api_server.py  # API entrypoint (health, generate, edit stub)
│  ├─ core/          # Prompt templates, options, post-processing, Gemini/OpenAI clients
│  └─ requirements.txt
└─ frontend/         # React/Vite client
   ├─ src/           # Pages, components, services/api.js
   └─ package.json
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

Run the server (default port 8001):
```bash
uvicorn api_server:app --reload --port 8001
```

Notes:
- The `/api/generate` route currently calls `Generate.generate_mock_image`, which reuses images from `backend/src/outputs/now`. Drop a few PNG/JPEG files there to demo the UI without API costs.
- Swap to live Gemini/OpenAI generation by switching the generator inside `generate` in `api_server.py`.

## Frontend setup (React/Vite)
```bash
cd frontend
npm install
```

Create `frontend/.env.local` (frontend defaults to `http://localhost:8001/api` if unset):
```
VITE_API_BASE_URL=http://localhost:8001/api
```

Run the client:
```bash
npm run dev -- --host --port 5173
```

## Running the full stack locally
1. Start FastAPI: `uvicorn api_server:app --reload --port 8001` from `backend/`.
2. Start Vite: `npm run dev -- --host --port 5173` from `frontend/`.
3. Open the printed Vite URL (e.g., http://localhost:5173) and generate designs.

## API quick reference
- `GET /health` — service heartbeat.
- `POST /api/generate` — body: `{ theme, enhancement, extraDetail?, selections, catalog }` → returns `image_sets` with base64 variants (`original`, `low`, `medium`, `high`, `edited`) and recent images.
- `POST /api/edit` — placeholder endpoint; wire to `Edit` in `backend/core/model.py` when ready.

## Customisation
- Prompt templates: `backend/core/templates.yml`
- Theme presets: `backend/core/themes.py`
- Dropdown options: `backend/core/options.py`
- Post-processing: `backend/core/postprocessing.py`

## Troubleshooting
- Empty options on load: frontend falls back to built-in defaults until a `/api/options` route is added.
- No images returned: ensure `backend/src/outputs/now` has files (mock mode) or set API keys and enable live generation.
- OpenCV/Pillow import errors: reinstall with `pip install -r backend/requirements.txt` inside the virtual env (Apple Silicon may need `--no-binary opencv-python-headless`).

## License
This software is proprietary and confidential to Sigmoid Analytics, Inc.
Use, modification, or distribution outside Sigmoid is strictly prohibited.
