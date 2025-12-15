"""Unit tests for LLMCombiner generation and fallback behavior."""

import json

import pytest

from src.services.combination_service.llm_combiner import LLMCombiner


def test_is_default_helper():
  assert LLMCombiner._is_default("Default")
  assert LLMCombiner._is_default("default  ")
  assert not LLMCombiner._is_default("custom")
  assert not LLMCombiner._is_default(None)


def test_generate_uses_llm_output_when_valid():
  selections = {
      "color_palette": "Default",
      "pattern": "stripes",
      "motif": "Default",
      "style": "Default",
      "finish": "Default",
  }
  catalog = {
      "color_palette": ["pastel", "neon"],
      "pattern": ["stripes", "dots"],
      "motif": ["stars", "moons"],
      "style": ["modern", "vintage"],
      "finish": ["matte", "glossy"],
  }

  def fake_llm_fn(prompt: str) -> str:
    combos = [
        {
            "color_palette": "pastel",
            "pattern": "stripes",
            "motif": "stars",
            "style": "modern",
            "finish": "matte",
            "rationale": "Test combo 1",
        },
        {
            "color_palette": "neon",
            "pattern": "stripes",
            "motif": "moons",
            "style": "vintage",
            "finish": "glossy",
            "rationale": "Test combo 2",
        },
        {
            "color_palette": "pastel",
            "pattern": "stripes",
            "motif": "stars",
            "style": "vintage",
            "finish": "matte",
            "rationale": "Test combo 3",
        },
    ]
    return json.dumps({"combinations": combos})

  combiner = LLMCombiner(llm_fn=fake_llm_fn)
  combos = combiner.generate(selections, catalog)

  assert len(combos) == 3
  # Locked attribute (pattern) should stay as provided in selections
  assert all(c["pattern"] == "stripes" for c in combos)
  # Returned attributes should include rationale text when supplied
  assert any(c["rationale"] for c in combos)


def test_generate_falls_back_when_llm_fails():
  selections = {
      "color_palette": "Default",
      "pattern": "Default",
      "motif": "bird",
      "style": "Default",
      "finish": "matte",
  }
  catalog = {
      "color_palette": ["pastel", "earthy"],
      "pattern": ["stripes", "chevrons"],
      "motif": ["bird", "leaf"],
      "style": ["modern", "classic"],
      "finish": ["matte", "glossy"],
  }

  def failing_llm_fn(prompt: str) -> str:
    raise RuntimeError("LLM unavailable")

  combiner = LLMCombiner(llm_fn=failing_llm_fn)
  combos = combiner.generate(selections, catalog)

  assert len(combos) >= 2
  # Locked motif/finish should be preserved in all fallback combos
  assert all(c["motif"] == "bird" for c in combos)
  assert all(c["finish"] == "matte" for c in combos)
