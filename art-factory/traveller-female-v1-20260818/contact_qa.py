#!/usr/bin/env python3
"""QA factory-local female Traveller atomic contact approval batches."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from build_contact_pack import (
    OUTPUT_ROOT,
    REPO_ROOT,
    alpha_bbox_at,
    inside_factory,
    repo_read_path,
    repo_runtime_path,
)
from build_core_pack import ROOT, is_key_like, safe_id


PREVIEW_ROOT = ROOT / "previews" / "contact-approval-batches"
QA_ROOT = ROOT / "qa" / "contact-approval-batches"

DEFAULT_GEOMETRY = {
    "minWidthRatio": 0.90,
    "maxWidthRatio": 1.10,
    "minHeightRatio": 0.90,
    "maxHeightRatio": 1.10,
    "maxCenterDeltaPx": 4.0,
    "maxCenterXDeltaPx": 4.0,
    "maxContinuityRatioSpread": 0.08,
    "maxContinuityCenterSpreadPx": 4.0,
}


def geometry_contract(raw: object) -> dict[str, float]:
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise ValueError("contact geometry contract must be an object")
    result = {
        key: float(raw.get(key, default))
        for key, default in DEFAULT_GEOMETRY.items()
    }
    if not 0 < result["minWidthRatio"] <= result["maxWidthRatio"]:
        raise ValueError("invalid contact width-ratio geometry contract")
    if not 0 < result["minHeightRatio"] <= result["maxHeightRatio"]:
        raise ValueError("invalid contact height-ratio geometry contract")
    if any(
        result[key] < 0
        for key in (
            "maxCenterDeltaPx",
            "maxCenterXDeltaPx",
            "maxContinuityRatioSpread",
            "maxContinuityCenterSpreadPx",
        )
    ):
        raise ValueError("contact geometry tolerances must be non-negative")
    return result


def inspect_frame(
    path: Path,
    reference_path: Path,
    *,
    canvas: tuple[int, int],
    ground_y: int | None,
    preserve_magenta_subject: bool,
    normalization: str,
    bbox_alpha_threshold: int,
    geometry: dict[str, float],
) -> dict[str, object]:
    source = Image.open(path)
    source.load()
    mode = source.mode
    image = source.convert("RGBA")
    reference = Image.open(reference_path).convert("RGBA")
    bbox = alpha_bbox_at(image, bbox_alpha_threshold)
    reference_bbox = alpha_bbox_at(reference, bbox_alpha_threshold)
    alpha = image.getchannel("A")
    histogram = alpha.histogram()
    visible = sum(histogram[8:])
    edge_alpha = 0
    technical_key = 0
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, value = pixels[x, y]
            if value < 8:
                continue
            if x < 2 or y < 2 or x >= image.width - 2 or y >= image.height - 2:
                edge_alpha += 1
            contaminated = (
                is_key_like(red, green, blue)
                if preserve_magenta_subject
                else min(red, blue) >= 135 and min(red, blue) - green >= 70
            )
            if contaminated:
                technical_key += 1
    key_ratio = technical_key / visible if visible else 1.0
    center = ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)
    reference_center = (
        (reference_bbox[0] + reference_bbox[2]) / 2,
        (reference_bbox[1] + reference_bbox[3]) / 2,
    )
    center_delta = math.dist(center, reference_center)
    center_x_delta = abs(center[0] - reference_center[0])
    center_offset = (
        center[0] - reference_center[0],
        center[1] - reference_center[1],
    )
    width_ratio = (bbox[2] - bbox[0]) / (reference_bbox[2] - reference_bbox[0])
    height_ratio = (bbox[3] - bbox[1]) / (reference_bbox[3] - reference_bbox[1])
    checks = {
        "rgba": mode == "RGBA",
        "canvas": image.size == canvas,
        "visibleSubject": visible >= 20_000,
        "realTransparency": histogram[0] >= canvas[0] * canvas[1] * 0.05,
        "transparentCorners": image.size == canvas
        and all(
            image.getpixel(point)[3] == 0
            for point in (
                (0, 0),
                (canvas[0] - 1, 0),
                (0, canvas[1] - 1),
                (canvas[0] - 1, canvas[1] - 1),
            )
        ),
        "clearCanvasEdge": edge_alpha == 0,
        "technicalKeyResidual": key_ratio <= 0.0005,
        "referenceWidthScale": geometry["minWidthRatio"]
        <= width_ratio
        <= geometry["maxWidthRatio"],
        "referenceHeightScale": geometry["minHeightRatio"]
        <= height_ratio
        <= geometry["maxHeightRatio"],
    }
    if ground_y is not None:
        checks["groundY"] = bbox[3] == ground_y
        checks["referenceCenterX"] = (
            center_x_delta <= geometry["maxCenterXDeltaPx"]
        )
    elif normalization == "reference-bbox-fit":
        checks["referenceCenter"] = center_delta <= geometry["maxCenterDeltaPx"]
    return {
        "file": str(path.relative_to(ROOT)),
        "reference": str(reference_path.relative_to(REPO_ROOT)),
        "mode": mode,
        "canvas": list(image.size),
        "bbox": list(bbox),
        "referenceBbox": list(reference_bbox),
        "bboxAlphaThreshold": bbox_alpha_threshold,
        "centerDeltaPx": round(center_delta, 4),
        "centerXDeltaPx": round(center_x_delta, 4),
        "centerOffsetPx": [round(value, 4) for value in center_offset],
        "widthRatioToReference": round(width_ratio, 6),
        "heightRatioToReference": round(height_ratio, 6),
        "visiblePixels": visible,
        "transparentPixels": histogram[0],
        "partialAlphaPixels": sum(histogram[1:255]),
        "edgeAlphaPixels": edge_alpha,
        "technicalKeyPixels": technical_key,
        "technicalKeyRatio": round(key_ratio, 8),
        "semanticMagentaPreserved": preserve_magenta_subject,
        "checks": checks,
        "passed": all(checks.values()),
    }


def evaluate_continuity(
    frames: dict[str, dict[str, object]],
    groups: object,
    *,
    grounded: bool,
    geometry: dict[str, float],
) -> dict[str, object]:
    """Evaluate only complete choreography groups so narrow batches stay valid."""
    if groups is None:
        groups = {}
    if not isinstance(groups, dict):
        raise ValueError("contact continuity groups must be an object")
    results: dict[str, dict[str, object]] = {}
    for name, raw_members in groups.items():
        if not isinstance(name, str) or not isinstance(raw_members, list) or not raw_members:
            raise ValueError("invalid contact continuity group")
        members = [str(member) for member in raw_members]
        missing = [member for member in members if member not in frames]
        if missing:
            results[name] = {
                "frames": members,
                "evaluated": False,
                "status": "partial-selection",
                "missingFrames": missing,
                "checks": {},
                "passed": True,
            }
            continue
        width_ratios = [float(frames[member]["widthRatioToReference"]) for member in members]
        height_ratios = [float(frames[member]["heightRatioToReference"]) for member in members]
        offsets = [frames[member]["centerOffsetPx"] for member in members]
        width_spread = max(width_ratios) - min(width_ratios)
        height_spread = max(height_ratios) - min(height_ratios)
        center_x_spread = max(float(item[0]) for item in offsets) - min(
            float(item[0]) for item in offsets
        )
        center_y_spread = max(float(item[1]) for item in offsets) - min(
            float(item[1]) for item in offsets
        )
        center_spread = center_x_spread if grounded else max(center_x_spread, center_y_spread)
        checks = {
            "widthRatioContinuity": width_spread
            <= geometry["maxContinuityRatioSpread"],
            "heightRatioContinuity": height_spread
            <= geometry["maxContinuityRatioSpread"],
            "centerContinuity": center_spread
            <= geometry["maxContinuityCenterSpreadPx"],
        }
        results[name] = {
            "frames": members,
            "evaluated": True,
            "status": "evaluated",
            "widthRatioSpread": round(width_spread, 6),
            "heightRatioSpread": round(height_spread, 6),
            "centerXOffsetSpreadPx": round(center_x_spread, 4),
            "centerYOffsetSpreadPx": round(center_y_spread, 4),
            "checks": checks,
            "passed": all(checks.values()),
        }
    return {
        "groups": results,
        "passed": all(item["passed"] for item in results.values()),
    }


def checker(size: tuple[int, int], cell: int = 16) -> Image.Image:
    image = Image.new("RGB", size, "#101a28")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            fill = "#213043" if (x // cell + y // cell) % 2 else "#182536"
            draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=fill)
    return image


def contact_sheet(
    batch: str,
    family: str,
    pairs: list[tuple[str, Path, Path]],
    destination: Path,
) -> None:
    columns = min(4, max(1, len(pairs)))
    rows = math.ceil(len(pairs) / columns)
    card_width = 400
    preview_size = 190
    label_height = 52
    header = 64
    card_height = preview_size + label_height
    sheet = Image.new("RGB", (columns * card_width, header + rows * card_height), "#08111d")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((18, 18), f"FEMALE CONTACT APPROVAL / {family} / {batch}", fill="#dceff5", font=font)
    for index, (frame, output_path, reference_path) in enumerate(pairs):
        column = index % columns
        row = index // columns
        left = column * card_width
        top = header + row * card_height
        for offset, path, tag in ((5, reference_path, "M REF"), (205, output_path, "F CAND")):
            stage = checker((preview_size, preview_size))
            image = Image.open(path).convert("RGBA")
            image.thumbnail((preview_size, preview_size), Image.Resampling.LANCZOS)
            stage.paste(image, ((preview_size - image.width) // 2, (preview_size - image.height) // 2), image)
            sheet.paste(stage, (left + offset, top))
            draw.text((left + offset + 7, top + 7), tag, fill="#65d9ff", font=font)
        draw.rectangle((left, top + preview_size, left + card_width - 1, top + card_height - 1), fill="#101a29")
        draw.text((left + 12, top + preview_size + 17), frame, fill="#dceff5", font=font)
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, optimize=True)


def markdown(report: dict[str, object]) -> str:
    lines = [
        f"# Female Traveller contact QA — `{report['batch']}`",
        "",
        f"Family: `{report['family']}`",
        f"Automated result: **{'PASS' if report['passed'] else 'FAIL'}**",
        "Runtime eligible: **NO — atomic contact and identity require manual approval**",
        "",
        "| Frame | Bbox | Ref centre delta | Key residue | Result |",
        "|---|---:|---:|---:|---:|",
    ]
    for frame, facts in report["frames"].items():
        lines.append(
            f"| `{frame}` | `{facts['bbox']}` | `{facts['centerDeltaPx']} px` | "
            f"`{facts['technicalKeyRatio']:.6%}` | {'PASS' if facts['passed'] else 'FAIL'} |"
        )
    continuity = report["continuity"]["groups"]
    if continuity:
        lines.extend(
            [
                "",
                "| Continuity group | Evaluation | Ratio spread W/H | Centre spread | Result |",
                "|---|---|---:|---:|---:|",
            ]
        )
        for name, facts in continuity.items():
            if facts["evaluated"]:
                ratio = (
                    f"{facts['widthRatioSpread']:.4f} / "
                    f"{facts['heightRatioSpread']:.4f}"
                )
                centre = (
                    f"{facts['centerXOffsetSpreadPx']:.2f} / "
                    f"{facts['centerYOffsetSpreadPx']:.2f} px"
                )
            else:
                ratio = "—"
                centre = "—"
            lines.append(
                f"| `{name}` | `{facts['status']}` | `{ratio}` | `{centre}` | "
                f"{'PASS' if facts['passed'] else 'FAIL'} |"
            )
    lines.extend(
        [
            "",
            "Manual review must confirm readable physical contact, correct occlusion,",
            "stable female Traveller identity, unchanged guardian/Shadow identity and",
            "the same pair choreography as the reference. Automated PASS does not",
            "authorize a copy to `public/art`.",
            "",
            f"Contact sheet: `previews/contact-approval-batches/{report['batch']}/contact-sheet.png`.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch", required=True)
    args = parser.parse_args()
    batch = safe_id(args.batch, "batch id")
    batch_dir = inside_factory(OUTPUT_ROOT / batch)
    manifest_path = batch_dir / "manifest.json"
    if not manifest_path.is_file():
        raise SystemExit(f"missing contact manifest: {manifest_path.relative_to(ROOT)}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema") != "satoru.traveller-female-contact-approval-batch/1":
        raise SystemExit("unsupported contact approval manifest")
    if (
        manifest.get("id") != batch
        or manifest.get("runtimeEligible") is not False
        or manifest.get("publicArtWrites") is not False
    ):
        raise SystemExit("unsafe or mismatched contact approval manifest")
    required = manifest.get("requiredFrames")
    assets = manifest.get("assets")
    runtime_routes = manifest.get("runtimeRoutes")
    if not isinstance(required, list) or not isinstance(assets, dict) or set(required) != set(assets):
        raise SystemExit("contact manifest frame set is incomplete")
    if runtime_routes is None and isinstance(manifest.get("runtimeTemplate"), str):
        runtime_routes = {
            frame: manifest["runtimeTemplate"].format(frame=frame)
            for frame in required
        }
    if not isinstance(runtime_routes, dict) or set(required) != set(runtime_routes):
        raise SystemExit("contact manifest runtime route set is incomplete")
    canvas = tuple(int(value) for value in manifest["canvas"])
    ground_y = manifest.get("groundY")
    ground_y = int(ground_y) if ground_y is not None else None
    preserve = bool(manifest.get("preserveMagentaSubject"))
    normalization = str(manifest.get("normalization"))
    try:
        geometry = geometry_contract(manifest.get("geometry"))
    except ValueError as error:
        raise SystemExit(f"invalid contact geometry contract: {error}") from error
    frames: dict[str, dict[str, object]] = {}
    sheet_pairs: list[tuple[str, Path, Path]] = []
    for frame in required:
        relative = assets[frame]
        if Path(relative).name != relative:
            raise SystemExit(f"unsafe contact asset route: {relative}")
        path = inside_factory(batch_dir / relative)
        source_facts = manifest["frames"][frame]
        reference_path = repo_read_path(source_facts["reference"])
        try:
            runtime_path = repo_runtime_path(runtime_routes[frame])
        except ValueError as error:
            raise SystemExit(f"unsafe contact runtime route for {frame}: {error}") from error
        if runtime_path.suffix.lower() != ".png" or (
            source_facts.get("runtime") is not None
            and source_facts.get("runtime") != runtime_routes[frame]
        ):
            raise SystemExit(f"mismatched contact runtime route for {frame}")
        if not path.is_file() or not reference_path.is_file():
            raise SystemExit(f"missing contact output/reference for {frame}")
        frames[frame] = inspect_frame(
            path,
            reference_path,
            canvas=canvas,
            ground_y=ground_y,
            preserve_magenta_subject=preserve,
            normalization=normalization,
            bbox_alpha_threshold=int(source_facts.get("bboxAlphaThreshold", 8)),
            geometry=geometry,
        )
        sheet_pairs.append((frame, path, reference_path))
    try:
        continuity = evaluate_continuity(
            frames,
            manifest.get("continuityGroups"),
            grounded=ground_y is not None,
            geometry=geometry,
        )
    except ValueError as error:
        raise SystemExit(f"invalid contact continuity contract: {error}") from error
    passed = all(item["passed"] for item in frames.values()) and bool(
        continuity["passed"]
    )
    report = {
        "schema": "satoru.traveller-female-contact-qa/1",
        "batch": batch,
        "family": manifest["family"],
        "canvas": list(canvas),
        "groundY": ground_y,
        "geometry": geometry,
        "automatedContractPassed": passed,
        "manualContactApprovalRequired": True,
        "runtimeEligible": False,
        "frames": frames,
        "continuity": continuity,
        "passed": passed,
    }
    qa_dir = inside_factory(QA_ROOT / batch)
    preview_path = inside_factory(PREVIEW_ROOT / batch / "contact-sheet.png")
    qa_dir.mkdir(parents=True, exist_ok=True)
    (qa_dir / "qa-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (qa_dir / "qa-report.md").write_text(markdown(report), encoding="utf-8")
    contact_sheet(batch, manifest["family"], sheet_pairs, preview_path)
    summary = {
        "batch": batch,
        "family": manifest["family"],
        "passed": passed,
        "runtimeEligible": False,
    }
    print(json.dumps(summary, indent=2))
    if not passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
