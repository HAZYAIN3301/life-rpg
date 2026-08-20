#!/usr/bin/env python3
"""Deterministic contracts for Traveller Appearance v2 semantic masks.

This module never guesses semantic ownership from colour.  Every mask and
Traveller-only matte is a manually authored, immutable factory input.  The
helpers below only validate, measure and package those inputs.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Iterable, Sequence

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parents[1]
INVENTORY_PATH = ROOT / "inventory.json"
CONTRACT_PATH = ROOT / "palette-contract.json"
PALETTE_CATALOG_PATH = ROOT / "palette-catalog.json"
MANUAL_APPROVALS_PATH = ROOT / "manual-approvals.json"

INVENTORY_SCHEMA = "satoru.traveller-semantic-mask-inventory/1"
CONTRACT_SCHEMA = "satoru.traveller-semantic-palette-contract/1"
PALETTE_CATALOG_SCHEMA = "satoru.traveller-semantic-palette-catalog/1"
PUBLIC_MASK_ROOT = "/art/avatars/traveller-appearance-v2/palette-masks-v1/"
VARIANTS = ("male-v1", "female-f2-v1")
CAPABILITY_COUNTS = {
    "core": 4,
    "motion": 3,
    "room": 4,
    "body-toad": 13,
    "recovery-slug": 6,
    "resources-penguin": 12,
    "shadow": 4,
}
CAPABILITY_FRAMES = {
    "core": ("idle", "arms-up", "seated", "window-back"),
    "motion": ("idle-blink", "walk-a", "walk-b"),
    "room": ("bench-rest", "bench-read-a", "bench-read-b", "bench-portal-reach"),
    "body-toad": (
        "greet-contact", "train-low", "train-high", "whistle-a", "whistle-b",
        "whistle-c", "whistle-d", "pushup-down", "pushup-up", "stretch-a",
        "stretch-b", "rest-contact", "rest-pet",
    ),
    "recovery-slug": (
        "greet-contact", "breathe-in", "breathe-out", "restore-contact",
        "stretch-a", "stretch-soft-b",
    ),
    "resources-penguin": (
        "greet-contact", "budget-point", "budget-reserve", "count-pass",
        "count-place", "count-stack", "reserve-offer", "reserve-accept",
        "focus-work", "focus-check", "focus-nod", "close-stamp",
    ),
    "shadow": ("attune-spark", "attune-spirit", "attune-guardian", "attune-keeper"),
}
CAPABILITY_CANVASES = {
    "core": (640, 900),
    "motion": (640, 900),
    "room": (640, 900),
    "body-toad": (1536, 1536),
    "recovery-slug": (1536, 1536),
    "resources-penguin": (1536, 1536),
    "shadow": (1254, 1254),
}
CHANNEL_INDEX = {"skin": 0, "hair": 1, "eyes": 2}
APPROVAL_IDS = (
    "male-v1:core:idle", "female-f2-v1:core:idle",
    "male-v1:core:window-back", "female-f2-v1:core:window-back",
    "male-v1:body-toad:greet-contact", "female-f2-v1:body-toad:greet-contact",
    "male-v1:recovery-slug:breathe-in", "female-f2-v1:recovery-slug:breathe-in",
    "male-v1:resources-penguin:greet-contact", "female-f2-v1:resources-penguin:greet-contact",
    "male-v1:shadow:attune-guardian", "female-f2-v1:shadow:attune-guardian",
)


@dataclass(frozen=True)
class Validation:
    passed: bool
    errors: tuple[str, ...]
    facts: dict[str, object]

    def payload(self) -> dict[str, object]:
        return {
            "passed": self.passed,
            "errors": list(self.errors),
            "facts": self.facts,
        }


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> dict[str, object]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected JSON object: {path}")
    return value


def load_inventory(path: Path = INVENTORY_PATH) -> dict[str, object]:
    return read_json(path)


def load_contract(path: Path = CONTRACT_PATH) -> dict[str, object]:
    return read_json(path)


def load_palette_catalog(path: Path = PALETTE_CATALOG_PATH) -> dict[str, object]:
    return read_json(path)


def validate_contract(
    contract: dict[str, object] | None = None,
    *,
    factory_root: Path = ROOT,
) -> Validation:
    payload = contract or load_contract(factory_root / "palette-contract.json")
    errors: list[str] = []
    if payload.get("schema") != CONTRACT_SCHEMA:
        errors.append("palette contract schema mismatch")
    if payload.get("id") != "traveller-appearance-v2" or payload.get("status") != "factory-only":
        errors.append("palette contract identity/status mismatch")
    expected_mask = {
        "format": "PNG",
        "mode": "RGB",
        "sameCanvasAsBase": True,
        "channels": {"red": "skin", "green": "hair", "blue": "eyes"},
        "coverage": {"minimum": 0, "maximum": 255, "sumMaximum": 255},
        "nonSemanticPixel": [0, 0, 0],
    }
    if payload.get("mask") != expected_mask:
        errors.append("packed RGB mask contract mismatch")
    if payload.get("routes") != {
        "publicMaskRoot": PUBLIC_MASK_ROOT,
        "factoryMaskRoot": "palette-masks-v1/",
        "factoryMatteRoot": "traveller-mattes-v1/",
    }:
        errors.append("immutable semantic mask route contract mismatch")
    if payload.get("palette") != {
        "catalogFile": "palette-catalog.json",
        "catalogSchema": PALETTE_CATALOG_SCHEMA,
        "algorithm": "oklab-paper-preserving-v1",
        "goldenVectorsFile": "palette-golden-vectors.json",
        "goldenVectorsSchema": "satoru.traveller-semantic-palette-golden-vectors/1",
    }:
        errors.append("palette catalog/golden-vector route contract mismatch")
    matte = payload.get("matte") if isinstance(payload.get("matte"), dict) else {}
    if matte != {
        "factoryOnly": True,
        "format": "PNG",
        "mode": "L",
        "sameCanvasAsBase": True,
        "meaning": "Traveller-only coverage; excludes guardians, Shadow, furniture and scene props",
    }:
        errors.append("Traveller matte contract mismatch")
    slots = payload.get("slots") if isinstance(payload.get("slots"), dict) else {}
    if set(slots) != {"skin", "hair", "eyes"} or any(not isinstance(value, str) or not value for value in slots.values()):
        errors.append("semantic slot definitions mismatch")
    invariants = payload.get("invariants") if isinstance(payload.get("invariants"), list) else []
    required_phrases = (
        "default palette returns the original base asset without pixel processing",
        "base alpha is copied pixel-for-pixel",
        "RGB outside the semantic channel union is copied pixel-for-pixel",
        "semantic coverage is a subset of the approved Traveller matte",
        "all mattes and masks contain coverage; skin and hair are always non-empty; eyes are empty only for an explicitly declared back view",
        "mask and matte PNGs contain no ICC, gAMA, sRGB, cHRM or transparency metadata",
        "an incomplete or missing mask fails closed and cannot authorize runtime options",
    )
    if tuple(invariants) != required_phrases:
        errors.append("palette invariants mismatch")
    return Validation(
        not errors,
        tuple(errors),
        {"channels": 3, "maskMode": "RGB", "matteMode": "L", "sumMaximum": 255},
    )


def validate_palette_catalog(
    catalog: dict[str, object] | None = None,
    *,
    factory_root: Path = ROOT,
) -> Validation:
    payload = catalog or load_palette_catalog(factory_root / "palette-catalog.json")
    errors: list[str] = []
    if payload.get("schema") != PALETTE_CATALOG_SCHEMA:
        errors.append("palette catalog schema mismatch")
    if (
        payload.get("id") != "traveller-palette-catalog-v1"
        or payload.get("status") != "authored-factory-contract"
        or payload.get("colourSpace") != "OKLab"
        or payload.get("inputEncoding") != "unmanaged-sRGB-8"
    ):
        errors.append("palette catalog identity/colour-space mismatch")
    identity = payload.get("identityOption") if isinstance(payload.get("identityOption"), dict) else {}
    if identity.get("id") != "original" or identity.get("mode") != "identity":
        errors.append("palette identity option mismatch")
    algorithm = payload.get("algorithm") if isinstance(payload.get("algorithm"), dict) else {}
    if algorithm.get("id") != "oklab-paper-preserving-v1":
        errors.append("palette algorithm revision mismatch")
    for key in ("linearSrgbToLms", "lmsRootToOklab", "oklabToLmsRoot", "lmsToLinearSrgb"):
        matrix = np.asarray(algorithm.get(key, []), dtype=np.float64)
        if matrix.shape != (3, 3) or not np.all(np.isfinite(matrix)):
            errors.append(f"palette algorithm {key} must be a finite 3x3 matrix")
    if algorithm.get("paperResidual") != {"lightness": 0.92, "chromaA": 0.35, "chromaB": 0.35}:
        errors.append("paper residual contract mismatch")
    if algorithm.get("linearClip") != [0.0, 1.0] or algorithm.get("byteRounding") != "floor(value * 255 + 0.5)":
        errors.append("palette clipping/byte-rounding contract mismatch")
    transfer = algorithm.get("srgbTransfer") if isinstance(algorithm.get("srgbTransfer"), dict) else {}
    required_transfer = {
        "decodeThreshold", "decodeDivisor", "decodeOffset", "decodeScale", "decodeExponent",
        "encodeThreshold", "encodeMultiplier", "encodeOffset", "encodeScale", "encodeExponent",
    }
    if set(transfer) != required_transfer or any(not isinstance(transfer[key], (int, float)) for key in transfer):
        errors.append("sRGB transfer contract mismatch")

    ramps = payload.get("ramps") if isinstance(payload.get("ramps"), dict) else {}
    expected_counts = {"skin": 5, "hair": 7, "eyes": 5}
    ids: set[str] = set()
    entries_by_slot: dict[str, set[str]] = {}
    for slot, expected_count in expected_counts.items():
        entries = ramps.get(slot) if isinstance(ramps.get(slot), list) else []
        entries_by_slot[slot] = set()
        if len(entries) != expected_count:
            errors.append(f"{slot} ramp must contain {expected_count} authored targets")
        for entry in entries:
            if not isinstance(entry, dict):
                errors.append(f"{slot} ramp entry must be an object")
                continue
            target_id = entry.get("id")
            target_hex = entry.get("hex")
            stored_lab = entry.get("oklab")
            if not isinstance(target_id, str) or not target_id.startswith(f"{slot}-") or target_id in ids:
                errors.append(f"{slot} ramp contains an invalid/duplicate id")
                continue
            ids.add(target_id)
            entries_by_slot[slot].add(target_id)
            if not isinstance(target_hex, str) or len(target_hex) != 7 or not target_hex.startswith("#"):
                errors.append(f"{target_id}: invalid #RRGGBB target")
                continue
            try:
                srgb = np.array([int(target_hex[index:index + 2], 16) for index in (1, 3, 5)], dtype=np.float64) / 255.0
                threshold = float(transfer["decodeThreshold"])
                linear = np.where(
                    srgb <= threshold,
                    srgb / float(transfer["decodeDivisor"]),
                    ((srgb + float(transfer["decodeOffset"])) / float(transfer["decodeScale"]))
                    ** float(transfer["decodeExponent"]),
                )
                lms = np.asarray(algorithm["linearSrgbToLms"], dtype=np.float64) @ linear
                measured_lab = np.asarray(algorithm["lmsRootToOklab"], dtype=np.float64) @ np.cbrt(lms)
                declared_lab = np.asarray(stored_lab, dtype=np.float64)
                if declared_lab.shape != (3,) or not np.allclose(measured_lab, declared_lab, atol=1e-9, rtol=0):
                    errors.append(f"{target_id}: stored OKLab value differs from authored hex")
            except (KeyError, TypeError, ValueError, OverflowError):
                errors.append(f"{target_id}: unreadable target vector")
    diagnostics = payload.get("diagnosticTargets") if isinstance(payload.get("diagnosticTargets"), dict) else {}
    if set(diagnostics) != set(expected_counts) or any(
        diagnostics.get(slot) not in entries_by_slot.get(slot, set()) for slot in expected_counts
    ):
        errors.append("diagnostic targets must reference their own authored ramps")
    return Validation(
        not errors,
        tuple(errors),
        {"ramps": expected_counts, "targets": len(ids), "algorithm": algorithm.get("id")},
    )


def safe_relative(root: Path, value: object, *, suffix: str = ".png") -> Path:
    if not isinstance(value, str) or not value or Path(value).is_absolute():
        raise ValueError(f"unsafe relative path: {value!r}")
    candidate = (root / value).resolve()
    candidate.relative_to(root.resolve())
    if suffix and candidate.suffix.lower() != suffix:
        raise ValueError(f"expected {suffix} path: {value}")
    return candidate


def public_asset_path(repo_root: Path, route: object) -> Path:
    if not isinstance(route, str) or not route.startswith("/art/"):
        raise ValueError(f"unsafe public art route: {route!r}")
    pure = PurePosixPath(route)
    if ".." in pure.parts or pure.suffix.lower() != ".png":
        raise ValueError(f"unsafe public art route: {route}")
    path = (repo_root / "public" / Path(*pure.parts[1:])).resolve()
    path.relative_to((repo_root / "public" / "art").resolve())
    return path


def _expected_base_prefix(asset: dict[str, object]) -> str:
    variant = asset.get("variant")
    capability = asset.get("capability")
    female = variant == "female-f2-v1"
    if capability in {"core", "motion", "room"}:
        return (
            "/art/avatars/traveller-core-v1/female/f2-v1/"
            if female
            else "/art/avatars/traveller-core-v1/male/"
        )
    roots = {
        "body-toad": "/art/pets/body-toad-v1/pair-v4/",
        "recovery-slug": "/art/pets/recovery-slug-v1/",
        "resources-penguin": "/art/pets/resources-penguin-v1/pair-v1/",
        "shadow": "/art/companions/shadow-den-v1/pair-v1/",
    }
    prefix = roots.get(str(capability), "")
    return prefix


def _expected_base_route(variant: str, capability: str, frame: str) -> str:
    female = variant == "female-f2-v1"
    if capability in {"core", "motion", "room"}:
        folder = {"core": "poses", "motion": "motion-v3", "room": "room-actions-v4"}[capability]
        variant_root = "female/f2-v1" if female else "male"
        return f"/art/avatars/traveller-core-v1/{variant_root}/{folder}/{frame}.png"
    female_suffix = "/female/f2-v1" if female else ""
    if capability == "body-toad":
        return f"/art/pets/body-toad-v1/pair-v4{female_suffix}/{frame}.png"
    if capability == "resources-penguin":
        return f"/art/pets/resources-penguin-v1/pair-v1{female_suffix}/{frame}.png"
    if capability == "shadow":
        return f"/art/companions/shadow-den-v1/pair-v1{female_suffix}/{frame}.png"
    if capability == "recovery-slug":
        if frame == "stretch-soft-b":
            return f"/art/pets/recovery-slug-v1/pair-v3{female_suffix}/stretch-soft-b-v155.png"
        return f"/art/pets/recovery-slug-v1/pair-v2{female_suffix}/{frame}.png"
    raise ValueError(f"unknown capability: {capability}")


def measure_production_state(
    assets: Sequence[dict[str, object]],
    *,
    factory_root: Path = ROOT,
) -> dict[str, object]:
    produced_ids: list[str] = []
    partial_ids: list[str] = []
    expected_masks: set[Path] = set()
    expected_mattes: set[Path] = set()
    for asset in assets:
        asset_id = str(asset.get("id") or "unknown")
        try:
            mask_path = safe_relative(factory_root, asset.get("maskFile"))
            matte_path = safe_relative(factory_root, asset.get("matteFile"))
        except ValueError:
            continue
        expected_masks.add(mask_path)
        expected_mattes.add(matte_path)
        mask_exists = mask_path.is_file() and not mask_path.is_symlink()
        matte_exists = matte_path.is_file() and not matte_path.is_symlink()
        if mask_exists and matte_exists:
            produced_ids.append(asset_id)
        elif mask_exists or matte_exists:
            partial_ids.append(asset_id)
    mask_root = factory_root / "palette-masks-v1"
    matte_root = factory_root / "traveller-mattes-v1"
    actual_masks = set(mask_root.rglob("*.png")) if mask_root.is_dir() else set()
    actual_mattes = set(matte_root.rglob("*.png")) if matte_root.is_dir() else set()
    return {
        "producedMasks": len(produced_ids),
        "producedAssetIds": produced_ids,
        "partialAssetIds": partial_ids,
        "orphanMaskFiles": sorted(str(path.relative_to(factory_root)) for path in actual_masks - expected_masks),
        "orphanMatteFiles": sorted(str(path.relative_to(factory_root)) for path in actual_mattes - expected_mattes),
    }


def production_status(produced: int, required: int) -> str:
    if produced <= 0:
        return "manual-mask-production-pending"
    if produced < required:
        return "manual-mask-production-in-progress"
    return "manual-mask-production-complete"


def approval_status(produced: int, required: int) -> str:
    if produced <= 0:
        return "manual-masks-missing"
    if produced < required:
        return "manual-masks-in-progress"
    return "manual-masks-complete"


def validate_inventory(
    inventory: dict[str, object] | None = None,
    *,
    repo_root: Path = REPO_ROOT,
    factory_root: Path = ROOT,
) -> Validation:
    payload = inventory or load_inventory(factory_root / "inventory.json")
    errors: list[str] = []
    try:
        contract = validate_contract(factory_root=factory_root)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        contract = Validation(False, (f"unreadable palette contract: {exc}",), {})
    errors.extend(contract.errors)
    try:
        palette = validate_palette_catalog(factory_root=factory_root)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        palette = Validation(False, (f"unreadable palette catalog: {exc}",), {})
    errors.extend(palette.errors)
    if payload.get("schema") != INVENTORY_SCHEMA:
        errors.append("inventory schema mismatch")
    if payload.get("runtimeEligible") is not False or payload.get("publicArtWrites") is not False:
        errors.append("factory inventory must be runtime-ineligible and forbid public writes")
    if payload.get("variantOrder") != list(VARIANTS):
        errors.append("variant order mismatch")
    if payload.get("variants") != {
        "male-v1": {"gender": "male", "morphologyRevision": "male-v1"},
        "female-f2-v1": {
            "gender": "female",
            "morphologyRevision": "f2-v1",
            "identitySha256": "5d811618fc851eec48eb910c7efc98eec46e23a94919b376d3c64f5ae24d62da",
        },
    }:
        errors.append("variant identity contract mismatch")
    channels = payload.get("channels") if isinstance(payload.get("channels"), dict) else {}
    if channels != {
        "red": "skin",
        "green": "hair",
        "blue": "eyes",
        "encoding": "linear-coverage-0-255",
        "constraint": "red + green + blue <= 255",
    }:
        errors.append("packed RGB channel contract mismatch")
    assets = payload.get("assets") if isinstance(payload.get("assets"), list) else []
    if len(assets) != 92:
        errors.append(f"inventory must contain 92 base assets, got {len(assets)}")

    ids: list[str] = []
    bases: list[str] = []
    masks: list[str] = []
    frame_variants: dict[tuple[str, str], set[str]] = defaultdict(set)
    capability_counts: Counter[tuple[str, str]] = Counter()
    verified_bases = 0
    for index, raw in enumerate(assets):
        label = f"asset[{index}]"
        if not isinstance(raw, dict):
            errors.append(f"{label}: expected object")
            continue
        asset = raw
        asset_id = asset.get("id")
        variant = asset.get("variant")
        capability = asset.get("capability")
        frame = asset.get("frame")
        if not all(isinstance(value, str) and value for value in (asset_id, variant, capability, frame)):
            errors.append(f"{label}: invalid id/variant/capability/frame")
            continue
        expected_id = f"{variant}:{capability}:{frame}"
        if asset_id != expected_id:
            errors.append(f"{label}: id must equal {expected_id}")
        ids.append(asset_id)
        if variant not in VARIANTS:
            errors.append(f"{asset_id}: unknown variant")
        expected_gender = "female" if variant == "female-f2-v1" else "male"
        if asset.get("gender") != expected_gender:
            errors.append(f"{asset_id}: gender/variant mismatch")
        if capability not in CAPABILITY_COUNTS:
            errors.append(f"{asset_id}: unknown capability")
            continue
        if frame not in CAPABILITY_FRAMES[capability]:
            errors.append(f"{asset_id}: frame is outside exact active inventory")
        expected_empty = asset.get("expectedEmptyChannels", [])
        if not isinstance(expected_empty, list) or any(value not in CHANNEL_INDEX for value in expected_empty):
            errors.append(f"{asset_id}: invalid expectedEmptyChannels")
        elif expected_empty and not (
            capability == "core" and frame == "window-back" and expected_empty == ["eyes"]
        ):
            errors.append(f"{asset_id}: only the back-view eye channel may be declared empty")
        elif capability == "core" and frame == "window-back" and expected_empty != ["eyes"]:
            errors.append(f"{asset_id}: back view must explicitly declare its empty eye channel")
        expected_canvas = CAPABILITY_CANVASES[capability]
        if asset.get("canvas") != list(expected_canvas):
            errors.append(f"{asset_id}: canvas contract mismatch")
        capability_counts[(variant, capability)] += 1
        frame_variants[(capability, frame)].add(variant)

        base_route = asset.get("baseRoute")
        mask_route = asset.get("maskRoute")
        if not isinstance(base_route, str) or not base_route.startswith(_expected_base_prefix(asset)):
            errors.append(f"{asset_id}: base route is outside its authored family")
            continue
        if base_route != _expected_base_route(variant, capability, frame):
            errors.append(f"{asset_id}: base route differs from exact active runtime route")
        if variant == "female-f2-v1" and "/female/f2-v1/" not in base_route:
            errors.append(f"{asset_id}: female route lacks immutable F2 revision")
        if variant == "male-v1" and "/female/" in base_route:
            errors.append(f"{asset_id}: male route crosses into female art")
        expected_mask_route = (
            f"{PUBLIC_MASK_ROOT}{variant}/{capability}/{PurePosixPath(base_route).name}"
        )
        if mask_route != expected_mask_route:
            errors.append(f"{asset_id}: mask route mismatch")
        else:
            masks.append(mask_route)
        bases.append(base_route)
        expected_mask_file = mask_route.removeprefix(
            "/art/avatars/traveller-appearance-v2/"
        ) if isinstance(mask_route, str) else None
        if asset.get("maskFile") != expected_mask_file:
            errors.append(f"{asset_id}: factory mask/public mask mapping mismatch")
        expected_matte_file = (
            expected_mask_file.replace("palette-masks-v1/", "traveller-mattes-v1/", 1)
            if expected_mask_file else None
        )
        if asset.get("matteFile") != expected_matte_file:
            errors.append(f"{asset_id}: factory matte/mask mapping mismatch")
        try:
            safe_relative(factory_root, asset.get("maskFile"))
            safe_relative(factory_root, asset.get("matteFile"))
            base_path = public_asset_path(repo_root, base_route)
        except ValueError as exc:
            errors.append(f"{asset_id}: {exc}")
            continue
        if not base_path.is_file() or base_path.is_symlink():
            errors.append(f"{asset_id}: missing or symlinked base PNG")
            continue
        expected_sha = asset.get("baseSha256")
        if not isinstance(expected_sha, str) or len(expected_sha) != 64 or sha256_file(base_path) != expected_sha:
            errors.append(f"{asset_id}: pinned base SHA mismatch")
            continue
        try:
            with Image.open(base_path) as opened:
                opened.load()
                image = opened.convert("RGBA")
                if opened.format != "PNG" or opened.mode != "RGBA":
                    errors.append(f"{asset_id}: base must be PNG RGBA")
                if image.size != expected_canvas:
                    errors.append(f"{asset_id}: base canvas mismatch")
                corners = ((0, 0), (image.width - 1, 0), (0, image.height - 1), (image.width - 1, image.height - 1))
                if any(image.getpixel(point)[3] != 0 for point in corners):
                    errors.append(f"{asset_id}: base corners must be transparent")
        except OSError as exc:
            errors.append(f"{asset_id}: unreadable base PNG: {exc}")
            continue
        verified_bases += 1

    if len(set(ids)) != len(ids):
        errors.append("duplicate inventory ids")
    if len(set(bases)) != len(bases):
        errors.append("duplicate base routes")
    if len(set(masks)) != len(masks):
        errors.append("duplicate mask routes")
    if len(frame_variants) != 46 or any(value != set(VARIANTS) for value in frame_variants.values()):
        errors.append("every one of the 46 frame keys must contain both variants")
    expected_frame_keys = {
        (capability, frame)
        for capability, frames in CAPABILITY_FRAMES.items()
        for frame in frames
    }
    if set(frame_variants) != expected_frame_keys:
        errors.append("inventory frame keys differ from the exact active 46-frame set")
    for variant in VARIANTS:
        for capability, expected in CAPABILITY_COUNTS.items():
            actual = capability_counts[(variant, capability)]
            if actual != expected:
                errors.append(f"{variant}/{capability}: expected {expected}, got {actual}")

    counts = payload.get("counts") if isinstance(payload.get("counts"), dict) else {}
    exact_static_counts = {
        "frameKeys": 46,
        "variants": 2,
        "baseAssets": 92,
        "requiredMasks": 92,
        "approvalBaseAssets": 12,
    }
    if any(counts.get(key) != value for key, value in exact_static_counts.items()) or set(counts) != {
        *exact_static_counts,
        "producedMasks",
    }:
        errors.append("declared inventory counts mismatch")
    approval = payload.get("approvalBatch") if isinstance(payload.get("approvalBatch"), dict) else {}
    approval_ids = approval.get("assetVariantIds") if isinstance(approval.get("assetVariantIds"), list) else []
    if approval.get("id") != "semantic-mask-approval-01" or tuple(approval_ids) != APPROVAL_IDS:
        errors.append("approval batch must contain the audited 12 variants")
    if len(set(approval_ids)) != len(approval_ids) or any(value not in set(ids) for value in approval_ids):
        errors.append("approval batch contains duplicate or unknown assets")

    production = measure_production_state(
        [item for item in assets if isinstance(item, dict)],
        factory_root=factory_root,
    )
    measured_produced = int(production["producedMasks"])
    if counts.get("producedMasks") != measured_produced:
        errors.append(
            f"declared producedMasks={counts.get('producedMasks')!r} differs from measured pairs={measured_produced}"
        )
    expected_status = production_status(measured_produced, 92)
    if payload.get("status") != expected_status:
        errors.append(f"inventory status must transition to {expected_status}")
    approval_produced = sum(value in set(production["producedAssetIds"]) for value in approval_ids)
    expected_approval_status = approval_status(approval_produced, 12)
    if approval.get("status") != expected_approval_status:
        errors.append(f"approval batch status must transition to {expected_approval_status}")
    if production["partialAssetIds"]:
        errors.append("partial mask/matte pairs are forbidden: " + ", ".join(production["partialAssetIds"]))
    if production["orphanMaskFiles"] or production["orphanMatteFiles"]:
        errors.append("orphan mask/matte PNGs exist outside the exact inventory")

    return Validation(
        not errors,
        tuple(errors),
        {
            "assets": len(assets),
            "frameKeys": len(frame_variants),
            "verifiedBaseAssets": verified_bases,
            "approvalAssets": len(approval_ids),
            "paletteContractPassed": contract.passed,
            "paletteCatalogPassed": palette.passed,
            "producedMasks": measured_produced,
            "productionStatus": expected_status,
            "approvalProducedMasks": approval_produced,
            "approvalStatus": expected_approval_status,
            "partialAssetIds": production["partialAssetIds"],
            "orphanMaskFiles": production["orphanMaskFiles"],
            "orphanMatteFiles": production["orphanMatteFiles"],
            "capabilityCountsPerVariant": CAPABILITY_COUNTS,
        },
    )


def asset_map(inventory: dict[str, object] | None = None) -> dict[str, dict[str, object]]:
    payload = inventory or load_inventory()
    assets = payload.get("assets") if isinstance(payload.get("assets"), list) else []
    return {
        str(item["id"]): item
        for item in assets
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }


def scoped_assets(
    scope: str,
    inventory: dict[str, object] | None = None,
) -> list[dict[str, object]]:
    payload = inventory or load_inventory()
    assets = asset_map(payload)
    if scope == "all":
        return [item for item in payload.get("assets", []) if isinstance(item, dict)]
    if scope != "approval":
        raise ValueError("scope must be 'approval' or 'all'")
    approval = payload.get("approvalBatch") if isinstance(payload.get("approvalBatch"), dict) else {}
    ids = approval.get("assetVariantIds") if isinstance(approval.get("assetVariantIds"), list) else []
    return [assets[value] for value in ids if value in assets]


def validate_semantic_mask(
    asset: dict[str, object],
    *,
    repo_root: Path = REPO_ROOT,
    factory_root: Path = ROOT,
) -> Validation:
    asset_id = str(asset.get("id") or "unknown")
    errors: list[str] = []
    try:
        base_path = public_asset_path(repo_root, asset.get("baseRoute"))
        mask_path = safe_relative(factory_root, asset.get("maskFile"))
        matte_path = safe_relative(factory_root, asset.get("matteFile"))
    except ValueError as exc:
        return Validation(False, (str(exc),), {"asset": asset_id})
    missing = [
        label
        for label, path in (("base", base_path), ("mask", mask_path), ("matte", matte_path))
        if not path.is_file()
    ]
    if missing:
        return Validation(
            False,
            tuple(f"{asset_id}: missing manual {label}" for label in missing),
            {"asset": asset_id, "missing": missing},
        )
    if any(path.is_symlink() for path in (base_path, mask_path, matte_path)):
        return Validation(
            False,
            (f"{asset_id}: base, mask and matte must be regular non-symlinked files",),
            {"asset": asset_id},
        )
    expected_canvas = tuple(int(value) for value in asset.get("canvas", ()))
    try:
        with Image.open(base_path) as opened:
            opened.load()
            base_mode = opened.mode
            base_format = opened.format
            base = opened.convert("RGBA")
        with Image.open(mask_path) as opened:
            opened.load()
            mask_mode = opened.mode
            mask_format = opened.format
            mask_info = dict(opened.info)
            mask = opened.copy()
        with Image.open(matte_path) as opened:
            opened.load()
            matte_mode = opened.mode
            matte_format = opened.format
            matte_info = dict(opened.info)
            matte = opened.copy()
    except OSError as exc:
        return Validation(False, (f"{asset_id}: unreadable PNG: {exc}",), {"asset": asset_id})
    if base_format != "PNG" or base_mode != "RGBA":
        errors.append(f"{asset_id}: base must remain PNG RGBA")
    actual_base_sha = sha256_file(base_path)
    if actual_base_sha != asset.get("baseSha256"):
        errors.append(f"{asset_id}: pinned base SHA mismatch")
    if mask_format != "PNG" or mask_mode != "RGB":
        errors.append(f"{asset_id}: semantic mask must be PNG RGB")
    if matte_format != "PNG" or matte_mode != "L":
        errors.append(f"{asset_id}: Traveller matte must be PNG L")
    if base.size != expected_canvas or mask.size != expected_canvas or matte.size != expected_canvas:
        errors.append(f"{asset_id}: base/mask/matte canvas mismatch")
    forbidden_metadata = {
        "icc_profile", "transparency", "gamma", "gama", "srgb",
        "chromaticity", "chrm",
    }
    if forbidden_metadata.intersection(key.lower() for key in mask_info):
        errors.append(f"{asset_id}: mask must not carry colour-management/transparency metadata")
    if forbidden_metadata.intersection(key.lower() for key in matte_info):
        errors.append(f"{asset_id}: matte must not carry colour-management/transparency metadata")
    if errors:
        return Validation(False, tuple(errors), {"asset": asset_id})

    base_rgba = np.asarray(base, dtype=np.uint8)
    semantic = np.asarray(mask, dtype=np.uint8)
    traveller = np.asarray(matte, dtype=np.uint8)
    alpha = base_rgba[..., 3]
    channel_sum = semantic.astype(np.uint16).sum(axis=2)
    union = semantic.max(axis=2)
    if not np.any(traveller > 0):
        errors.append(f"{asset_id}: Traveller matte is all black")
    if not np.any(union > 0):
        errors.append(f"{asset_id}: semantic mask is all black")
    if np.any(channel_sum > 255):
        errors.append(f"{asset_id}: red + green + blue exceeds 255")
    if np.any((union > 0) & (traveller == 0)):
        errors.append(f"{asset_id}: semantic coverage escapes Traveller matte")
    if np.any(union > traveller):
        errors.append(f"{asset_id}: semantic coverage exceeds Traveller matte coverage")
    if np.any(traveller > alpha):
        errors.append(f"{asset_id}: Traveller matte exceeds base alpha coverage")
    if np.any((union > 0) & (alpha == 0)):
        errors.append(f"{asset_id}: semantic coverage exists on transparent base pixels")
    channel_pixels = {
        "skin": int(np.count_nonzero(semantic[..., 0])),
        "hair": int(np.count_nonzero(semantic[..., 1])),
        "eyes": int(np.count_nonzero(semantic[..., 2])),
    }
    expected_empty = asset.get("expectedEmptyChannels", [])
    for channel, pixel_count in channel_pixels.items():
        if channel in expected_empty and pixel_count != 0:
            errors.append(f"{asset_id}: expected-empty {channel} channel contains coverage")
        elif channel not in expected_empty and pixel_count == 0:
            errors.append(f"{asset_id}: required {channel} channel is empty")
    return Validation(
        not errors,
        tuple(errors),
        {
            "asset": asset_id,
            "canvas": list(expected_canvas),
            "baseSha256": actual_base_sha,
            "maskSha256": sha256_file(mask_path),
            "matteSha256": sha256_file(matte_path),
            "travellerPixels": int(np.count_nonzero(traveller)),
            "semanticPixels": int(np.count_nonzero(union)),
            "channelPixels": channel_pixels,
            "maximumChannelSum": int(channel_sum.max(initial=0)),
        },
    )


def validate_mask_set(
    assets: Sequence[dict[str, object]],
    *,
    repo_root: Path = REPO_ROOT,
    factory_root: Path = ROOT,
    results: Sequence[Validation] | None = None,
) -> Validation:
    measured = list(results) if results is not None else [
        validate_semantic_mask(asset, repo_root=repo_root, factory_root=factory_root)
        for asset in assets
    ]
    errors = tuple(error for result in measured for error in result.errors)
    missing = sum(bool(result.facts.get("missing")) for result in measured)
    return Validation(
        not errors and len(measured) == len(assets),
        errors,
        {
            "required": len(assets),
            "passed": sum(result.passed for result in measured),
            "missing": missing,
            "frames": [result.payload() for result in measured],
        },
    )


def candidate_manifest(
    inventory: dict[str, object],
    results: Iterable[Validation],
) -> dict[str, object]:
    assets = [item for item in inventory.get("assets", []) if isinstance(item, dict)]
    measured = {str(result.facts.get("asset")): result for result in results}
    if len(assets) != 92 or any(not measured.get(str(asset.get("id")), Validation(False, (), {})).passed for asset in assets):
        raise ValueError("all 92 masks must pass before a runtime manifest candidate exists")
    return {
        "schema": "satoru.traveller-semantic-mask-runtime-candidate/1",
        "id": "traveller-appearance-v2",
        "status": "factory-candidate-manual-runtime-review-required",
        "runtimeEligible": False,
        "assets": [
            {
                "id": asset["id"],
                "baseRoute": asset["baseRoute"],
                "baseSha256": asset["baseSha256"],
                "maskRoute": asset["maskRoute"],
                "maskSha256": measured[str(asset["id"])].facts["maskSha256"],
                "canvas": asset["canvas"],
            }
            for asset in assets
        ],
    }
