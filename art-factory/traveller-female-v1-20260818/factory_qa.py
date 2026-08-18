#!/usr/bin/env python3
"""Measure a female Traveller approval batch and build its review artifacts."""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
OUTPUT_ROOT = ROOT / "outputs" / "approval-batches"
PREVIEW_ROOT = ROOT / "previews" / "approval-batches"
QA_ROOT = ROOT / "qa" / "approval-batches"
CANVAS = (640, 900)
FLOOR_Y = 860
SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")


def inside_factory(path: Path) -> Path:
    resolved = path.resolve()
    try:
        resolved.relative_to(ROOT.resolve())
    except ValueError as error:
        raise ValueError(f"path escapes female Traveller factory: {path}") from error
    return resolved


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value >= 8 else 0).getbbox()


def in_boxes(x: int, y: int, boxes: list[list[int]]) -> bool:
    return any(left <= x < right and top <= y < bottom for left, top, right, bottom in boxes)


def inspect_frame(path: Path) -> dict[str, object]:
    image = Image.open(path)
    image.load()
    mode = image.mode
    rgba = image.convert("RGBA")
    bbox = alpha_bbox(rgba)
    alpha = rgba.getchannel("A")
    histogram = alpha.histogram()
    visible = sum(histogram[8:])
    partial = sum(histogram[1:255])
    corner_points = (
        (0, 0),
        (CANVAS[0] - 1, 0),
        (0, CANVAS[1] - 1),
        (CANVAS[0] - 1, CANVAS[1] - 1),
    )
    corners = [rgba.getpixel(point)[3] for point in corner_points] if rgba.size == CANVAS else []
    edge_alpha = 0
    magenta_pixels = 0
    if rgba.size == CANVAS:
        pixels = rgba.load()
        for y in range(rgba.height):
            for x in range(rgba.width):
                red, green, blue, value = pixels[x, y]
                if value >= 8 and (x < 2 or y < 2 or x >= rgba.width - 2 or y >= rgba.height - 2):
                    edge_alpha += 1
                if value >= 8 and min(red, blue) >= 135 and min(red, blue) - green >= 70:
                    magenta_pixels += 1
    magenta_ratio = magenta_pixels / visible if visible else 1.0
    checks = {
        "rgba": mode == "RGBA",
        "canvas": rgba.size == CANVAS,
        "visibleSubject": bool(bbox and visible >= 8_000),
        "realTransparency": histogram[0] >= CANVAS[0] * CANVAS[1] * 0.1 if rgba.size == CANVAS else False,
        "floorY": bool(bbox and bbox[3] == FLOOR_Y),
        "transparentCorners": len(corners) == 4 and all(value == 0 for value in corners),
        "clearCanvasEdge": edge_alpha == 0,
        "magentaContamination": magenta_ratio <= 0.0005,
    }
    return {
        "file": str(path.relative_to(ROOT)),
        "mode": mode,
        "canvas": list(rgba.size),
        "bbox": list(bbox) if bbox else None,
        "floorY": bbox[3] if bbox else None,
        "visiblePixels": visible,
        "transparentPixels": histogram[0],
        "partialAlphaPixels": partial,
        "edgeAlphaPixels": edge_alpha,
        "magentaPixels": magenta_pixels,
        "magentaRatio": round(magenta_ratio, 8),
        "checks": checks,
        "passed": all(checks.values()),
    }


