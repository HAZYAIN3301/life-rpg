#!/usr/bin/env python3
"""QA factory-local female Traveller atomic contact approval batches."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from build_contact_pack import OUTPUT_ROOT, REPO_ROOT, inside_factory, repo_read_path
from build_core_pack import ROOT, alpha_bbox, is_key_like, safe_id


PREVIEW_ROOT = ROOT / "previews" / "contact-approval-batches"
QA_ROOT = ROOT / "qa" / "contact-approval-batches"


def inspect_frame(
    path: Path,
    reference_path: Path,
    *,
    canvas: tuple[int, int],
    ground_y: int | None,
    preserve_magenta_subject: bool,
    normalization: str,
) -> dict[str, object]:
    source = Image.open(path)
    source.load()
    mode = source.mode
    image = source.convert("RGBA")
    reference = Image.open(reference_path).convert("RGBA")
    bbox = alpha_bbox(image)
    reference_bbox = alpha_bbox(reference)
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
        "referenceScale": 0.72 <= width_ratio <= 1.28 and 0.72 <= height_ratio <= 1.28,
    }
    if ground_y is not None:
        checks["groundY"] = bbox[3] == ground_y
        checks["referenceCenterX"] = center_x_delta <= 4.0
    elif normalization == "reference-bbox-fit":
        checks["referenceCenter"] = center_delta <= 4.0
    return {
        "file": str(path.relative_to(ROOT)),
        "reference": str(reference_path.relative_to(REPO_ROOT)),
        "mode": mode,
        "canvas": list(image.size),
        "bbox": list(bbox),
        "referenceBbox": list(reference_bbox),
        "centerDeltaPx": round(center_delta, 4),
        "centerXDeltaPx": round(center_x_delta, 4),
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
    if not isinstance(required, list) or not isinstance(assets, dict) or set(required) != set(assets):
        raise SystemExit("contact manifest frame set is incomplete")
    canvas = tuple(int(value) for value in manifest["canvas"])
    ground_y = manifest.get("groundY")
    ground_y = int(ground_y) if ground_y is not None else None
    preserve = bool(manifest.get("preserveMagentaSubject"))
    normalization = str(manifest.get("normalization"))
    frames: dict[str, dict[str, object]] = {}
    sheet_pairs: list[tuple[str, Path, Path]] = []
    for frame in required:
        relative = assets[frame]
        if Path(relative).name != relative:
            raise SystemExit(f"unsafe contact asset route: {relative}")
        path = inside_factory(batch_dir / relative)
        source_facts = manifest["frames"][frame]
        reference_path = repo_read_path(source_facts["reference"])
        if not path.is_file() or not reference_path.is_file():
            raise SystemExit(f"missing contact output/reference for {frame}")
        frames[frame] = inspect_frame(
            path,
            reference_path,
            canvas=canvas,
            ground_y=ground_y,
            preserve_magenta_subject=preserve,
            normalization=normalization,
        )
        sheet_pairs.append((frame, path, reference_path))
    passed = all(item["passed"] for item in frames.values())
    report = {
        "schema": "satoru.traveller-female-contact-qa/1",
        "batch": batch,
        "family": manifest["family"],
        "canvas": list(canvas),
        "groundY": ground_y,
        "automatedContractPassed": passed,
        "manualContactApprovalRequired": True,
        "runtimeEligible": False,
        "frames": frames,
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
