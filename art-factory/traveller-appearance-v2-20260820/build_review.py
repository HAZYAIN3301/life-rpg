#!/usr/bin/env python3
"""Build approval sheets only after every selected manual mask passes QA."""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from reference_recolor import DIAGNOSTIC_TARGETS, recolor_image
from semantic_masks import (
    REPO_ROOT,
    ROOT,
    load_inventory,
    public_asset_path,
    safe_relative,
    scoped_assets,
    validate_mask_set,
)


PANEL = (180, 210)
CARD = (750, 270)
HEADER = 74


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    names = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for name in names:
        if Path(name).is_file():
            return ImageFont.truetype(name, size)
    return ImageFont.load_default()


def checker(size: tuple[int, int], cell: int = 12) -> Image.Image:
    stage = Image.new("RGB", size, "#142130")
    draw = ImageDraw.Draw(stage)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill="#203247")
    return stage


def fit(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    copy = image.copy()
    copy.thumbnail(size, Image.Resampling.LANCZOS)
    return copy


def stage(image: Image.Image) -> Image.Image:
    target = checker(PANEL)
    preview = fit(image.convert("RGBA"), (PANEL[0] - 12, PANEL[1] - 12))
    target.paste(preview, ((PANEL[0] - preview.width) // 2, (PANEL[1] - preview.height) // 2), preview)
    return target


def mask_overlay(base: Image.Image, mask: Image.Image) -> Image.Image:
    rgba = np.asarray(base.convert("RGBA"), dtype=np.uint8)
    packed = np.asarray(mask.convert("RGB"), dtype=np.uint8)
    output = rgba.copy()
    visible = rgba[..., 3] > 0
    output[..., :3][visible] = np.rint(output[..., :3][visible].astype(np.float32) * 0.28).astype(np.uint8)
    weights = packed.astype(np.float32) / 255.0
    diagnostic = np.array([255, 70, 95], dtype=np.float32)[None, None, :] * weights[..., 0:1]
    diagnostic += np.array([70, 245, 160], dtype=np.float32)[None, None, :] * weights[..., 1:2]
    diagnostic += np.array([70, 150, 255], dtype=np.float32)[None, None, :] * weights[..., 2:3]
    union = weights.sum(axis=2)
    changed = union > 0
    output[..., :3][changed] = np.clip(np.rint(diagnostic[changed]), 0, 255).astype(np.uint8)
    return Image.fromarray(output, "RGBA")


def matte_overlay(base: Image.Image, matte: Image.Image) -> Image.Image:
    rgba = np.asarray(base.convert("RGBA"), dtype=np.uint8)
    coverage = np.asarray(matte.convert("L"), dtype=np.float32) / 255.0
    output = rgba.copy()
    visible = rgba[..., 3] > 0
    output[..., :3][visible] = np.floor(
        output[..., :3][visible].astype(np.float32) * 0.22 + 0.5
    ).astype(np.uint8)
    cyan = np.array([70.0, 225.0, 255.0], dtype=np.float32)
    changed = coverage > 0
    blended = (
        output[..., :3].astype(np.float32) * (1.0 - coverage[..., None])
        + cyan[None, None, :] * coverage[..., None]
    )
    output[..., :3][changed] = np.floor(blended[changed] + 0.5).astype(np.uint8)
    return Image.fromarray(output, "RGBA")


def build_review(
    scope: str,
    output: Path,
    *,
    inventory: dict[str, object] | None = None,
    repo_root: Path = REPO_ROOT,
    factory_root: Path = ROOT,
) -> Path:
    inventory = inventory or load_inventory(factory_root / "inventory.json")
    assets = scoped_assets(scope, inventory)
    gate = validate_mask_set(assets, repo_root=repo_root, factory_root=factory_root)
    if not gate.passed:
        raise ValueError("review blocked; manual masks are missing or invalid: " + "; ".join(gate.errors))
    columns = 2
    rows = math.ceil(len(assets) / columns)
    sheet = Image.new("RGB", (columns * CARD[0], HEADER + rows * CARD[1]), "#08111d")
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 18), f"TRAVELLER APPEARANCE V2 / {scope.upper()} / DIAGNOSTIC COLOURS ONLY", fill="#dceff5", font=font(24, True))
    for index, asset in enumerate(assets):
        left = (index % columns) * CARD[0]
        top = HEADER + (index // columns) * CARD[1]
        base_path = public_asset_path(repo_root, asset["baseRoute"])
        mask_path = safe_relative(factory_root, asset["maskFile"])
        matte_path = safe_relative(factory_root, asset["matteFile"])
        with Image.open(base_path) as opened:
            base = opened.convert("RGBA")
        with Image.open(mask_path) as opened:
            mask = opened.convert("RGB")
        with Image.open(matte_path) as opened:
            matte = opened.convert("L")
        panels = (
            ("BASE", base),
            ("TRAVELLER MATTE / CYAN", matte_overlay(base, matte)),
            ("R SKIN / G HAIR / B EYES", mask_overlay(base, mask)),
            ("DIAGNOSTIC RECOLOUR", recolor_image(base, mask, DIAGNOSTIC_TARGETS)),
        )
        for panel_index, (label, image) in enumerate(panels):
            x = left + panel_index * PANEL[0]
            sheet.paste(stage(image), (x, top))
            draw.rectangle((x, top, x + PANEL[0] - 1, top + PANEL[1] - 1), outline="#36536d", width=1)
            draw.text((x + 8, top + 8), label, fill="#7de0ff", font=font(10, True))
        draw.text((left + 12, top + PANEL[1] + 13), str(asset["id"]), fill="#e6eef5", font=font(14, True))
        draw.text((left + 12, top + PANEL[1] + 35), str(asset["baseRoute"]), fill="#95a9ba", font=font(10))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, "PNG", optimize=True)
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scope", choices=("approval", "all"), default="approval")
    parser.add_argument("--output", default="previews/semantic-mask-approval-01/contact-sheet.png")
    args = parser.parse_args()
    try:
        output = safe_relative(ROOT, args.output)
        built = build_review(args.scope, output)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    print(built.relative_to(ROOT))


if __name__ == "__main__":
    main()
