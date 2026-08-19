#!/usr/bin/env python3
"""Build factory-local female Traveller atomic contact approval batches."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image

from build_core_pack import (
    ROOT,
    clean_resampled_magenta_fringe,
    inside_factory,
    is_key_like,
    keyed_border_ratio,
    load_approved_identity,
    remove_magenta_key,
    safe_id,
    sha256,
)


REPO_ROOT = ROOT.parents[1]
PUBLIC_ART_ROOT = (REPO_ROOT / "public" / "art").resolve()
CONFIG_PATH = ROOT / "contact-families.json"
SOURCE_ROOT = ROOT / "sources" / "approval-batches"
OUTPUT_ROOT = ROOT / "outputs" / "contact-approval-batches"


def load_families() -> dict[str, dict[str, object]]:
    payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    if payload.get("schema") not in {
        "satoru.traveller-female-contact-families/1",
        "satoru.traveller-female-contact-families/2",
    }:
        raise ValueError("unsupported contact family manifest")
    families = payload.get("families")
    if not isinstance(families, dict) or not families:
        raise ValueError("contact family manifest has no families")
    for family, config in families.items():
        safe_id(str(family), "contact family id")
        if not isinstance(config, dict):
            raise ValueError(f"contact family {family} must be an object")
        raw_frames = config.get("frames")
        if not isinstance(raw_frames, list) or not raw_frames:
            raise ValueError(f"contact family {family} has no frames")
        frames = tuple(safe_id(str(frame), "frame id") for frame in raw_frames)
        if len(set(frames)) != len(frames):
            raise ValueError(f"contact family {family} has duplicate frames")
        routes = config.get("routes")
        if routes is not None and (
            not isinstance(routes, dict) or set(routes) != set(frames)
        ):
            raise ValueError(f"contact family {family} route set is incomplete")
        groups = config.get("continuityGroups", {})
        if not isinstance(groups, dict) or any(
            not isinstance(members, list)
            or not members
            or any(str(frame) not in frames for frame in members)
            for members in groups.values()
        ):
            raise ValueError(f"contact family {family} has invalid continuity groups")
    return families


def alpha_bbox_at(image: Image.Image, threshold: int = 8) -> tuple[int, int, int, int]:
    """Return the visible bbox at the family's reviewed alpha threshold."""
    if not 1 <= threshold <= 255:
        raise ValueError(f"bbox alpha threshold must be 1..255, got {threshold}")
    bbox = image.getchannel("A").point(
        lambda value: 255 if value >= threshold else 0
    ).getbbox()
    if not bbox:
        raise ValueError(
            f"source has no visible subject at alpha threshold {threshold}"
        )
    return bbox


def repo_read_path(relative: str) -> Path:
    path = (REPO_ROOT / relative).resolve()
    try:
        path.relative_to(REPO_ROOT.resolve())
    except ValueError as error:
        raise ValueError(f"contact reference escapes repository: {relative}") from error
    return path


def repo_runtime_path(relative: str) -> Path:
    path = repo_read_path(relative)
    try:
        path.relative_to(PUBLIC_ART_ROOT)
    except ValueError as error:
        raise ValueError(f"contact runtime route escapes public/art: {relative}") from error
    return path


def frame_route(config: dict[str, object], frame: str) -> dict[str, object]:
    """Resolve schema-v2 explicit routes with a schema-v1 compatibility path."""
    routes = config.get("routes")
    if routes is not None:
        if not isinstance(routes, dict) or frame not in routes:
            raise ValueError(f"missing contact route for frame {frame}")
        raw = routes[frame]
        if not isinstance(raw, dict):
            raise ValueError(f"contact route for {frame} must be an object")
        route = dict(raw)
    else:
        route = {
            "source": f"{frame}-keyed.png",
            "reference": f"{config['referenceRoot']}/{frame}.png",
            "runtime": str(config["runtimeTemplate"]).format(frame=frame),
        }
    for field in ("source", "reference", "runtime"):
        value = route.get(field)
        if not isinstance(value, str) or not value or Path(value).is_absolute():
            raise ValueError(f"invalid {field} route for contact frame {frame}")
        if Path(value).suffix.lower() != ".png":
            raise ValueError(f"contact {field} route must be a PNG: {value}")
    threshold = int(route.get("bboxAlphaThreshold", config.get("bboxAlphaThreshold", 8)))
    if not 1 <= threshold <= 255:
        raise ValueError(f"invalid bbox alpha threshold for {frame}: {threshold}")
    route["bboxAlphaThreshold"] = threshold
    return route


