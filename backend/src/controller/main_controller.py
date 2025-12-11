"""FastAPI application bootstrap and routing setup."""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.utility.logger import AppLogger
from src.handlers.error_handler import MapExceptions as me
from src.controller.image_controller import router as generate_router

AppLogger.init(
    level=logging.INFO,
    log_to_file=True,
)

app = FastAPI()
me.register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)
app.include_router(generate_router)


@app.get("/", tags=["Health"])
def health_check():
    """Health probe indicating API wiring and logger setup succeeded."""
    return {"status": "ok", "message": "Setup Successfull"}


@app.get("/health", tags=["Health"])
def health_check():
    """Secondary health endpoint used by deployments and monitoring probes."""
    return {"status": "ok", "message": "FastAPI server running!"}
