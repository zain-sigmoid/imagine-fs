"""Orchestrates synchronous and streaming image generation workflows."""

import os
import io
import json
import time
import asyncio
import requests
import traceback
from PIL import Image
from io import BytesIO
from google import genai
from openai import OpenAI
from socket import gaierror
from termcolor import colored
from datetime import datetime
from typing import AsyncIterator, Dict, List, Tuple, Any

from src.models.generate import (
    GenerateResponse,
    GenerateRequest,
    ImageItem,
    ImageSet,
    Combo,
)
from src.utility.utils import Helper
from src.utility.path_finder import Finder
from src.handlers.error_handler import MapExceptions
from src.services.image_generation_service.model import Imagine
from src.services.post_service.post_processing import PostProcessing
from src.services.combination_service.llm_combiner import GeminiClient
from src.services.combination_service.make_combinations import Combinations
from src.utility.logger import AppLogger

logger = AppLogger.get_logger(__name__)


class Generate:
    """Low-level image generation helpers using OpenAI, Gemini, or local mocks.

    Handles API calls, post-processing, and basic error mapping.
    Intended to be invoked by higher-level Generation orchestration.
    """

    def __init__(
        self,
    ):
        """Set up paths, post-processing, and exception mappers."""
        self.path = Finder()
        self.post_processing = PostProcessing()
        self.exceptions = MapExceptions()

    def generate_with_openai(
        self, final_prompt: str, model_name: str = "dall-e-3"
    ) -> Tuple[Image.Image, Dict[str, Image.Image]]:
        """Call OpenAI images API to generate variants for the provided prompt."""
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return {
                "status": False,
                "type": "Key Error",
                "msg": "OPENAI_API_KEY is not set.",
            }
        client = OpenAI(api_key=api_key) if api_key else None
        gen_kwargs = {
            "model": model_name,
            "prompt": final_prompt,
            "size": "1024x1024",
            "quality": "hd",
        }
        try:
            resp = client.images.generate(**gen_kwargs)
            if not resp or not getattr(resp, "data", None):
                return None, None
            else:
                for i, item in enumerate(resp.data, start=1):
                    if getattr(item, "b64_json", None):
                        img = self.b64_to_image(item.b64_json)
                    elif getattr(item, "url", None):
                        try:
                            logger.info("Fetching image from URL")
                            resp = requests.get(item.url, timeout=10)
                            resp.raise_for_status()
                            img = Image.open(io.BytesIO(resp.content)).convert("RGBA")
                        except Exception as e:
                            logger.warning(f"Could not fetch image from URL: {e}")
                            return None, None
                    else:
                        logger.info(f"Result {i}: Unrecognized response format.")
                        return None, None
                    if img is not None:
                        logger.info("Image generated successfully")
                        low, med, high = self.post_processing.apply_post_processing(img)
                        return img, {"low": low, "medium": med, "high": high}
        except gaierror as e:
            logger.error("Cannot reach server")
            return {
                "status": False,
                "type": "network",
                "msg": "Cannot reach Gemini servers. Check internet/DNS/VPN.",
                "details": str(e),
            }
        except Exception as e:
            logger.error(f"Error Occurred while generating:{e}")
            raise self.exceptions.map_openai_exception(e)

    def generate_with_gemini(
        self,
        prompt: str,
    ) -> Tuple[Image.Image, Dict[str, Image.Image]]:
        """Generate an image with Gemini and return base plus enhanced variants."""
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not gemini_api_key:
            logger.error("GEMINI API Key not Found")
            return None, None
        client_gemini = genai.Client(api_key=gemini_api_key)
        """
        Calls the image model and returns a tuple of (original_image, enhanced_variants).
        enhanced_variants is a dict with keys low/medium/high or None on failure.
        """
        try:
            logger.info("generating image with Gemini Model")
            # --- Gemini image generation ---
            resp = client_gemini.models.generate_content(
                model="gemini-2.5-flash-image",
                contents=[prompt],
            )
            candidates = getattr(resp, "candidates", []) or []
            for candidate in candidates:
                parts = getattr(
                    candidate, "content", getattr(candidate, "contents", None)
                )
                parts = getattr(parts, "parts", []) if parts is not None else []
                for part in parts:
                    if part.inline_data is None:
                        continue
                    img = Image.open(BytesIO(part.inline_data.data)).convert("RGBA")
                    low, medium, high = self.post_processing.apply_post_processing(img)
                    return img, {"low": low, "medium": medium, "high": high}
            return None, None

        except Exception as e:
            logger.error(f"Could not generate image: {e}")
            raise self.exceptions.map_gemini_exception(e)

    def generate_mock_image(
        self, index: int, folder: str = "demo", count: int = 3
    ) -> Tuple[Image.Image, Dict[str, Image.Image]]:
        """
        Function to retun mock images to test the UI instead of generating images repeatedly
        """
        logger.info(f"generating mock for image {index}")
        folder_path = self.path.get_directory("data") / folder
        image_files = sorted(
            [
                f
                for f in os.listdir(folder_path)
                if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
            ],
            key=lambda x: os.path.getmtime(os.path.join(folder_path, x)),
            reverse=True,
        )[:count]
        index = index - 1
        if not image_files:
            return None, None
        img_path = os.path.join(folder_path, image_files[index])
        img = Image.open(img_path).convert("RGBA")
        if img is not None:
            low, medium, high = self.post_processing.apply_post_processing(img)
            return img, {"low": low, "medium": medium, "high": high}
        return None, None


