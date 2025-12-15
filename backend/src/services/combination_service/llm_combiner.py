"""LLM-driven combination builder and Gemini client helpers."""

from __future__ import annotations
import json
import random
import os
from typing import Optional
from google import genai
from typing import Any, Callable, Dict, List, Optional
from src.handlers.error_handler import MapExceptions
from src.utility.utils import Helper
from src.utility.logger import AppLogger

logger = AppLogger.get_logger(__name__)

Json = Dict[str, Any]
LLMFn = Callable[[str], str]  # (prompt) -> raw_text_response


class LLMCombiner:
    """
    Builds the prompt for Gemini (or any LLM), calls it via an injected function,
    and returns three validated combinations. Falls back to a local generator if needed.
    """

    def __init__(self, llm_fn: LLMFn):
        """
        llm_fn: a callable taking a prompt string and returning raw text (LLM output).
                Example for Gemini: lambda p: genai_model.generate_content(p).text
        """
        self.llm_fn = llm_fn
        self.utility = Helper()

    @staticmethod
    def _is_default(val: Any) -> bool:
        """Check whether a selection value is marked as default."""
        return isinstance(val, str) and val.strip().lower() == "default"

    def build_prompt(self, type: str, selections: Json, catalog: Json) -> str:
        """
        selections: dict like {"color_palette": "...", "pattern": "...", "motif": "...", "style": "...", "finish": "..."}
        catalog: dict like {"color_palette": [...], "pattern": [...], "motif": [...], "style": [...], "finish": [...]}
        """
        PROMPT_TEMPLATE = self.utility.load_template(template="combination")
        user_selections_json = json.dumps(selections, ensure_ascii=False, indent=2)
        catalog_json = json.dumps(catalog, ensure_ascii=False, indent=2)
        return PROMPT_TEMPLATE.format(
            type=type,
            user_selections_json=user_selections_json,
            catalog_json=catalog_json,
        )

    def _validate_and_fix(self, data: Any, catalog: Json, lock: Json) -> List[Json]:
        """
        Validate JSON from LLM; enforce schema and catalog membership.
        lock: non-default selections that must be kept.
        Returns a list of exactly 3 combinations. Raises on unrecoverable issues.
        """
        if not isinstance(data, dict) or "combinations" not in data:
            raise ValueError("Missing 'combinations' key.")

        combos = data["combinations"]
        if not isinstance(combos, list) or len(combos) != 3:
            raise ValueError("Expected exactly 3 combinations.")

        fixed: List[Json] = []
        for idx, c in enumerate(combos):
            if not isinstance(c, dict):
                raise ValueError(f"Combination {idx} is not an object.")

            out = {}
            for k in ("color_palette", "pattern", "motif", "style", "finish"):
                # enforce locked (non-default) attrs
                if not self._is_default(lock.get(k, "Default")):
                    out[k] = lock[k]
                else:
                    v = c.get(k)
                    if not isinstance(v, str):
                        raise ValueError(f"Combination {idx}: '{k}' must be a string.")
                    if k not in catalog or v not in catalog[k]:
                        raise ValueError(
                            f"Combination {idx}: '{k}' value '{v}' not in catalog."
                        )
                    out[k] = v

            # rationale (optional but nice)
            rationale = c.get("rationale")
            out["rationale"] = rationale if isinstance(rationale, str) else ""

            fixed.append(out)

        # de-duplicate exact duplicates
        unique = []
        seen = set()
        for c in fixed:
            sig = (
                c["color_palette"],
                c["pattern"],
                c["motif"],
                c["style"],
                c["finish"],
            )
            if sig not in seen:
                seen.add(sig)
                unique.append(c)

        # If LLM produced dupes, try to diversify by randomizing remaining catalog choices
        while len(unique) < 3:
            # choose alternatives only for defaulted attributes
            candidate = {}
            for k in ("color_palette", "pattern", "motif", "style", "finish"):
                if not self._is_default(lock.get(k, "Default")):
                    candidate[k] = lock[k]
                else:
                    cand_list = [x for x in catalog.get(k, [])]
                    # avoid picking already used combos
                    if cand_list:
                        candidate[k] = random.choice(cand_list)
                    else:
                        raise ValueError(f"No catalog values for '{k}'.")
            sig = (
                candidate["color_palette"],
                candidate["pattern"],
                candidate["motif"],
                candidate["style"],
                candidate["finish"],
            )
            if sig not in seen:
                candidate["rationale"] = "Auto-diversified fallback."
                seen.add(sig)
                unique.append(candidate)

        return unique[:3]

    def _local_fallback(self, selections: Json, catalog: Json) -> List[Json]:
        """
        Deterministic local generator if LLM fails completely.
        - Respects locked attributes.
        - Varies only default attributes.
        """
        lock = selections
        # build 3 varied picks round-robin
        picks: List[Json] = []
        # prepare indices for default lists
        def_lists: Dict[str, List[str]] = {
            k: (
                catalog.get(k, [])
                if self._is_default(lock.get(k, "Default"))
                else [lock[k]]
            )
            for k in ("color_palette", "pattern", "motif", "style", "finish")
        }
        for i in range(3):
            combo = {}
            for k, vals in def_lists.items():
                if len(vals) == 0:
                    raise ValueError(f"No options for '{k}'.")
                combo[k] = vals[i % len(vals)]
            combo["rationale"] = "Local fallback: balanced rotation across defaults."
            picks.append(combo)
        # ensure uniqueness
        uniq, seen = [], set()
        for c in picks:
            sig = (
                c["color_palette"],
                c["pattern"],
                c["motif"],
                c["style"],
                c["finish"],
            )
            if sig not in seen:
                seen.add(sig)
                uniq.append(c)
        return uniq[:3]

    def generate(self, type: str, selections: Json, catalog: Json) -> List[Json]:
        """
        Returns exactly 3 combinations.
        """
        prompt = self.build_prompt(type, selections, catalog)

        # Try LLM
        try:
            raw = self.llm_fn(prompt)
            # Some LLMs wrap JSON in code fences; strip them safely.
            raw_str = raw.strip()
            if raw_str.startswith("```"):
                raw_str = raw_str.strip("`")
                # remove leading 'json' if present after fence
                if raw_str.startswith("json"):
                    raw_str = raw_str[4:]
            data = json.loads(raw_str)
            combos = self._validate_and_fix(data, catalog, selections)
            return combos
        except Exception:
            # Fallback if anything goes wrong
            return self._local_fallback(selections, catalog)


