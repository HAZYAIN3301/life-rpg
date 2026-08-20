#!/usr/bin/env python3
"""Author the 12-frame semantic-mask approval batch from explicit annotations.

This is a deterministic authoring aid, not a runtime gate.  Every semantic
region is constrained by a frame-specific owner zone and the generated sheet
still requires visual review before these files can become production inputs.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image, ImageDraw

from semantic_masks import ROOT, load_inventory, public_asset_path, safe_relative, scoped_assets


FRAME_CONFIGS: dict[str, dict[str, object]] = {
    "male-v1:core:idle": {
        "hair": [(205, 45), (432, 45), (440, 250), (390, 290), (255, 290), (195, 230)],
        "skin_rects": [(0, 0, 640, 900)],
        "eye_boxes": [(288, 172, 307, 202), (334, 172, 354, 202)],
        "matte_rects": [(0, 0, 640, 900)],
    },
    "female-f2-v1:core:idle": {
        "hair": [(195, 45), (475, 45), (480, 430), (300, 430), (205, 320)],
        "skin_rects": [(0, 0, 640, 900)],
        "eye_boxes": [(276, 165, 296, 196), (320, 164, 341, 196)],
        "matte_rects": [(0, 0, 640, 900)],
    },
    "male-v1:core:window-back": {
        "hair": [(205, 45), (440, 45), (440, 245), (205, 245)],
        "skin_rects": [(0, 0, 640, 900)],
        "eye_boxes": [],
        "matte_rects": [(0, 0, 640, 900)],
    },
    "female-f2-v1:core:window-back": {
        "hair": [(185, 35), (475, 35), (475, 370), (185, 370)],
        "skin_rects": [(0, 0, 640, 900)],
        "eye_boxes": [],
        "matte_rects": [(0, 0, 640, 900)],
    },
    "male-v1:body-toad:greet-contact": {
        "hair": [(900, 300), (1325, 300), (1325, 1050), (900, 1050)],
        "skin_rects": [(940, 700, 1536, 1536)],
        "skin_polygons": [[(790, 1075), (850, 1060), (1000, 1060), (1000, 1165), (835, 1160), (790, 1140)]],
        "eye_boxes": [(988, 890, 1024, 942), (1046, 892, 1070, 942)],
        "matte_polygons": [[(940, 710), (1190, 710), (1390, 850), (1460, 1475), (900, 1475), (860, 1250), (900, 1170), (835, 1160), (790, 1140), (790, 1075), (850, 1060), (900, 1030), (940, 930)]],
    },
    "female-f2-v1:body-toad:greet-contact": {
        "hair": [(900, 360), (1410, 360), (1410, 1050), (900, 1050)],
        "skin_rects": [(920, 700, 1536, 1536)],
        "skin_polygons": [[(790, 1075), (850, 1060), (1020, 1060), (1020, 1165), (845, 1160), (790, 1135)]],
        "eye_boxes": [(1022, 884, 1070, 944), (1104, 880, 1168, 944)],
        "matte_polygons": [[(920, 700), (1240, 700), (1420, 850), (1490, 1475), (900, 1475), (860, 1260), (900, 1180), (845, 1160), (790, 1135), (790, 1080), (845, 1060), (900, 1030), (920, 930)]],
    },
    "male-v1:recovery-slug:breathe-in": {
        "hair": [(850, 250), (1340, 250), (1340, 760), (850, 760)],
        "skin_rects": [(850, 300, 1536, 1536)],
        "skin_polygons": [[(680, 1060), (700, 1010), (780, 990), (900, 980), (900, 1100), (690, 1100)]],
        "eye_boxes": [(994, 630, 1064, 682), (1132, 630, 1206, 682)],
        "closed_eyes": True,
        "matte_polygons": [[(1000, 285), (1090, 295), (1160, 320), (1220, 325), (1275, 375), (1295, 470), (1280, 570), (1310, 650), (1330, 770), (1330, 900), (1400, 970), (1530, 990), (1536, 1080), (1480, 1115), (1400, 1110), (1420, 1180), (1380, 1245), (1300, 1285), (1250, 1320), (1120, 1320), (1000, 1310), (900, 1325), (795, 1300), (745, 1250), (735, 1160), (680, 1105), (670, 1050), (695, 1005), (780, 985), (830, 955), (850, 900), (835, 800), (865, 720), (900, 650), (900, 560), (900, 450), (930, 360)]],
        "matte_exclude_polygons": [
            [(1242, 470), (1260, 470), (1270, 480), (1280, 490), (1290, 510), (1305, 530), (1315, 560), (1325, 620), (1330, 690), (1310, 705), (1295, 650), (1290, 590), (1270, 550), (1258, 550), (1258, 520), (1257, 515), (1256, 510), (1255, 505), (1254, 500), (1253, 495), (1251, 490), (1250, 485), (1247, 480), (1245, 475)],
            [(978, 282), (1004, 282), (1027, 289), (1040, 297), (1040, 310), (1045, 315), (1047, 320), (1049, 325), (1052, 330), (1054, 335), (1057, 340), (1060, 345), (1044, 349), (1032, 342), (1019, 334), (1005, 326), (992, 317), (983, 306)],
            [(754, 1255), (775, 1255), (785, 1266), (875, 1266), (879, 1285), (885, 1305), (902, 1321), (890, 1325), (860, 1320), (835, 1312), (810, 1307), (792, 1300), (780, 1285), (768, 1275), (758, 1268)],
            [(1134, 1284), (1146, 1284), (1168, 1290), (1188, 1296), (1204, 1301), (1218, 1305), (1232, 1310), (1244, 1315), (1252, 1321), (1230, 1323), (1200, 1321), (1150, 1321), (1100, 1318), (1060, 1315), (1000, 1311), (1018, 1305), (1042, 1300), (1092, 1298), (1110, 1294), (1130, 1290)],
            [(1308, 1265), (1334, 1265), (1333, 1272), (1323, 1280), (1310, 1280)],
        ],
    },
    "female-f2-v1:recovery-slug:breathe-in": {
        "hair": [(860, 220), (1450, 220), (1450, 900), (860, 900)],
        "skin_rects": [(850, 300, 1536, 1536)],
        "skin_polygons": [[(680, 1050), (700, 1000), (790, 980), (920, 970), (920, 1100), (690, 1100)]],
        "eye_boxes": [(972, 552, 1008, 584), (1102, 552, 1148, 584)],
        "closed_eyes": True,
        "matte_polygons": [[(1010, 320), (1110, 315), (1190, 335), (1280, 325), (1350, 380), (1375, 500), (1385, 650), (1350, 760), (1330, 850), (1360, 930), (1430, 980), (1505, 995), (1520, 1060), (1480, 1110), (1400, 1105), (1420, 1180), (1380, 1240), (1300, 1280), (1250, 1315), (1120, 1315), (1000, 1305), (900, 1320), (800, 1295), (750, 1250), (740, 1160), (690, 1100), (675, 1045), (700, 1000), (790, 980), (835, 950), (850, 900), (835, 800), (860, 700), (890, 620), (920, 550), (940, 450), (970, 360)]],
        "matte_exclude_polygons": [[(1062, 315), (1080, 315), (1095, 321), (1107, 329), (1112, 338), (1108, 342), (1103, 345), (1092, 338), (1081, 332), (1071, 325)]],
    },
    "male-v1:resources-penguin:greet-contact": {
        "hair": [(760, 190), (1240, 190), (1240, 860), (760, 860)],
        "skin_rects": [(760, 400, 1536, 1536)],
        "skin_polygons": [[(735, 980), (770, 955), (900, 920), (900, 1070), (760, 1070), (735, 1055)]],
        "eye_boxes": [(932, 680, 964, 734), (986, 665, 1022, 718)],
        "matte_polygons": [[(820, 420), (1210, 420), (1500, 680), (1536, 1475), (800, 1475), (760, 1200), (760, 1080), (735, 1055), (735, 980), (770, 955), (800, 900)]],
    },
    "female-f2-v1:resources-penguin:greet-contact": {
        "hair": [(790, 150), (1400, 150), (1400, 940), (790, 940)],
        "skin_rects": [(760, 400, 1536, 1536)],
        "skin_polygons": [[(735, 980), (775, 955), (920, 920), (920, 1080), (760, 1080), (735, 1065)]],
        "eye_boxes": [(960, 696, 990, 744), (1022, 680, 1062, 736)],
        "matte_polygons": [[(820, 400), (1320, 400), (1520, 680), (1536, 1475), (800, 1475), (760, 1210), (760, 1090), (735, 1065), (735, 980), (775, 955), (820, 900)]],
    },
    "male-v1:shadow:attune-guardian": {
        "hair": [(550, 190), (920, 190), (960, 380), (920, 650), (570, 650), (540, 380)],
        "skin_rects": [],
        "skin_polygons": [[(560, 190), (900, 190), (980, 300), (1050, 450), (1060, 700), (1030, 820), (1080, 900), (1100, 1120), (950, 1190), (400, 1190), (370, 1100), (380, 980), (420, 900), (500, 850), (540, 780), (550, 650), (560, 550), (555, 350)], [(305, 620), (325, 620), (350, 635), (375, 650), (405, 650), (440, 660), (475, 670), (510, 690), (540, 720), (560, 750), (570, 780), (565, 820), (540, 850), (510, 865), (480, 860), (450, 845), (425, 825), (400, 800), (385, 770), (360, 745), (335, 720), (315, 690), (300, 650)]],
        "eye_boxes": [(638, 414, 674, 475), (718, 428, 766, 486)],
        "matte_polygons": [[(560, 190), (900, 190), (980, 300), (1050, 450), (1060, 700), (1030, 820), (1080, 900), (1100, 1120), (950, 1190), (400, 1190), (370, 1100), (380, 980), (420, 900), (500, 850), (540, 780), (550, 650), (560, 550), (555, 350)], [(305, 620), (325, 620), (350, 635), (375, 650), (405, 650), (440, 660), (475, 670), (510, 690), (540, 720), (560, 750), (570, 780), (565, 820), (540, 850), (510, 865), (480, 860), (450, 845), (425, 825), (400, 800), (385, 770), (360, 745), (335, 720), (315, 690), (300, 650)]],
        "matte_exclude_polygons": [[(400, 500), (525, 500), (525, 565), (505, 600), (480, 630), (455, 650), (430, 655), (405, 645), (385, 625), (395, 600)]],
    },
    "female-f2-v1:shadow:attune-guardian": {
        "hair": [(610, 280), (1000, 280), (1060, 520), (1020, 820), (610, 820), (590, 480)],
        "skin_rects": [],
        "skin_polygons": [[(620, 290), (880, 290), (980, 380), (1015, 600), (980, 720), (970, 850), (1030, 930), (1050, 1140), (930, 1190), (450, 1190), (400, 1110), (400, 1000), (440, 920), (500, 850), (560, 820), (590, 750), (610, 650), (620, 550)], [(365, 710), (390, 715), (420, 725), (450, 735), (480, 740), (520, 750), (555, 770), (580, 800), (600, 830), (600, 860), (580, 890), (550, 905), (515, 900), (480, 880), (450, 855), (420, 830), (395, 805), (375, 780), (360, 750)]],
        "eye_boxes": [(666, 470, 707, 526), (742, 472, 781, 526)],
        "matte_polygons": [[(620, 290), (880, 290), (980, 380), (1015, 600), (980, 720), (970, 850), (1030, 930), (1050, 1140), (930, 1190), (450, 1190), (400, 1110), (400, 1000), (440, 920), (500, 850), (560, 820), (590, 750), (610, 650), (620, 550)], [(365, 710), (390, 715), (420, 725), (450, 735), (480, 740), (520, 750), (555, 770), (580, 800), (600, 830), (600, 860), (580, 890), (550, 905), (515, 900), (480, 880), (450, 855), (420, 830), (395, 805), (375, 780), (360, 750)]],
        "matte_exclude_polygons": [[(420, 620), (510, 620), (510, 660), (500, 680), (488, 700), (475, 715), (464, 728), (452, 731), (442, 725), (435, 710), (425, 690), (415, 660)]],
    },
}


def rgb_to_hsv(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    normalized = rgb.astype(np.float32) / 255.0
    maximum = normalized.max(axis=2)
    minimum = normalized.min(axis=2)
    delta = maximum - minimum
    hue = np.zeros_like(maximum)
    nonzero = delta > 1e-6
    red, green, blue = normalized[..., 0], normalized[..., 1], normalized[..., 2]
    selected = nonzero & (maximum == red)
    hue[selected] = ((green[selected] - blue[selected]) / delta[selected]) % 6
    selected = nonzero & (maximum == green)
    hue[selected] = ((blue[selected] - red[selected]) / delta[selected]) + 2
    selected = nonzero & (maximum == blue)
    hue[selected] = ((red[selected] - green[selected]) / delta[selected]) + 4
    hue /= 6.0
    saturation = np.where(maximum > 1e-6, delta / np.maximum(maximum, 1e-6), 0)
    return hue, saturation, maximum


def polygon(size: tuple[int, int], points: Iterable[tuple[int, int]]) -> np.ndarray:
    image = Image.new("L", size, 0)
    ImageDraw.Draw(image).polygon(list(points), fill=255)
    return np.asarray(image, dtype=np.uint8) > 0


def rectangles(size: tuple[int, int], values: Iterable[tuple[int, int, int, int]]) -> np.ndarray:
    result = np.zeros((size[1], size[0]), dtype=bool)
    for left, top, right, bottom in values:
        result[max(0, top):min(size[1], bottom), max(0, left):min(size[0], right)] = True
    return result


def polygons(size: tuple[int, int], values: Iterable[Iterable[tuple[int, int]]]) -> np.ndarray:
    result = np.zeros((size[1], size[0]), dtype=bool)
    for points in values:
        result |= polygon(size, points)
    return result


def author(base: Image.Image, config: dict[str, object]) -> tuple[Image.Image, Image.Image]:
    rgba = np.asarray(base.convert("RGBA"), dtype=np.uint8)
    rgb = rgba[..., :3]
    alpha = rgba[..., 3]
    hue, saturation, value = rgb_to_hsv(rgb)
    red = rgb[..., 0].astype(np.float32)
    green = rgb[..., 1].astype(np.float32)
    blue = rgb[..., 2].astype(np.float32)
    size = base.size
    visible = alpha > 12

    skin_owner = rectangles(size, config.get("skin_rects", ()))
    skin_owner |= polygons(size, config.get("skin_polygons", ()))
    skin = (
        visible
        & skin_owner
        & (hue >= 0.052)
        & (hue <= 0.125)
        & (saturation >= 0.28)
        & (saturation <= 0.68)
        & (value >= 0.58)
        & (green / np.maximum(red, 1) >= 0.54)
        & (blue / np.maximum(green, 1) >= 0.42)
    )
    hair = (
        visible
        & polygon(size, config["hair"])
        & (hue >= 0.055)
        & (hue <= 0.16)
        & (saturation >= 0.25)
        & (value >= 0.055)
        & (value <= 0.62)
        & (red >= green * 1.02)
        & (green >= blue * 1.02)
    )
    hair &= ~rectangles(size, config.get("hair_exclude_rects", ()))
    eyes = np.zeros_like(visible)
    closed = bool(config.get("closed_eyes"))
    for box in config["eye_boxes"]:
        owner = rectangles(size, [box])
        eyes |= visible & owner & (value <= (0.58 if closed else 0.34)) & (saturation <= (1.0 if closed else 0.92))

    hair &= ~eyes
    skin &= ~(hair | eyes)
    packed = np.zeros_like(rgb)
    packed[..., 0] = np.where(skin, alpha, 0).astype(np.uint8)
    packed[..., 1] = np.where(hair, alpha, 0).astype(np.uint8)
    packed[..., 2] = np.where(eyes, alpha, 0).astype(np.uint8)

    matte_owner = rectangles(size, config.get("matte_rects", ()))
    matte_owner |= polygons(size, config.get("matte_polygons", ()))
    matte_owner &= ~rectangles(size, config.get("matte_exclude_rects", ()))
    matte_owner &= ~polygons(size, config.get("matte_exclude_polygons", ()))
    matte = np.where(visible & matte_owner, alpha, 0).astype(np.uint8)
    escaped = packed.max(axis=2) > matte
    if np.any(escaped):
        escaped_y, escaped_x = np.where(escaped)
        channel_counts = {
            channel: int(np.count_nonzero(escaped & (packed[..., index] > 0)))
            for index, channel in enumerate(("skin", "hair", "eyes"))
        }
        bounds = (
            int(escaped_x.min()),
            int(escaped_y.min()),
            int(escaped_x.max()) + 1,
            int(escaped_y.max()) + 1,
        )
        samples = [
            (int(x), int(y), tuple(int(value) for value in rgba[y, x]))
            for y, x in zip(escaped_y[:8], escaped_x[:8])
        ]
        raise ValueError(
            "semantic annotation escapes its manually authored Traveller matte: "
            f"count={int(np.count_nonzero(escaped))}, bbox={bounds}, channels={channel_counts}, samples={samples}"
        )
    return Image.fromarray(packed, "RGB"), Image.fromarray(matte, "L")


def write_image(path: Path, image: Image.Image, *, overwrite: bool) -> None:
    if path.exists() and not overwrite:
        raise FileExistsError(f"refusing to overwrite immutable input: {path.relative_to(ROOT)}")
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="write all 24 reviewed factory inputs")
    parser.add_argument("--overwrite", action="store_true", help="replace this approval batch during review")
    args = parser.parse_args()
    inventory = load_inventory()
    assets = scoped_assets("approval", inventory)
    ids = [str(asset["id"]) for asset in assets]
    if set(ids) != set(FRAME_CONFIGS) or len(ids) != 12:
        raise SystemExit("approval annotations do not match the exact 12-frame inventory")
    authored: list[tuple[dict[str, object], Image.Image, Image.Image]] = []
    for asset in assets:
        base_path = public_asset_path(ROOT.parents[1], asset["baseRoute"])
        with Image.open(base_path) as opened:
            opened.load()
            try:
                semantic, matte = author(opened.convert("RGBA"), FRAME_CONFIGS[str(asset["id"])])
            except ValueError as error:
                raise ValueError(f"{asset['id']}: {error}") from error
        authored.append((asset, semantic, matte))
    print(f"preflight: PASS ({len(authored)} masks + {len(authored)} mattes)")
    if not args.write:
        print("publicArtWrites: false; factoryWrites: false")
        return
    for asset, semantic, matte in authored:
        write_image(safe_relative(ROOT, asset["maskFile"]), semantic, overwrite=args.overwrite)
        write_image(safe_relative(ROOT, asset["matteFile"]), matte, overwrite=args.overwrite)
    print("factoryWrites: 24; publicArtWrites: false")


if __name__ == "__main__":
    main()
