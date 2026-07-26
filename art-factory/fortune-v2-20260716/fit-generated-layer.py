#!/usr/bin/env python3
"""Fit a keyed generated layer into an approved reference layer's exact alpha geometry."""

import argparse
from pathlib import Path
from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--reference", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    generated = Image.open(args.input).convert("RGBA")
    reference = Image.open(args.reference).convert("RGBA")
    if reference.size != (1024, 1024):
        raise SystemExit(f"reference must be 1024x1024, got {reference.size}")

    generated_box = generated.getchannel("A").getbbox()
    reference_alpha = reference.getchannel("A")
    reference_box = reference_alpha.getbbox()
    if not generated_box or not reference_box:
        raise SystemExit("empty alpha bounds")

    left, top, right, bottom = reference_box
    fitted = generated.crop(generated_box).resize(
        (right - left, bottom - top), Image.Resampling.LANCZOS
    )
    canvas = Image.new("RGBA", reference.size, (0, 0, 0, 0))
    canvas.alpha_composite(fitted, (left, top))
    canvas.putalpha(reference_alpha)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.output)
    print({
        "output": str(args.output),
        "generated_bbox": generated_box,
        "reference_bbox": reference_box,
        "final_bbox": canvas.getchannel("A").getbbox(),
    })


if __name__ == "__main__":
    main()
