"""Model layer for prompt construction, persistence, and related image queries."""

from types import SimpleNamespace
import os
import io
import re
import base64
import json
import requests
from PIL import Image
from io import BytesIO
from google import genai
from pathlib import Path
from openai import OpenAI
from socket import gaierror
from datetime import datetime
from dotenv import load_dotenv
from typing import Dict, Any, Optional, List, Tuple

from src.utility.utils import Helper
from src.config.themes import THEMES
from src.utility.path_finder import Finder
from src.config.themes import THEMES_PRESETS_MIN, DEFAULTS
from src.models.generate import SidebarImage, Combo, RelatedRequest
from src.services.post_service.post_processing import PostProcessing
from src.handlers.error_handler import MapExceptions
from src.utility.path_finder import Finder
from src.utility.logger import AppLogger

logger = AppLogger.get_logger(__name__)
path_finder = Finder()
env_path = path_finder.get_directory("root") / ".env"
load_dotenv(env_path)


class _SafeDict(dict):
    def __missing__(self, key):
        """Return an empty string for missing keys to keep template formatting safe."""
        return ""


class Imagine:
    """Handle prompt assembly, storage, retrieval, and related-image lookups.

    Bridges templates, metadata files, and post-processing utilities.
    Provides helpers to serialize images and enforce selection logic.
    Designed to be consumed by generation and editing services.
    """

    def __init__(
        self,
    ):
        """Initialize helpers, directories, and shared configuration."""
        self.helper = Helper()
        self.path = Finder()
        self.post_processing = PostProcessing()
        self.STRENGTH_INDEX = {"Light": 0, "Medium": 1, "Strong": 2}
        self.ATTR_KEYS = ("color_palette", "pattern", "motif", "style", "finish")

    def build_final_prompt(
        self, subject: str, theme_name: str, strength_label: str
    ) -> str:
        """Combine subject with themed style guidance into a final prompt string."""
        subject = (subject or "").strip()
        style = THEMES.get(theme_name, ["", "", ""])[
            self.STRENGTH_INDEX[strength_label]
        ]
        if style:
            return (
                f"{subject}\n\n"
                f"Style: {style}. "
                f"Avoid text, watermarks, signatures, borders."
            )
        return subject

    def _safe_clean(self, d: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize values into strings while handling None and iterables."""
        out = {}
        for k, v in d.items():
            if v is None:
                out[k] = ""
            elif isinstance(v, (list, tuple, set)):
                out[k] = ", ".join(map(str, v))
            else:
                out[k] = str(v)
        return out

    def _apply_design_overrides(
        self, base: Dict[str, Any], design: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        design may contain up to 5 user options:
        - color_palette: dict with 'base' and/or 'accent' (or a string)
        - pattern: string -> maps to background_library and (if empty) background_treatment
        - motif: string -> overrides motif
        - style: string -> overrides illustration_style
        - finish: string -> overrides finish_spec; if it mentions foil/metal, also metallic_finish
        """
        if not design:
            return base

        if "motif" in design and design["motif"]:
            base["motif"] = design["motif"]

        if "style" in design and design["style"]:
            base["illustration_style"] = design["style"]

        if "pattern" in design and design["pattern"]:
            base["background_library"] = design["pattern"]
            # fall back to same text as background_treatment if not explicitly set
            base.setdefault("background_treatment", design["pattern"])

        if "color_palette" in design and design["color_palette"]:
            cp = design["color_palette"]
            if isinstance(cp, dict):
                if cp.get("base"):
                    base["base_tones"] = cp["base"]
                if cp.get("accent"):
                    base["accent_colors"] = cp["accent"]
            else:
                # if string, put everything into base_tones
                base["base_tones"] = cp

        if "finish" in design and design["finish"]:
            fin = str(design["finish"])
            base["finish_spec"] = fin
            if any(word in fin.lower() for word in ("foil", "metal", "gold", "silver")):
                base["metallic_finish"] = fin

        return base

    def build_prompt(
        self,
        type: str,
        theme_key: str,
        extra: str = "",
        design: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Build the prompt text for image generation using templates and overrides."""
        # start from global defaults, then theme preset
        if theme_key not in THEMES_PRESETS_MIN:
            raise KeyError(f"Unknown theme: {theme_key}")

        base = {**DEFAULTS, **THEMES_PRESETS_MIN[theme_key]}
        base["theme_label"] = theme_key
        base["extra"] = (extra or "").strip() or "—"

        base = self._apply_design_overrides(base, design)

        # finalize
        TEMPLATE = self.helper.load_template(template=type)
        logger.info(f"Loaded template for type: {type}")
        text = TEMPLATE.format_map(_SafeDict(self._safe_clean(base)))
        # collapse whitespace to keep prompt tidy
        return " ".join(text.split())

    def mock_response_from_file(self, path: str):
        """Construct a fake OpenAI-like response from a local image file."""
        # Read and encode the image
        with open(path, "rb") as f:
            img_bytes = f.read()
        b64_str = base64.b64encode(img_bytes).decode("utf-8")

        # Match OpenAI's response format: resp.data[0].b64_json
        fake_item = SimpleNamespace(b64_json=b64_str, url=None)
        fake_resp = SimpleNamespace(data=[fake_item])
        return fake_resp

    def b64_to_image(self, b64_str: str) -> Image.Image:
        """Decode a base64 string into a RGBA PIL Image."""
        img_bytes = base64.b64decode(b64_str)
        return Image.open(io.BytesIO(img_bytes)).convert("RGBA")

    def image_to_base64(self, img_path):
        """Convert image to base64 for inline display."""
        with open(img_path, "rb") as f:
            data = f.read()
        return base64.b64encode(data).decode("utf-8")

    def ensure_mode_rgba(self, img: Image.Image) -> Image.Image:
        """Guarantee the provided image is in RGBA mode."""
        # Convert any mode (RGB, P, CMYK, etc.) to RGBA
        if img.mode != "RGBA":
            return img.convert("RGBA")
        return img

    def pil_to_png_bytes(self, img: Image.Image) -> bytes:
        """Encode a PIL image to PNG bytes after enforcing RGBA mode."""
        img = self.ensure_mode_rgba(img)  # <-- ensure acceptable mode
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return buf.getvalue()

    def pick_openai_size_from_image(self, img: Image.Image) -> str:
        """Map current image size to a supported square size."""
        w, h = img.size
        m = max(w, h)
        # common choices your app already uses
        candidates = [
            (1024, "1024x1024"),
            (1792, "1792x1024" if w >= h else "1024x1792"),
        ]
        # pick 1024 if unsure
        return (
            "1792x1024"
            if m >= 1400 and w >= h
            else ("1024x1792" if m >= 1400 else "1024x1024")
        )

    def read_gemini_image_part(self, part) -> bytes | None:
        """
        Gemini can return inline_data (bytes) or a URL. Return raw PNG/JPEG bytes.
        """
        if getattr(part, "inline_data", None) and getattr(
            part.inline_data, "data", None
        ):
            return part.inline_data.data  # already bytes
        if getattr(part, "file_data", None) and getattr(part.file_data, "uri", None):
            # Fallback if SDK surfaces uri
            r = requests.get(part.file_data.uri, timeout=60)
            r.raise_for_status()
            return r.content
        if getattr(part, "image_url", None):  # very rare alt surface
            r = requests.get(part.image_url, timeout=60)
            r.raise_for_status()
            return r.content
        return None

    def save_image_with_metadata(
        self,
        id: str,
        img: Image.Image,
        save_path: str,
        combination: dict,
        rationale: str = "",
        filename: str = "",
        type: str = "",
        theme: str = "",
        json_path: str = "image_metadata.json",
    ) -> None:
        """
        Save image to disk and store its combination metadata in a JSON file.
        """
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        img.save(save_path)

        # Load existing metadata if present
        json_pathd = self.path.get_directory("output")
        json_path_new = json_pathd / json_path
        if os.path.exists(json_path_new):
            with open(json_path_new, "r", encoding="utf-8") as f:
                metadata = json.load(f)
        else:
            metadata = {}

        # Save metadata using image path as key
        metadata[filename] = {
            "id": id,
            "theme": theme,
            "combination": combination,
            "type": type,
            "rationale": rationale,
            "timestamp": datetime.now().isoformat(),
        }

        # Write back to JSON
        with open(json_path_new, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

    def _combination_to_badges(self, combo: dict) -> list[str]:
        """Turn a combination dictionary into human-friendly badge labels."""
        labels: list[str] = []
        for key in self.ATTR_KEYS:
            raw = combo.get(key)
            if not raw or raw == "default":
                continue
            # normalize whitespace & nice casing
            label = " ".join(raw.split()).strip().title()
            labels.append(label)
        return labels

    def _get_output_dir_and_metadata(self) -> Tuple[Path, Dict]:
        """
        Returns the output directory and loaded metadata dict.
        """
        output_dir = self.path.get_directory("output")
        metadata_path = output_dir / "image_metadata.json"

        if metadata_path.exists():
            with open(metadata_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)
        else:
            metadata = {}

        return output_dir, metadata

    def _parse_image_filename(self, filename: str) -> Optional[Tuple[str, str, str]]:
        """
        Parse filename into (theme_slug, stamp, short_spec).

        Expected format:
        {theme_slug}_{YYYYMMDD_HHMMSS}_{short_spec}.png
        """
        FILENAME_RE = re.compile(r"^(.+?)_(\d{8}_\d{6})_(.+)\.(?:png|jpg|jpeg)$")
        match = FILENAME_RE.match(filename)
        if not match:
            return None
        return match.groups()

    def _build_sidebar_image(
        self,
        output_dir: Path,
        filename: str,
        metadata: Dict,
    ) -> Optional[SidebarImage]:
        """
        Given a filename and metadata, build a SidebarImage instance.
        Returns None if metadata/filename is invalid.
        """
        parsed = self._parse_image_filename(filename)
        if not parsed:
            return None

        file_theme_slug, stamp, short_spec = parsed  # theme_slug, id, spec

        meta = metadata.get(filename)
        if not meta:
            combo = {}
        else:
            combo = meta.get("combination", meta)
            rationale = meta.get("rationale", "")
            type = meta.get("type", "")
            theme = meta.get("theme", "")
            if rationale:
                combo["rationale"] = rationale

        img_path = output_dir / filename

        if not img_path.exists():
            return None

        # Load image and convert to ImageItem
        img = Image.open(img_path)
        lowp, mediump, highp = self.post_processing.apply_post_processing(img)
        org = self.helper.from_pil(img)
        low = self.helper.from_pil(lowp)
        medium = self.helper.from_pil(mediump)
        high = self.helper.from_pil(highp)

        variants = {
            "original": org,
            "low": low,
            "medium": medium,
            "high": high,
        }
        return SidebarImage(
            id=stamp,
            theme=theme,
            type=type,
            name=self._combination_to_badges(combo),
            variants=variants,
            combo=Combo(**combo),
        )

    def _iter_image_filenames(self, output_dir: Path):
        """
        Yield image filenames in output_dir.
        """
        if not output_dir.exists():
            return
        for f in os.listdir(output_dir):
            if f.lower().endswith((".png", ".jpg", ".jpeg")):
                yield f

    def load_recent_images(
        self,
        offset: int = 0,
        limit: int | None = 6,
    ) -> tuple[list[SidebarImage], int]:
        """
        Load recent images from the output folder.

        - Sorts all images by modified time (newest first)
        - Returns a page (offset, limit) of SidebarImage objects
        - Also returns total count of images in the folder
        """
        recent_images: List[SidebarImage] = []
        output_dir, metadata = self._get_output_dir_and_metadata()

        if not output_dir.exists():
            return False, []

        # Get image files sorted by latest mtime
        all_files = sorted(
            list(self._iter_image_filenames(output_dir)),
            key=lambda x: os.path.getmtime(output_dir / x),
            reverse=True,
        )
        total = len(all_files)
        # Normalize offset/limit
        safe_offset = max(0, offset or 0)
        safe_limit = max(1, limit) if limit is not None else total

        # Slice filenames for this page only
        slice_files = all_files[safe_offset : safe_offset + safe_limit]

        for fname in slice_files:
            sidebar_image = self._build_sidebar_image(output_dir, fname, metadata)
            if sidebar_image:
                recent_images.append(sidebar_image)

        return recent_images, total

    from typing import Dict, List, Tuple

    def find_related_images(
        self,
        payload: RelatedRequest,
        min_matches: int = 3,
        limit: int | None = 12,
        offset: int = 0,
    ) -> Tuple[List[SidebarImage], int]:
        """
        Find related images based on:
        - Same theme_slug
        - Same type
        - At least `min_matches` matching attributes

        Pagination is applied on the *logical matches* (by filename),
        then we only build SidebarImage for the requested slice.

        Returns:
            (related_files, total_matches)
            related_files: list for this page (offset/limit)
            total_matches: total number of logical matches (all pages)
        """
        id = payload.id
        theme = payload.theme
        selections = payload.selections
        item_type = payload.type

        theme_slug = self.helper._slug(theme)
        wanted_type = item_type
        matching_fnames: List[str] = []

        output_dir, metadata = self._get_output_dir_and_metadata()

        for key, value in metadata.items():
            theme = self.helper._slug(value.get("theme", ""))
            type = value.get("type", "")
            combo = value.get("combination", {})
            meta_id = value.get("id", "")

            if id == meta_id:
                continue

            if theme == theme_slug and type == wanted_type:
                match_count = sum(
                    1 for key in self.ATTR_KEYS if selections.get(key) == combo.get(key)
                )
                if match_count >= min_matches:
                    fname = key
                    matching_fnames.append(fname)

        total_matches = len(matching_fnames)
        start = max(0, offset or 0)
        if limit is not None and limit > 0:
            end = start + limit
            slice_fnames = matching_fnames[start:end]
        else:
            slice_fnames = matching_fnames[start:]

        related_files: List[SidebarImage] = []

        for fname in slice_fnames:
            sidebar_image = self._build_sidebar_image(output_dir, fname, metadata)
            if not sidebar_image:
                logger.error(
                    f"_build_sidebar_image returned None for related file {fname}"
                )
                continue

            related_files.append(sidebar_image)

        return related_files, total_matches

    def delete_image(self, image_id: str) -> bool:
        """
        Delete image based on its stamp (image_id).
        Returns True if deleted, False otherwise.
        """
        output_dir, metadata = self._get_output_dir_and_metadata()

        if not output_dir.exists():
            return False

        target_fname = None

        # Find matching file
        for fname in self._iter_image_filenames(output_dir):
            parsed = self._parse_image_filename(fname)
            if not parsed:
                continue

            file_theme_slug, stamp, short_spec = parsed

            if str(stamp) == str(image_id):
                target_fname = fname
                break

        if not target_fname:
            logger.warning("target image not found")
            return False

        try:
            file_path = output_dir / target_fname
            file_path.unlink()  # delete file
            logger.info(f"Image Deleted for id :{image_id}")
            # Also delete metadata entry if exists
            output_dir_metadata = output_dir / "metadata.json"
            if output_dir_metadata.exists():
                try:
                    import json

                    with open(output_dir_metadata, "r+") as f:
                        data = json.load(f)
                        if target_fname in data:
                            del data[target_fname]
                            f.seek(0)
                            f.truncate()
                            json.dump(data, f, indent=2)
                except Exception:
                    pass  # don't fail delete if metadata update fails

            return True

        except Exception as e:
            logger.error(f"Failed to delete image {image_id}: {e}")
            return False

    def delete_all_images(self) -> dict[str, Any]:
        """
        Delete all image files in images_dir and clear metadata.json
        Returns a small summary dict.
        """
        deleted_files = 0
        output_dir = self.path.get_directory("output")
        metadata_path = output_dir / "image_metadata.json"

        # Delete all files in the image directory
        for file in output_dir.iterdir():
            if file.is_file() and file.suffix.lower() == ".png":
                try:
                    file.unlink()
                    deleted_files += 1
                except Exception as e:
                    logger.error(f"Failed to delete file {file}: {e}")

        # Clear metadata.json
        try:
            # If you store a dict, use {}; if a list, use [].
            empty_metadata = {}
            metadata_path.write_text(
                json.dumps(empty_metadata, indent=2), encoding="utf-8"
            )
        except Exception as e:
            logger.error(f"Failed to clear metadata.json: {e}")
            return {
                "success": False,
                "deleted_files": deleted_files,
                "error": "Images deleted but failed to clear metadata.json",
            }
        logger.warning(f"Deleted {deleted_files}")
        return {"success": True, "deleted_files": deleted_files}

    def get_image_bytes_for_download(
        self,
        image_id: str,
        level: str = "org",
    ) -> Tuple[bytes, str, str]:
        """
        Returns (raw_bytes, mime_type, download_filename) for the given
        image id and level in ["org", "low", "med", "high"].

        Only the original is stored on disk; low/med/high are generated
        on the fly via post-processing.
        """
        base: Tuple[bytes, str, str] = None, "", ""
        # Normalize level names
        level = level.lower()
        level_map = {
            "org": "original",
            "original": "original",
            "low": "low",
            "med": "medium",
            "medium": "medium",
            "high": "high",
            "edited": "edited",
        }
        if level not in level_map:
            return base

        normalized_level = level_map[level]

        output_dir, _ = self._get_output_dir_and_metadata()

        if not output_dir.exists():
            return base

        target_fname = None

        # Find the file by stamp (image_id)
        for fname in self._iter_image_filenames(output_dir):
            parsed = self._parse_image_filename(fname)
            if not parsed:
                continue

            file_theme_slug, stamp, short_spec = parsed
            if str(stamp) != str(image_id):
                continue

            # stamp == image_id
            if level != "edited":
                target_fname = fname
                break

            # level == "edited"
            if "edited" in short_spec.split("_"):
                target_fname = fname
                break

        if not target_fname:
            return base

        file_path = output_dir / target_fname
        if not file_path.exists():
            return base

        try:
            img = Image.open(file_path).convert("RGBA")
        except Exception as e:
            logger.error(f"Failed to open image for download: {e}")
            return base

        # --- Choose which image to send ---
        if normalized_level == "original" or normalized_level == "edited":
            selected_img = img
        else:
            # Generate low / medium / high on the fly
            low, med, high = self.post_processing.apply_post_processing(img)
            variant_map = {
                "low": low,
                "medium": med,
                "high": high,
            }
            selected_img = variant_map[normalized_level]

        # --- Convert selected PIL image to bytes ---
        buf = io.BytesIO()
        fmt = "PNG"
        selected_img.save(buf, format=fmt)
        raw_bytes = buf.getvalue()

        mime_type = "image/png"
        stem = file_path.stem
        if normalized_level == "original":
            download_name = f"{stem}.png"
        else:
            download_name = f"{stem}_{normalized_level}.png"

        return raw_bytes, mime_type, download_name


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
                "msg": "GEMINI_API_KEY is not set.",
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
        GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
        if not GEMINI_API_KEY:
            logger.error("GEMINI API Key not Found")
            return None, None
        client_gemini = genai.Client(api_key=GEMINI_API_KEY)
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
