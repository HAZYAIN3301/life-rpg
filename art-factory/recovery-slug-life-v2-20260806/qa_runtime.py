#!/usr/bin/env python3
"""Production QA for RECOVERY Guardian life-v2 sprites."""

from pathlib import Path
import json

import numpy as np
from PIL import Image


HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parents[1] / "public"
ROOT = PUBLIC / "art/pets/recovery-slug-v1"
SOLO = ["cushion-sleep", "glide-compress", "glide-extend", "helpers", "stretch-up"]
PAIR = ["breathe-in", "breathe-out", "greet-contact", "restore-contact", "stretch-a", "stretch-b"]


def inspect_png(path: Path, expected: tuple[int, int]) -> dict:
    image = Image.open(path).convert("RGBA")
    if image.size != expected:
        raise AssertionError(f"{path.name}: {image.size} != {expected}")
    rgba = np.asarray(image)
    alpha = rgba[:, :, 3]
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise AssertionError(f"{path.name}: empty alpha")
    corners = [int(alpha[0, 0]), int(alpha[0, -1]), int(alpha[-1, 0]), int(alpha[-1, -1])]
    if max(corners) > 2:
        raise AssertionError(f"{path.name}: opaque corner {corners}")
    visible = alpha > 32
    magenta = visible & (rgba[:, :, 0] > 210) & (rgba[:, :, 2] > 180) & (rgba[:, :, 1] < 80)
    magenta_ratio = float(magenta.sum() / max(1, visible.sum()))
    if magenta_ratio > 0.0005:
        raise AssertionError(f"{path.name}: magenta fringe {magenta_ratio:.6f}")
    return {
        "file": str(path.relative_to(PUBLIC)),
        "size": list(image.size),
        "bbox": list(bbox),
        "cornerAlpha": corners,
        "magentaRatio": round(magenta_ratio, 7),
    }


def main() -> None:
    assets = [inspect_png(ROOT / "motion-v2" / f"{name}.png", (1024, 1024)) for name in SOLO]
    assets += [inspect_png(ROOT / "pair-v2" / f"{name}.png", (1536, 1536)) for name in PAIR]
    states = [inspect_png(ROOT / "states" / f"{name}.png", (1024, 1024)) for name in ["calm", "thriving", "strained", "restoring"]]
    idle = Image.open(ROOT / "motion" / "idle-softbody.gif")
    frames = int(getattr(idle, "n_frames", 1))
    if idle.size != (1024, 1024) or frames < 24:
        raise AssertionError(f"idle-softbody.gif: size={idle.size}, frames={frames}")
    result = {
        "status": "PASS",
        "productionPngCount": len(assets),
        "stateCount": len(states),
        "idleFrames": frames,
        "assets": assets,
        "states": states,
    }
    (HERE / "qa-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "PASS", "productionPngCount": len(assets), "stateCount": len(states), "idleFrames": frames}, ensure_ascii=False))


if __name__ == "__main__":
    main()