class Generation:
    """Coordinate prompts, generation, storage, and streaming responses.

    Manages combination selection, prompt preparation, and metadata saving.
    Provides both synchronous and streaming interfaces for clients.
    Uses helpers for post-processing and rationale generation when needed.
    """

    def __init__(self):
        """Initialize generation dependencies and reusable helpers."""
        self.attr_keys = ("color_palette", "pattern", "motif", "style", "finish")
        self.generate = Generate()
        self.utility = Helper()
        self.imagine = Imagine()
        self.path = Finder()
        self.combinations = Combinations()
        self.gemini_client = GeminiClient()
        self.run_mode = os.getenv("RUN_MODE", "actual")

    def _pre_loading(self, combo: dict, context: GenerateRequest) -> str:
        """Prepare prompt content and cleaned combo design before generation."""
        prompt_design = self.utility._strip_defaults(combo)
        final_prompt = self.imagine.build_prompt(
            type=context.enhancement,
            theme_key=context.theme,
            design=prompt_design,
            extra=context.extra_detail,
        )
        return final_prompt, prompt_design

    def resolve_designs(self, context: GenerateRequest) -> List[Dict[str, Any]]:
        """
        Resolve the list of design combinations to run based on the active execution mode.

        This method centralizes the logic for selecting between:
          - Mock mode: returns static or test-friendly ingredient data from
          - Actual mode: generates real design combinations using
        """
        if self.run_mode == "mock":
            return self.imagine.get_mock_ingredients(type="designs")
        return self.combinations.create_combinations(
            type=context.enhancement, selections=context.selections
        )

    def resolve_ratonale(self, type: str, user_combo: Dict[str, Any]) -> str:
        """
        Resolve the rationale to run based on the active execution mode.
        """
        if self.run_mode == "mock":
            rationale = self.imagine.get_mock_ingredients(type="rationale")
            return rationale
        return self.gemini_client.generate_rationale(type, user_combo)

    def _post_loading(
        self,
        img: Image.Image,
        variants: dict[str, Image.Image],
        context: GenerateRequest,
        combo: Combo,
        prompt_design: dict,
        rationale: str = "",
    ) -> Tuple[Dict[str, ImageItem], str]:
        """Package generated variants, persist metadata, and return serialized items."""

        orig = self.utility.from_pil(img)
        low = self.utility.from_pil(variants["low"])
        medium = self.utility.from_pil(variants["medium"])
        high = self.utility.from_pil(variants["high"])

        type = context.enhancement
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        spec_parts = [prompt_design.get(key, "default") for key in self.attr_keys]
        short_spec = self.utility._slug("-".join(spec_parts))[:60]
        theme_slug = self.utility._slug(context.theme)
        filename = f"{theme_slug}_{stamp}_{short_spec}.png"
        save_dir = self.path.get_directory("output")
        save_path = os.path.join(save_dir, filename)
        # comb_dict = context.selections
        self.imagine.save_image_with_metadata(
            id=str(stamp),
            img=img,
            filename=filename,
            save_path=save_path,
            combination=combo,
            rationale=rationale,
            type=type,
            theme=context.theme,
        )
        # stat, images = self.imagine.load_recent_images()
        # recent_img = []
        # if stat:
        #     recent_img = images

        variants = {
            "original": orig,
            "low": low,
            "medium": medium,
            "high": high,
        }

        return variants, stamp

    def generate_image(self, context: GenerateRequest) -> GenerateResponse:
        """Generate images synchronously for the provided request context."""
        start = time.time()
        has_default = self.combinations.any_default(context.selections)
        if has_default:
            designs_to_run = self.resolve_designs(context=context)
        else:
            user_combo = {k: context.selections[k] for k in self.attr_keys}
            rationale = self.resolve_ratonale(
                type=context.enhancement, user_combo=user_combo
            )
            time.sleep(2)  # to avaoid rate limit
            user_combo["rationale"] = rationale if rationale else ""
            designs_to_run = [user_combo]
        try:
            for idx, combo in enumerate(designs_to_run, start=1):
                final_prompt, prompt_design = self._pre_loading(combo, context)
                if self.run_mode == "mock":
                    img, variants = self.generate.generate_mock_image(index=3)
                else:
                    img, variants = self.generate.generate_with_gemini(final_prompt)

                if img is None or variants is None:
                    logger.info(f"No image returned for combo {idx}.")
                    continue

                variants_dict = self._post_loading(
                    img, variants, context, prompt_design, rationale
                )

                return GenerateResponse(
                    status=200,
                    message="Image generation successful",
                    image_sets=[
                        ImageSet(
                            combo=(
                                Combo(**context.selections)
                                if isinstance(context.selections, dict)
                                else Combo()
                            ),
                            edited=False,
                            variants=variants_dict,
                        )
                    ],
                    recent_images=[],
                )
            logger.info(f"Image generated in {time.time() - start:.3f} seconds total")
        except Exception as e:
            logger.error(f"Error occurred : {e}")
            return GenerateResponse(
                message="Image Generation Failed",
            )

    async def generate_image_stream(
        self, context: GenerateRequest
    ) -> AsyncIterator[bytes]:
        """
        Stream back events as JSON lines:
        - prompt
        - variants info
        - each image as it's ready
        """
        start = time.time()
        has_default = self.combinations.any_default(context.selections)
        if has_default:
            logger.info(f"Has default: {colored(has_default, 'green')}")
            designs_to_run = self.resolve_designs(context=context)
        else:
            logger.info(f"Has default: {colored(has_default, 'red')}")
            user_combo = {k: context.selections[k] for k in self.attr_keys}
            rationale = self.resolve_ratonale(
                type=context.enhancement, user_combo=user_combo
            )
            user_combo["rationale"] = rationale if rationale else ""
            designs_to_run = [user_combo]
        try:
            last_variants_dict: Dict[str, ImageItem] | None = None
            last_recent_img: List[ImageItem] = []
            for idx, combo in enumerate(designs_to_run, start=1):
                final_prompt, prompt_design = self._pre_loading(combo, context)

                # send prompt info down
                yield json.dumps(
                    {"event": "prompt", "data": final_prompt}
                ).encode() + b"\n"

                logger.info(f"Generating image for combo {idx}...")
                # generate image for this combo

                if self.run_mode == "mock":
                    img, variants = self.generate.generate_mock_image(index=3)
                else:
                    img, variants = self.generate.generate_with_gemini(final_prompt)

                if img is None or variants is None:
                    logger.warning(f"No image returned for combo {idx}.")
                    yield json.dumps(
                        {
                            "event": "error",
                            "data": {"message": "Unable to generate image"},
                        }
                    ).encode() + b"\n"
                    break

                variants_dict, stamp = self._post_loading(
                    img=img,
                    variants=variants,
                    context=context,
                    combo=combo,
                    prompt_design=prompt_design,
                )

                # stream each variant
                rationale = combo.get("rationale", "")
                for var_key, img_item in variants_dict.items():
                    yield json.dumps(
                        {
                            "event": "image_variant",
                            "data": {
                                "index": idx,
                                "id": stamp,
                                "variant": var_key,
                                "image": img_item.dict(),
                                "rationale": rationale,
                                "combo": combo,
                            },
                        }
                    ).encode() + b"\n"

                # remember last ones for summary
                last_variants_dict = variants_dict
                last_recent_img = []

                await asyncio.sleep(0)

            # If we never had any designs (just in case)
            if last_variants_dict is None:
                yield json.dumps(
                    {
                        "event": "error",
                        "data": {"message": "No designs generated."},
                    }
                ).encode() + b"\n"
                return

            yield json.dumps(
                {
                    "event": "summary",
                    "data": {
                        "status": 200,
                        "message": "Image generation successful",
                        "image_set": {
                            "combo": (
                                Combo(**context.selections)
                                if isinstance(context.selections, dict)
                                else Combo()
                            ).dict(),
                            "edited": False,
                            "variants": {
                                k: v.dict() for k, v in last_variants_dict.items()
                            },
                        },
                        "recent_images": [img.dict() for img in last_recent_img],
                    },
                }
            ).encode() + b"\n"

            yield json.dumps(
                {
                    "event": "done",
                    "data": {
                        "id": stamp,
                        "theme": context.theme,
                        "combo": combo,
                        "type": context.enhancement,
                    },
                }
            ).encode() + b"\n"
            logger.info(f"Image generated in {time.time() - start:.3f} seconds total")
        except Exception as e:
            logger.error(f"Error occurred : {e}")
            traceback.print_exc()
            yield json.dumps(
                {"event": "error", "data": "Image Generation Failed"}
            ).encode() + b"\n"
