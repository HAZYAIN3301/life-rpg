#!/usr/bin/env python3
"""Build a QA-gated Scholar wardrobe on the Traveller common rig.

AI supplies paper texture and lighting in one approved composite. Deterministic
masks own geometry and ensure every runtime asset uses the same 512x768 canvas.
This is deliberately a first production experiment, not an automatic approval.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
MASTER = ROOT / "masters" / "scholar-on-common-rig-alpha-v2.png"
PROJECT_ROOT = ROOT.parent.parent
STAGED_PUBLIC = PROJECT_ROOT / "integration-staging" / "public"
PUBLIC = STAGED_PUBLIC if STAGED_PUBLIC.is_dir() else PROJECT_ROOT / "public"
TRAVELLER = PUBLIC / "art" / "avatars" / "traveller-clean-v2"
OUTPUTS = ROOT / "outputs" / "scholar-v2"
MASKS = ROOT / "masks" / "scholar-v2"
PREVIEWS = ROOT / "previews"
SOURCE_CANVAS = (1024, 1536)
RUNTIME_CANVAS = (512, 768)
PALETTES = {
    "teal": {"label": "Бирюзовый", "swatch": "#1e7773", "hue": None},
    "blue": {"label": "Синий", "swatch": "#3f6496", "hue": .61},
    "violet": {"label": "Фиолетовый", "swatch": "#755596", "hue": .76},
    "crimson": {"label": "Бордовый", "swatch": "#984c58", "hue": .96},
    "forest": {"label": "Лесной", "swatch": "#477856", "hue": .37},
}

LAYERS = [
    {"id": "scholar-backpack", "slot": "back", "file": "back/scholar-backpack.png", "z": 10, "pivot": [302, 255], "replaces": ["avatar-backpack"]},
    {"id": "scholar-coat", "slot": "outfit/torso", "file": "outfit/scholar-coat.png", "z": 52, "pivot": [256, 280], "replaces": ["avatar-cloak"]},
    {"id": "scholar-sleeve-r", "slot": "outfit/sleeve-r", "file": "outfit/scholar-sleeve-r.png", "z": 55, "pivot": [182.5, 205], "replaces": ["avatar-upper-arm-r"]},
    {"id": "scholar-sleeve-l", "slot": "outfit/sleeve-l", "file": "outfit/scholar-sleeve-l.png", "z": 56, "pivot": [329.5, 205], "replaces": ["avatar-upper-arm-l"]},
    {"id": "scholar-neck", "slot": "neck", "file": "neck/scholar-collar-amulet.png", "z": 70, "pivot": [256, 175], "replaces": ["avatar-scarf"]},
    {"id": "scholar-hat", "slot": "headwear", "file": "head/scholar-hat.png", "z": 106, "pivot": [256, 92], "replaces": [], "conflicts": []},
    {"id": "scholar-glasses", "slot": "eyewear", "file": "head/scholar-glasses.png", "z": 108, "pivot": [256, 128], "replaces": ["head-traveller-goggles"]},
    {"id": "scholar-field-kit", "slot": "waist", "file": "waist/scholar-field-kit.png", "z": 110, "pivot": [287, 350], "replaces": ["avatar-pouch"]}
]


def rgba(path: Path) -> np.ndarray:
    data = np.asarray(Image.open(path).convert("RGBA"), dtype=np.uint8).copy()
    data[data[..., 3] == 0, :3] = 0
    return data


def shape(draw_fn) -> np.ndarray:
    image = Image.new("L", SOURCE_CANVAS, 0)
    draw_fn(ImageDraw.Draw(image))
    return np.asarray(image, dtype=np.uint8) > 0


def polygon(points: list[tuple[int, int]]) -> np.ndarray:
    return shape(lambda draw: draw.polygon(points, fill=255))


def rect(box: tuple[int, int, int, int]) -> np.ndarray:
    return shape(lambda draw: draw.rectangle(box, fill=255))


def ring(box: tuple[int, int, int, int], width: int) -> np.ndarray:
    return shape(lambda draw: draw.ellipse(box, outline=255, width=width))


def line(points: list[tuple[int, int]], width: int) -> np.ndarray:
    return shape(lambda draw: draw.line(points, fill=255, width=width, joint="curve"))


def dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    image = Image.fromarray(mask.astype(np.uint8) * 255, "L")
    return np.asarray(image.filter(ImageFilter.MaxFilter(radius * 2 + 1))) > 0


def hsv_masks(master: np.ndarray) -> dict[str, np.ndarray]:
    hsv = np.asarray(Image.fromarray(master[..., :3], "RGB").convert("HSV"), dtype=np.uint8)
    h = hsv[..., 0].astype(np.float32) / 255.0
    s = hsv[..., 1].astype(np.float32) / 255.0
    v = hsv[..., 2].astype(np.float32) / 255.0
    alpha = master[..., 3] > 0
    return {
        "teal": alpha & (h >= .42) & (h <= .58) & (s >= .16),
        "gold": alpha & (h >= .07) & (h <= .18) & (s >= .25) & (v >= .25),
        "orange": alpha & ((h <= .07) | (h >= .97)) & (s >= .30),
        "brown": alpha & (((h <= .15) | (h >= .96)) & (s >= .18) & (v <= .72)),
        "cream": alpha & (h >= .04) & (h <= .19) & (s <= .48) & (v >= .55),
        "dark": alpha & (v <= .28),
        "crystal": alpha & (h >= .45) & (h <= .58) & (s >= .18) & (v >= .55),
    }


def semantic_masks(master: np.ndarray) -> dict[str, np.ndarray]:
    alpha = master[..., 3] > 0
    c = hsv_masks(master)

    hat_region = polygon([(315, 175), (421, 151), (449, 85), (555, 88), (590, 145), (635, 105), (642, 169), (692, 225), (681, 273), (608, 293), (398, 290), (330, 250)])
    hat_color = c["teal"] | c["gold"] | c["orange"]
    hat = alpha & hat_region & dilate(hat_color, 5)

    glasses_geom = ring((423, 231, 502, 319), 13) | ring((513, 231, 594, 319), 13) | line([(498, 272), (518, 272)], 10) | line([(423, 266), (405, 260)], 8) | line([(594, 265), (610, 258)], 8)
    glasses = alpha & dilate(glasses_geom, 2)

    backpack_region = polygon([(572, 300), (690, 294), (751, 330), (783, 405), (785, 724), (735, 746), (679, 710), (640, 622), (600, 520)])
    backpack = alpha & backpack_region & (c["brown"] | c["gold"] | c["cream"] | c["dark"])
    backpack |= alpha & rect((690, 350, 800, 730))

    sleeve_r_region = polygon([(365, 365), (316, 389), (286, 456), (272, 760), (295, 810), (354, 792), (388, 722), (421, 531), (447, 397)])
    sleeve_l_region = polygon([(571, 368), (626, 384), (676, 449), (715, 757), (695, 811), (640, 792), (612, 718), (582, 532), (552, 398)])
    sleeve_r = alpha & sleeve_r_region & ~backpack
    sleeve_l = alpha & sleeve_l_region & ~backpack

    field_strap = line([(427, 337), (548, 570), (600, 704)], 58)
    pouch = polygon([(525, 650), (635, 653), (647, 810), (520, 825)])
    belt = polygon([(390, 674), (569, 671), (591, 735), (390, 737)])
    field_kit = alpha & (field_strap | pouch | belt) & (c["brown"] | c["gold"] | c["dark"])

    neck_region = polygon([(403, 303), (603, 305), (594, 565), (430, 567)])
    necklace_geom = line([(468, 347), (480, 455), (502, 524)], 12) | line([(548, 345), (530, 454), (502, 524)], 12) | polygon([(473, 460), (526, 460), (530, 552), (472, 552)])
    neck = alpha & neck_region & (c["cream"] | c["gold"] | (c["crystal"] & necklace_geom) | (c["brown"] & necklace_geom))

    coat_region = polygon([(382, 304), (607, 307), (615, 626), (730, 1145), (594, 1139), (511, 789), (452, 1138), (275, 1146), (390, 625)])
    coat = alpha & coat_region & ~sleeve_r & ~sleeve_l & ~field_kit & ~neck & ~backpack

    ownership = [backpack, coat, sleeve_r, sleeve_l, neck, hat, glasses, field_kit]
    claimed = np.zeros(alpha.shape, dtype=bool)
    clean: list[np.ndarray] = []
    for mask in ownership:
        owned = mask & ~claimed
        clean.append(owned)
        claimed |= owned
    return dict(zip([layer["id"] for layer in LAYERS], clean, strict=True))


def premultiplied_resize(data: np.ndarray) -> np.ndarray:
    rgba_f = data.astype(np.float32) / 255.0
    alpha = rgba_f[..., 3:4]
    premul = np.concatenate([rgba_f[..., :3] * alpha, alpha], axis=2)
    channels = []
    for index in range(4):
        channel = Image.fromarray(np.clip(premul[..., index] * 65535, 0, 65535).astype(np.uint16))
        channels.append(np.asarray(channel.resize(RUNTIME_CANVAS, Image.Resampling.LANCZOS), dtype=np.float32) / 65535.0)
    resized = np.stack(channels, axis=2)
    out_alpha = np.clip(resized[..., 3:4], 0, 1)
    rgb = np.divide(resized[..., :3], out_alpha, out=np.zeros_like(resized[..., :3]), where=out_alpha > 1e-5)
    out = np.concatenate([np.clip(rgb, 0, 1), out_alpha], axis=2)
    return np.clip(np.rint(out * 255), 0, 255).astype(np.uint8)


def save_layer(master: np.ndarray, mask: np.ndarray, path: Path) -> dict[str, object]:
    layer = np.zeros_like(master)
    layer[mask] = master[mask]
    runtime = premultiplied_resize(layer)
    runtime[runtime[..., 3] == 0, :3] = 0
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(runtime, "RGBA").save(path)
    mask_path = MASKS / path.relative_to(OUTPUTS)
    mask_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(mask.astype(np.uint8) * 255, "L").resize(RUNTIME_CANVAS, Image.Resampling.LANCZOS).save(mask_path)
    alpha = runtime[..., 3]
    return {
        "visiblePixels": int(np.count_nonzero(alpha)),
        "partialAlphaPixels": int(np.count_nonzero((alpha > 0) & (alpha < 255))),
        "transparentCorners": [int(alpha[0, 0]), int(alpha[0, -1]), int(alpha[-1, 0]), int(alpha[-1, -1])] == [0, 0, 0, 0],
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }


def recolor_runtime(path: Path, target_hue: float, out: Path) -> dict[str, object]:
    data = rgba(path)
    hsv = np.asarray(Image.fromarray(data[..., :3], "RGB").convert("HSV"), dtype=np.uint8).copy()
    hue = hsv[..., 0].astype(np.float32) / 255.0
    saturation = hsv[..., 1].astype(np.float32) / 255.0
    value = hsv[..., 2].astype(np.float32) / 255.0
    # The generated paper contains warm/cool teal under the same material. Use
    # a deliberately wider hue window so the vest, sleeves and coat tails move
    # together instead of leaving a teal "sticker" inside a blue/violet coat.
    selected = (data[..., 3] > 0) & (hue >= .25) & (hue <= .62) & (saturation >= .12) & (value <= .88)
    hsv[selected, 0] = round(target_hue * 255)
    hsv[selected, 1] = np.maximum(hsv[selected, 1], 92)
    shifted = np.asarray(Image.fromarray(hsv, "HSV").convert("RGB"), dtype=np.uint8)
    result = data.copy()
    result[selected, :3] = shifted[selected]
    result[result[..., 3] == 0, :3] = 0
    out.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(result, "RGBA").save(out)
    return {
        "changedPixels": int(np.count_nonzero(selected)),
        "alphaExact": bool(np.array_equal(result[..., 3], data[..., 3])),
        "sha256": hashlib.sha256(out.read_bytes()).hexdigest(),
    }


def traveller_layer(relative: str) -> Image.Image:
    return Image.open(TRAVELLER / relative).convert("RGBA")


def compose(layer_paths: list[Path | str]) -> Image.Image:
    canvas = Image.new("RGBA", RUNTIME_CANVAS)
    for source in layer_paths:
        image = traveller_layer(source) if isinstance(source, str) else Image.open(source).convert("RGBA")
        canvas.alpha_composite(image)
    return canvas


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    path = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def checker(size: tuple[int, int], cell: int = 16) -> Image.Image:
    image = Image.new("RGBA", size, (242, 238, 228, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(226, 222, 214, 255))
    return image


def build_preview(paths: dict[str, Path]) -> None:
    base = [
        "base/avatar-shadow.png", "base/avatar-hair-back.png",
        "base/avatar-leg-r.png", "base/avatar-leg-l.png",
        "base/avatar-boot-r.png", "base/avatar-boot-l.png",
        "base/avatar-torso.png",
    ]
    middle = [
        "base/avatar-hips-pants.png", "base/avatar-forearm-hand-r.png",
        "base/avatar-forearm-hand-l.png", "base/avatar-head.png",
        "states/avatar-face-neutral.png", "base/avatar-hair-front.png",
    ]
    full = compose(base + [paths["scholar-backpack"], paths["scholar-coat"], paths["scholar-sleeve-r"], paths["scholar-sleeve-l"]] + middle + [paths["scholar-neck"], paths["scholar-hat"], paths["scholar-glasses"], paths["scholar-field-kit"]])
    no_hat = compose(base + [paths["scholar-backpack"], paths["scholar-coat"], paths["scholar-sleeve-r"], paths["scholar-sleeve-l"]] + middle + [paths["scholar-neck"], paths["scholar-glasses"], paths["scholar-field-kit"]])
    mixed = compose(base + ["wearables/back/avatar-backpack.png", paths["scholar-coat"], paths["scholar-sleeve-r"], paths["scholar-sleeve-l"]] + middle + ["wearables/neck/avatar-scarf.png", paths["scholar-hat"], "wearables/head/head-traveller-goggles.png", "accessories/avatar-pouch.png"])
    base_only = compose(base + ["base/avatar-upper-arm-r.png", "base/avatar-upper-arm-l.png"] + middle)
    variants = [("Scholar set", full), ("No hat", no_hat), ("Mixed slots", mixed), ("Canonical base", base_only)]
    cell_w, cell_h, top = 360, 650, 72
    sheet = Image.new("RGBA", (cell_w * len(variants), top + cell_h), (23, 28, 46, 255))
    draw = ImageDraw.Draw(sheet)
    draw.text((24, 18), "Common rig v1 · Scholar wardrobe gate", font=font(30, True), fill=(244, 238, 228, 255))
    for index, (label, avatar) in enumerate(variants):
        panel = checker((cell_w - 16, cell_h - 48))
        scaled = avatar.copy()
        scaled.thumbnail((310, 560), Image.Resampling.LANCZOS)
        panel.alpha_composite(scaled, ((panel.width - scaled.width) // 2, panel.height - scaled.height - 8))
        sheet.alpha_composite(panel, (index * cell_w + 8, top))
        draw.text((index * cell_w + 18, top + cell_h - 38), label, font=font(22, True), fill=(244, 238, 228, 255))
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(PREVIEWS / "scholar-common-rig-gate-v1.jpg", quality=94)
    full.save(PREVIEWS / "scholar-common-rig-full-v1.png")


def build_colorway_preview(paths_by_palette: dict[str, dict[str, Path]]) -> None:
    base = [
        "base/avatar-shadow.png", "base/avatar-hair-back.png",
        "base/avatar-leg-r.png", "base/avatar-leg-l.png",
        "base/avatar-boot-r.png", "base/avatar-boot-l.png", "base/avatar-torso.png",
    ]
    middle = [
        "base/avatar-hips-pants.png", "base/avatar-forearm-hand-r.png",
        "base/avatar-forearm-hand-l.png", "base/avatar-head.png",
        "states/avatar-face-neutral.png", "base/avatar-hair-front.png",
    ]
    cell_w, cell_h, top = 300, 560, 72
    sheet = Image.new("RGBA", (cell_w * len(PALETTES), top + cell_h), (23, 28, 46, 255))
    draw = ImageDraw.Draw(sheet)
    draw.text((24, 18), "Scholar common rig · deterministic colorways", font=font(30, True), fill=(244, 238, 228, 255))
    for index, (palette_id, palette) in enumerate(PALETTES.items()):
        paths = paths_by_palette[palette_id]
        avatar = compose(base + [paths["scholar-backpack"], paths["scholar-coat"], paths["scholar-sleeve-r"], paths["scholar-sleeve-l"]] + middle + [paths["scholar-neck"], paths["scholar-hat"], paths["scholar-glasses"], paths["scholar-field-kit"]])
        panel = checker((cell_w - 16, cell_h - 48))
        avatar.thumbnail((266, 478), Image.Resampling.LANCZOS)
        panel.alpha_composite(avatar, ((panel.width - avatar.width) // 2, panel.height - avatar.height - 8))
        sheet.alpha_composite(panel, (index * cell_w + 8, top))
        draw.rounded_rectangle((index * cell_w + 18, top + cell_h - 39, index * cell_w + 45, top + cell_h - 12), radius=7, fill=palette["swatch"])
        draw.text((index * cell_w + 54, top + cell_h - 39), palette["label"], font=font(19, True), fill=(244, 238, 228, 255))
    sheet.convert("RGB").save(PREVIEWS / "scholar-common-rig-colorways-v1.jpg", quality=94)


def main() -> None:
    master = rgba(MASTER)
    if tuple(master.shape[1::-1]) != SOURCE_CANVAS:
        raise SystemExit(f"wrong master canvas: {master.shape[1]}x{master.shape[0]}")
    masks = semantic_masks(master)
    paths: dict[str, Path] = {}
    qa_files: dict[str, object] = {}
    for layer in LAYERS:
        path = OUTPUTS / layer["file"]
        paths[layer["id"]] = path
        qa_files[layer["id"]] = save_layer(master, masks[layer["id"]], path)
    build_preview(paths)
    paths_by_palette = {"teal": paths}
    colorway_qa: dict[str, dict[str, object]] = {"teal": {}}
    for palette_id, palette in PALETTES.items():
        if palette_id == "teal":
            continue
        palette_paths: dict[str, Path] = {}
        palette_qa: dict[str, object] = {}
        for layer in LAYERS:
            source = paths[layer["id"]]
            out = OUTPUTS / "colorways" / palette_id / layer["file"]
            palette_paths[layer["id"]] = out
            palette_qa[layer["id"]] = recolor_runtime(source, float(palette["hue"]), out)
        paths_by_palette[palette_id] = palette_paths
        colorway_qa[palette_id] = palette_qa
    build_colorway_preview(paths_by_palette)
    all_passed = (
        all(item["visiblePixels"] > 12 and item["transparentCorners"] for item in qa_files.values())
        and all(item["alphaExact"] for palette in colorway_qa.values() for item in palette.values())
    )
    manifest = {
        "schemaVersion": 1,
        "id": "scholar-common-rig-v1",
        "status": "qa-passed-runtime-verified" if all_passed else "qa-failed",
        "canvas": list(RUNTIME_CANVAS),
        "compositeOrigin": [0, 0],
        "canonicalBase": "traveller-clean-v2",
        "sourceMaster": str(MASTER.relative_to(ROOT)),
        "sourceSha256": hashlib.sha256(MASTER.read_bytes()).hexdigest(),
        "layers": [{**layer, "qa": qa_files[layer["id"]]} for layer in LAYERS],
        "colorways": {
            palette_id: {
                "label": palette["label"],
                "swatch": palette["swatch"],
                "prefix": "" if palette_id == "teal" else f"colorways/{palette_id}/",
            }
            for palette_id, palette in PALETTES.items()
        },
        "preview": "previews/scholar-common-rig-gate-v1.jpg",
        "colorwayPreview": "previews/scholar-common-rig-colorways-v1.jpg",
    }
    (ROOT / "art-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    (ROOT / "qa-report.json").write_text(json.dumps({"allPassed": all_passed, "files": qa_files, "colorways": colorway_qa}, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"allPassed": all_passed, "layers": len(LAYERS)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
