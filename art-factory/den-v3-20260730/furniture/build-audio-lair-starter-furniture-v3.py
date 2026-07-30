#!/usr/bin/env python3
"""Normalize and QA the audio_lair_audit Den v3 starter-furniture sub-batch."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
SOURCES = ROOT / "sources"
PREVIEWS = ROOT / "previews"
DEN_BACKGROUND = ROOT.parent / "den-v3-runtime-1536x864.png"

ITEMS = [
    {
        "id": "surface-crate",
        "slot": "surface",
        "name": "Folding campaign table",
        "raw": "surface-crate-v3-alpha-raw.png",
        "out": "surface-crate-v3.png",
        "motion": "still",
        "access": "starter",
        "placement": {"right": 0.07, "bottom": 0.03, "width": 0.20, "z": 4},
    },
    {
        "id": "comfort-bonsai",
        "slot": "comfort",
        "name": "Bonsai of the Path",
        "raw": "comfort-bonsai-v3-alpha-raw.png",
        "out": "comfort-bonsai-v3.png",
        "motion": "leaf",
        "access": "starter",
        "placement": {"left": 0.0, "bottom": 0.18, "width": 0.13, "z": 3},
    },
    {
        "id": "keepsake-blades",
        "slot": "keepsake",
        "name": "Traveller blade rack",
        "raw": "keepsake-blades-v3-alpha-raw.png",
        "out": "keepsake-blades-v3.png",
        "motion": "glint",
        "access": "starter",
        "placement": {"right": 0.0, "bottom": 0.18, "width": 0.13, "z": 3},
    },
]


def round_up(value: int, multiple: int = 16) -> int:
    return int(math.ceil(value / multiple) * multiple)


def alpha_bbox(image: Image.Image, threshold: int = 4) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > threshold else 0)
    bbox = mask.getbbox()
    if not bbox:
        raise ValueError("empty alpha")
    return bbox


def resize_premultiplied(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    if image.size == size:
        return image
    return image.convert("RGBa").resize(size, Image.Resampling.LANCZOS).convert("RGBA")


def normalize(source: Path, destination: Path) -> dict:
    image = Image.open(source).convert("RGBA")
    source_bbox = alpha_bbox(image)
    subject = image.crop(source_bbox)

    max_subject_edge = 960
    scale = min(1.0, max_subject_edge / max(subject.size))
    subject_size = (
        max(1, round(subject.width * scale)),
        max(1, round(subject.height * scale)),
    )
    subject = resize_premultiplied(subject, subject_size)

    side_pad = 32
    top_pad = 32
    bottom_pad = 24
    canvas_w = round_up(subject.width + side_pad * 2)
    canvas_h = round_up(subject.height + top_pad + bottom_pad)
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    x = (canvas_w - subject.width) // 2
    y = canvas_h - bottom_pad - subject.height
    canvas.alpha_composite(subject, (x, y))
    canvas.save(destination, optimize=True)

    return {
        "sourceCanvas": list(image.size),
        "sourceAlphaBBox": list(source_bbox),
        "scale": round(scale, 6),
        "normalizedCanvas": list(canvas.size),
        "normalizedAlphaBBox": list(alpha_bbox(canvas)),
        "contactBaselinePx": canvas.height - bottom_pad,
    }


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def inspect(path: Path, normalization: dict) -> dict:
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha_bbox(image)
    pixels = list(image.getdata())
    total = image.width * image.height
    alpha_pixels = sum(1 for *_, a in pixels if a > 4)
    opaque_pixels = sum(1 for *_, a in pixels if a >= 250)
    partial_pixels = sum(1 for *_, a in pixels if 4 < a < 250)
    chroma_pixels = sum(
        1
        for r, g, b, a in pixels
        if a > 4 and g >= 190 and g - r >= 75 and g - b >= 75
    )
    chroma_edge_pixels = sum(
        1
        for r, g, b, a in pixels
        if 4 < a < 250 and g >= 150 and g - r >= 45 and g - b >= 45
    )
    corners = [
        alpha.getpixel((0, 0)),
        alpha.getpixel((image.width - 1, 0)),
        alpha.getpixel((0, image.height - 1)),
        alpha.getpixel((image.width - 1, image.height - 1)),
    ]
    coverage = alpha_pixels / total
    chroma_ratio = chroma_pixels / max(alpha_pixels, 1)
    chroma_edge_ratio = chroma_edge_pixels / max(partial_pixels, 1)
    passed = (
        image.mode == "RGBA"
        and bbox is not None
        and all(value == 0 for value in corners)
        and 0.20 <= coverage <= 0.90
        and chroma_ratio < 0.001
        and chroma_edge_ratio < 0.02
        and bbox[3] == normalization["contactBaselinePx"]
    )
    return {
        **normalization,
        "mode": image.mode,
        "alpha": True,
        "transparentCorners": corners,
        "alphaPixels": alpha_pixels,
        "opaquePixels": opaque_pixels,
        "partialPixels": partial_pixels,
        "coverage": round(coverage, 6),
        "chromaLikePixels": chroma_pixels,
        "chromaLikeRatio": round(chroma_ratio, 8),
        "chromaEdgePixels": chroma_edge_pixels,
        "chromaEdgeRatio": round(chroma_edge_ratio, 8),
        "sha256": sha256(path),
        "result": "PASS" if passed else "FAIL",
    }


def checker(size: tuple[int, int], cell: int = 24) -> Image.Image:
    image = Image.new("RGBA", size, "#202632")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill="#2b3340")
    return image


def fit(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    scale = min(size[0] / image.width, size[1] / image.height)
    target = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return resize_premultiplied(image, target)


def add_drop_shadow(base: Image.Image, item: Image.Image, x: int, y: int) -> None:
    alpha = item.getchannel("A")
    shadow = Image.new("RGBA", item.size, (3, 5, 10, 0))
    shadow.putalpha(alpha.point(lambda a: round(a * 0.34)).filter(ImageFilter.GaussianBlur(12)))
    base.alpha_composite(shadow, (x, y + 11))
    base.alpha_composite(item, (x, y))


def place_runtime_item(base: Image.Image, image: Image.Image, placement: dict) -> None:
    target_w = round(base.width * placement["width"])
    target_h = max(1, round(image.height * target_w / image.width))
    item = resize_premultiplied(image, (target_w, target_h))
    if "left" in placement:
        x = round(base.width * placement["left"])
    else:
        x = base.width - round(base.width * placement["right"]) - target_w
    y = base.height - round(base.height * placement["bottom"]) - target_h
    add_drop_shadow(base, item, x, y)


def font(size: int) -> ImageFont.ImageFont:
    candidates = [
        Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def build_previews(records: list[dict]) -> None:
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    den = Image.open(DEN_BACKGROUND).convert("RGBA")
    for item in sorted(ITEMS, key=lambda entry: entry["placement"]["z"]):
        art = Image.open(ROOT / item["out"]).convert("RGBA")
        place_runtime_item(den, art, item["placement"])
    composite_path = PREVIEWS / "audio-lair-starter-v3-den-composite.png"
    den.convert("RGB").save(composite_path, optimize=True)

    sheet = Image.new("RGB", (1800, 1660), "#111620")
    draw = ImageDraw.Draw(sheet)
    draw.text((70, 35), "Den v3 starter furniture — audio_lair_audit", fill="#f4e6c7", font=font(34))
    draw.text(
        (70, 78),
        "Tight alpha assets + exact current runtime anchors on canonical 1536x864 room",
        fill="#9eabbc",
        font=font(20),
    )

    card_w, card_h = 520, 560
    card_y = 125
    for index, (item, record) in enumerate(zip(ITEMS, records)):
        card_x = 70 + index * 570
        panel = checker((card_w, card_h))
        art = Image.open(ROOT / item["out"]).convert("RGBA")
        scaled = fit(art, (440, 445))
        panel.alpha_composite(
            scaled,
            ((card_w - scaled.width) // 2, 30 + (430 - scaled.height) // 2),
        )
        sheet.paste(panel.convert("RGB"), (card_x, card_y))
        draw.rectangle((card_x, card_y, card_x + card_w, card_y + card_h), outline="#465262", width=2)
        draw.text((card_x + 18, card_y + 470), item["id"], fill="#f4e6c7", font=font(24))
        meta = (
            f"{record['normalizedCanvas'][0]}x{record['normalizedCanvas'][1]}  "
            f"coverage {record['coverage']:.1%}  {record['result']}"
        )
        draw.text((card_x + 18, card_y + 510), meta, fill="#aab5c2", font=font(17))

    preview = den.convert("RGB").resize((1600, 900), Image.Resampling.LANCZOS)
    sheet.paste(preview, (100, 735))
    draw.rectangle((100, 735, 1700, 1635), outline="#59677a", width=3)
    draw.text((120, 750), "Runtime placement QA", fill="#f4e6c7", font=font(25))
    sheet.save(PREVIEWS / "audio-lair-starter-v3-contact-sheet.png", optimize=True)


def main() -> None:
    records = []
    for item in ITEMS:
        source = SOURCES / item["raw"]
        destination = ROOT / item["out"]
        normalization = normalize(source, destination)
        record = {
            "id": item["id"],
            "slot": item["slot"],
            "file": item["out"],
            **inspect(destination, normalization),
        }
        records.append(record)

    build_previews(records)
    payload = {
        "batch": "audio-lair-starter-furniture-v3",
        "date": "2026-07-30",
        "canvasContract": "tight alpha PNG; long subject edge <= 960 px; canvas rounded to 16 px",
        "items": records,
        "result": "PASS" if all(item["result"] == "PASS" for item in records) else "FAIL",
    }
    (ROOT / "audio-lair-starter-v3-qa.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