def inspect_blink(idle_path: Path, blink_path: Path, boxes: list[list[int]], max_ratio: float) -> dict[str, object]:
    idle = Image.open(idle_path).convert("RGBA")
    blink = Image.open(blink_path).convert("RGBA")
    if idle.size != blink.size:
        return {"passed": False, "reason": "idle and blink canvas mismatch"}
    changed = 0
    outside = 0
    for index, (before, after) in enumerate(
        zip(idle.get_flattened_data(), blink.get_flattened_data())
    ):
        if before == after:
            continue
        changed += 1
        x = index % idle.width
        y = index // idle.width
        outside += int(not in_boxes(x, y, boxes))
    ratio = changed / (idle.width * idle.height)
    alpha_identical = idle.getchannel("A").tobytes() == blink.getchannel("A").tobytes()
    checks = {
        "twoMeasuredEyeBoxes": len(boxes) == 2,
        "hasVisibleChange": changed > 0,
        "withinChangeBudget": ratio <= max_ratio,
        "changesConfinedToEyeBoxes": outside == 0,
        "alphaIdenticalToIdle": alpha_identical,
    }
    return {
        "changedPixels": changed,
        "changedRatio": round(ratio, 8),
        "changedOutsideEyeBoxes": outside,
        "alphaIdenticalToIdle": alpha_identical,
        "maxChangedRatio": max_ratio,
        "eyeBoxes": boxes,
        "checks": checks,
        "passed": all(checks.values()),
    }


def checker(size: tuple[int, int], cell: int = 20) -> Image.Image:
    image = Image.new("RGB", size, "#111a27")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            fill = "#202c3a" if (x // cell + y // cell) % 2 else "#172231"
            draw.rectangle((x, y, min(size[0] - 1, x + cell - 1), min(size[1] - 1, y + cell - 1)), fill=fill)
    return image


def contact_sheet(batch: str, asset_paths: list[tuple[str, Path]], destination: Path) -> None:
    columns = min(4, max(1, len(asset_paths)))
    rows = math.ceil(len(asset_paths) / columns)
    tile_width = 320
    image_height = 450
    label_height = 42
    header_height = 64
    sheet = Image.new("RGB", (columns * tile_width, header_height + rows * (image_height + label_height)), "#08111d")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((18, 18), f"TRAVELLER FEMALE V1 / APPROVAL BATCH: {batch}", fill="#dceff5", font=font)
    for index, (frame, path) in enumerate(asset_paths):
        column = index % columns
        row = index // columns
        left = column * tile_width
        top = header_height + row * (image_height + label_height)
        stage = checker((tile_width, image_height))
        image = Image.open(path).convert("RGBA").resize((tile_width, image_height), Image.Resampling.LANCZOS)
        stage.paste(image, (0, 0), image)
        sheet.paste(stage, (left, top))
        label_box = (
            left,
            top + image_height,
            left + tile_width - 1,
            top + image_height + label_height - 1,
        )
        draw.rectangle(label_box, fill="#101a29")
        draw.text((left + 12, top + image_height + 13), frame, fill="#65d9ff", font=font)
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, optimize=True)


def markdown_report(report: dict[str, object]) -> str:
    result = "PASS" if report["passed"] else "FAIL"
    lines = [
        f"# Traveller female v1 — QA: `{report['batch']}`",
        "",
        f"Automated result: **{result}**",
        "Runtime eligible: **NO — manual art approval is still required**",
        "",
        "## Stage contract",
        "",
        "- Canvas: `640 × 900` RGBA.",
        "- Floor line: `y=860`.",
        "- Technical key: `#FF00FF`, converted to real alpha.",
        "- Outputs and QA remain inside this factory approval batch.",
        "",
        "## Frames",
        "",
        "| Frame | Canvas | Bbox | Magenta | Result |",
        "|---|---:|---:|---:|---:|",
    ]
    for frame, facts in report["frames"].items():
        lines.append(
            f"| `{frame}` | `{facts['canvas']}` | `{facts['bbox']}` | "
            f"`{facts['magentaRatio']:.6%}` | {'PASS' if facts['passed'] else 'FAIL'} |"
        )
    if report.get("blink"):
        blink = report["blink"]
        lines.extend(
            [
                "",
                "## Deterministic blink",
                "",
                f"- Changed pixels: `{blink.get('changedPixels')}` (`{blink.get('changedRatio', 0):.6%}`).",
                f"- Changed outside measured eye boxes: `{blink.get('changedOutsideEyeBoxes')}`.",
                f"- Alpha identical to idle: `{blink.get('alphaIdenticalToIdle')}`.",
                f"- Result: **{'PASS' if blink.get('passed') else 'FAIL'}**.",
            ]
        )
    lines.extend(
        [
            "",
            "## Manual approval gate",
            "",
            "Automated PASS does not approve identity, anatomy or art direction. Review the contact sheet for:",
            "",
            "- the same adult female identity, proportions, hair and costume in every frame;",
            "- readable connected locomotion and coherent back-view construction;",
            "- canonical cut-paper material and lighting without style drift;",
            "- no sexualisation, infantilisation, detached anatomy or baked scene content.",
            "",
            f"Contact sheet: `previews/approval-batches/{report['batch']}/contact-sheet.png`.",
            "",
        ]
    )
    return "\n".join(lines)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--batch", required=True, help="approval batch id produced by build_core_pack.py")
    return result


