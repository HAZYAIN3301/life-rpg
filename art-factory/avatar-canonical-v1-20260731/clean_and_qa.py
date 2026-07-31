#!/usr/bin/env python3
"""Remove post-toggle alpha debris and validate the canonical paper doll."""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / "runtime"
MANIFEST = ROOT / "art-manifest.json"
CANVAS = (1024, 1536)


def components(mask: np.ndarray) -> list[tuple[int, np.ndarray]]:
    height, width = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    result: list[tuple[int, np.ndarray]] = []
    for start_y, start_x in zip(*np.where(mask & ~seen)):
        if seen[start_y, start_x]:
            continue
        points: list[tuple[int, int]] = []
        queue: deque[tuple[int, int]] = deque([(int(start_y), int(start_x))])
        seen[start_y, start_x] = True
        while queue:
            y, x = queue.popleft()
            points.append((y, x))
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((ny, nx))
        result.append((len(points), np.asarray(points, dtype=np.int32)))
    return sorted(result, key=lambda item: item[0], reverse=True)


def enabled_layers(manifest: dict, disabled: set[str]) -> list[dict]:
    return [
        layer for layer in sorted(manifest["layers"], key=lambda item: item["z"])
        if layer["slot"] not in disabled
    ]


def compose(manifest: dict, arrays: dict[str, np.ndarray], disabled: set[str]) -> tuple[Image.Image, np.ndarray]:
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    owner = np.full((CANVAS[1], CANVAS[0]), "", dtype=object)
    if "outfit" in disabled:
        base = np.asarray(Image.open(RUNTIME / manifest["bodyUnderlay"]["fullReveal"]).convert("RGBA"), dtype=np.uint8)
        canvas.alpha_composite(Image.fromarray(base, "RGBA"))
        owner[base[..., 3] > 0] = "__full_body__"
    for layer in enabled_layers(manifest, disabled):
        if "outfit" in disabled and layer["slot"] == "body":
            continue
        data = arrays[layer["id"]]
        canvas.alpha_composite(Image.fromarray(data, "RGBA"))
        owner[data[..., 3] > 0] = layer["id"]
        if "hair" in disabled and layer["id"] == "body-visible":
            bald = np.asarray(Image.open(RUNTIME / manifest["bodyUnderlay"]["baldHeadReveal"]).convert("RGBA"), dtype=np.uint8)
            canvas.alpha_composite(Image.fromarray(bald, "RGBA"))
            owner[bald[..., 3] > 0] = "__bald_reveal__"
    return canvas, owner


def font(size: int) -> ImageFont.ImageFont:
    for candidate in (Path("/System/Library/Fonts/SFNS.ttf"), Path("/System/Library/Fonts/Supplemental/Arial.ttf")):
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def keep_largest_alpha_component(path: Path) -> int:
    data = np.array(Image.open(path).convert("RGBA"), dtype=np.uint8, copy=True)
    groups = components(data[..., 3] > 0)
    if len(groups) <= 1:
        return 0
    keep = np.zeros(data.shape[:2], dtype=bool)
    points = groups[0][1]
    keep[points[:, 0], points[:, 1]] = True
    removed = int(np.count_nonzero((data[..., 3] > 0) & ~keep))
    data[~keep] = 0
    Image.fromarray(data, "RGBA").save(path)
    return removed


def main() -> None:
    manifest = json.loads(MANIFEST.read_text())
    auxiliary_removed = {
        "body-underlay-full": keep_largest_alpha_component(RUNTIME / manifest["bodyUnderlay"]["fullReveal"]),
        "body-bald-head-reveal": keep_largest_alpha_component(RUNTIME / manifest["bodyUnderlay"]["baldHeadReveal"]),
    }
    arrays = {
        layer["id"]: np.array(Image.open(RUNTIME / layer["file"]).convert("RGBA"), dtype=np.uint8, copy=True)
        for layer in manifest["layers"]
    }
    states = [
        ("approved", set()),
        ("backpack-off", {"backpack", "lantern"}),
        ("scarf-off", {"scarf"}),
        ("goggles-off", {"goggles"}),
        ("hair-off", {"hair"}),
        ("pouch-off", {"pouch"}),
        ("lantern-off", {"lantern"}),
        ("outfit-off", {"outfit", "scarf", "pouch", "backpack", "lantern"}),
    ]
    removed: dict[str, int] = {}
    for _ in range(5):
        changed = False
        for _, disabled in states:
            image, owner = compose(manifest, arrays, disabled)
            groups = components(np.asarray(image)[..., 3] > 0)
            for size, points in groups[1:]:
                if size > 256:
                    continue
                ys, xs = points[:, 0], points[:, 1]
                for layer_id in set(owner[ys, xs].tolist()):
                    if not layer_id or layer_id.startswith("__"):
                        continue
                    owned = owner[ys, xs] == layer_id
                    target_y, target_x = ys[owned], xs[owned]
                    count = int(np.count_nonzero(arrays[layer_id][target_y, target_x, 3]))
                    if count:
                        arrays[layer_id][target_y, target_x] = 0
                        removed[layer_id] = removed.get(layer_id, 0) + count
                        changed = True
        if not changed:
            break

    for layer in manifest["layers"]:
        data = arrays[layer["id"]]
        data[data[..., 3] == 0, :3] = 0
        Image.fromarray(data, "RGBA").save(RUNTIME / layer["file"])

    cells = []
    state_report = {}
    for label, disabled in states:
        image, _ = compose(manifest, arrays, disabled)
        groups = components(np.asarray(image)[..., 3] > 0)
        detached = [size for size, _ in groups[1:] if size <= 256]
        state_report[label] = {"components": len(groups), "detachedSmallComponents": detached, "pass": not detached}
        paper = Image.new("RGBA", CANVAS, (242, 237, 226, 255))
        paper.alpha_composite(image)
        paper.thumbnail((320, 480), Image.Resampling.LANCZOS)
        cells.append((label, paper))

    preview = Image.new("RGB", (4 * 344, 2 * 536), (22, 27, 43))
    draw = ImageDraw.Draw(preview)
    label_font = font(20)
    for index, (label, image) in enumerate(cells):
        x = (index % 4) * 344 + 12
        y = (index // 4) * 536 + 44
        preview.paste(image.convert("RGB"), (x, y))
        draw.text((x, y - 30), label, fill=(242, 237, 226), font=label_font)
    (ROOT / "previews").mkdir(exist_ok=True)
    preview.save(ROOT / "previews" / "canonical-toggle-matrix.png", quality=95)

    report = {
        "canvas": list(CANVAS),
        "removedAuxiliaryPixels": auxiliary_removed,
        "removedDetachedPixels": removed,
        "states": state_report,
        "allPassed": all(item["pass"] for item in state_report.values()),
        "runtimeIntegrationAllowed": all(item["pass"] for item in state_report.values()),
    }
    (ROOT / "qa-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
