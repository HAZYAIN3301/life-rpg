#!/usr/bin/env python3
"""Build deterministic diagnostic recolours from approved semantic masks.

Outputs remain inside this factory.  They are review aids, never runtime art.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

from semantic_masks import (
    CHANNEL_INDEX,
    REPO_ROOT,
    ROOT,
    asset_map,
    load_palette_catalog,
    public_asset_path,
    safe_relative,
    validate_semantic_mask,
)


SLOT_INDEX = CHANNEL_INDEX
PALETTE_CATALOG = load_palette_catalog()
ALGORITHM = PALETTE_CATALOG["algorithm"]
RAMP_ENTRIES = {
    item["id"]: item
    for entries in PALETTE_CATALOG["ramps"].values()
    for item in entries
}
DIAGNOSTIC_TARGETS = {
    slot: RAMP_ENTRIES[target_id]["hex"]
    for slot, target_id in PALETTE_CATALOG["diagnosticTargets"].items()
}


def parse_hex(value: str) -> np.ndarray:
    raw = value.strip().removeprefix("#")
    if len(raw) != 6 or any(char not in "0123456789abcdefABCDEF" for char in raw):
        raise ValueError(f"expected #RRGGBB, got {value!r}")
    return np.array([int(raw[index:index + 2], 16) for index in (0, 2, 4)], dtype=np.float64) / 255.0


def srgb_to_linear(rgb: np.ndarray) -> np.ndarray:
    transfer = ALGORITHM["srgbTransfer"]
    return np.where(
        rgb <= transfer["decodeThreshold"],
        rgb / transfer["decodeDivisor"],
        ((rgb + transfer["decodeOffset"]) / transfer["decodeScale"]) ** transfer["decodeExponent"],
    )


def linear_to_srgb(rgb: np.ndarray) -> np.ndarray:
    low, high = ALGORITHM["linearClip"]
    rgb = np.clip(rgb, low, high)
    transfer = ALGORITHM["srgbTransfer"]
    return np.where(
        rgb <= transfer["encodeThreshold"],
        rgb * transfer["encodeMultiplier"],
        transfer["encodeScale"] * np.power(rgb, transfer["encodeExponent"]) - transfer["encodeOffset"],
    )


def linear_to_oklab(rgb: np.ndarray) -> np.ndarray:
    linear_to_lms = np.asarray(ALGORITHM["linearSrgbToLms"], dtype=np.float64)
    root_to_lab = np.asarray(ALGORITHM["lmsRootToOklab"], dtype=np.float64)
    lms = np.matmul(rgb, linear_to_lms.T)
    return np.matmul(np.cbrt(lms), root_to_lab.T)


def oklab_to_linear(lab: np.ndarray) -> np.ndarray:
    lab_to_root = np.asarray(ALGORITHM["oklabToLmsRoot"], dtype=np.float64)
    lms_to_linear = np.asarray(ALGORITHM["lmsToLinearSrgb"], dtype=np.float64)
    lms_root = np.matmul(lab, lab_to_root.T)
    return np.matmul(lms_root ** 3, lms_to_linear.T)


def weighted_anchor(lab: np.ndarray, weights: np.ndarray) -> np.ndarray:
    total = float(weights.sum())
    if total <= 0:
        raise ValueError("slot mask has no coverage")
    return (lab * weights[..., None]).sum(axis=(0, 1)) / total


def recolor_image(
    base: Image.Image,
    mask: Image.Image,
    targets: dict[str, str],
) -> Image.Image:
    """Recolour selected slots while preserving alpha and local paper texture."""
    rgba = np.asarray(base.convert("RGBA"), dtype=np.uint8)
    packed = np.asarray(mask.convert("RGB"), dtype=np.uint8)
    source_srgb = rgba[..., :3].astype(np.float64) / 255.0
    source_lab = linear_to_oklab(srgb_to_linear(source_srgb))
    weights = packed.astype(np.float64) / 255.0
    output = source_srgb.copy()
    total_weight = np.zeros(weights.shape[:2], dtype=np.float64)
    contributions = np.zeros_like(source_srgb)
    residual = ALGORITHM["paperResidual"]
    for slot, target_hex in targets.items():
        if slot not in SLOT_INDEX:
            raise ValueError(f"unknown semantic slot: {slot}")
        weight = weights[..., SLOT_INDEX[slot]]
        if not np.any(weight > 0):
            continue
        anchor = weighted_anchor(source_lab, weight)
        target_srgb = parse_hex(target_hex).reshape(1, 1, 3)
        target_lab = linear_to_oklab(srgb_to_linear(target_srgb))[0, 0]
        mapped_lab = np.empty_like(source_lab)
        mapped_lab[..., 0] = target_lab[0] + (source_lab[..., 0] - anchor[0]) * residual["lightness"]
        mapped_lab[..., 1] = target_lab[1] + (source_lab[..., 1] - anchor[1]) * residual["chromaA"]
        mapped_lab[..., 2] = target_lab[2] + (source_lab[..., 2] - anchor[2]) * residual["chromaB"]
        mapped = linear_to_srgb(oklab_to_linear(mapped_lab))
        contributions += mapped * weight[..., None]
        total_weight += weight
    if np.any(total_weight > 1.0 + 1e-9):
        raise ValueError("semantic channel sum exceeds one")
    output = output * (1.0 - total_weight[..., None]) + contributions
    result = rgba.copy()
    union = total_weight > 0
    result[..., :3][union] = np.clip(
        np.floor(output[union] * 255.0 + 0.5), 0, 255
    ).astype(np.uint8)
    result[..., 3] = rgba[..., 3]
    return Image.fromarray(result, "RGBA")


def recolor_asset(asset: dict[str, object], targets: dict[str, str]) -> Image.Image:
    validation = validate_semantic_mask(asset)
    if not validation.passed:
        raise ValueError("semantic mask is not approved: " + "; ".join(validation.errors))
    base_path = public_asset_path(REPO_ROOT, asset["baseRoute"])
    mask_path = safe_relative(ROOT, asset["maskFile"])
    with Image.open(base_path) as opened:
        base = opened.convert("RGBA")
    with Image.open(mask_path) as opened:
        mask = opened.convert("RGB")
    return recolor_image(base, mask, targets)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", required=True, help="exact inventory asset id")
    parser.add_argument("--skin")
    parser.add_argument("--hair")
    parser.add_argument("--eyes")
    parser.add_argument("--output", required=True, help="factory-relative PNG path")
    args = parser.parse_args()
    assets = asset_map()
    if args.asset not in assets:
        raise SystemExit(f"unknown inventory asset: {args.asset}")
    targets = {slot: value for slot, value in (("skin", args.skin), ("hair", args.hair), ("eyes", args.eyes)) if value}
    if not targets:
        raise SystemExit("select at least one of --skin, --hair or --eyes")
    try:
        for value in targets.values():
            parse_hex(value)
        output = safe_relative(ROOT, args.output)
        image = recolor_asset(assets[args.asset], targets)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, "PNG", optimize=True)
    print(output.relative_to(ROOT))


if __name__ == "__main__":
    main()
