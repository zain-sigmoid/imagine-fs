"""Shared helper utilities for template handling and image serialization."""

import io
import os
import yaml
import base64
from PIL import Image
from typing import Dict, Any
from src.utility.path_finder import Finder
from src.models.generate import ImageItem

ATTR_KEYS = ("color_palette", "pattern", "motif", "style", "finish")


class Helper:
    """Provide reusable utilities for prompts, slugs, and image encoding.

    Handles loading YAML templates, normalizing selections, and converting
    PIL images to API-friendly structures.
    Centralizes repeated helper logic across services.
    """

    def __init__(
        self,
    ):
        """Initialize the helper with access to configured paths."""
        self.path = Finder()

    def load_template(self, filename="templates.yml", template="plates"):
        """Load a prompt template from disk based on the requested type."""
        config_dir = self.path.get_directory("config")
        full_path = os.path.join(config_dir, filename)
        with open(full_path, "r") as f:
            data = yaml.safe_load(f)

        template_map = {
            "napkin": "NAPKIN_TEMPLATE",
            "plates": "PLATE_TEMPLATE",
            "cup": "CUP_TEMPLATE",
            "combination": "COMBINATION_PROMPT_TEMPLATE",
            "rationale": "RATIONALE_PROMPT_TEMPLATE",
        }

        template_key = template_map.get(template)

        if not template_key:
            raise ValueError(f"Unknown template type: {template}")

        # check YAML contains that key
        if template_key not in data:
            raise KeyError(f"Template '{template_key}' missing in {filename}")

        return data[template_key]

    def _strip_defaults(self, values: Dict[str, Any]) -> Dict[str, str]:
        """Remove any attributes still marked as 'default' from the mapping."""
        cleaned: Dict[str, str] = {}
        for key in ATTR_KEYS:
            val = values.get(key)
            if (
                isinstance(val, str)
                and val.strip()
                and val.strip().lower() != "default"
            ):
                cleaned[key] = val.strip()
        return cleaned

    def _slug(self, s: str) -> str:
        """Create a filesystem-safe slug from the provided string."""
        return "".join(c.lower() if c.isalnum() else "_" for c in s).strip("_")

    def from_pil(self, img: Image.Image, fmt: str = "PNG") -> ImageItem:
        """Serialize a PIL image into base64-encoded ImageItem."""
        buf = io.BytesIO()
        img.save(buf, format=fmt)
        return ImageItem(
            mime_type=f"image/{fmt.lower()}",
            data_b64=base64.b64encode(buf.getvalue()).decode("utf-8"),
        )
