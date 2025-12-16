"""Editing service for applying AI-driven updates to generated images."""

import os
import io
import requests
from PIL import Image
from io import BytesIO
from google import genai
from dotenv import load_dotenv
from google.genai import types
from typing import Dict, Any

from src.utility.utils import Helper
from src.services.image_generation_service.model import Imagine
from src.models.edit_image import EditRequest, EditResponse
from src.services.post_service.post_processing import PostProcessing
from src.handlers.error_handler import MapExceptions
from src.utility.path_finder import Finder
from src.utility.logger import AppLogger

path_finder = Finder()
env_path = path_finder.get_directory("root") / ".env"
load_dotenv(env_path)
logger = AppLogger.get_logger(__name__)


class Editor:
    """Orchestrates AI editing workflows with Gemini, OpenAI, or mock pipelines.

    Manages image preprocessing, post-processing, and exception handling.
    Provides multiple editing backends selectable by client.
    Keeps helper utilities bundled for convenience.
    Suitable for both production and local testing flows.
    """

    def __init__(self):
        """Initialize dependencies for editing operations and utilities."""
        self.model = Imagine()
        self.post_processing = PostProcessing()
        self.exception = MapExceptions()
        self.path_finder = Finder()
        self.utility = Helper()

    def edit_with_gemini(self, base_img: Image.Image, prompt: str) -> Dict[str, Any]:
        """Send an edit request to Gemini and return generated variants."""
        try:
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                return {
                    "status": False,
                    "type": "Key Error",
                    "msg": "GEMINI_API_KEY is not set.",
                }
            else:
                status = False
                client = genai.Client(api_key=api_key)

                # Build request: text + image
                img_bytes = self.model.pil_to_png_bytes(base_img)
                # parts = [
                #     types.Part.from_bytes(
                #         data=img_bytes,
                #         mime_type="image/png",
                #     ),
                # ]

                model_name = (
                    "gemini-2.5-flash-image"  # or "gemini-2.5-flash-image-preview"
                )
                resp = client.models.generate_content(
                    model=model_name,
                    contents=[
                        prompt,
                        types.Part.from_bytes(
                            data=img_bytes, mime_type="image/png"
                        ),  # or use this helper
                    ],
                )

                # Parse response: find first image part
                edited_bytes = None
                if resp and resp.candidates:
                    for part in resp.candidates[0].content.parts:
                        b = self.model.read_gemini_image_part(part)
                        if b:
                            edited_bytes = b
                            break

                if not edited_bytes:
                    return {"status": False, "msg": "Edit response missing image data."}
                else:
                    edited_img = Image.open(BytesIO(edited_bytes)).convert("RGBA")

                    # Update originals + rebuild your enhanced variants
                    status = True
                    logger.info("Applying post processing to edited image")
                    low, med, high = self.post_processing.apply_post_processing(
                        edited_img
                    )
                    result = {
                        "status": status,
                        "type": "success",
                        "images": {
                            "org": edited_img,
                            "low": low,
                            "medium": med,
                            "high": high,
                        },
                    }
                    return result
        except requests.HTTPError as e:
            return {
                "status": False,
                "type": "exception",
                "msg": f"Image edit failed: {e.response.text if e.response is not None else e}",
            }
        except Exception as e:
            raise self.exception.map_gemini_exception(e)

    def edit_with_openai(
        self, base_img: Image.Image, edit_prompt: str
    ) -> Dict[str, Any]:
        """Submit an edit job to OpenAI edits endpoint and parse the response image."""
        try:
            api_key = os.getenv("OPENAI_API_KEY")
            edit_url = os.getenv("OPENAI_EDIT_URL")
            if not api_key:
                return {
                    "status": False,
                    "type": "Key Error",
                    "msg": "OPENAI_API_KEY is not set",
                }
            else:
                size = self.model.pick_openai_size_from_image(base_img)
                files = {
                    "image": (
                        "image.png",
                        self.model.pil_to_png_bytes(base_img),
                        "image/png",
                    ),
                }
                data = {
                    "model": "dall-e-2",  # supports edits/inpainting
                    "prompt": edit_prompt,
                    "size": size,
                }
                logger.info("Sending edit request to OpenAI...")
                resp = requests.post(
                    edit_url,
                    headers={"Authorization": f"Bearer {api_key}"},
                    data=data,
                    files=files,
                    timeout=90,
                )
                resp.raise_for_status()
                logger.info("Edit response received.")

                payload = resp.json()
                if not payload.get("data"):
                    return {
                        "status": False,
                        "type": "Open AI API Error",
                        "msg": "No image returned from edit.",
                    }
                else:
                    out = payload.get("data", [{}])[0]
                    eimg = None
                    if out.get("b64_json"):
                        # if you forced response_format="b64_json"
                        eimg = self.model.b64_to_image(out["b64_json"])
                    elif out.get("url"):
                        # fallback: download from signed URL
                        logger.info("Fetching edited image from URL...")
                        r = requests.get(out["url"], timeout=30)
                        r.raise_for_status()
                        eimg = Image.open(io.BytesIO(r.content)).convert("RGBA")
                    if eimg is None:
                        return {
                            "status": False,
                            "type": "Edit failed",
                            "msg": ("Edit failed: no image returned."),
                        }
                    else:
                        result = {"status": True, "type": "success", "images": eimg}
                        return result

        except requests.HTTPError as e:
            return {
                "status": False,
                "type": "exception",
                "msg": f"Image edit failed: {e.response.text if e.response is not None else e}",
            }
        except Exception as e:
            raise self.exception.map_openai_exception(e)

    def edit_with_mock_image(
        self, base_img: Image.Image, prompt: str
    ) -> Dict[str, Any]:
        """
        Mock version of edit_with_gemini / edit_with_openai.

        Does NOT call any external API. Just reuses the base image and
        runs post-processing so the frontend can test the full edit flow.
        """
        logger.info("Running mock edit_image (no external API call).")
        try:
            data = self.path_finder.get_directory("data")
            edit_image_dir = data / "demo" / "nano_banana_edited.jpeg"
            edited_img = Image.open(edit_image_dir)

            low, med, high = self.post_processing.apply_post_processing(edited_img)

            return {
                "status": True,
                "type": "mock",
                "images": {
                    "org": edited_img,
                    "low": low,
                    "medium": med,
                    "high": high,
                },
            }
        except Exception as e:
            logger.error(f"Mock edit_image failed: {e}")
            return {
                "status": False,
                "type": "mock_error",
                "msg": str(e),
            }