class GeminiClient:
    """Helper client for interacting with Gemini and mapping its errors.

    Wraps API key resolution, client creation, and text generation helpers.
    Keeps exception handling centralized via MapExceptions.
    Designed to be a lightweight dependency for combination generation.
    """

    def __init__(self):
        """Initialize the Gemini helper with shared exception mappers."""
        self.map_exception = MapExceptions()
        self.utility = Helper()

    def _get_api_key(
        self,
    ) -> str:
        """Retrieve the Gemini API key from provided value or environment."""
        # Fallback to env var
        key = os.getenv("GEMINI_API_KEY")
        if not key:
            raise RuntimeError(
                "Gemini API key not found. Set Streamlit secret GEMINI_API_KEY "
                "or environment variable GEMINI_API_KEY."
            )
        return key

    def make_gemini_client(self, api_key: Optional[str] = None):
        """Create a configured Gemini client instance using the supplied API key."""
        api_key = api_key or self._get_api_key()
        # google.genai modern client
        return genai.Client(api_key=api_key)

    def gemini_call(self, prompt: str, model: str = "gemini-2.0-flash") -> str:
        """
        Minimal wrapper: (prompt) -> text
        Compatible with current google.genai client methods.
        """
        client = self.make_gemini_client()

        # Try the current/primary method signature first
        try:
            resp = client.models.generate_content(model=model, contents=prompt)
        except Exception as e:
            raise self.map_exception.map_gemini_exception(e)

        # Extract text robustly
        if getattr(resp, "text", None):
            return resp.text

        # Fallback: stitch candidate parts text if needed
        try:
            cand = resp.candidates[0]
            parts = getattr(cand, "content", getattr(cand, "contents", None)).parts
            chunks = [getattr(p, "text", "") for p in parts if getattr(p, "text", "")]
            if chunks:
                return "\n".join(chunks)
        except Exception:
            pass

        # Last resort
        return str(resp)

    def generate_rationale(
        self, type: str, combination: Dict[str, Any], model: str = "gemini-2.0-flash"
    ) -> str:
        """Generate a concise rationale for a given design combination."""
        client = self.make_gemini_client()
        try:
            logger.info(f"Generating rationale for the selected combination")
            RATIONALE_PROMPT_TEMPLATE = self.utility.load_template(template="rationale")
            prompt = RATIONALE_PROMPT_TEMPLATE.format(
                type=type,
                color_palette=combination["color_palette"],
                pattern=combination["pattern"],
                motif=combination["motif"],
                style=combination["style"],
                finish=combination["finish"],
            )
            resp = client.models.generate_content(model=model, contents=prompt)
            if hasattr(resp, "text") and resp.text:
                return resp.text.strip()

            # Fallback: try candidates[0].content.parts text
            try:
                parts = resp.candidates[0].content.parts
                texts = [p.text for p in parts if hasattr(p, "text")]
                if texts:
                    return " ".join(texts).strip()
            except Exception as e:
                logger.error(f"Rationale generation failed: {e}")
                raise self.map_exception.map_gemini_exception(e)

            return "Could not generate"
        except Exception as e:
            logger.error(f"Rationale generation failed: {e}")
            raise self.map_exception.map_gemini_exception(e)
