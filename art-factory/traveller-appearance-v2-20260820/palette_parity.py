#!/usr/bin/env python3
"""Validate authored OKLab ramps and byte-exact cross-runtime golden vectors."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

from reference_recolor import PALETTE_CATALOG, RAMP_ENTRIES, recolor_image
from semantic_masks import ROOT, Validation, read_json, validate_palette_catalog


GOLDEN_PATH = ROOT / "palette-golden-vectors.json"
GOLDEN_SCHEMA = "satoru.traveller-semantic-palette-golden-vectors/1"


def validate_golden_vectors(path: Path = GOLDEN_PATH) -> Validation:
    errors: list[str] = []
    catalog = validate_palette_catalog(PALETTE_CATALOG)
    errors.extend(catalog.errors)
    try:
        payload = read_json(path)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        return Validation(False, (f"unreadable golden vectors: {exc}",), {})
    algorithm = PALETTE_CATALOG["algorithm"]
    if payload.get("schema") != GOLDEN_SCHEMA:
        errors.append("golden vector schema mismatch")
    if payload.get("algorithm") != algorithm["id"] or payload.get("byteRounding") != algorithm["byteRounding"]:
        errors.append("golden vectors target a different algorithm revision")
    vectors = payload.get("vectors") if isinstance(payload.get("vectors"), list) else []
    if len(vectors) < 3:
        errors.append("at least three golden vectors are required")
    ids: set[str] = set()
    passed = 0
    for raw in vectors:
        if not isinstance(raw, dict):
            errors.append("golden vector must be an object")
            continue
        vector_id = raw.get("id")
        if not isinstance(vector_id, str) or not vector_id or vector_id in ids:
            errors.append("golden vector id is missing or duplicate")
            continue
        ids.add(vector_id)
        try:
            width = int(raw["width"])
            height = int(raw["height"])
            source_values = np.asarray(raw["sourceRgba"], dtype=np.int64)
            mask_values = np.asarray(raw["maskRgb"], dtype=np.int64)
            expected_values = np.asarray(raw["expectedRgba"], dtype=np.int64)
            if any(
                values.size and (int(values.min()) < 0 or int(values.max()) > 255)
                for values in (source_values, mask_values, expected_values)
            ):
                raise ValueError("golden byte values must be in 0..255")
            source_flat = source_values.astype(np.uint8)
            mask_flat = mask_values.astype(np.uint8)
            expected_flat = expected_values.astype(np.uint8)
            if source_flat.shape != (width * height, 4):
                raise ValueError("sourceRgba shape mismatch")
            if mask_flat.shape != (width * height, 3):
                raise ValueError("maskRgb shape mismatch")
            if expected_flat.shape != (width * height, 4):
                raise ValueError("expectedRgba shape mismatch")
            target_ids = raw.get("targetIds") if isinstance(raw.get("targetIds"), dict) else {}
            targets: dict[str, str] = {}
            for slot, target_id in target_ids.items():
                if slot not in {"skin", "hair", "eyes"}:
                    raise ValueError(f"unknown slot {slot}")
                entry = RAMP_ENTRIES.get(target_id)
                if not entry or not str(target_id).startswith(f"{slot}-"):
                    raise ValueError(f"target {target_id!r} does not belong to {slot}")
                targets[slot] = entry["hex"]
            if not targets:
                raise ValueError("golden vector must select at least one target")
            source = Image.fromarray(source_flat.reshape(height, width, 4), "RGBA")
            mask = Image.fromarray(mask_flat.reshape(height, width, 3), "RGB")
            actual = np.asarray(recolor_image(source, mask, targets)).reshape(width * height, 4)
            if not np.array_equal(actual, expected_flat):
                errors.append(
                    f"{vector_id}: byte parity mismatch; expected {expected_flat.tolist()}, got {actual.tolist()}"
                )
                continue
            passed += 1
        except (KeyError, TypeError, ValueError, OverflowError) as exc:
            errors.append(f"{vector_id}: {exc}")
    return Validation(
        not errors,
        tuple(errors),
        {"vectors": len(vectors), "passed": passed, "algorithm": algorithm["id"]},
    )


if __name__ == "__main__":
    result = validate_golden_vectors()
    print(json.dumps(result.payload(), ensure_ascii=False, indent=2))
    raise SystemExit(0 if result.passed else 1)
