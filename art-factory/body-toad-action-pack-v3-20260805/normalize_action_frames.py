#!/usr/bin/env python3
"""Normalize atomic BODY pair frames to the shared 1536 stage and ground line."""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / "public/art/pets/body-toad-v1/pair-v3"
CANVAS = (1536, 1536)
GROUND_Y = 1470


def normalize(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    if image.size != CANVAS:
        raise ValueError(f"{path.name}: expected {CANVAS}, got {image.size}")
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError(f"{path.name}: empty alpha")
    dx = round((CANVAS[0] - (bbox[0] + bbox[2])) / 2)
    dy = GROUND_Y - bbox[3]
    result = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    result.alpha_composite(image, (dx, dy))
    result.save(path, optimize=True)
    print(f"{path.name}: dx={dx} dy={dy} bbox={result.getchannel('A').getbbox()}")


if __name__ == "__main__":
    for source in sorted(ROOT.glob("*.png")):
        normalize(source)
