#!/usr/bin/env python3
"""Build the Den v3 starter-furniture raster pack.

The generator outputs remain untouched in sources-green/. This script performs
only deterministic post-processing:

1. sample the flat chroma key from the image border;
2. derive a soft alpha matte from color distance;
3. despill partially transparent edges;
4. trim to the visible subject with fixed padding;
5. normalize the longest edge;
6. render QA previews and machine-readable metrics.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SOURCE_DIR = ROOT / "sources-green"
LAYER_DIR = ROOT / "layers"
PREVIEW_DIR = ROOT / "previews"
BACKGROUND = ROOT.parent / "den-v3-runtime-1536x864.png"

TRANSPARENT_DISTANCE = 12.0
OPAQUE_DISTANCE = 72.0
ALPHA_NOISE_FLOOR = 8
SOURCE_PADDING = 24
MAX_EDGE = 1024

ITEMS = [
    {
        "id": "wall-map",
        "label": "wall-map · Карта странника",
        "source": "wall-map-green.png",
        "layer": "wall-map.png",
        "placement": {"left": 0.355, "top": 0.175, "width": 0.255, "z": 2},
    },
    {
        "id": "seat-cushion",
        "label": "seat-cushion · Подушка привала",
        "source": "seat-cushion-green.png",
        "layer": "seat-cushion.png",
        "placement": {"left": 0.642, "top": 0.585, "width": 0.280, "z": 4},
    },
    {
        "id": "light-lantern",
        "label": "light-lantern · Фонарь странника",
        "source": "light-lantern-green.png",
        "layer": "light-lantern.png",
        "placement": {"left": 0.270, "top": 0.065, "width": 0.075, "z": 4},
    },
    {
        "id": "floor-traveller",
        "label": "floor-traveller · Ковёр путника",
        "source": "floor-traveller-green.png",
        "layer": "floor-traveller.png",
        "placement": {"left": 0.310, "bottom": -0.012, "width": 0.380, "z": 1},
    },
]


def smoothstep(value: np.ndarray) -> np.ndarray:
    value = np.clip(value, 0.0, 1.0)
    return value * value * (3.0 - 2.0 * value)


def border_key(rgb: np.ndarray, band: int = 6) -> np.ndarray:
    samples = np.concatenate(
        [
            rgb[:band, :, :].reshape(-1, 3),
            rgb[-band:, :, :].reshape(-1, 3),
            rgb[:, :band, :].reshape(-1, 3),
            rgb[:, -band:, :].reshape(-1, 3),
        ],
        axis=0,
    )
    return np.median(samples, axis=0)


def chroma_to_rgba(source: Image.Image) -> tuple[Image.Image, list[int]]:
    rgb = np.asarray(source.convert("RGB"), dtype=np.float32)
    key = border_key(rgb)
    distance = np.max(np.abs(rgb - key.reshape(1, 1, 3)), axis=2)

    ratio = (distance - TRANSPARENT_DISTANCE) / (
        OPAQUE_DISTANCE - TRANSPARENT_DISTANCE
    )
    alpha_f = smoothstep(ratio)
    alpha = np.rint(alpha_f * 255.0).astype(np.uint8)
    alpha[alpha <= ALPHA_NOISE_FLOOR] = 0

    # Remove green contamination only on the antialiased transition. Interior
    # muted teals stay fully opaque and keep their authored color.
    out_rgb = rgb.copy()
    partial = (alpha > 0) & (alpha < 255)
    if np.any(partial):
        key_channel = int(np.argmax(key))
        other_channels = [idx for idx in range(3) if idx != key_channel]
        neutral_cap = np.max(out_rgb[:, :, other_channels], axis=2)
        # A partially transparent edge is never allowed to remain key-green
        # dominant. Preserve a small channel lead so authored muted teal still
        # reads naturally after compositing, while neon spill is eliminated.
        safe_cap = neutral_cap + 8.0
        out_rgb[:, :, key_channel][partial] = np.minimum(
            out_rgb[:, :, key_channel][partial], safe_cap[partial]
        )

    out_rgb = np.clip(np.rint(out_rgb), 0, 255).astype(np.uint8)
    out_rgb[alpha == 0] = 0
    rgba = np.dstack([out_rgb, alpha])
    return Image.fromarray(rgba, "RGBA"), [int(round(v)) for v in key]


def tight_normalize(image: Image.Image) -> tuple[Image.Image, list[int]]:
    alpha = np.asarray(image.getchannel("A"), dtype=np.uint8)
    ys, xs = np.nonzero(alpha > ALPHA_NOISE_FLOOR)
    if len(xs) == 0:
        raise RuntimeError("No visible subject after chroma removal")

    left = max(0, int(xs.min()) - SOURCE_PADDING)
    top = max(0, int(ys.min()) - SOURCE_PADDING)
    right = min(image.width, int(xs.max()) + 1 + SOURCE_PADDING)
    bottom = min(image.height, int(ys.max()) + 1 + SOURCE_PADDING)
    cropped = image.crop((left, top, right, bottom))

    longest = max(cropped.size)
    if longest > MAX_EDGE:
        scale = MAX_EDGE / float(longest)
        size = (
            max(1, int(round(cropped.width * scale))),
            max(1, int(round(cropped.height * scale))),
        )
        cropped = cropped.resize(size, Image.Resampling.LANCZOS)
    return cropped, [left, top, right, bottom]


def final_edge_despill(image: Image.Image, key: list[int]) -> Image.Image:
    """Clean any key dominance reintroduced by Lanczos resampling."""
    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8).copy()
    alpha = rgba[:, :, 3]
    partial = (alpha > 0) & (alpha < 255)
    if np.any(partial):
        key_channel = int(np.argmax(np.asarray(key)))
        other_channels = [idx for idx in range(3) if idx != key_channel]
        neutral_cap = np.max(rgba[:, :, other_channels], axis=2).astype(np.int16)
        channel = rgba[:, :, key_channel].astype(np.int16)
        channel[partial] = np.minimum(channel[partial], neutral_cap[partial] + 8)
        rgba[:, :, key_channel] = np.clip(channel, 0, 255).astype(np.uint8)
    rgba[alpha == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def alpha_metrics(image: Image.Image) -> dict[str, object]:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8)
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]
    visible = alpha > ALPHA_NOISE_FLOOR
    partial = (alpha > 0) & (alpha < 255)
    corners = [
        int(alpha[:4, :4].max()),
        int(alpha[:4, -4:].max()),
        int(alpha[-4:, :4].max()),
        int(alpha[-4:, -4:].max()),
    ]

    green_dominance = rgb[:, :, 1].astype(np.int16) - np.maximum(
        rgb[:, :, 0], rgb[:, :, 2]
    ).astype(np.int16)
    green_fringe = visible & (alpha < 252) & (green_dominance > 42) & (
        rgb[:, :, 1] > 135
    )

    return {
        "canvas": [image.width, image.height],
        "visiblePixels": int(visible.sum()),
        "visibleCoverage": round(float(visible.mean()), 6),
        "partialAlphaPixels": int(partial.sum()),
        "transparentCornersMaxAlpha": corners,
        "greenFringePixels": int(green_fringe.sum()),
        "alphaMin": int(alpha.min()),
        "alphaMax": int(alpha.max()),
    }


def checker(size: tuple[int, int], cell: int = 24) -> Image.Image:
    width, height = size
    image = Image.new("RGBA", size, (32, 35, 46, 255))
    draw = ImageDraw.Draw(image)
    colors = ((48, 52, 65, 255), (63, 68, 82, 255))
    for y in range(0, height, cell):
        for x in range(0, width, cell):
            draw.rectangle(
                (x, y, min(width, x + cell), min(height, y + cell)),
                fill=colors[((x // cell) + (y // cell)) % 2],
            )
    return image


def load_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default(size=size)


def render_contact_sheet(processed: dict[str, Image.Image], metrics: dict) -> None:
    sheet = Image.new("RGBA", (1920, 1200), (18, 21, 30, 255))
    draw = ImageDraw.Draw(sheet)
    title_font = load_font(34)
    label_font = load_font(25)
    small_font = load_font(20)
    draw.text((54, 30), "Satoru · Den v3 · starter furniture", fill=(239, 225, 194), font=title_font)

    tile_w, tile_h = 900, 520
    positions = [(45, 100), (975, 100), (45, 650), (975, 650)]
    for item, (x, y) in zip(ITEMS, positions):
        tile = checker((tile_w, tile_h), cell=22)
        art = processed[item["id"]].copy()
        art.thumbnail((tile_w - 110, tile_h - 125), Image.Resampling.LANCZOS)
        tile.alpha_composite(art, ((tile_w - art.width) // 2, 76 + (tile_h - 126 - art.height) // 2))
        tile_draw = ImageDraw.Draw(tile)
        tile_draw.rounded_rectangle(
            (1, 1, tile_w - 2, tile_h - 2),
            radius=22,
            outline=(123, 105, 75, 255),
            width=2,
        )
        tile_draw.rectangle((0, 0, tile_w, 62), fill=(16, 19, 28, 232))
        tile_draw.text((22, 16), item["label"], fill=(239, 225, 194), font=label_font)
        canvas = metrics[item["id"]]["canvas"]
        tile_draw.text(
            (22, tile_h - 38),
            f"{canvas[0]}×{canvas[1]} · transparent PNG · fringe {metrics[item['id']]['greenFringePixels']}",
            fill=(178, 185, 201),
            font=small_font,
        )
        sheet.alpha_composite(tile, (x, y))

    output = PREVIEW_DIR / "starter-furniture-contact-sheet.png"
    sheet.convert("RGB").save(output, "PNG", optimize=True)


def render_scene_preview(processed: dict[str, Image.Image]) -> None:
    scene = Image.open(BACKGROUND).convert("RGBA")
    ordered = sorted(ITEMS, key=lambda item: item["placement"]["z"])
    for item in ordered:
        placement = item["placement"]
        art = processed[item["id"]]
        width = int(round(scene.width * placement["width"]))
        height = int(round(art.height * (width / art.width)))
        art_scaled = art.resize((width, height), Image.Resampling.LANCZOS)
        left = int(round(scene.width * placement["left"]))
        if "top" in placement:
            top = int(round(scene.height * placement["top"]))
        else:
            top = int(round(scene.height * (1.0 - placement["bottom"]) - height))
        scene.alpha_composite(art_scaled, (left, top))

    output = PREVIEW_DIR / "starter-furniture-scene-preview.png"
    scene.convert("RGB").save(output, "PNG", optimize=True)


def main() -> None:
    LAYER_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    processed: dict[str, Image.Image] = {}
    metrics: dict[str, dict] = {}

    for item in ITEMS:
        source_path = SOURCE_DIR / item["source"]
        if not source_path.exists():
            raise FileNotFoundError(source_path)
        source = Image.open(source_path).convert("RGB")
        rgba, key = chroma_to_rgba(source)
        normalized, trim_box = tight_normalize(rgba)
        normalized = final_edge_despill(normalized, key)
        output = LAYER_DIR / item["layer"]
        normalized.save(output, "PNG", optimize=True)
        processed[item["id"]] = normalized
        metrics[item["id"]] = {
            "sourceCanvas": [source.width, source.height],
            "sampledKey": key,
            "trimBox": trim_box,
            **alpha_metrics(normalized),
            "sha256": sha256(output),
        }

    with (ROOT / "qa-metrics.json").open("w", encoding="utf-8") as handle:
        json.dump(metrics, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    render_contact_sheet(processed, metrics)
    render_scene_preview(processed)


if __name__ == "__main__":
    main()
