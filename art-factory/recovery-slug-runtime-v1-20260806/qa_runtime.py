#!/usr/bin/env python3
"""Runtime art QA for the Recovery Guardian."""

from pathlib import Path
import json

import numpy as np
from PIL import Image


HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parents[1] / "public"
ROOT = PUBLIC / "art/pets/recovery-slug-v1"
STATES = ["calm", "thriving", "strained", "restoring"]


def inspect_state(name: str) -> dict:
    path = ROOT / "states" / f"{name}.png"
    image = Image.open(path).convert("RGBA")
    if image.size != (1024, 1024):
        raise AssertionError(f"{name}: wrong canvas {image.size}")
    alpha = np.asarray(image.getchannel("A"))
    corners = [int(alpha[0, 0]), int(alpha[0, -1]), int(alpha[-1, 0]), int(alpha[-1, -1])]
    if image.getchannel("A").getbbox() is None:
        raise AssertionError(f"{name}: empty alpha")
    if max(corners) > 2:
        raise AssertionError(f"{name}: opaque corner {corners}")
    return {"state": name, "canvas": [1024, 1024], "cornerAlpha": corners}


def main() -> None:
    states = [inspect_state(name) for name in STATES]
    idle = Image.open(ROOT / "motion/idle-softbody.gif")
    frames = int(getattr(idle, "n_frames", 1))
    if idle.size != (1024, 1024) or frames < 24:
        raise AssertionError(f"idle-softbody.gif: size={idle.size}, frames={frames}")
    result = {"status": "PASS", "states": states, "idleFrames": frames}
    (HERE / "qa-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "PASS", "stateCount": len(states), "idleFrames": frames}, ensure_ascii=False))


if __name__ == "__main__":
    main()
