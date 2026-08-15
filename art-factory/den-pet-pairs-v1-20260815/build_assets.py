#!/usr/bin/env python3
"""Normalize the first Den pet-pet authored pair into runtime RGBA plates.

Generated material arrives on a flat technical blue field.  Geometry is never
invented here: the script only removes that field, despills antialiased edges,
normalizes the shared canvas, writes measured QA, and builds the approval sheet.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SOURCES = ROOT / "sources"
OUTPUTS = ROOT / "outputs" / "body-recovery"
PREVIEWS = ROOT / "previews"
CANVAS = (1536, 1536)
FRAMES = ("body-recovery-stretch-a", "body-recovery-stretch-b")


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    if edge1 <= edge0:
        return 1.0 if value >= edge1 else 0.0
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def remove_blue_key(source: Image.Image) -> Image.Image:
    image = source.convert("RGB")
    out = Image.new("RGBA", image.size)
    src = image.load()
    dst = out.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue = src[x, y]
            # The source key is nominally #0000FF but ImageGen introduces a
            # tiny blue gradient.  Distance and channel dominance separate it
            # from teal paper without making the character translucent.
            distance = ((red * red + green * green + (255 - blue) ** 2) ** 0.5)
            dominance = blue - max(red, green)
            field_strength = (1.0 - smoothstep(34, 88, distance)) * smoothstep(34, 112, dominance)
            fringe_strength = smoothstep(22, 74, dominance) * smoothstep(92, 176, blue)
            key_strength = max(field_strength, fringe_strength)
            alpha = int(round(255 * (1.0 - key_strength)))
            if alpha <= 2:
                dst[x, y] = (0, 0, 0, 0)
                continue
            if alpha < 255 and dominance > 0:
                # Remove only technical-blue dominance from edge pixels.  The
                # teal leaves remain opaque because their green channel leads.
                blue = min(blue, max(red, green) + 12)
            dst[x, y] = (red, green, blue, alpha)
    return out


def qa(image: Image.Image) -> dict[str, object]:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    histogram = alpha.histogram()
    visible = sum(histogram[1:])
    partial = sum(histogram[1:255])
    edge = max(6, round(min(image.size) * 0.006))
    edge_alpha = 0
    pixels = alpha.load()
    for y in range(image.height):
        for x in range(image.width):
            if x < edge or y < edge or x >= image.width - edge or y >= image.height - edge:
                edge_alpha += int(pixels[x, y] > 0)
    return {
        "canvas": list(image.size),
        "mode": image.mode,
        "bbox": list(bbox) if bbox else None,
        "visiblePixels": visible,
        "transparentPixels": histogram[0],
        "partialAlphaPixels": partial,
        "edgeAlphaPixels": edge_alpha,
        "pass": bool(
            image.size == CANVAS
            and image.mode == "RGBA"
            and bbox
            and visible > 20_000
            and histogram[0] > 20_000
            and edge_alpha <= 500
        ),
    }


def checker(size: tuple[int, int], cell: int = 32) -> Image.Image:
    result = Image.new("RGB", size, "#17202d")
    draw = ImageDraw.Draw(result)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            fill = "#202b39" if (x // cell + y // cell) % 2 else "#15202c"
            draw.rectangle((x, y, x + cell, y + cell), fill=fill)
    return result


def approval_sheet(outputs: list[Path]) -> None:
    tile = 720
    margin = 28
    header = 92
    sheet = Image.new("RGB", (tile * len(outputs) + margin * 3, tile + header + margin * 2), "#08111d")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((margin, 26), "GAMABUNTA x KATSUYU — AFTER TRAINING / RECOVERY STRETCH", fill="#d7e8ef", font=font)
    for index, path in enumerate(outputs):
        plate = Image.open(path).convert("RGBA")
        stage = checker((tile, tile))
        scaled = plate.resize((tile, tile), Image.Resampling.LANCZOS)
        stage.paste(scaled, (0, 0), scaled)
        left = margin + index * (tile + margin)
        sheet.paste(stage, (left, header))
        draw.text((left + 12, header + 12), f"FRAME {'AB'[index]}", fill="#62d8ff", font=font)
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEWS / "body-recovery-stretch-approval.jpg", quality=92)


def main() -> None:
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    report: dict[str, object] = {
        "id": "den-pet-pairs-v1-20260815",
        "version": "1.0.0",
        "canvas": list(CANVAS),
        "key": "#0000FF",
        "frames": [],
    }
    outputs: list[Path] = []
    for frame in FRAMES:
        source = SOURCES / f"{frame}-keyed.png"
        output = OUTPUTS / f"{frame}.png"
        normalized = remove_blue_key(Image.open(source)).resize(CANVAS, Image.Resampling.LANCZOS)
        normalized.save(output, optimize=True)
        outputs.append(output)
        facts = qa(normalized)
        report["frames"].append({"id": frame, "source": str(source.relative_to(ROOT)), "output": str(output.relative_to(ROOT)), **facts})
    report["pass"] = all(frame["pass"] for frame in report["frames"])
    (ROOT / "qa-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    approval_sheet(outputs)
    if not report["pass"]:
        raise SystemExit("pet-pet asset QA failed")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
