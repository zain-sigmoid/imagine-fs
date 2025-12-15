"""Mock designs and rationale for generating image."""

from typing import List, Dict


class Mock:
    """Provide canned design combinations and rationale for mock generation flows."""
    def __init__(self):
        self.MOCK_DESIGNS: List[Dict[str, str]] = [
            {
                "color_palette": "pastel pinks",
                "pattern": "stripes",
                "motif": "bats",
                "style": "whimsical gothic",
                "finish": "matte",
                "rationale": "The bat motif adds a subtle gothic touch to the pink stripes, complementing the whimsical gothic style. The matte finish enhances the softness of the pastel pinks and keeps it sophisticated.",
            },
            {
                "color_palette": "pastel pinks",
                "pattern": "stripes",
                "motif": "pumpkins",
                "style": "whimsical gothic",
                "finish": "matte",
                "rationale": "Pumpkins offer a different take on the gothic, leaning into a harvest theme while maintaining the whimsical style. The embossed texture adds a tactile element, elevating the premium feel of the napkin.",
            },
            {
                "color_palette": "pastel pinks",
                "pattern": "stripes",
                "motif": "stars",
                "style": "whimsical gothic",
                "finish": "matte",
                "rationale": "Stars provide a celestial gothic element, creating a slightly ethereal feel. Foil stamping highlights the stars, creating a subtle shimmer that enhances the design's premium appeal.",
            },
        ]

        self.MOCK_RATIONALE: str = (
            "A vibrant and colorful design that captures the essence of joy and celebration."
        )
