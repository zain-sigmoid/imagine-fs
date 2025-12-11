# Imagine Backend
FastAPI backend that powers the Imagine full-stack app: generates images, streams progress to the UI, and serves paginated recent/related results.

## Features
- `/api/image/generate` and `/generate/stream` endpoints for synchronous or streaming image creation.
- Post-processing pipeline (OpenCV + Pillow) producing low/medium/high variants on every render.
- Related/recent image APIs with paging and caching-friendly metadata.
- Editing endpoints backed by Gemini/OpenAI with download support for any variant.
- Structured logging with colored console output and optional file logs.

## Folder structure
```
backend/
├─ README.md
├─ requirements.txt
├─ data/
│  ├─ outputs/          # Saved images + metadata JSON
│  └─ logs/             # Optional log files
├─ extra/               # Additional scripts/notebooks
└─ src/
   ├─ config/           # Option catalogs, themes, templates
   ├─ controller/       # FastAPI routers (image, health)
   ├─ handlers/         # Shared error handling
   ├─ models/           # Pydantic request/response schemas
   ├─ services/
   │  ├─ combination_service/   # LLM combiner + prompt building
   │  ├─ edit_service/          # Editing pipelines (Gemini/OpenAI/mock)
   │  ├─ image_generation_service/ # Generation + streaming + storage
   │  └─ post_service/          # Post-processing utilities
   └─ utility/         # Paths, logging, helpers
```

## Getting started
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env  # fill OPENAI_API_KEY / GEMINI_API_KEY etc.
uvicorn src.controller.main_controller:app --reload
```
API base: `http://localhost:8000/api/image`.

## Notes
- Images and metadata are written to `backend/data/outputs`.
- Related/recent endpoints support `offset`/`limit` pagination; keep requests to 6–12 items for best performance.
- Streaming responses emit `prompt`, `image_variant`, `done`, and optional error events as JSON lines.
