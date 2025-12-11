"""Pydantic models for generation, sidebar, and related-image payloads."""

import io
import base64
from PIL import Image
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional, Literal


class ImageItem(BaseModel):
    """Image blob encoded as base64 with MIME metadata."""
    mime_type: str = "image/png"
    data_b64: str = ""


class Combo(BaseModel):
    """Describes a single design combination and rationale used for generation."""
    motif: Optional[str] = None
    pattern: Optional[str] = None
    color_palette: Optional[str] = None
    style: Optional[str] = None
    finish: Optional[str] = None
    rationale: Optional[str] = None


class GenerateRequest(BaseModel):
    """Payload describing the generation request and user selections."""
    theme: str
    enhancement: str
    extra_detail: Optional[str] = Field(default=None, alias="extraDetail")
    selections: Dict[str, Any] = Field(default_factory=dict)
    catalog: Dict[str, List[str]] = Field(default_factory=dict)

    model_config = {
        "populate_by_name": True,
        "str_strip_whitespace": True,
        "extra": "ignore",
    }


class ImageSet(BaseModel):
    """A collection of image variants and combo metadata for one design."""
    combo: Combo = Field(default_factory=Combo)
    edited: bool = False
    variants: Dict[Literal["original", "low", "medium", "high", "edited"], ImageItem]


class SidebarImage(BaseModel):
    """Lightweight representation for sidebar lists of generated images."""
    id: Optional[str] = None
    type: Optional[str] = ""
    theme: Optional[str] = ""
    name: List[str] = Field(default_factory=list)
    variants: Dict[Literal["original", "low", "medium", "high", "edited"], ImageItem]
    combo: Combo = Field(default_factory=Combo)


class RelatedRequest(BaseModel):
    """Request shape used to fetch related images for a generated item."""
    id: Optional[str] = ""
    theme: str
    type: str
    selections: Dict[str, Any] = Field(default_factory=dict)


class GenerateResponse(BaseModel):
    """Response envelope containing image sets and recent images."""
    status: int = 200
    message: str = "ok"
    image_sets: List[ImageSet] = Field(default_factory=list)
    recent_images: List[ImageItem] = Field(default_factory=list)
