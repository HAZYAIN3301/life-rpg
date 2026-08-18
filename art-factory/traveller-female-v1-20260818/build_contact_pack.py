#!/usr/bin/env python3
"""Build factory-local female Traveller atomic contact approval batches."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image

from build_core_pack import (
    ROOT,
    alpha_bbox,
    clean_resampled_magenta_fringe,
    inside_factory,
    is_key_like,
    keyed_border_ratio,
    remove_magenta_key,
    safe_id,
    sha256,
)


REPO_ROOT = ROOT.parents[1]
CONFIG_PATH = ROOT / "contact-families.json"
SOURCE_ROOT = ROOT / "sources" / "approval-batches"
OUTPUT_ROOT = ROOT / "outputs" / "contact-approval-batches"


def load_families() -> dict[str, dict[str, object]]:
    payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    if payload.get("schema") != "satoru.traveller-female-contact-families/1":
        raise ValueError("unsupported contact family manifest")
    families = payload.get("families")
    if not isinstance(families, dict) or not families:
        raise ValueError("contact family manifest has no families")
    return families


def repo_read_path(relative: str) -> Path:
    path = (REPO_ROOT / relative).resolve()
    try:
        path.relative_to(REPO_ROOT.resolve())
    except ValueError as error:
        raise ValueError(f"contact reference escapes repository: {relative}") from error
    return path


def reference_path(config: dict[str, object], frame: str) -> Path:
    root = repo_read_path(str(config["referenceRoot"]))
    return root / f"{frame}.png"


def extract_contact(
    source: Image.Image,
    *,
    preserve_magenta_subject: bool,
) -> tuple[Image.Image, tuple[int, int, int, int]]:
    extracted = remove_magenta_key(
        source,
        preserve_magenta_subject=preserve_magenta_subject,
    )
    bbox = alpha_bbox(extracted)
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
) -> Image.Image:
    resized = content.resize(size, Image.Resampling.LANCZOS)
    resized = (
        clean_preserved_resampling(resized)
        if preserve_magenta_subject
        else clean_resampled_magenta_fringe(resized)
    )
    return resized.crop(alpha_bbox(resized))


def fit_scale(content: Image.Image, max_size: tuple[int, int]) -> float:
    return min(max_size[0] / content.width, max_size[1] / content.height)


def normalize_contact(
    source: Image.Image,
    reference: Image.Image,
    config: dict[str, object],
) -> tuple[Image.Image, dict[str, object]]:
    canvas = tuple(int(value) for value in config["canvas"])
    if len(canvas) != 2:
        raise ValueError("contact canvas must have two dimensions")
    if reference.size != canvas:
        raise ValueError(f"reference must be {canvas}, got {reference.size}")
    reference_bbox = alpha_bbox(reference.convert("RGBA"))
    preserve = bool(config.get("preserveMagentaSubject"))
    content, source_bbox = extract_contact(source, preserve_magenta_subject=preserve)
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
    final_bbox = alpha_bbox(stage)
    if config.get("groundY") is not None and final_bbox[3] != int(config["groundY"]):
        raise RuntimeError(f"contact frame missed ground line: {final_bbox}")
    return stage, {
        "sourceCanvas": list(source.size),
        "sourceBbox": list(source_bbox),
        "referenceBbox": list(reference_bbox),
        "canvas": list(stage.size),
        "bbox": list(final_bbox),
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
    sources = {frame: inside_factory(source_dir / f"{frame}-keyed.png") for frame in frames}
    references = {frame: reference_path(config, frame) for frame in frames}
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
            "sourceSha256": sha256(sources[frame]),
            "keyedBorderRatio": round(ratio, 6),
            "reference": str(references[frame].relative_to(REPO_ROOT)),
            "referenceSha256": sha256(references[frame]),
        }

    expected = [output_dir / f"{frame}.png" for frame in frames]
    expected.append(output_dir / "manifest.json")
    existing = [str(path.relative_to(ROOT)) for path in expected if path.exists()]
    if existing and not args.overwrite:
        raise SystemExit("contact outputs already exist; use --overwrite explicitly:\n- " + "\n- ".join(existing))

    normalized: dict[str, Image.Image] = {}
    reports: dict[str, dict[str, object]] = {}
    for frame in frames:
        stage, facts = normalize_contact(opened[frame], reference_images[frame], config)
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
        "canvas": config["canvas"],
        "groundY": config.get("groundY"),
        "key": config["key"],
        "preserveMagentaSubject": bool(config.get("preserveMagentaSubject")),
        "normalization": config["normalization"],
        "familyFrames": list(manifest_frames),
        "requiredFrames": list(frames),
        "runtimeTemplate": config["runtimeTemplate"],
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
