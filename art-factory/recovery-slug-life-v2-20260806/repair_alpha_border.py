#!/usr/bin/env python3
"""Make the normalized production canvases unambiguously transparent at the rim.

Image resampling can leave a few semi-transparent chroma pixels on the outermost
row. Runtime compositing never needs those pixels, so clear a deterministic
two-pixel guard band after normalization and before QA/publication.
"""

from pathlib import Path
from PIL import Image


HERE = Path(__file__).resolve().parent
OUTPUTS = HERE / "outputs"
PUBLIC = HERE.parents[1] / "public/art/pets/recovery-slug-v1"


def clear_guard_band(path: Path, width: int = 2) -> None:
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    canvas_width, canvas_height = image.size
    for y in range(canvas_height):
        for x in range(canvas_width):
            if x < width or y < width or x >= canvas_width - width or y >= canvas_height - width:
                pixels[x, y] = (0, 0, 0, 0)
    image.save(path, optimize=True)


def main() -> None:
    mappings = [
        (OUTPUTS / "solo", PUBLIC / "motion-v2"),
        (OUTPUTS / "pair", PUBLIC / "pair-v2"),
    ]
    repaired = 0
    for source_root, public_root in mappings:
        public_root.mkdir(parents=True, exist_ok=True)
        for source in sorted(source_root.glob("*.png")):
            clear_guard_band(source)
            target = public_root / source.name
            target.write_bytes(source.read_bytes())
            repaired += 1
    print(f"repaired and published {repaired} PNG files")


if __name__ == "__main__":
    main()
