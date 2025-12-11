"""Factories for image generation dependencies and option providers."""

from PIL import Image
from typing import List
from src.models.generate import (
    GenerateResponse,
)
from src.config.options import Options
from src.services.image_generation_service.model import Imagine
from src.services.image_generation_service.generate import Generation


class ImageGeneration:
    """Expose dependency providers for generation, storage, and configuration.

    Keeps FastAPI dependency wiring concise and centralized.
    Returns concrete service instances for request handlers.
    """

    @staticmethod
    def get_image_generation() -> GenerateResponse:
        """Provide the Generation service for API handlers."""
        return Generation()

    @staticmethod
    def get_imagine() -> List[Image.Image]:
        """Return the Imagine model used for persistence and retrieval."""
        return Imagine()

    @staticmethod
    def get_image_generation_options():
        """Return default option catalog used by generation endpoints."""
        return Options()