def main() -> None:
    args = parser().parse_args()
    if not SAFE_ID.fullmatch(args.batch):
        raise SystemExit("invalid batch id")
    batch_dir = inside_factory(OUTPUT_ROOT / args.batch)
    manifest_path = inside_factory(batch_dir / "manifest.json")
    if not manifest_path.is_file():
        raise SystemExit(f"missing build manifest: {manifest_path.relative_to(ROOT)}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema") != "satoru.traveller-female-approval-batch/1" or manifest.get("id") != args.batch:
        raise SystemExit("manifest does not match the requested female approval batch")
    if manifest.get("runtimeEligible") is not False or manifest.get("publicArtWrites") is not False:
        raise SystemExit("unsafe manifest: approval batch must remain runtime-ineligible and factory-local")

    assets = manifest.get("assets")
    if not isinstance(assets, dict) or not assets:
        raise SystemExit("manifest has no assets")
    asset_paths: list[tuple[str, Path]] = []
    missing: list[str] = []
    for frame, relative in assets.items():
        if not isinstance(frame, str) or not isinstance(relative, str) or Path(relative).name != relative:
            raise SystemExit(f"unsafe asset route in manifest: {frame!r} -> {relative!r}")
        path = inside_factory(batch_dir / relative)
        if not path.is_file():
            missing.append(str(path.relative_to(ROOT)))
        asset_paths.append((frame, path))
    if missing:
        raise SystemExit("missing built assets; QA did not write reports:\n- " + "\n- ".join(missing))

    frames = {frame: inspect_frame(path) for frame, path in asset_paths}
    blink: dict[str, object] | None = None
    if "idle" in assets or "idle-blink" in assets:
        if "idle" not in assets or "idle-blink" not in assets:
            blink = {"passed": False, "reason": "idle and idle-blink must be present together"}
        else:
            max_ratio = float(manifest.get("blink", {}).get("maxChangedRatio", 0.006))
            boxes = manifest.get("eyeBoxes", [])
            blink = inspect_blink(batch_dir / assets["idle"], batch_dir / assets["idle-blink"], boxes, max_ratio)

    passed = all(facts["passed"] for facts in frames.values()) and (blink is None or bool(blink.get("passed")))
    report: dict[str, object] = {
        "schema": "satoru.traveller-female-approval-qa/1",
        "batch": args.batch,
        "canvas": list(CANVAS),
        "floorY": FLOOR_Y,
        "automatedContractPassed": passed,
        "manualArtApprovalRequired": True,
        "runtimeEligible": False,
        "frames": frames,
        "blink": blink,
        "passed": passed,
    }
    qa_dir = inside_factory(QA_ROOT / args.batch)
    preview_path = inside_factory(PREVIEW_ROOT / args.batch / "contact-sheet.png")
    qa_dir.mkdir(parents=True, exist_ok=True)
    (qa_dir / "qa-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (qa_dir / "qa-report.md").write_text(markdown_report(report), encoding="utf-8")
    contact_sheet(args.batch, asset_paths, preview_path)
    summary = {
        "batch": args.batch,
        "passed": passed,
        "runtimeEligible": False,
        "report": str((qa_dir / "qa-report.json").relative_to(ROOT)),
        "contactSheet": str(preview_path.relative_to(ROOT)),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if not passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
