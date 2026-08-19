#!/usr/bin/env python3
"""In-memory smoke tests for the female Traveller factory contracts."""

from __future__ import annotations

import json

from PIL import Image, ImageDraw

import build_contact_pack as contacts
import build_core_pack as core
import contact_qa as contact_quality


def test_approved_identity_pin() -> None:
    identity = core.load_approved_identity()
    assert identity == {
        "id": "female-f2-high-ponytail",
        "path": "sources/identity-variants-04/candidate-f2-high-ponytail-keyed.png",
        "sha256": "5d811618fc851eec48eb910c7efc98eec46e23a94919b376d3c64f5ae24d62da",
        "status": "identity-approved/runtime-not-yet",
    }
    assert contacts.load_approved_identity() == identity
    real_sha256 = core.sha256
    try:
        core.sha256 = lambda _path: "0" * 64
        try:
            core.load_approved_identity()
        except ValueError as error:
            assert "SHA-256 mismatch" in str(error)
        else:
            raise AssertionError("approved identity accepted a mismatched SHA-256")
    finally:
        core.sha256 = real_sha256


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


def test_contact_family_routes() -> None:
    families = contacts.load_families()
    assert set(families) == {"gamabunta", "recovery", "resources", "shadow"}
    assert contacts.frame_route(families["gamabunta"], "pushup-up")["runtime"] == (
        "public/art/pets/body-toad-v1/pair-v4/female/pushup-up.png"
    )
    assert contacts.frame_route(families["shadow"], "attune-keeper")["reference"] == (
        "public/art/companions/shadow-den-v1/pair-v1/attune-keeper.png"
    )
    recovery = families["recovery"]
    assert tuple(recovery["frames"]) == (
        "greet-contact",
        "breathe-in",
        "breathe-out",
        "restore-contact",
        "stretch-a",
        "stretch-soft-b",
    )
    soft = contacts.frame_route(recovery, "stretch-soft-b")
    assert soft == {
        "source": "stretch-soft-b-keyed.png",
        "reference": "public/art/pets/recovery-slug-v1/pair-v3/stretch-soft-b-v155.png",
        "runtime": "public/art/pets/recovery-slug-v1/pair-v3/female/stretch-soft-b-v155.png",
        "bboxAlphaThreshold": 32,
    }
    assert "pair-v2/stretch-b.png" not in json.dumps(recovery)
    resources = families["resources"]
    assert len(resources["frames"]) == 12
    route = contacts.frame_route(resources, "close-stamp")
    assert route["source"] == "close-stamp-keyed.png"
    assert route["reference"] == (
        "public/art/pets/resources-penguin-v1/pair-v1/close-stamp.png"
    )
    assert route["runtime"] == (
        "public/art/pets/resources-penguin-v1/pair-v1/female/close-stamp.png"
    )
    assert contacts.selected_frames(
        "stretch-soft-b,breathe-in", tuple(recovery["frames"])
    ) == ("stretch-soft-b", "breathe-in")


def test_contact_reference_geometry_contract() -> None:
    families = contacts.load_families()
    recovery = families["recovery"]
    expected_recovery = {
        "greet-contact": (44, 296, 1492, 1360),
        "breathe-in": (30, 215, 1510, 1333),
        "breathe-out": (32, 359, 1485, 1362),
        "restore-contact": (40, 377, 1508, 1356),
        "stretch-a": (64, 402, 1488, 1297),
        "stretch-soft-b": (24, 394, 1515, 1304),
    }
    for frame, expected_bbox in expected_recovery.items():
        with Image.open(contacts.reference_path(recovery, frame)) as image:
            assert contacts.alpha_bbox_at(image.convert("RGBA"), 32) == expected_bbox
    with Image.open(contacts.reference_path(recovery, "breathe-out")) as image:
        assert contacts.alpha_bbox_at(image.convert("RGBA"), 8) == (5, 2, 1534, 1534)

    resources = families["resources"]
    for frame in resources["frames"]:
        with Image.open(contacts.reference_path(resources, frame)) as image:
            assert contacts.alpha_bbox_at(image.convert("RGBA"), 8)[3] == 1470


