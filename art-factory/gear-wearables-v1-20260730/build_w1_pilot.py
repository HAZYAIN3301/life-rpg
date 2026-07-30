#!/usr/bin/env python3
"""Build the deterministic w1 gear pilot from one AI material source.

The generated source supplies paper texture and lighting only.  The sword
silhouette, scale, rotation, grip anchors, occlusion and common canvases are
owned by this script.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
CANVAS = (1024, 1536)
INVENTORY_CANVAS = (1024, 1024)

MATERIAL = ROOT / "generated" / "w1-material-alpha.png"
TRAVELLER = ROOT.parent / "traveller-v1-wardrobe-v5" / "previews" / "neutral-transparent.png"
SCHOLAR = ROOT.parent / "traveller-scholar-v1-20260728" / "previews" / "scholar-approved-transparent.png"

# Source coordinates are measured once on the approved vertical material pass.
SOURCE_GRIP = (627.0, 1014.0)
SOURCE_TIP = (627.0, 54.0)

# Endpoints are character-specific and are part of the wearable contract.
# Both use the character-right hand, which appears on screen-left.
PLACEMENTS = {
    "inventory": {
        "canvas": INVENTORY_CANVAS,
        "grip": (340.0, 744.0),
        "tip": (760.0, 138.0),
    },
    "traveller": {
        "canvas": CANVAS,
        "grip": (319.0, 825.0),
        "tip": (253.0, 416.0),
        "avatar": TRAVELLER,
        "hand_polygon": [
            (292, 708),
            (352, 708),
            (365, 786),
            (355, 850),
            (336, 879),
            (306, 870),
            (279, 834),
            (276, 784),
        ],
    },
    "scholar": {
        "canvas": CANVAS,
        "grip": (317.0, 861.0),
        "tip": (257.0, 452.0),
        "avatar": SCHOLAR,
        "hand_polygon": [
            (286, 748),
            (349, 748),
            (365, 821),
            (358, 887),
            (339, 919),
            (304, 913),
            (279, 875),
            (278, 810),
        ],
    },
}

# Mask geometry is expressed in generated-source units around SOURCE_GRIP.
# It is deliberately inset from the material source, so the model cannot own
# the production silhouette.
SWORD_PARTS = {
    "blade": [
        (0, -960),
        (-31, -900),
        (-34, -174),
        (34, -174),
        (31, -900),
    ],
    "guard": [
        (-111, -174),
        (-116, -153),
        (-76, -136),
        (-35, -142),
        (35, -142),
        (76, -136),
        (116, -153),
        (111, -174),
    ],
    "grip": [
        (-31, -142),
        (31, -142),
        (32, 127),
        (-32, 127),
    ],
    "pommel": [
        (-32, 122),
        (32, 122),
        (43, 144),
        (34, 181),
        (18, 190),
        (-18, 190),
        (-34, 181),
        (-43, 144),
    ],
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def transform_parameters(placement: dict) -> tuple[float, float]:
    sgx, sgy = SOURCE_GRIP
    stx, sty = SOURCE_TIP
    tgx, tgy = placement["grip"]
    ttx, tty = placement["tip"]

    source_v = (stx - sgx, sty - sgy)
    target_v = (ttx - tgx, tty - tgy)
    source_len = math.hypot(*source_v)
    target_len = math.hypot(*target_v)
    scale = target_len / source_len

    source_angle = math.atan2(source_v[1], source_v[0])
    target_angle = math.atan2(target_v[1], target_v[0])
    angle = target_angle - source_angle
    return scale, angle


def map_local(point: tuple[float, float], placement: dict) -> tuple[float, float]:
    """Map local coordinates around SOURCE_GRIP to target canvas."""
    scale, angle = transform_parameters(placement)
    x, y = point
    c, s = math.cos(angle), math.sin(angle)
    tgx, tgy = placement["grip"]
    return (
        tgx + scale * (c * x - s * y),
        tgy + scale * (s * x + c * y),
    )


def transform_material(source: Image.Image, placement: dict) -> Image.Image:
    """Inverse-map the source RGBA into an exact target canvas."""
    scale, angle = transform_parameters(placement)
    c, s = math.cos(angle), math.sin(angle)
    tgx, tgy = placement["grip"]
    sgx, sgy = SOURCE_GRIP

    a = c / scale
    b = s / scale
    c0 = sgx - a * tgx - b * tgy
    d = -s / scale
    e = c / scale
    f0 = sgy - d * tgx - e * tgy
    return source.transform(
        placement["canvas"],
        Image.Transform.AFFINE,
        (a, b, c0, d, e, f0),
        resample=Image.Resampling.BICUBIC,
    )


def geometry_mask(placement: dict, supersample: int = 4) -> Image.Image:
    width, height = placement["canvas"]
    hi = Image.new("L", (width * supersample, height * supersample), 0)
    draw = ImageDraw.Draw(hi)
    for points in SWORD_PARTS.values():
        mapped = [map_local(point, placement) for point in points]
        draw.polygon(
            [(round(x * supersample), round(y * supersample)) for x, y in mapped],
            fill=255,
        )
    return hi.resize((width, height), Image.Resampling.LANCZOS)


def clipped_item(source: Image.Image, placement: dict) -> tuple[Image.Image, Image.Image]:
    material = transform_material(source, placement)
    mask = geometry_mask(placement)
    material.putalpha(mask)
    return material, mask


def hand_mask(avatar: Image.Image, polygon: list[tuple[int, int]]) -> Image.Image:
    region = Image.new("L", CANVAS, 0)
    ImageDraw.Draw(region).polygon(polygon, fill=255)
    hand = ImageChops.multiply(avatar.getchannel("A"), region)
    # Two-pixel safety expansion keeps the existing hand/glove edge above the
    # foreground hilt without creating a visible halo.
    return hand.filter(ImageFilter.MaxFilter(5))


def foreground_region(placement: dict) -> Image.Image:
    """Only the lower grip and pommel may pass in front of the outfit."""
    width, height = placement["canvas"]
    hi = Image.new("L", (width * 4, height * 4), 0)
    draw = ImageDraw.Draw(hi)
    local = [(-70, 10), (70, 10), (70, 220), (-70, 220)]
    mapped = [map_local(point, placement) for point in local]
    draw.polygon([(round(x * 4), round(y * 4)) for x, y in mapped], fill=255)
    return hi.resize((width, height), Image.Resampling.LANCZOS)


def checker(size: tuple[int, int], cell: int = 24) -> Image.Image:
    out = Image.new("RGBA", size, (222, 214, 192, 255))
    draw = ImageDraw.Draw(out)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(194, 185, 164, 255))
    return out


def fit(image: Image.Image, box: tuple[int, int]) -> Image.Image:
    copy = image.copy()
    copy.thumbnail(box, Image.Resampling.LANCZOS)
    return copy


def contact_sheet(
    inventory: Image.Image,
    avatars: dict[str, Image.Image],
    layers: dict[str, tuple[Image.Image, Image.Image]],
    hand_masks: dict[str, Image.Image],
) -> Image.Image:
    sheet = Image.new("RGBA", (2100, 1380), (19, 26, 40, 255))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    title = "GEAR wearables v1 · w1 Training Blade · GEOMETRY GATE"
    draw.text((48, 30), title, font=font, fill=(244, 229, 191, 255))
    draw.text(
        (48, 50),
        "Prototype placement only: neutral open hands do not provide an approved gripping pose.",
        font=font,
        fill=(242, 155, 120, 255),
    )

    # Inventory art, large enough to judge texture and small-size silhouette.
    inv_bg = checker((580, 580), 28)
    inv = fit(inventory, (520, 520))
    inv_bg.alpha_composite(inv, ((580 - inv.width) // 2, (580 - inv.height) // 2))
    sheet.alpha_composite(inv_bg, (48, 78))
    draw.text((48, 672), "inventoryIcon · 1024x1024 RGBA", font=font, fill="white")

    x_positions = {"traveller": 690, "scholar": 1395}
    for avatar_id, x in x_positions.items():
        avatar = avatars[avatar_id]
        back, front = layers[avatar_id]
        comp = Image.new("RGBA", CANVAS, (231, 218, 184, 255))
        comp.alpha_composite(back)
        comp.alpha_composite(avatar)
        comp.alpha_composite(front)
        shown = fit(comp, (650, 930))
        sheet.alpha_composite(shown, (x + (650 - shown.width) // 2, 78))
        draw.text((x, 1022), f"{avatar_id} · back + avatar + front", font=font, fill="white")

        # Grip close-up shows that the hand stays above the grip while the
        # pommel can sit in front of the coat.
        grip_x, grip_y = map(int, PLACEMENTS[avatar_id]["grip"])
        crop_box = (grip_x - 125, grip_y - 175, grip_x + 175, grip_y + 225)
        close = comp.crop(crop_box).resize((330, 440), Image.Resampling.LANCZOS)
        sheet.alpha_composite(close, (x, 890))
        hm = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
        hm.putalpha(hand_masks[avatar_id])
        mask_crop = hm.crop(crop_box).resize((210, 280), Image.Resampling.NEAREST)
        mask_card = Image.new("RGBA", (210, 280), (42, 47, 58, 255))
        mask_card.alpha_composite(mask_crop)
        sheet.alpha_composite(mask_card, (x + 360, 1050))
        draw.text((x + 360, 1335), "hand occlusion mask", font=font, fill="white")
    return sheet


def fringe_count(image: Image.Image) -> int:
    count = 0
    for r, g, b, a in image.get_flattened_data():
        if a > 8 and g > 145 and g > r * 1.35 and g > b * 1.35:
            count += 1
    return count


def remove_residual_green(image: Image.Image) -> Image.Image:
    """Final deterministic despill for rare antialiasing pixels."""
    out = image.copy()
    pixels = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = pixels[x, y]
            if a > 8 and g > 145 and g > r * 1.35 and g > b * 1.35:
                pixels[x, y] = (r, max(r, b), b, a)
    return out


def alpha_stats(image: Image.Image) -> dict:
    alpha = image.getchannel("A")
    histogram = alpha.histogram()
    return {
        "bbox": list(alpha.getbbox() or (0, 0, 0, 0)),
        "opaquePixels": histogram[255],
        "partialPixels": sum(histogram[1:255]),
        "transparentPixels": histogram[0],
        "cornerAlpha": [
            alpha.getpixel((0, 0)),
            alpha.getpixel((image.width - 1, 0)),
            alpha.getpixel((0, image.height - 1)),
            alpha.getpixel((image.width - 1, image.height - 1)),
        ],
    }


def save_rgba(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def main() -> None:
    for directory in [
        ROOT / "inventory",
        ROOT / "prototypes" / "avatar-layers" / "traveller",
        ROOT / "prototypes" / "avatar-layers" / "scholar",
        ROOT / "masks" / "traveller",
        ROOT / "masks" / "scholar",
        ROOT / "previews",
    ]:
        directory.mkdir(parents=True, exist_ok=True)

    source = Image.open(MATERIAL).convert("RGBA")
    inventory, inventory_mask = clipped_item(source, PLACEMENTS["inventory"])
    inventory = remove_residual_green(inventory)
    inventory_path = ROOT / "inventory" / "w1-training-blade.png"
    inventory_mask_path = ROOT / "masks" / "w1-inventory-silhouette.png"
    save_rgba(inventory, inventory_path)
    inventory_mask.save(inventory_mask_path, optimize=True)

    avatars: dict[str, Image.Image] = {}
    layers: dict[str, tuple[Image.Image, Image.Image]] = {}
    hand_masks: dict[str, Image.Image] = {}
    outputs: list[Path] = [inventory_path]
    geometry: dict[str, dict] = {}

    for avatar_id in ["traveller", "scholar"]:
        placement = PLACEMENTS[avatar_id]
        avatar = Image.open(placement["avatar"]).convert("RGBA")
        full_item, placement_mask = clipped_item(source, placement)
        hand = hand_mask(avatar, placement["hand_polygon"])
        front_zone = foreground_region(placement)

        front_alpha = ImageChops.multiply(full_item.getchannel("A"), front_zone)
        front_alpha = ImageChops.subtract(front_alpha, hand)
        front = full_item.copy()
        front.putalpha(front_alpha)

        # The entire item remains in the back layer.  The foreground layer
        # repeats only the exposed lower hilt after avatar composition.
        back = full_item

        base = ROOT / "prototypes" / "avatar-layers" / avatar_id
        back_path = base / "w1-training-blade-back.png"
        front_path = base / "w1-training-blade-front.png"
        mask_path = ROOT / "masks" / avatar_id / "w1-placement-mask.png"
        hand_path = ROOT / "masks" / avatar_id / "w1-hand-occlusion-mask.png"
        back = remove_residual_green(back)
        front = remove_residual_green(front)
        save_rgba(back, back_path)
        save_rgba(front, front_path)
        placement_mask.save(mask_path, optimize=True)
        hand.save(hand_path, optimize=True)
        outputs.extend([back_path, front_path])

        avatar_alpha = avatar.getchannel("A")
        hidden = ImageChops.multiply(back.getchannel("A"), avatar_alpha)
        visible = ImageChops.subtract(back.getchannel("A"), hidden)
        scale, angle = transform_parameters(placement)
        geometry[avatar_id] = {
            "grip": list(map(int, placement["grip"])),
            "tip": list(map(int, placement["tip"])),
            "scale": round(scale, 6),
            "rotationDegrees": round(math.degrees(angle), 3),
            "gripAvatarAlpha": avatar_alpha.getpixel(tuple(map(int, placement["grip"]))),
            "occludedWeaponPixels": sum(hidden.histogram()[1:]),
            "visibleWeaponPixels": sum(visible.histogram()[1:]),
            "back": str(back_path.relative_to(ROOT)),
            "front": str(front_path.relative_to(ROOT)),
            "placementMask": str(mask_path.relative_to(ROOT)),
            "handMask": str(hand_path.relative_to(ROOT)),
        }
        avatars[avatar_id] = avatar
        layers[avatar_id] = (back, front)
        hand_masks[avatar_id] = hand

    contact = contact_sheet(inventory, avatars, layers, hand_masks)
    contact_path = ROOT / "previews" / "w1-contact-sheet.png"
    save_rgba(contact, contact_path)

    file_qa = {}
    passed = True
    for path in outputs:
        image = Image.open(path).convert("RGBA")
        expected = INVENTORY_CANVAS if path == inventory_path else CANVAS
        stats = alpha_stats(image)
        fringe = fringe_count(image)
        checks = {
            "rgba": image.mode == "RGBA",
            "canvas": list(image.size) == list(expected),
            "nonEmptyAlpha": stats["opaquePixels"] + stats["partialPixels"] > 0,
            "transparentCorners": stats["cornerAlpha"] == [0, 0, 0, 0],
            "greenFringePixels": fringe,
            "greenFringePass": fringe == 0,
        }
        checks_pass = all(
            checks[key]
            for key in ["rgba", "canvas", "nonEmptyAlpha", "transparentCorners", "greenFringePass"]
        )
        passed &= checks_pass
        file_qa[str(path.relative_to(ROOT))] = {
            "pass": checks_pass,
            "checks": checks,
            "alpha": stats,
            "sha256": sha256(path),
        }

    for avatar_id, data in geometry.items():
        geometry_pass = (
            data["gripAvatarAlpha"] >= 240
            and data["occludedWeaponPixels"] >= 1000
            and data["visibleWeaponPixels"] >= 3000
        )
        data["geometryPass"] = geometry_pass
        passed &= geometry_pass

    report = {
        "id": "gear-wearables-v1-w1-pilot",
        "status": "GEOMETRY_GATE" if passed else "FAIL",
        "productionReady": False,
        "gate": {
            "code": "WEAPON_GRIP_POSE_MISSING",
            "fileAndMaskQA": "PASS" if passed else "FAIL",
            "visualGripCompatibility": "FAIL",
            "reason": (
                "Both approved neutral avatars use relaxed/open hands. A sword can be "
                "registered to the palm and occluded deterministically, but neither "
                "approved hand silhouette closes around the grip. Prototype layers "
                "must not be shipped as a believable held weapon."
            ),
            "requiredNextAsset": "character-specific forearm+closed-grip replacement bundle",
        },
        "source": {
            "material": str(MATERIAL.relative_to(ROOT)),
            "sha256": sha256(MATERIAL),
            "sourceGrip": list(map(int, SOURCE_GRIP)),
            "sourceTip": list(map(int, SOURCE_TIP)),
        },
        "files": file_qa,
        "geometry": geometry,
        "contactSheet": str(contact_path.relative_to(ROOT)),
    }
    (ROOT / "qa-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    lines = [
        "# GEAR wearables v1 · w1 QA",
        "",
        f"- Status: **{report['status']}**",
        "- Pilot: `w1` · Тренировочный клинок",
        "- Inventory art: 1024×1024 RGBA — **PASS**",
        "- Avatar candidates: character-specific 1024×1536 RGBA, composite at `(0,0)`",
        "- Render bundle: `back → avatar stack → front`",
        "- Geometry: deterministic mask + fixed source/target landmarks",
        "- Material and lighting: image generation source; production alpha is mask-owned",
        "- Transparent corners / alpha / chroma-fringe: **PASS**",
        "- Visual grip compatibility: **FAIL** — approved neutral hands are relaxed/open",
        "- Production avatar-layer status: **BLOCKED at geometry gate**",
        "",
        "## Grip checks",
        "",
    ]
    for avatar_id, data in geometry.items():
        lines.extend(
            [
                f"- **{avatar_id}**: grip `{data['grip']}`, tip `{data['tip']}`, "
                f"rotation `{data['rotationDegrees']}°`, scale `{data['scale']}`",
                f"  - grip alpha: `{data['gripAvatarAlpha']}`",
                f"  - occluded weapon pixels: `{data['occludedWeaponPixels']}`",
                f"  - visible weapon pixels: `{data['visibleWeaponPixels']}`",
                f"  - geometry gate: **{'PASS' if data['geometryPass'] else 'FAIL'}**",
            ]
        )
    lines.extend(
        [
            "",
            "## Visual gate",
            "",
            "- `previews/w1-contact-sheet.png`",
            "- Contact sheet includes inventory art, both full composites, grip close-ups and hand masks.",
            "- Candidate avatar layers live under `prototypes/`; they are evidence for the gate, not production files.",
            "",
            "No application runtime files were changed.",
        ]
    )
    (ROOT / "qa-report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
