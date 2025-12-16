"""Models used for the edit-image endpoint payloads and responses."""

from pydantic import BaseModel, Field, field_validator
from typing import Dict, Literal
from src.models.generate import Combo, ImageItem


class EditRequest(BaseModel):
    """Incoming request describing which image to edit and how."""

    id: str = Field(alias="imageId")
    variant: str
    theme: str
    prompt: str
    type: str
    combo: Combo = Field(default_factory=Combo)

    model_config = {
        "populate_by_name": True,
        "str_strip_whitespace": True,
        "extra": "ignore",
    }

    @field_validator("prompt")
    def prompt_must_not_be_blank(cls, value: str) -> str:
        """Ensure the edit prompt has meaningful text before processing."""
        if not value.strip():
            raise ValueError("Edit prompt must not be empty.")
        return value


class EditResponse(BaseModel):
    """Response container for edited image variants and message."""

    message: str = "Edit endpoint not yet implemented."
    variants: Dict[Literal["edited", "low", "medium", "high"], ImageItem]