def source_path(source_dir: Path, relative: str) -> Path:
    path = inside_factory(source_dir / relative)
    try:
        path.relative_to(source_dir.resolve())
    except ValueError as error:
        raise ValueError(f"contact source escapes approval batch: {relative}") from error
    return path


def reference_path(config: dict[str, object], frame: str) -> Path:
    return repo_read_path(str(frame_route(config, frame)["reference"]))


def extract_contact(
    source: Image.Image,
    *,
    preserve_magenta_subject: bool,
    bbox_alpha_threshold: int = 8,
) -> tuple[Image.Image, tuple[int, int, int, int]]:
    extracted = remove_magenta_key(
        source,
        preserve_magenta_subject=preserve_magenta_subject,
    )
    bbox = alpha_bbox_at(extracted, bbox_alpha_threshold)
    return extracted.crop(bbox), bbox


def clean_preserved_resampling(image: Image.Image) -> Image.Image:
    """Remove only bright technical-key interpolation around purple actors."""
    cleaned = image.copy()
    pixels = cleaned.load()
    for y in range(cleaned.height):
        for x in range(cleaned.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha >= 128 or not is_key_like(red, green, blue):
                continue
            if alpha <= 16:
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


def resize_clean(
    content: Image.Image,
    size: tuple[int, int],
    *,
    preserve_magenta_subject: bool,
    bbox_alpha_threshold: int = 8,
) -> Image.Image:
    resized = content.resize(size, Image.Resampling.LANCZOS)
    resized = (
        clean_preserved_resampling(resized)
        if preserve_magenta_subject
        else clean_resampled_magenta_fringe(resized)
    )
    return resized.crop(alpha_bbox_at(resized, bbox_alpha_threshold))


def fit_scale(content: Image.Image, max_size: tuple[int, int]) -> float:
    return min(max_size[0] / content.width, max_size[1] / content.height)


def normalize_contact(
    source: Image.Image,
    reference: Image.Image,
    config: dict[str, object],
    *,
    bbox_alpha_threshold: int | None = None,
) -> tuple[Image.Image, dict[str, object]]:
    canvas = tuple(int(value) for value in config["canvas"])
    if len(canvas) != 2:
        raise ValueError("contact canvas must have two dimensions")
    if reference.size != canvas:
        raise ValueError(f"reference must be {canvas}, got {reference.size}")
    threshold = int(
        config.get("bboxAlphaThreshold", 8)
        if bbox_alpha_threshold is None
        else bbox_alpha_threshold
    )
    reference_bbox = alpha_bbox_at(reference.convert("RGBA"), threshold)
    preserve = bool(config.get("preserveMagentaSubject"))
    content, source_bbox = extract_contact(
        source,
        preserve_magenta_subject=preserve,
        bbox_alpha_threshold=threshold,
    )
    pad = int(config.get("contentPad", 16))
    strategy = str(config["normalization"])

    if strategy == "reference-x-grounded":
        ground_y = int(config["groundY"])
        reference_size = (
            reference_bbox[2] - reference_bbox[0],
            reference_bbox[3] - reference_bbox[1],
        )
        max_size = (
            min(reference_size[0], canvas[0] - pad * 2),
            min(reference_size[1], ground_y - pad),
        )
        scale = fit_scale(content, max_size)
        target = (
            max(1, round(content.width * scale)),
            max(1, round(content.height * scale)),
        )
        content = resize_clean(
            content,
            target,
            preserve_magenta_subject=preserve,
            bbox_alpha_threshold=threshold,
        )
        reference_center_x = (reference_bbox[0] + reference_bbox[2]) / 2
        left = round(reference_center_x - content.width / 2)
        left = max(0, min(canvas[0] - content.width, left))
        top = ground_y - content.height
    elif strategy == "reference-bbox-fit":
        reference_size = (
            reference_bbox[2] - reference_bbox[0],
            reference_bbox[3] - reference_bbox[1],
        )
        scale = fit_scale(content, reference_size)
        target = (
            max(1, round(content.width * scale)),
            max(1, round(content.height * scale)),
        )
        content = resize_clean(
            content,
            target,
            preserve_magenta_subject=preserve,
            bbox_alpha_threshold=threshold,
        )
        reference_center = (
            (reference_bbox[0] + reference_bbox[2]) / 2,
            (reference_bbox[1] + reference_bbox[3]) / 2,
        )
        left = round(reference_center[0] - content.width / 2)
        top = round(reference_center[1] - content.height / 2)
        left = max(0, min(canvas[0] - content.width, left))
        top = max(0, min(canvas[1] - content.height, top))
    else:
        raise ValueError(f"unsupported contact normalization strategy: {strategy}")

    stage = Image.new("RGBA", canvas, (0, 0, 0, 0))
    stage.alpha_composite(content, (left, top))
    final_bbox = alpha_bbox_at(stage, threshold)
    if config.get("groundY") is not None and final_bbox[3] != int(config["groundY"]):
        raise RuntimeError(f"contact frame missed ground line: {final_bbox}")
    return stage, {
        "sourceCanvas": list(source.size),
        "sourceBbox": list(source_bbox),
        "referenceBbox": list(reference_bbox),
        "canvas": list(stage.size),
        "bbox": list(final_bbox),
        "bboxAlphaThreshold": threshold,
        "scale": round(scale, 7),
        "normalization": strategy,
    }


def parser() -> argparse.ArgumentParser:
    families = tuple(load_families())
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--family", required=True, choices=families)
    result.add_argument("--batch", required=True, help="safe contact approval batch id")
    result.add_argument(
        "--frames",
        help="comma-separated manifest frame subset; default builds the complete family",
    )
    result.add_argument("--overwrite", action="store_true")
    return result


def selected_frames(
    requested: str | None,
    manifest_frames: tuple[str, ...],
) -> tuple[str, ...]:
    if requested is None:
        return manifest_frames
    frames = tuple(
        safe_id(item.strip(), "frame id")
        for item in requested.split(",")
        if item.strip()
    )
    if not frames:
        raise ValueError("--frames must select at least one manifest frame")
    if len(set(frames)) != len(frames):
        raise ValueError("--frames must not contain duplicates")
    unknown = [frame for frame in frames if frame not in manifest_frames]
    if unknown:
        raise ValueError(
            "contact frame is not declared for this family: " + ", ".join(unknown)
        )
    return frames


def main() -> None:
    args = parser().parse_args()
    batch = safe_id(args.batch, "batch id")
    try:
        approved_identity = load_approved_identity()
    except ValueError as error:
        raise SystemExit(f"approved identity preflight failed; nothing was written: {error}") from error
    families = load_families()
    config = families[args.family]
    if config.get("key") != "#FF00FF":
        raise SystemExit("this factory accepts only reviewed magenta contact inputs")
    manifest_frames = tuple(str(frame) for frame in config["frames"])
    try:
        frames = selected_frames(args.frames, manifest_frames)
    except ValueError as error:
        raise SystemExit(str(error)) from error
    source_dir = inside_factory(SOURCE_ROOT / batch)
    output_dir = inside_factory(OUTPUT_ROOT / batch)
    try:
        routes = {frame: frame_route(config, frame) for frame in frames}
        sources = {
            frame: source_path(source_dir, str(routes[frame]["source"]))
            for frame in frames
        }
        references = {
            frame: repo_read_path(str(routes[frame]["reference"]))
            for frame in frames
        }
        runtime_routes = {
            frame: str(
                repo_runtime_path(str(routes[frame]["runtime"])).relative_to(REPO_ROOT)
            )
            for frame in frames
        }
    except ValueError as error:
        raise SystemExit(f"invalid contact route; nothing was written: {error}") from error
    missing_sources = [str(path.relative_to(ROOT)) for path in sources.values() if not path.is_file()]
    missing_references = [str(path.relative_to(REPO_ROOT)) for path in references.values() if not path.is_file()]
    if missing_sources or missing_references:
        lines = ["contact preflight failed; nothing was written"]
        lines.extend(f"missing source: {item}" for item in missing_sources)
        lines.extend(f"missing reference: {item}" for item in missing_references)
        raise SystemExit("\n".join(lines))

    opened: dict[str, Image.Image] = {}
    reference_images: dict[str, Image.Image] = {}
    source_facts: dict[str, dict[str, object]] = {}
    for frame in frames:
        source = Image.open(sources[frame]).convert("RGBA")
        source.load()
        ratio = keyed_border_ratio(source)
        if ratio < 0.25:
            raise SystemExit(
                f"{sources[frame].relative_to(ROOT)} has only {ratio:.1%} "
                "magenta-like border; nothing was written"
            )
        reference = Image.open(references[frame]).convert("RGBA")
        reference.load()
        opened[frame] = source
        reference_images[frame] = reference
        source_facts[frame] = {
            "source": str(sources[frame].relative_to(ROOT)),
            "sourceRoute": str(routes[frame]["source"]),
            "sourceSha256": sha256(sources[frame]),
            "keyedBorderRatio": round(ratio, 6),
            "reference": str(references[frame].relative_to(REPO_ROOT)),
            "referenceSha256": sha256(references[frame]),
            "runtime": runtime_routes[frame],
            "bboxAlphaThreshold": int(routes[frame]["bboxAlphaThreshold"]),
        }

    expected = [output_dir / f"{frame}.png" for frame in frames]
    expected.append(output_dir / "manifest.json")
    existing = [str(path.relative_to(ROOT)) for path in expected if path.exists()]
    if existing and not args.overwrite:
        raise SystemExit("contact outputs already exist; use --overwrite explicitly:\n- " + "\n- ".join(existing))

    normalized: dict[str, Image.Image] = {}
    reports: dict[str, dict[str, object]] = {}
    for frame in frames:
        stage, facts = normalize_contact(
            opened[frame],
            reference_images[frame],
            config,
            bbox_alpha_threshold=int(routes[frame]["bboxAlphaThreshold"]),
        )
        normalized[frame] = stage
        reports[frame] = {**source_facts[frame], **facts}

    output_dir.mkdir(parents=True, exist_ok=True)
    for frame, image in normalized.items():
        image.save(output_dir / f"{frame}.png", optimize=True)
    manifest = {
        "schema": "satoru.traveller-female-contact-approval-batch/1",
        "id": batch,
        "family": args.family,
        "morphology": "female",
        "status": "awaiting-manual-contact-approval",
        "runtimeEligible": False,
        "publicArtWrites": False,
        "approvedIdentity": approved_identity,
        "canvas": config["canvas"],
        "groundY": config.get("groundY"),
        "key": config["key"],
        "preserveMagentaSubject": bool(config.get("preserveMagentaSubject")),
        "normalization": config["normalization"],
        "familyFrames": list(manifest_frames),
        "requiredFrames": list(frames),
        "runtimeTemplate": config.get("runtimeTemplate"),
        "runtimeRoutes": runtime_routes,
        "geometry": config.get("geometry", {}),
        "continuityGroups": config.get("continuityGroups", {}),
        "assets": {frame: f"{frame}.png" for frame in frames},
        "frames": reports,
        "qa": {
            "required": True,
            "command": (
                "python3 art-factory/traveller-female-v1-20260818/contact_qa.py "
                f"--batch {batch}"
            ),
        },
    }
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    summary = {
        "batch": batch,
        "family": args.family,
        "frames": len(frames),
        "runtimeEligible": False,
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
