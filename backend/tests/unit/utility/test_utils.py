"""Unit tests for utility helpers used across services."""

from src.utility.utils import Helper


def test_strip_defaults_and_trim():
    helper = Helper()
    values = {
        "color_palette": "Default",
        "pattern": "  stripes ",
        "motif": "default",
        "style": "modern ",
        "finish": "",
    }

    cleaned = helper._strip_defaults(values)

    # Defaults should be removed, others trimmed
    assert "color_palette" not in cleaned
    assert "motif" not in cleaned
    assert cleaned["pattern"] == "stripes"
    assert cleaned["style"] == "modern"
    assert "finish" not in cleaned


def test_slug_produces_safe_strings():
    helper = Helper()
    assert helper._slug("Hello World!") == "hello_world"
    assert helper._slug("A/B\\C") == "a_b_c"
    assert helper._slug(" already_slug ") == "already_slug"
