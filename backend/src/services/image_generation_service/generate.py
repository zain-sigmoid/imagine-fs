"""Orchestrates synchronous and streaming image generation workflows."""

import os
import json
import time
import asyncio
import traceback
from PIL import Image
from datetime import datetime
from termcolor import colored
from typing import AsyncIterator, Dict, List, Tuple
from src.models.generate import (
    GenerateResponse,
    GenerateRequest,
    ImageItem,
    ImageSet,
    Combo,
)
from src.utility.utils import Helper
from src.utility.path_finder import Finder
from src.services.image_generation_service.model import Imagine, Generate
from src.services.combination_service.llm_combiner import GeminiClient
from src.services.combination_service.make_combinations import Combinations
from src.utility.logger import AppLogger

logger = AppLogger.get_logger(__name__)


class Generation:
    """Coordinate prompts, generation, storage, and streaming responses.

    Manages combination selection, prompt preparation, and metadata saving.
    Provides both synchronous and streaming interfaces for clients.
    Uses helpers for post-processing and rationale generation when needed.
    """
    def __init__(self):
        """Initialize generation dependencies and reusable helpers."""
        self.ATTR_KEYS = ("color_palette", "pattern", "motif", "style", "finish")
        self.generate = Generate()
        self.utility = Helper()
        self.imagine = Imagine()
        self.path = Finder()
        self.combinations = Combinations()
        self.gemini_client = GeminiClient()

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
        spec_parts = [prompt_design.get(key, "default") for key in self.ATTR_KEYS]
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
            designs_to_run = self.combinations.create_combinations(
                context.selections
            )  # output: List[Json]
        else:
            user_combo = {k: context.selections[k] for k in self.ATTR_KEYS}
            rationale = self.gemini_client.generate_rationale(user_combo)
            time.sleep(2)  # to avaoid rate limit
            user_combo["rationale"] = rationale if rationale else ""
            designs_to_run = [user_combo]
        try:
            for idx, combo in enumerate(designs_to_run, start=1):
                final_prompt, prompt_design = self._pre_loading(combo, context)
                img, variants = self.generate.generate_with_gemini(final_prompt)
                # img, variants = self.generate.generate_mock_image(index=3)
                if img is None or variants is None:
                    logger.info(f"No image returned for combo {idx}.")
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
            designs_to_run = self.combinations.create_combinations(
                context.selections
            )  # output: List[Json]
            # designs_to_run = [
            #     {
            #         "color_palette": "pastel pinks",
            #         "pattern": "stripes",
            #         "motif": "bats",
            #         "style": "whimsical gothic",
            #         "finish": "matte",
            #         "rationale": "The bat motif adds a subtle gothic touch to the pink stripes, complementing the whimsical gothic style. The matte finish enhances the softness of the pastel pinks and keeps it sophisticated.",
            #     },
            #     {
            #         "color_palette": "pastel pinks",
            #         "pattern": "stripes",
            #         "motif": "pumpkins",
            #         "style": "whimsical gothic",
            #         "finish": "matte",
            #         "rationale": "Pumpkins offer a different take on the gothic, leaning into a harvest theme while maintaining the whimsical style. The embossed texture adds a tactile element, elevating the premium feel of the napkin.",
            #     },
            #     {
            #         "color_palette": "pastel pinks",
            #         "pattern": "stripes",
            #         "motif": "stars",
            #         "style": "whimsical gothic",
            #         "finish": "matte",
            #         "rationale": "Stars provide a celestial gothic element, creating a slightly ethereal feel. Foil stamping highlights the stars, creating a subtle shimmer that enhances the design's premium appeal.",
            #     },
            # ]
        else:
            logger.info(f"Has default: {colored(has_default, 'red')}")
            user_combo = {k: context.selections[k] for k in self.ATTR_KEYS}
            rationale = self.gemini_client.generate_rationale(user_combo)
            # rationale = "A vibrant and colorful design that captures the essence of joy and celebration."
            await asyncio.sleep(2)  # to avaoid rate limit
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
                img, variants = self.generate.generate_with_gemini(final_prompt)
                # img, variants = self.generate.generate_mock_image(index=idx)

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
