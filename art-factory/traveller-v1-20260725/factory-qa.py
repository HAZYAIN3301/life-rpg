#!/usr/bin/env python3
"""Validate Traveller production layers and build current assembly previews."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / "art-manifest.json").read_text())
WIDTH, HEIGHT = MANIFEST["canvas"]
OUTPUTS = ROOT / MANIFEST["outputRoot"]
PREVIEWS = ROOT / "previews"
CONTROL = ROOT / MANIFEST["assembledReference"]
PAPER = (244, 238, 228, 255)
INK = (23, 28, 46, 255)
PREVIEWS.mkdir(parents=True, exist_ok=True)


def resolve_layer(layer: dict[str, Any]) -> Path:
    return OUTPUTS / layer["file"]


def validate(file: Path) -> dict[str, Any]:
    original = Image.open(file)
    has_alpha = original.mode in {"RGBA", "LA"} or "transparency" in original.info
    image = original.convert("RGBA")
    pixels = image.load()
    nonzero = 0
    fringe = 0
    min_x, min_y = image.width, image.height
    max_x = max_y = -1

    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                continue
            nonzero += 1
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)
            if green > max(red, blue) + 32 and green > 92:
                fringe += 1

    corners = [
        pixels[0, 0][3],
        pixels[image.width - 1, 0][3],
        pixels[0, image.height - 1][3],
        pixels[image.width - 1, image.height - 1][3],
    ]
    result = {
        "file": str(file.relative_to(ROOT)),
        "size": [image.width, image.height],
        "alpha": has_alpha,
        "transparentCorners": all(alpha == 0 for alpha in corners),
        "coverage": round(nonzero / (image.width * image.height), 6),
        "bbox": [min_x, min_y, max_x + 1, max_y + 1] if nonzero else None,
        "chromaFringePixels": fringe,
    }
    result["pass"] = (
        result["size"] == [WIDTH, HEIGHT]
        and result["alpha"]
        and result["transparentCorners"]
        and result["coverage"] > 0
        and result["chromaFringePixels"] <= 1024
    )
    return result


def paper_canvas() -> Image.Image:
    return Image.new("RGBA", (WIDTH, HEIGHT), PAPER)


def composite_layers(layers: list[dict[str, Any]]) -> Image.Image:
    canvas = paper_canvas()
    for layer in layers:
        canvas.alpha_composite(Image.open(layer["file"]).convert("RGBA"), (0, 0))
    return canvas


def font(size: int) -> ImageFont.ImageFont:
    candidates = [
        Path("/System/Library/Fonts/SFNS.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def contact_sheet(
    cells: list[tuple[str, Image.Image]],
    output: Path,
    columns: int = 3,
) -> None:
    if not cells:
        return
    tile_width, tile_height, header = 384, 576, 56
    rows = (len(cells) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * tile_width, rows * (tile_height + header)), INK)
    draw = ImageDraw.Draw(sheet)
    label_font = font(22)

    for index, (label, image) in enumerate(cells):
        x = (index % columns) * tile_width
        y = (index // columns) * (tile_height + header)
        thumb = image.copy()
        thumb.thumbnail((tile_width, tile_height), Image.Resampling.LANCZOS)
        left = x + (tile_width - thumb.width) // 2
        top = y + header + (tile_height - thumb.height) // 2
        sheet.alpha_composite(thumb, (left, top))
        draw.text((x + 16, y + 15), label, fill=PAPER, font=label_font)
    sheet.save(output)


ordered = sorted(MANIFEST["layers"], key=lambda layer: layer["z"])
present: list[dict[str, Any]] = []
for layer in ordered:
    file = resolve_layer(layer)
    if file.exists():
        present.append({**layer, "file": file})

current = composite_layers(present)
current.save(PREVIEWS / "current-assembled.png")

isolated_cells: list[tuple[str, Image.Image]] = []
for layer in present:
    isolated = paper_canvas()
    isolated.alpha_composite(Image.open(layer["file"]).convert("RGBA"), (0, 0))
    isolated_cells.append((f'{layer["id"]} · z{layer["z"]}', isolated))
contact_sheet(isolated_cells, PREVIEWS / "current-layers-contact-sheet.png")

if CONTROL.exists():
    approved = paper_canvas()
    approved.alpha_composite(Image.open(CONTROL).convert("RGBA"), (0, 0))
    contact_sheet(
        [
            ("approved control master", approved),
            (f"current split · {len(present)} layers", current),
        ],
        PREVIEWS / "control-vs-current.png",
        columns=2,
    )

assets = [validate(layer["file"]) for layer in present]
report = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "canvas": MANIFEST["canvas"],
    "expectedLayerCount": len(MANIFEST["layers"]),
    "presentLayerCount": len(present),
    "passed": sum(asset["pass"] for asset in assets),
    "failed": sum(not asset["pass"] for asset in assets),
    "assets": assets,
}
(ROOT / "qa-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")

lines = [
    "# Traveller v1 factory QA",
    "",
    f"- Canvas: {WIDTH}×{HEIGHT}",
    f'- Present layers: {report["presentLayerCount"]}/{report["expectedLayerCount"]}',
    f'- Passed: {report["passed"]}',
    f'- Failed: {report["failed"]}',
    "- Contract: full master canvas, real alpha, transparent corners, non-empty layer, no material green fringe.",
    "",
    "| asset | bbox | coverage | chroma fringe | result |",
    "|---|---:|---:|---:|---:|",
]
for asset in assets:
    bbox = ", ".join(map(str, asset["bbox"])) if asset["bbox"] else "empty"
    lines.append(
        f'| {asset["file"]} | {bbox} | {asset["coverage"]} | '
        f'{asset["chromaFringePixels"]} | {"PASS" if asset["pass"] else "FAIL"} |'
    )
lines.append("")
(ROOT / "qa-report.md").write_text("\n".join(lines))
print(
    f'Traveller QA: {report["presentLayerCount"]}/{report["expectedLayerCount"]} '
    f'layers; {report["failed"]} failures'
)
