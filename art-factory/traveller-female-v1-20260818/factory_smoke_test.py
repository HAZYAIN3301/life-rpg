#!/usr/bin/env python3
"""In-memory smoke tests for the female Traveller factory contracts."""

from __future__ import annotations

import json

from PIL import Image, ImageDraw

import build_contact_pack as contacts
import build_core_pack as core


def keyed_canvas(size: tuple[int, int]) -> Image.Image:
    image = Image.new("RGBA", size, (255, 0, 255, 255))
    pixels = image.load()
    for y in range(size[1]):
        for x in range(size[0]):
            drift = (x * 7 + y * 11) % 24
            pixels[x, y] = (255 - drift // 2, drift, 255 - drift // 3, 255)
    return image


def visible_magenta_ratio(image: Image.Image) -> float:
    visible = 0
    magenta = 0
    for red, green, blue, alpha in image.get_flattened_data():
        if alpha < 8:
            continue
        visible += 1
        magenta += int(min(red, blue) >= 135 and min(red, blue) - green >= 70)
    return magenta / visible if visible else 1.0


def test_core_key_and_profiles() -> None:
    source = keyed_canvas((320, 480))
    draw = ImageDraw.Draw(source)
    draw.rectangle((100, 60, 220, 430), fill=(20, 130, 140, 255))
    draw.rectangle((120, 240, 200, 360), fill=(180, 70, 35, 255))
    extracted = core.remove_magenta_key(source)
    assert extracted.getpixel((110, 100))[:3] == (20, 130, 140), "teal shifted during despill"
    assert extracted.getpixel((150, 300))[:3] == (180, 70, 35), "rust shifted during despill"
    stage, report = core.normalize(source, target_height=796, max_width=590)
    assert report["floorY"] == core.FLOOR_Y
    assert visible_magenta_ratio(stage) <= 0.0005
    expected = {
        "idle": ("core", 796, 590),
        "window-back": ("core", 800, 590),
        "arms-up": ("pose", 829, 590),
        "seated": ("pose", 693, 590),
        "bench-read-a": ("room", 790, 500),
    }
    for frame, values in expected.items():
        spec = core.frame_normalization_spec(
            frame,
            profile="auto",
            target_height=None,
            max_width=None,
        )
        assert (spec["profile"], spec["targetHeight"], spec["maxWidth"]) == values


def test_blink() -> None:
    idle = Image.new("RGBA", core.CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(idle)
    draw.rectangle((200, 64, 440, 859), fill=(220, 180, 145, 255))
    draw.ellipse((286, 163, 299, 184), fill=(35, 30, 25, 255))
    draw.ellipse((330, 163, 343, 184), fill=(35, 30, 25, 255))
    boxes = ((284, 161, 302, 187), (328, 161, 346, 187))
    _, report = core.build_blink(idle, boxes)
    assert report["alphaIdenticalToIdle"] is True
    assert report["changedOutsideEyeBoxes"] == 0
    assert 0 < report["changedRatio"] <= 0.006


def reference(
    canvas: tuple[int, int],
    bbox: tuple[int, int, int, int],
    colour: tuple[int, int, int, int],
) -> Image.Image:
    image = Image.new("RGBA", canvas, (0, 0, 0, 0))
    ImageDraw.Draw(image).rectangle((bbox[0], bbox[1], bbox[2] - 1, bbox[3] - 1), fill=colour)
    return image


def test_contact_profiles() -> None:
    families = contacts.load_families()
    gamabunta = families["gamabunta"]
    toad_source = keyed_canvas((900, 900))
    toad_draw = ImageDraw.Draw(toad_source)
    toad_draw.rectangle((120, 160, 780, 820), fill=(20, 125, 135, 255))
    toad_draw.rectangle((380, 300, 520, 700), fill=(180, 70, 35, 255))
    toad_reference = reference((1536, 1536), (180, 500, 1360, 1470), (20, 125, 135, 255))
    toad_stage, toad_report = contacts.normalize_contact(toad_source, toad_reference, gamabunta)
    assert toad_report["bbox"][3] == 1470
    assert toad_stage.size == (1536, 1536)
    assert visible_magenta_ratio(toad_stage) <= 0.0005

    shadow = families["shadow"]
    shadow_source = keyed_canvas((900, 900))
    shadow_draw = ImageDraw.Draw(shadow_source)
    shadow_draw.rectangle((180, 120, 720, 820), fill=(130, 55, 170, 255))
    shadow_reference = reference((1254, 1254), (260, 140, 1050, 1160), (130, 55, 170, 255))
    shadow_stage, shadow_report = contacts.normalize_contact(shadow_source, shadow_reference, shadow)
    assert shadow_stage.size == (1254, 1254)
    final = shadow_report["bbox"]
    reference_bbox = shadow_report["referenceBbox"]
    final_center = ((final[0] + final[2]) / 2, (final[1] + final[3]) / 2)
    reference_center = (
        (reference_bbox[0] + reference_bbox[2]) / 2,
        (reference_bbox[1] + reference_bbox[3]) / 2,
    )
    assert abs(final_center[0] - reference_center[0]) <= 1
    assert abs(final_center[1] - reference_center[1]) <= 1
    opaque_purple = sum(
        1
        for red, green, blue, alpha in shadow_stage.get_flattened_data()
        if alpha == 255 and blue > red > green
    )
    assert opaque_purple > 10_000, "semantic Shadow purple was removed"


def test_shadow_connected_matte_regression() -> None:
    source = Image.new("RGBA", (180, 180), (0, 0, 0, 0))
    pixels = source.load()
    for y in range(source.height):
        for x in range(source.width):
            drift = (x * 5 + y * 9) % 32
            pixels[x, y] = (226 + drift // 2, 15 + drift, 213 + drift // 3, 255)
    draw = ImageDraw.Draw(source)
    draw.ellipse((48, 30, 132, 154), fill=(104, 44, 146, 255))
    draw.ellipse((75, 62, 105, 92), fill=(211, 99, 239, 255))
    extracted = core.remove_magenta_key(source, preserve_magenta_subject=True)
    bbox = core.alpha_bbox(extracted)
    assert bbox == (48, 30, 133, 155), f"border key leaked into Shadow bbox: {bbox}"
    assert extracted.getpixel((90, 78)) == (211, 99, 239, 255)
    assert extracted.getpixel((90, 110)) == (104, 44, 146, 255)
    assert extracted.getpixel((0, 0))[3] == 0
    assert extracted.getpixel((179, 179))[3] == 0


def main() -> None:
    test_core_key_and_profiles()
    test_blink()
    test_contact_profiles()
    test_shadow_connected_matte_regression()
    print(json.dumps({"factorySmoke": "PASS", "publicWrites": False}, indent=2))


if __name__ == "__main__":
    main()