def test_recovery_threshold_reference_bbox() -> None:
    recovery = contacts.load_families()["recovery"]
    source = keyed_canvas((900, 900))
    source_draw = ImageDraw.Draw(source)
    source_draw.rectangle((94, 244, 815, 755), fill=(90, 100, 105, 12))
    source_draw.rectangle((100, 250, 809, 749), fill=(20, 125, 135, 255))
    recovery_reference = Image.new("RGBA", (1536, 1536), (0, 0, 0, 0))
    reference_draw = ImageDraw.Draw(recovery_reference)
    reference_draw.rectangle((2, 2, 1533, 1533), fill=(90, 100, 105, 12))
    reference_draw.rectangle((200, 400, 1335, 1199), fill=(20, 125, 135, 255))
    stage, report = contacts.normalize_contact(
        source,
        recovery_reference,
        recovery,
        bbox_alpha_threshold=32,
    )
    assert stage.size == (1536, 1536)
    assert report["bboxAlphaThreshold"] == 32
    assert report["referenceBbox"] == [200, 400, 1336, 1200]
    assert report["bbox"] == [200, 400, 1336, 1200]
    raw_bbox = contacts.alpha_bbox_at(recovery_reference, 8)
    assert raw_bbox == (2, 2, 1534, 1534), "test fixture lost its faint matte"


def test_resources_grounded_normalization() -> None:
    resources = contacts.load_families()["resources"]
    source = keyed_canvas((900, 900))
    ImageDraw.Draw(source).rectangle((150, 180, 749, 779), fill=(20, 125, 135, 255))
    resource_reference = reference(
        (1536, 1536),
        (320, 570, 1220, 1470),
        (20, 125, 135, 255),
    )
    stage, report = contacts.normalize_contact(source, resource_reference, resources)
    assert stage.size == (1536, 1536)
    assert report["bbox"][3] == 1470
    assert report["referenceBbox"] == [320, 570, 1220, 1470]


def test_contact_continuity_contract() -> None:
    geometry = contact_quality.geometry_contract({})
    stable = {
        "a": {
            "widthRatioToReference": 0.99,
            "heightRatioToReference": 1.0,
            "centerOffsetPx": [0.0, 0.0],
        },
        "b": {
            "widthRatioToReference": 1.01,
            "heightRatioToReference": 0.98,
            "centerOffsetPx": [1.0, 2.0],
        },
    }
    result = contact_quality.evaluate_continuity(
        stable,
        {"motion": ["a", "b"]},
        grounded=False,
        geometry=geometry,
    )
    assert result["passed"] is True
    assert result["groups"]["motion"]["evaluated"] is True
    drift = {name: dict(facts) for name, facts in stable.items()}
    drift["b"] = dict(drift["b"], widthRatioToReference=1.12)
    result = contact_quality.evaluate_continuity(
        drift,
        {"motion": ["a", "b"]},
        grounded=False,
        geometry=geometry,
    )
    assert result["passed"] is False
    partial = contact_quality.evaluate_continuity(
        {"a": stable["a"]},
        {"motion": ["a", "b"]},
        grounded=False,
        geometry=geometry,
    )
    assert partial["passed"] is True
    assert partial["groups"]["motion"]["evaluated"] is False
    assert partial["groups"]["motion"]["status"] == "partial-selection"


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
    draw.rectangle((55, 108, 65, 118), fill=(20, 130, 140, 255))
    draw.rectangle((115, 108, 125, 118), fill=(180, 70, 35, 255))
    # Reproduce a generator-created technical-field hole enclosed by the
    # Shadow actor. Its non-uniform colours recur in the border field.
    for y in range(112, 136):
        for x in range(78, 103):
            drift = (x * 5 + y * 9) % 32
            pixels[x, y] = (226 + drift // 2, 15 + drift, 213 + drift // 3, 255)
    extracted = core.remove_magenta_key(source, preserve_magenta_subject=True)
    bbox = core.alpha_bbox(extracted)
    assert bbox == (48, 30, 133, 155), f"border key leaked into Shadow bbox: {bbox}"
    assert extracted.getpixel((90, 78)) == (211, 99, 239, 255)
    assert extracted.getpixel((90, 145)) == (104, 44, 146, 255)
    assert extracted.getpixel((60, 113)) == (20, 130, 140, 255)
    assert extracted.getpixel((120, 113)) == (180, 70, 35, 255)
    assert extracted.getpixel((90, 124))[3] == 0, "enclosed technical key was preserved"
    assert extracted.getpixel((0, 0))[3] == 0
    assert extracted.getpixel((179, 179))[3] == 0


def main() -> None:
    test_approved_identity_pin()
    test_core_key_and_profiles()
    test_blink()
    test_contact_profiles()
    test_contact_family_routes()
    test_contact_reference_geometry_contract()
    test_recovery_threshold_reference_bbox()
    test_resources_grounded_normalization()
    test_contact_continuity_contract()
    test_shadow_connected_matte_regression()
    print(json.dumps({"factorySmoke": "PASS", "publicWrites": False}, indent=2))


if __name__ == "__main__":
    main()