class Edit:
    """
    Handles image editing workflows using Gemini, OpenAI, or mock editing engines.
    Provides utilities to locate the target image, apply edits, process variants,
    and save edited outputs with updated metadata. Acts as a high-level wrapper
    orchestrating the edit pipeline for all supported models.
    """

    def __init__(self):
        """Initializes the Edit service by configuring the editor engine"""
        self.editor = Editor()
        self.model = Imagine()
        self.utility = Helper()
        self.attr_keys = ("color_palette", "pattern", "motif", "style", "finish")

    def edit_image(self, context: EditRequest, model: str = "gemini") -> EditResponse:
        """Edits an image based on the provided request and selected model"""
        output_dir, _ = self.model._get_output_dir_and_metadata()

        if not output_dir.exists():
            return
        for fname in self.model._iter_image_filenames(output_dir):
            parsed = self.model._parse_image_filename(fname)
            if not parsed:
                continue

            file_theme_slug, stamp, short_spec = parsed

            if str(stamp) == context.id:
                target_fname = fname
                break

        if not target_fname:
            return EditResponse(
                message=f"No image found with id {context.id}.",
                edited=None,
            )

        base_path = output_dir / target_fname
        base_img = Image.open(base_path).convert("RGBA")

        if model == "mock":
            result = self.editor.edit_with_mock_image(base_img, context.prompt)
        elif model == "openai":
            result = self.editor.edit_with_openai(base_img, context.prompt)
        else:
            result = self.editor.edit_with_gemini(base_img, context.prompt)

        if not result.get("status"):
            return EditResponse(
                message=f"Edit failed: {result.get('msg', 'Unknown error')}",
                edited=None,
            )
        images = result["images"]
        edited = self.utility.from_pil(images.get("org", ""))
        low = self.utility.from_pil(images.get("low", ""))
        med = self.utility.from_pil(images.get("medium", ""))
        high = self.utility.from_pil(images.get("high", ""))

        spec_parts = [
            getattr(context.combo, key) for key in self.attr_keys if key != "rationale"
        ]
        short_spec = self.utility._slug("-".join(spec_parts))[:60]
        theme_slug = self.utility._slug(context.theme)
        file_name = f"{theme_slug}_{stamp}_{short_spec}_edited.png"
        save_path = os.path.join(output_dir, file_name)
        logger.info(f"saving edited image")
        self.model.save_image_with_metadata(
            id=context.id,
            img=images.get("org", ""),
            save_path=save_path,
            combination=context.combo.model_dump(),
            rationale=context.combo.rationale,
            filename=file_name,
            type=context.type,
            theme=context.theme,
        )

        variants = {
            "edited": edited,
            "low": low,
            "medium": med,
            "high": high,
        }

        return EditResponse(message="Image Editted Successfully", variants=variants)
