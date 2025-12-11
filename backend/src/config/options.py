"""Default option sets for image generation selections."""


class Options:
    """Provide in-memory lists of selectable design attributes.

    Exposes themed palettes, patterns, motifs, themes, and finishes
    for clients that need consistent option catalogs.
    Keeps values static per process without persistence.
    Intended for lightweight configuration responses.
    """
    def __init__(self):
        """Initialize default collections for palette, pattern, motif, style, and finish."""
        self.color_palettes = [
            "pastel pinks",
            "jewel tones",
            "metallic gold & black",
            "earthy autumn shades",
        ]

        self.patterns = [
            "stripes",
            "chevrons",
            "damask",
            "watercolor wash",
            "geometric lattice",
        ]

        self.motifs = [
            "pumpkins",
            "bats",
            "florals",
            "stars",
            "waves",
            "shells",
        ]

        self.themes = [
            "whimsical gothic",
            "festive holiday sparkle",
            "coastal summer",
            "rustic harvest",
        ]

        self.finishes = [
            "matte",
            "foil stamping",
            "embossed texture",
            "glossy lacquer",
        ]

    def get_options(
        self,
    ) -> dict[str, list[str]]:
        """Return all option categories grouped by attribute type."""
        options = {
            "color_palettes": self.color_palettes,
            "patterns": self.patterns,
            "motifs": self.motifs,
            "themes": self.themes,
            "finishes": self.finishes,
        }
        return options
