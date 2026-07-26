#!/usr/bin/env python3
"""Crop a generated transparent asset and place it inside a master-canvas target box."""

import argparse
from pathlib import Path
from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--box", required=True, nargs=4, type=int, metavar=("L", "T", "R", "B"))
    args = parser.parse_args()

    image = Image.open(args.input).convert("RGBA")
    alpha_box = image.getchannel("A").getbbox()
    if not alpha_box:
        raise SystemExit("empty alpha bounds")

    left, top, right, bottom = args.box
    if not (0 <= left < right <= 1024 and 0 <= top < bottom <= 1024):
        raise SystemExit(f"invalid target box: {args.box}")

    cropped = image.crop(alpha_box)
    max_w, max_h = right - left, bottom - top
    scale = min(max_w / cropped.width, max_h / cropped.height)
    out_w = max(1, round(cropped.width * scale))
    out_h = max(1, round(cropped.height * scale))
    fitted = cropped.resize((out_w, out_h), Image.Resampling.LANCZOS)

    x = left + (max_w - out_w) // 2
    y = top + (max_h - out_h) // 2
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    canvas.alpha_composite(fitted, (x, y))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.output)
    print({
        "output": str(args.output),
        "source_bbox": alpha_box,
        "target_box": tuple(args.box),
        "final_bbox": canvas.getchannel("A").getbbox(),
    })


if __name__ == "__main__":
    main()
