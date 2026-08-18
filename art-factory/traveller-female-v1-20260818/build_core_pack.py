#!/usr/bin/env python3
"""Build isolated female Traveller approval batches on the canonical stage.

The script never generates art and never writes outside this factory. Every
requested keyed source is validated before any output is created. A blink is
derived deterministically from normalized idle using caller-supplied eye boxes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import statistics
from collections import deque
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
SOURCE_ROOT = ROOT / "sources" / "approval-batches"
OUTPUT_ROOT = ROOT / "outputs" / "approval-batches"
CANVAS = (640, 900)
FLOOR_Y = 860
DEFAULT_TARGET_HEIGHT = 796
DEFAULT_MAX_WIDTH = 590
CORE_FRAMES = ("idle", "walk-a", "walk-b", "window-back")
PROFILE_DEFAULTS = {
    "core": {"targetHeight": 796, "maxWidth": 590},
    "pose": {"targetHeight": 796, "maxWidth": 590},
    "room": {"targetHeight": 790, "maxWidth": 500},
}
FRAME_SPECS = {
    "idle": {"profile": "core", "targetHeight": 796, "maxWidth": 590},
    "walk-a": {"profile": "core", "targetHeight": 796, "maxWidth": 590},
    "walk-b": {"profile": "core", "targetHeight": 796, "maxWidth": 590},
    "window-back": {"profile": "core", "targetHeight": 800, "maxWidth": 590},
    "arms-up": {"profile": "pose", "targetHeight": 829, "maxWidth": 590},
    "seated": {"profile": "pose", "targetHeight": 693, "maxWidth": 590},
    "bench-rest": {"profile": "room", "targetHeight": 790, "maxWidth": 500},
    "bench-read-a": {"profile": "room", "targetHeight": 790, "maxWidth": 500},
    "bench-read-b": {"profile": "room", "targetHeight": 790, "maxWidth": 500},
}
SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")


def inside_factory(path: Path) -> Path:
    resolved = path.resolve()
    try:
        resolved.relative_to(ROOT.resolve())
    except ValueError as error:
        raise ValueError(f"path escapes female Traveller factory: {path}") from error
    return resolved


def safe_id(value: str, label: str) -> str:
    if not SAFE_ID.fullmatch(value):
        raise ValueError(f"invalid {label} {value!r}; use lowercase letters, digits and hyphens")
    return value


def parse_frames(value: str) -> tuple[str, ...]:
    frames = tuple(safe_id(item.strip(), "frame id") for item in value.split(",") if item.strip())
    if not frames:
        raise ValueError("at least one frame is required")
    if len(set(frames)) != len(frames):
        raise ValueError("frame ids must be unique")
    if "idle-blink" in frames:
        raise ValueError("idle-blink is derived locally and cannot be supplied as a generated source")
    return frames


def parse_eye_boxes(value: str | None, *, required: bool) -> tuple[tuple[int, int, int, int], ...]:
    if value is None:
        if required:
            raise ValueError("--eye-boxes is required when the batch contains idle")
        return ()
    try:
        payload = json.loads(value)
    except json.JSONDecodeError as error:
        raise ValueError("--eye-boxes must be JSON: [[left,top,right,bottom], ...]") from error
    if not isinstance(payload, list) or len(payload) != 2:
        raise ValueError("exactly two female eye boxes are required")
    boxes: list[tuple[int, int, int, int]] = []
    for raw in payload:
        if not isinstance(raw, list) or len(raw) != 4 or not all(isinstance(item, int) for item in raw):
            raise ValueError("every eye box must contain four integer coordinates")
        left, top, right, bottom = raw
        if not (1 <= left < right < CANVAS[0] - 1 and 1 <= top < bottom < CANVAS[1] - 1):
            raise ValueError(f"eye box is outside the canonical canvas: {raw}")
        if right - left < 5 or bottom - top < 5:
            raise ValueError(f"eye box is too small to calibrate safely: {raw}")
        boxes.append((left, top, right, bottom))
    first, second = boxes
    overlaps = not (
        first[2] <= second[0]
        or second[2] <= first[0]
        or first[3] <= second[1]
        or second[3] <= first[1]
    )
    if overlaps:
        raise ValueError("the two measured eye boxes must not overlap")
    return tuple(boxes)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    if edge1 <= edge0:
        return 1.0 if value >= edge1 else 0.0
    amount = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return amount * amount * (3.0 - 2.0 * amount)


def is_key_like(red: int, green: int, blue: int) -> bool:
    distance = math.sqrt((255 - red) ** 2 + green**2 + (255 - blue) ** 2)
    return distance <= 96 and min(red, blue) - green >= 48


def keyed_border_ratio(image: Image.Image, border: int = 6) -> float:
    source = image.convert("RGBA")
    pixels = source.load()
    sampled = 0
    keyed = 0
    for y in range(source.height):
        for x in range(source.width):
            if x < border or y < border or x >= source.width - border or y >= source.height - border:
                red, green, blue, alpha = pixels[x, y]
                if alpha == 0:
                    continue
                sampled += 1
                keyed += int(is_key_like(red, green, blue))
    return keyed / sampled if sampled else 0.0


def connected_preserve_key_zones(image: Image.Image) -> bytearray:
    """Find technical magenta connected to the canvas border.

    Semantic Shadow violet can be chromatically close to the key, so colour
    alone is not a safe matte. Only a conservative magenta field reachable
    from a canvas edge becomes hard background. Two surrounding rings are
    marked for local antialias cleanup; enclosed purple remains untouched.
    Zone values are 1=background, 2=first fringe, 3=second fringe.
    """
    width, height = image.size
    pixels = image.load()
    seen = bytearray(width * height)
    zones = bytearray(width * height)
    queue: deque[int] = deque()

    def candidate(index: int) -> bool:
        x = index % width
        y = index // width
        red, green, blue, alpha = pixels[x, y]
        lower_magenta = min(red, blue)
        dominance = lower_magenta - green
        return (
            alpha > 0
            and lower_magenta >= 170
            and dominance >= 62
            and green <= 122
            and abs(red - blue) <= 92
        )

    def seed(index: int) -> None:
        if seen[index]:
            return
        seen[index] = 1
        if candidate(index):
            zones[index] = 1
            queue.append(index)

    for x in range(width):
        seed(x)
        seed((height - 1) * width + x)
    for y in range(1, height - 1):
        seed(y * width)
        seed(y * width + width - 1)

    while queue:
        index = queue.popleft()
        x = index % width
        y = index // width
        neighbours = []
        if x:
            neighbours.append(index - 1)
        if x + 1 < width:
            neighbours.append(index + 1)
        if y:
            neighbours.append(index - width)
        if y + 1 < height:
            neighbours.append(index + width)
        for neighbour in neighbours:
            if seen[neighbour]:
                continue
            seen[neighbour] = 1
            if candidate(neighbour):
                zones[neighbour] = 1
                queue.append(neighbour)

    for ring in (2, 3):
        previous = ring - 1
        additions: list[int] = []
        for y in range(height):
            row = y * width
            for x in range(width):
                index = row + x
                if zones[index]:
                    continue
                adjacent = False
                for delta_y in (-1, 0, 1):
                    neighbour_y = y + delta_y
                    if not 0 <= neighbour_y < height:
                        continue
                    for delta_x in (-1, 0, 1):
                        neighbour_x = x + delta_x
                        if not 0 <= neighbour_x < width:
                            continue
                        neighbour = neighbour_y * width + neighbour_x
                        if zones[neighbour] == previous:
                            adjacent = True
                            break
                    if adjacent:
                        break
                if adjacent:
                    additions.append(index)
        for index in additions:
            zones[index] = ring
    return zones


def remove_magenta_key(
    source: Image.Image,
    *,
    preserve_magenta_subject: bool = False,
) -> Image.Image:
    """Extract a non-uniform magenta field without shifting teal or rust.

    Core Traveller art has no semantic magenta, so mixed fringe pixels receive
    a strict neutral despill. Purple contact actors opt into preservation: only
    bright technical-field colour is removed and interior purple stays intact.
    """
    image = source.convert("RGBA")
    output = Image.new("RGBA", image.size, (0, 0, 0, 0))
    src = image.load()
    dst = output.load()
    preserve_zones = connected_preserve_key_zones(image) if preserve_magenta_subject else None
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, source_alpha = src[x, y]
            if source_alpha == 0:
                continue
            if preserve_zones is not None:
                zone = preserve_zones[y * image.width + x]
                if zone == 1:
                    continue
                if zone == 0:
                    dst[x, y] = (red, green, blue, source_alpha)
                    continue
                dominance = min(red, blue) - green
                chroma = smoothstep(30, 105, dominance)
                brightness = smoothstep(125, 225, min(red, blue))
                ring_weight = 0.9 if zone == 2 else 0.42
                key_strength = chroma * brightness * ring_weight
                alpha = round(source_alpha * (1.0 - key_strength))
                if alpha <= 6:
                    continue
                correction = round(max(0, dominance) * key_strength * 0.64)
                dst[x, y] = (
                    max(0, red - correction),
                    green,
                    max(0, blue - correction),
                    alpha,
                )
                continue
            distance = math.sqrt((255 - red) ** 2 + green**2 + (255 - blue) ** 2)
            dominance = min(red, blue) - green
            field = (1.0 - smoothstep(26, 120, distance)) * smoothstep(18, 82, dominance)
            fringe = smoothstep(24, 88, dominance) * smoothstep(104, 210, min(red, blue))
            key_strength = max(field, fringe)
            alpha = round(source_alpha * (1.0 - key_strength))
            if min(red, blue) >= 172 and dominance >= 58:
                bright_field = smoothstep(172, 238, min(red, blue)) * smoothstep(48, 116, dominance)
                alpha = round(alpha * (1.0 - 0.92 * bright_field))
            if alpha <= 12:
                continue
            if dominance > 0:
                # Only colours with both R and B ahead of G are touched. The
                # canonical teal and rust families cannot enter this branch.
                excess = max(0, min(red, blue) - (green + 36))
                red = max(0, red - excess)
                blue = max(0, blue - excess)
            dst[x, y] = (red, green, blue, alpha)
    return output


def frame_normalization_spec(
    frame: str,
    *,
    profile: str,
    target_height: int | None,
    max_width: int | None,
) -> dict[str, int | str]:
    known = FRAME_SPECS.get(frame)
    if profile == "auto":
        if known is None:
            raise ValueError(f"frame {frame!r} has no scale profile; pass --profile explicitly")
        selected = dict(known)
    else:
        if known is not None and known["profile"] != profile:
            raise ValueError(
                f"frame {frame!r} belongs to {known['profile']!r}, "
                f"not requested profile {profile!r}"
            )
        selected = {"profile": profile, **PROFILE_DEFAULTS[profile]}
        if known is not None:
            selected.update(known)
    if target_height is not None:
        selected["targetHeight"] = target_height
    if max_width is not None:
        selected["maxWidth"] = max_width
    return selected


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").point(lambda value: 255 if value >= 8 else 0).getbbox()
    if not bbox:
        raise ValueError("source has no visible subject after magenta removal")
    return bbox


def clean_resampled_magenta_fringe(image: Image.Image) -> Image.Image:
    """Remove low-alpha chroma reintroduced by Lanczos interpolation."""
    cleaned = image.copy()
    pixels = cleaned.load()
    for y in range(cleaned.height):
        for x in range(cleaned.width):
            red, green, blue, alpha = pixels[x, y]
            dominance = min(red, blue) - green
            if alpha >= 128 or min(red, blue) < 90 or dominance < 40:
                continue
            if alpha <= 16 and min(red, blue) >= 130 and dominance >= 65:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            excess = max(0, min(red, blue) - (green + 36))
            pixels[x, y] = (
                max(0, red - excess),
                green,
                max(0, blue - excess),
                alpha,
            )
    return cleaned


def normalize(source: Image.Image, *, target_height: int, max_width: int) -> tuple[Image.Image, dict[str, object]]:
    extracted = remove_magenta_key(source)
    source_bbox = alpha_bbox(extracted)
    content = extracted.crop(source_bbox)
    scale = min(target_height / content.height, max_width / content.width)
    size = (max(1, round(content.width * scale)), max(1, round(content.height * scale)))
    content = content.resize(size, Image.Resampling.LANCZOS)
    content = clean_resampled_magenta_fringe(content)
    content = content.crop(alpha_bbox(content))
    if content.width > CANVAS[0] or content.height > FLOOR_Y:
        raise ValueError(f"normalized content exceeds stage: {content.size}")
    left = (CANVAS[0] - content.width) // 2
    top = FLOOR_Y - content.height
    stage = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    stage.alpha_composite(content, (left, top))
    bbox = alpha_bbox(stage)
    if bbox[3] != FLOOR_Y:
        raise RuntimeError(f"normalization failed floor contract: bbox={bbox}")
    return stage, {
        "sourceCanvas": list(source.size),
        "sourceBbox": list(source_bbox),
        "scale": round(scale, 7),
        "canvas": list(stage.size),
        "bbox": list(bbox),
        "floorY": bbox[3],
    }


def dark_eye_mask(image: Image.Image, boxes: Iterable[tuple[int, int, int, int]]) -> set[tuple[int, int]]:
    mask: set[tuple[int, int]] = set()
    for left, top, right, bottom in boxes:
        for y in range(top, bottom):
            for x in range(left, right):
                red, green, blue, alpha = image.getpixel((x, y))
                if alpha >= 200 and max(red, green, blue) < 125:
                    mask.add((x, y))
    if len(mask) < 4:
        raise ValueError("eye boxes did not capture enough dark eye pixels; measure them on normalized idle")
    original = set(mask)
    for _ in range(2):
        expanded = set(mask)
        for x, y in mask:
            for neighbour in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if any(
                    left <= neighbour[0] < right and top <= neighbour[1] < bottom
                    for left, top, right, bottom in boxes
                ):
                    expanded.add(neighbour)
        mask = expanded
    total_box_area = sum((right - left) * (bottom - top) for left, top, right, bottom in boxes)
    if len(original) > total_box_area * 0.72:
        raise ValueError("eye boxes capture too much dark material; exclude hair, goggles and brows")
    return mask


def inpaint_mask(image: Image.Image, mask: set[tuple[int, int]]) -> None:
    pixels = image.load()
    remaining = set(mask)
    while remaining:
        resolved: list[tuple[tuple[int, int], tuple[int, int, int, int]]] = []
        for x, y in remaining:
            samples = []
            for delta_y in (-1, 0, 1):
                for delta_x in (-1, 0, 1):
                    if delta_x == 0 and delta_y == 0:
                        continue
                    point = (x + delta_x, y + delta_y)
                    if point not in remaining:
                        colour = pixels[point[0], point[1]]
                        if colour[3] >= 200:
                            samples.append(colour)
            if samples:
                alpha = pixels[x, y][3]
                rgb = tuple(round(sum(colour[index] for colour in samples) / len(samples)) for index in range(3))
                resolved.append(((x, y), (*rgb, alpha)))
        if not resolved:
            raise RuntimeError("deterministic eye inpaint could not resolve its mask")
        for point, colour in resolved:
            pixels[point[0], point[1]] = colour
            remaining.remove(point)


def lid_points(box: tuple[int, int, int, int]) -> list[tuple[int, int]]:
    left, top, right, bottom = box
    inset = max(2, round((right - left) * 0.12))
    start = left + inset
    end = right - inset - 1
    baseline = round(top + (bottom - top) * 0.55)
    depth = max(2, round((bottom - top) * 0.12))
    points = []
    for step in range(25):
        amount = step / 24
        x = round(start + (end - start) * amount)
        y = round(baseline + depth * 4 * amount * (1 - amount))
        points.append((x, y))
    return points


def build_blink(
    idle: Image.Image,
    boxes: tuple[tuple[int, int, int, int], ...],
) -> tuple[Image.Image, dict[str, object]]:
    blink = idle.copy()
    mask = dark_eye_mask(blink, boxes)
    colours = [idle.getpixel(point) for point in mask]
    lid_colour = tuple(round(statistics.median(colour[index] for colour in colours)) for index in range(3)) + (255,)
    inpaint_mask(blink, mask)
    draw = ImageDraw.Draw(blink)
    for box in boxes:
        width = max(2, round((box[3] - box[1]) * 0.13))
        draw.line(lid_points(box), fill=lid_colour, width=width, joint="curve")
    blink.putalpha(idle.getchannel("A"))
    changed = [
        index
        for index, (before, after) in enumerate(
            zip(idle.get_flattened_data(), blink.get_flattened_data())
        )
        if before != after
    ]
    outside = 0
    for index in changed:
        x = index % CANVAS[0]
        y = index // CANVAS[0]
        if not any(left <= x < right and top <= y < bottom for left, top, right, bottom in boxes):
            outside += 1
    alpha_identical = idle.getchannel("A").tobytes() == blink.getchannel("A").tobytes()
    if not alpha_identical or outside:
        raise RuntimeError("blink changed alpha or pixels outside the calibrated eye boxes")
    return blink, {
        "eyeBoxes": [list(box) for box in boxes],
        "maskedPixels": len(mask),
        "changedPixels": len(changed),
        "changedRatio": round(len(changed) / (CANVAS[0] * CANVAS[1]), 8),
        "changedOutsideEyeBoxes": outside,
        "alphaIdenticalToIdle": alpha_identical,
    }


def frame_facts(image: Image.Image) -> dict[str, object]:
    bbox = alpha_bbox(image)
    corner_points = (
        (0, 0),
        (CANVAS[0] - 1, 0),
        (0, CANVAS[1] - 1),
        (CANVAS[0] - 1, CANVAS[1] - 1),
    )
    corners = [image.getpixel(point)[3] for point in corner_points]
    return {
        "canvas": list(image.size),
        "mode": image.mode,
        "bbox": list(bbox),
        "floorY": bbox[3],
        "transparentCorners": sum(value == 0 for value in corners),
    }


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--batch", required=True, help="safe approval batch id, for example female-core-01")
    result.add_argument("--frames", default=",".join(CORE_FRAMES), help="comma-separated keyed source frame ids")
    result.add_argument("--eye-boxes", help="two measured canonical eye boxes as JSON; required with idle")
    result.add_argument("--profile", choices=("auto", *PROFILE_DEFAULTS), default="auto")
    result.add_argument("--target-height", type=int, help="explicit batch override; normally use frame profiles")
    result.add_argument("--max-width", type=int, help="explicit batch override; normally use frame profiles")
    result.add_argument("--overwrite", action="store_true", help="replace only this factory batch's generated files")
    return result


def main() -> None:
    args = parser().parse_args()
    batch = safe_id(args.batch, "batch id")
    frames = parse_frames(args.frames)
    boxes = parse_eye_boxes(args.eye_boxes, required="idle" in frames)
    if args.target_height is not None and not (64 <= args.target_height <= FLOOR_Y):
        raise SystemExit(f"--target-height must be between 64 and {FLOOR_Y}")
    if args.max_width is not None and not (64 <= args.max_width <= CANVAS[0]):
        raise SystemExit(f"--max-width must be between 64 and {CANVAS[0]}")
    try:
        specs = {
            frame: frame_normalization_spec(
                frame,
                profile=args.profile,
                target_height=args.target_height,
                max_width=args.max_width,
            )
            for frame in frames
        }
    except ValueError as error:
        raise SystemExit(str(error)) from error

    source_dir = inside_factory(SOURCE_ROOT / batch)
    output_dir = inside_factory(OUTPUT_ROOT / batch)
    sources = {frame: inside_factory(source_dir / f"{frame}-keyed.png") for frame in frames}
    missing = [str(path.relative_to(ROOT)) for path in sources.values() if not path.is_file()]
    if missing:
        raise SystemExit("missing keyed inputs; nothing was written:\n- " + "\n- ".join(missing))

    opened: dict[str, Image.Image] = {}
    source_facts: dict[str, dict[str, object]] = {}
    for frame, path in sources.items():
        try:
            image = Image.open(path).convert("RGBA")
            image.load()
        except Exception as error:
            raise SystemExit(f"cannot read keyed input {path.relative_to(ROOT)}: {error}") from error
        ratio = keyed_border_ratio(image)
        if ratio < 0.25:
            raise SystemExit(
                f"{path.relative_to(ROOT)} does not have a measurable #FF00FF border "
                f"({ratio:.1%} key-like); nothing was written"
            )
        opened[frame] = image
        source_facts[frame] = {
            "file": str(path.relative_to(ROOT)),
            "sha256": sha256(path),
            "keyedBorderRatio": round(ratio, 6),
        }

    expected = [output_dir / f"{frame}.png" for frame in frames]
    if "idle" in frames:
        expected.append(output_dir / "idle-blink.png")
    expected.append(output_dir / "manifest.json")
    existing = [str(path.relative_to(ROOT)) for path in expected if path.exists()]
    if existing and not args.overwrite:
        raise SystemExit("batch outputs already exist; use --overwrite explicitly:\n- " + "\n- ".join(existing))

    normalized: dict[str, Image.Image] = {}
    frame_reports: dict[str, dict[str, object]] = {}
    for frame, image in opened.items():
        spec = specs[frame]
        stage, normalization = normalize(
            image,
            target_height=int(spec["targetHeight"]),
            max_width=int(spec["maxWidth"]),
        )
        normalized[frame] = stage
        frame_reports[frame] = {
            **source_facts[frame],
            "profile": spec["profile"],
            "targetHeight": spec["targetHeight"],
            "maxWidth": spec["maxWidth"],
            **normalization,
            **frame_facts(stage),
        }

    blink_report: dict[str, object] | None = None
    if "idle" in normalized:
        blink, blink_report = build_blink(normalized["idle"], boxes)
        normalized["idle-blink"] = blink
        frame_reports["idle-blink"] = {"derivedFrom": "idle.png", **frame_facts(blink), **blink_report}

    output_dir.mkdir(parents=True, exist_ok=True)
    for frame, image in normalized.items():
        image.save(output_dir / f"{frame}.png", optimize=True)

    manifest = {
        "schema": "satoru.traveller-female-approval-batch/1",
        "id": batch,
        "morphology": "female",
        "status": "awaiting-manual-art-approval",
        "runtimeEligible": False,
        "publicArtWrites": False,
        "canvas": list(CANVAS),
        "floorY": FLOOR_Y,
        "normalization": {
            "key": "#FF00FF",
            "strategy": "per-frame-profile",
            "requestedProfile": args.profile,
            "profiles": specs,
        },
        "eyeBoxes": [list(box) for box in boxes],
        "blink": {
            "method": "deterministic-local-inpaint-and-lid-curves",
            "maxChangedRatio": 0.006,
            **(blink_report or {}),
        },
        "assets": {frame: f"{frame}.png" for frame in normalized},
        "frames": frame_reports,
        "qa": {
            "required": True,
            "command": f"python3 art-factory/traveller-female-v1-20260818/factory_qa.py --batch {batch}",
        },
    }
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    summary = {
        "batch": batch,
        "outputs": str(output_dir.relative_to(ROOT)),
        "frames": list(normalized),
        "runtimeEligible": False,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
