from __future__ import annotations

import os
import io
import base64
import logging
import datetime
import traceback
from datetime import datetime
from PIL import Image
from typing import Any, Dict, List, Optional, Literal

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from core.utils import Utility
from core.postprocessing import PostProcessing
from core.model import Imagine, Edit, Generate
from core.options import Options
from core.llm_combiner import LLMCombiner, GeminiClient

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)-8s | %(message)s")
ATTR_KEYS = ("color_palette", "pattern", "motif", "style", "finish")


class ImageItem(BaseModel):
    mime_type: str = "image/png"
    data_b64: str = ""

    @classmethod
    def from_pil(cls, img: Image.Image, fmt: str = "PNG"):
        buf = io.BytesIO()
        img.save(buf, format=fmt)
        return cls(
            mime_type=f"image/{fmt.lower()}",
            data_b64=base64.b64encode(buf.getvalue()).decode("utf-8"),
        )


class GenerateRequest(BaseModel):
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


class Combo(BaseModel):
    motif: Optional[str] = None
    pattern: Optional[str] = None
    color_palette: Optional[str] = None
    style: Optional[str] = None
    finish: Optional[str] = None


class ImageSet(BaseModel):
    combo: Combo = Field(default_factory=Combo)
    edited: bool = False
    variants: Dict[Literal["original", "low", "medium", "high", "edited"], ImageItem]


class GenerateResponse(BaseModel):
    status: int = 200
    message: str = "ok"
    image_sets: List[ImageSet] = Field(default_factory=list)
    recent_images: List[ImageItem] = Field(default_factory=list)


# class GenerateResponse(BaseModel):
#     status: int = 200
#     message: str = "Generation endpoint not yet implemented."
#     image_sets: Dict[str, Any] = Field(default_factory=dict)
#     recent_images: List[Dict[str, Any]] = Field(default_factory=list)


class EditRequest(BaseModel):
    combo_index: int = Field(..., alias="comboIndex")
    base_variant: str = Field(..., alias="baseVariant")
    prompt: str
    saved_path: Optional[str] = Field(default=None, alias="savedPath")

    model_config = {
        "populate_by_name": True,
        "str_strip_whitespace": True,
        "extra": "ignore",
    }

    @field_validator("prompt")
    def prompt_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Edit prompt must not be empty.")
        return value


class EditResponse(BaseModel):
    message: str = "Edit endpoint not yet implemented."
    edited: Optional[Dict[str, Any]] = None


app = FastAPI(title="Imagine FastAPI Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
async def healthcheck() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/generate", response_model=GenerateResponse, tags=["imagine"])
async def generate(payload: GenerateRequest) -> GenerateResponse:
    try:
        gen = Generate()
        prompt_design = Utility._strip_defaults(payload.selections)
        final_prompt = Imagine.build_napkin_prompt(
            theme_key=payload.theme, design=prompt_design, extra=payload.extra_detail
        )
        # img, variants = gen.generate_with_gemini(final_prompt)
        img, variants = gen.generate_mock_image(index=3)
        orig = ImageItem.from_pil(img)
        low = ImageItem.from_pil(variants["low"])
        medium = ImageItem.from_pil(variants["medium"])
        high = ImageItem.from_pil(variants["high"])
        edited = (
            ImageItem.from_pil(variants["edited"]) if variants.get("edited") else low
        )
        if img is None or variants is None:
            return GenerateResponse(message="Unable to generate Image")

        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        spec_parts = [prompt_design.get(key, "default") for key in ATTR_KEYS]
        short_spec = Utility._slug("-".join(spec_parts))[:60]
        theme_slug = Utility._slug(payload.theme)
        filename = f"napkin_{theme_slug}_{stamp}_{short_spec}.png"
        save_path = os.path.join("outputs/now", filename)
        comb_dict = payload.selections
        Imagine.save_image_with_metadata(
            img=img, save_path=save_path, combination=comb_dict
        )
        stat, images = Imagine.load_recent_images()
        recent_img = []
        if stat:
            for img in images:
                recent_img.append(ImageItem.from_pil(img))

        return GenerateResponse(
            status=200,
            message="Image generation successful",
            image_sets=[
                ImageSet(
                    combo=(
                        Combo(**payload.selections)
                        if isinstance(payload.selections, dict)
                        else Combo()
                    ),
                    edited=False,
                    variants={
                        "original": orig,
                        "low": low,
                        "medium": medium,
                        "high": high,
                        "edited": edited,
                    },
                )
            ],
            recent_images=recent_img,
        )
    except Exception as e:
        traceback.print_exc()
        logger.error(f"Error occurred : {e}")
        return GenerateResponse(
            message="Image Generation Failed",
        )


@app.post("/api/edit", response_model=EditResponse, tags=["imagine"])
async def edit(payload: EditRequest) -> EditResponse:
    """
    Placeholder endpoint for image editing.

    Hook up the Edit class from core once image editing workflow is ready.
    """
    logger.info(
        "Received edit request: combo_index=%s base_variant=%s",
        payload.combo_index,
        payload.base_variant,
    )

    # TODO: Invoke Edit().edit_with_gemini or similar core routine here.
    return EditResponse()


__all__ = ["app"]
