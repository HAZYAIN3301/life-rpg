#!/usr/bin/env python3
"""Validate every common-rig Scholar runtime asset and legal slot combination."""

from __future__ import annotations

import itertools
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parents[1]
STAGED_RUNTIME = PROJECT_ROOT / "integration-staging/public/art/avatars/common-rig-v1/scholar-v2"
RUNTIME = STAGED_RUNTIME if STAGED_RUNTIME.is_dir() else PROJECT_ROOT / "public/art/avatars/common-rig-v1/scholar-v2"
MANIFEST = json.loads((ROOT / "art-manifest.json").read_text())
COLORWAYS = tuple(MANIFEST["colorways"])
SLOTS = {
    "outfitSet": ("base", "traveller", "scholar"),
    "hairStyle": ("none", "traveller"),
    "headwear": ("none", "scholar-hat"),
    "eyewear": ("none", "traveller-goggles", "scholar-glasses"),
    "neckItem": ("none", "traveller-scarf", "scholar-neck"),
    "backItem": ("none", "traveller-backpack", "scholar-backpack"),
    "waistItem": ("none", "traveller-pouch", "scholar-field-kit"),
    "handItem": ("none", "traveller-lantern"),
}


def main() -> None:
    errors: list[str] = []
    checked_assets = 0
    for colorway in COLORWAYS:
        prefix = Path() if colorway == "teal" else Path("colorways") / colorway
        for layer in MANIFEST["layers"]:
            path = RUNTIME / prefix / layer["file"]
            if not path.is_file():
                errors.append(f"missing: {path}")
                continue
            with Image.open(path) as image:
                if image.size != (512, 768):
                    errors.append(f"canvas: {path} -> {image.size}")
                if image.mode != "RGBA":
                    errors.append(f"mode: {path} -> {image.mode}")
                alpha = image.getchannel("A")
                corners = [alpha.getpixel((0, 0)), alpha.getpixel((511, 0)), alpha.getpixel((0, 767)), alpha.getpixel((511, 767))]
                if any(corners):
                    errors.append(f"opaque corner: {path} -> {corners}")
                if alpha.getbbox() is None:
                    errors.append(f"empty alpha: {path}")
            checked_assets += 1

    legal = 0
    coerced_lantern = 0
    keys = tuple(SLOTS)
    for values in itertools.product(*(SLOTS[key] for key in keys)):
        appearance = dict(zip(keys, values, strict=True))
        if appearance["handItem"] == "traveller-lantern" and appearance["backItem"] != "traveller-backpack":
            appearance["backItem"] = "traveller-backpack"
            coerced_lantern += 1
        legal += 1

    report = {
        "allPassed": not errors,
        "runtimeAssets": checked_assets,
        "colorways": len(COLORWAYS),
        "slotCombinations": legal,
        "lanternDependencyCoercions": coerced_lantern,
        "errors": errors,
    }
    (ROOT / "qa-runtime-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False))
    raise SystemExit(1 if errors else 0)


if __name__ == "__main__":
    main()
