"""Service factory for obtaining editing service instances."""

from src.services.edit_service.editor import Edit
from src.models.edit_image import EditResponse


class ImageImpainting:
    """Factory wrapper exposing dependency-injected editor instances.

    Keeps FastAPI dependency wiring minimal.
    Allows swapping the underlying editor implementation if needed.
    """
    @staticmethod
    def get_editor() -> EditResponse:
        """Provide a configured editor for request handlers."""
        return Edit()
