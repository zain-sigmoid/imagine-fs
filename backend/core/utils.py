import os
import yaml
from typing import Dict, Any

ATTR_KEYS = ("color_palette", "pattern", "motif", "style", "finish")


class Utility:
    @staticmethod
    def load_template(filepath="templates.yml"):
        base_path = os.path.dirname(__file__)  # folder where utils.py is
        full_path = os.path.join(base_path, filepath)
        with open(full_path, "r") as f:
            data = yaml.safe_load(f)
        return data["NAPKIN_TEMPLATE"]

    @staticmethod
    def _strip_defaults(values: Dict[str, Any]) -> Dict[str, str]:
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

    @staticmethod
    def _slug(s: str) -> str:
        return "".join(c.lower() if c.isalnum() else "_" for c in s).strip("_")
