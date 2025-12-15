"""Construct design combinations using configured options and LLM combiner."""

from typing import Any, Dict, List
from src.config.options import Options
from src.services.combination_service.llm_combiner import LLMCombiner, GeminiClient
from src.utility.logger import AppLogger

logger = AppLogger.get_logger(__name__)

Json = Dict[str, Any]


class Combinations:
    """Build possible design combinations leveraging defaults and LLM guidance.

    Coordinates option loading, Gemini client creation, and combination logic.
    Exposes helpers to detect defaults and produce varied sets.
    Keeps logging centralized for traceability.
    Intended to be reused by generation services.
    """

    def __init__(self):
        """Initialize option catalogs, LLM combiner, and Gemini helper."""
        self.options = Options()
        self.gemini_client = GeminiClient()
        self.combiner = LLMCombiner(llm_fn=self.gemini_client.gemini_call)

    def any_default(self, d: dict) -> bool:
        """Return True when any selection value is flagged as default."""
        return any(isinstance(v, str) and v.lower() == "default" for v in d.values())

    def create_combinations(self, type: str, selections: Dict[str, Any]) -> List[Json]:
        """Generate three combinations based on selections and available catalogs."""
        catalog = {
            "color_palette": list(self.options.color_palettes),
            "pattern": list(self.options.patterns),
            "motif": list(self.options.motifs),
            "style": list(self.options.themes),
            "finish": list(self.options.finishes),
        }
        combos = self.combiner.generate(type, selections, catalog)
        logger.info(f"Generated {len(combos)} combinations")
        return combos
