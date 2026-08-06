#!/usr/bin/env python3
"""Runtime QA for BODY Guardian life-v4 production sprites."""

from pathlib import Path
import json

import numpy as np
from PIL import Image


HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parents[1] / "public"
MOTION = PUBLIC / "art/pets/body-toad-v1/motion-v4"
PAIR = PUBLIC / "art/pets/body-toad-v1/pair-v4"
ACTORS = PUBLIC / "art/den/actors"

PNG_EXPECTED = {
    **{MOTION / name: (1024, 1024) for name in [
        "idle-blink.png", "hop-crouch.png", "hop-air.png", "solo-stretch.png", "solo-stretch-up.png", "bench-sleep.png",
    ]},
    **{PAIR / f"{name}.png": (1536, 1536) for name in [
        "greet-contact", "train-low", "train-high", "rest-contact", "rest-pet",
        "pushup-down", "pushup-up", "stretch-a", "stretch-b",
        "whistle-a", "whistle-b", "whistle-c", "whistle-d",
    ]},
    ACTORS / "prop-portal-rim.png": (542, 768),
    ACTORS / "prop-portal-core.png": (542, 768),
    ACTORS / "traveller-portal-reach.png": (900, 900),
    PUBLIC / "art/avatars/traveller-core-v1/male/room-actions-v4/bench-portal-reach.png": (640, 900),
}


def inspect_png(path: Path, expected: tuple[int, int]) -> dict:
    image = Image.open(path).convert("RGBA")
    alpha = np.asarray(image.getchannel("A"))
    rgba = np.asarray(image)
    if image.size != expected:
        raise AssertionError(f"{path.name}: {image.size} != {expected}")
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise AssertionError(f"{path.name}: empty alpha")
    corners = [int(alpha[0, 0]), int(alpha[0, -1]), int(alpha[-1, 0]), int(alpha[-1, -1])]
    if max(corners) > 2:
        raise AssertionError(f"{path.name}: opaque corner {corners}")
    opaque = alpha > 32
    # Reject the vivid generation chroma, while allowing old authored burgundy
    # paper shadows that can legitimately contain a small blue component.
    magenta = opaque & (rgba[:, :, 0] > 210) & (rgba[:, :, 2] > 180) & (rgba[:, :, 1] < 75)
    magenta_ratio = float(magenta.sum() / max(1, opaque.sum()))
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
    rows = [inspect_png(path, expected) for path, expected in PNG_EXPECTED.items()]
    idle = Image.open(MOTION / "idle-breath.gif")
    frames = int(getattr(idle, "n_frames", 1))
    if idle.size != (1024, 1024) or frames < 12:
        raise AssertionError(f"idle-breath.gif: size={idle.size}, frames={frames}")
    payload = {"status": "PASS", "pngCount": len(rows), "idleFrames": frames, "assets": rows}
    (HERE / "qa-results.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "PASS", "pngCount": len(rows), "idleFrames": frames}, ensure_ascii=False))


if __name__ == "__main__":
    main()
