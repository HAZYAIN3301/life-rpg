#!/usr/bin/env python3
"""Remove magenta by hue, resize and ground atomic BODY action frames."""

from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
SOURCES = HERE / "sources"
OUTPUTS = HERE.parents[1] / "public/art/pets/body-toad-v1/pair-v3"
SIZE = 1536
GROUND_Y = 1470


def build(source: Path) -> None:
    rgb = Image.open(source).convert("RGB")
    pixels = np.asarray(rgb)
    red = pixels[:, :, 0].astype(np.int16)
    green = pixels[:, :, 1].astype(np.int16)
    blue = pixels[:, :, 2].astype(np.int16)
    # Generated chroma varies across a small magenta gradient.  Skin, scarf,
    # teal cloth and the red toad all fail at least one of these conditions.
    magenta = (
        (red >= 178) & (blue >= 160) & (green <= 96)
        & ((red - blue) >= -28) & ((red - blue) <= 82)
    )
    background = Image.fromarray((magenta.astype(np.uint8) * 255), "L")
    background = background.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.55))
    alpha = Image.eval(background, lambda value: 255 - value)
    rgba = rgb.convert("RGBA")
    rgba.putalpha(alpha)
    rgba = rgba.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    bbox = rgba.getchannel("A").getbbox()
    if not bbox:
        raise ValueError(f"{source.name}: empty alpha")
    dx = round((SIZE - (bbox[0] + bbox[2])) / 2)
    dy = GROUND_Y - bbox[3]
    result = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    result.alpha_composite(rgba, (dx, dy))
    target = OUTPUTS / source.name.replace("-source", "")
    result.save(target, optimize=True)
    print(f"{target.name}: shift=({dx},{dy}) bbox={result.getchannel('A').getbbox()}")


if __name__ == "__main__":
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    for source in sorted(SOURCES.glob("*-source.png")):
        build(source)
