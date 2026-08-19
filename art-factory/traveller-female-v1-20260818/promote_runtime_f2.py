#!/usr/bin/env python3
"""Fail-closed, deterministic promotion gate for the approved Traveller F2 pack.

``--dry-run`` and ``--verify`` are read-only. ``--promote`` requires the
explicit Resources approval switch and only creates immutable female/f2-v1
trees after every contract, identity, batch-QA, and PNG check passes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from collections import Counter, OrderedDict, defaultdict
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Sequence

from PIL import Image


IDENTITY_ID = "female-f2-high-ponytail"
IDENTITY_SHA256 = "5d811618fc851eec48eb910c7efc98eec46e23a94919b376d3c64f5ae24d62da"
IDENTITY_PATH = "sources/identity-variants-04/candidate-f2-high-ponytail-keyed.png"
IDENTITY_STATUS = "identity-approved/runtime-not-yet"
REVISION = "f2-v1"
CAPABILITY_KEYS = (
    "core", "motion", "room", "bodyToad", "recoverySlug",
    "resourcesPenguin", "shadow",
)
RUNTIME_MANIFEST_SCHEMA = "satoru.traveller-runtime-asset-manifest/1"
PLAN_SCHEMA = "satoru.traveller-f2-runtime-promotion-plan/1"


@dataclass(frozen=True)
class AssetSpec:
    capability: str
    route: str
    canvas: tuple[int, int]
    batch_kind: str
    batch: str
    frame: str

    @property
    def output_group(self) -> str:
        return "approval-batches" if self.batch_kind == "core" else "contact-approval-batches"


@dataclass(frozen=True)
class MaterializedAsset:
    spec: AssetSpec
    source: Path
    sha256: str


def specs(
    capability: str,
    root: str,
    canvas: tuple[int, int],
    batch_kind: str,
    batch: str,
    names: Sequence[str],
    targets: Sequence[str] | None = None,
) -> tuple[AssetSpec, ...]:
    targets = tuple(targets or names)
    if len(names) != len(targets):
        raise ValueError(f"{batch}: source/target length mismatch")
    return tuple(
        AssetSpec(capability, f"{root}/{target}.png", canvas, batch_kind, batch, name)
        for name, target in zip(names, targets)
    )


# Exact order exported by public/traveller-appearance-v1.js expectedAssets('female').
ASSET_SPECS: tuple[AssetSpec, ...] = (
    *specs("core", "/art/avatars/traveller-core-v1/female/f2-v1/poses", (640, 900), "core", "female-core-f2-01", ("idle",)),
    *specs("core", "/art/avatars/traveller-core-v1/female/f2-v1/poses", (640, 900), "core", "female-poses-f2-01", ("arms-up",)),
    *specs("core", "/art/avatars/traveller-core-v1/female/f2-v1/poses", (640, 900), "core", "female-poses-f2-full-01", ("seated",)),
    *specs("core", "/art/avatars/traveller-core-v1/female/f2-v1/poses", (640, 900), "core", "female-core-f2-01", ("window-back",)),
    *specs("motion", "/art/avatars/traveller-core-v1/female/f2-v1/motion-v3", (640, 900), "core", "female-core-f2-01", ("idle-blink", "walk-a", "walk-b")),
    *specs("room", "/art/avatars/traveller-core-v1/female/f2-v1/room-actions-v4", (640, 900), "core", "female-room-f2-full-01", ("bench-rest",)),
    *specs("room", "/art/avatars/traveller-core-v1/female/f2-v1/room-actions-v4", (640, 900), "core", "female-room-f2-01", ("bench-read-a",)),
    *specs("room", "/art/avatars/traveller-core-v1/female/f2-v1/room-actions-v4", (640, 900), "core", "female-room-f2-full-01", ("bench-read-b", "bench-portal-reach")),
    *specs(
        "bodyToad", "/art/pets/body-toad-v1/pair-v4/female/f2-v1", (1536, 1536),
        "contact", "female-gamabunta-f2-full-01",
        ("greet-contact", "train-low", "train-high", "whistle-a", "whistle-b", "whistle-c", "whistle-d", "pushup-down", "pushup-up", "stretch-a", "stretch-b", "rest-contact", "rest-pet"),
    ),
    *specs(
        "recoverySlug", "/art/pets/recovery-slug-v1/pair-v2/female/f2-v1", (1536, 1536),
        "contact", "female-recovery-f2-full-01",
        ("greet-contact", "breathe-in", "breathe-out", "restore-contact", "stretch-a"),
    ),
    *specs(
        "recoverySlug", "/art/pets/recovery-slug-v1/pair-v3/female/f2-v1", (1536, 1536),
        "contact", "female-recovery-f2-full-01", ("stretch-soft-b",), ("stretch-soft-b-v155",),
    ),
    *specs(
        "resourcesPenguin", "/art/pets/resources-penguin-v1/pair-v1/female/f2-v1", (1536, 1536),
        "contact", "female-resources-f2-full-01",
        ("greet-contact", "budget-point", "budget-reserve", "count-pass", "count-place", "count-stack", "reserve-offer", "reserve-accept", "focus-work", "focus-check", "focus-nod", "close-stamp"),
    ),
    *specs(
        "shadow", "/art/companions/shadow-den-v1/pair-v1/female/f2-v1", (1254, 1254),
        "contact", "female-shadow-f2-full-01",
        ("attune-spark", "attune-spirit", "attune-guardian", "attune-keeper"),
    ),
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path, errors: list[str], label: str) -> dict | None:
    if not path.is_file():
        errors.append(f"{label}: missing: {path}")
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"{label}: invalid JSON: {path}: {exc}")
        return None
    if not isinstance(value, dict):
        errors.append(f"{label}: expected JSON object: {path}")
        return None
    return value


def inspect_png(path: Path, canvas: tuple[int, int], errors: list[str], label: str) -> None:
    if not path.is_file():
        errors.append(f"{label}: missing PNG: {path}")
        return
    if path.is_symlink():
        errors.append(f"{label}: symlink is forbidden: {path}")
        return
    try:
        with Image.open(path) as image:
            image.load()
            if image.format != "PNG":
                errors.append(f"{label}: format must be PNG, got {image.format}")
            if image.mode != "RGBA":
                errors.append(f"{label}: mode must be RGBA, got {image.mode}")
            if image.size != canvas:
                errors.append(f"{label}: canvas must be {canvas}, got {image.size}")
    except (OSError, ValueError) as exc:
        errors.append(f"{label}: unreadable PNG: {path}: {exc}")


def route_relative(route: str) -> Path:
    pure = PurePosixPath(route)
    if not route.startswith("/art/") or ".." in pure.parts or pure.suffix.lower() != ".png":
        raise ValueError(f"unsafe runtime route: {route}")
    return Path(*pure.parts[1:])


def target_roots(spec_list: Sequence[AssetSpec] = ASSET_SPECS) -> tuple[str, ...]:
    roots: list[str] = []
    marker = f"/{REVISION}/"
    for spec in spec_list:
        if marker not in spec.route:
            raise ValueError(f"route lacks immutable revision: {spec.route}")
        root = spec.route.split(marker, 1)[0] + f"/{REVISION}"
        if root not in roots:
            roots.append(root)
    return tuple(roots)


def grouped_specs(spec_list: Sequence[AssetSpec] = ASSET_SPECS) -> OrderedDict[tuple[str, str], list[AssetSpec]]:
    grouped: OrderedDict[tuple[str, str], list[AssetSpec]] = OrderedDict()
    for spec in spec_list:
        grouped.setdefault((spec.batch_kind, spec.batch), []).append(spec)
    return grouped


def validate_static_contract(repo_root: Path, errors: list[str]) -> None:
    routes = [spec.route for spec in ASSET_SPECS]
    sources = [(spec.output_group, spec.batch, spec.frame) for spec in ASSET_SPECS]
    if len(ASSET_SPECS) != 46:
        errors.append(f"promotion spec count must be 46, got {len(ASSET_SPECS)}")
    if len(set(routes)) != len(routes):
        errors.append("promotion specs contain duplicate routes")
    if len(set(sources)) != len(sources):
        errors.append("promotion specs contain duplicate source frames")
    if tuple(dict.fromkeys(spec.capability for spec in ASSET_SPECS)) != CAPABILITY_KEYS:
        errors.append("promotion capability order differs from contract")
    for spec in ASSET_SPECS:
        try:
            route_relative(spec.route)
        except ValueError as exc:
            errors.append(str(exc))
        if f"/female/{REVISION}/" not in spec.route or "/male/" in spec.route:
            errors.append(f"route is not immutable female F2: {spec.route}")

    contract = repo_root / "public/traveller-appearance-v1.js"
    if not contract.is_file():
        errors.append(f"TravellerAppearance contract missing: {contract}")
        return
    program = (
        "const a=require(process.argv[1]);process.stdout.write(JSON.stringify({"
        "assets:a.expectedAssets('female'),keys:a.CAPABILITY_KEYS,"
        "revision:a.FEMALE_F2_REVISION,sha:a.FEMALE_F2_IDENTITY_SHA256,"
        "validation:a.validateAssetManifest(a.ASSET_MANIFESTS.female)}));"
    )
    try:
        completed = subprocess.run(
            ["node", "-e", program, str(contract)], capture_output=True,
            text=True, timeout=20, check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        errors.append(f"TravellerAppearance contract could not execute: {exc}")
        return
    if completed.returncode:
        errors.append(f"TravellerAppearance contract failed: {completed.stderr.strip()}")
        return
    try:
        snapshot = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        errors.append(f"TravellerAppearance returned invalid JSON: {exc}")
        return
    if snapshot.get("assets") != routes:
        errors.append("promotion routes differ from TravellerAppearance expectedAssets('female')")
    if tuple(snapshot.get("keys") or ()) != CAPABILITY_KEYS:
        errors.append("promotion capabilities differ from TravellerAppearance")
    if snapshot.get("revision") != REVISION or snapshot.get("sha") != IDENTITY_SHA256:
        errors.append("promotion revision/identity differs from TravellerAppearance")
    validation = snapshot.get("validation") or {}
    if validation.get("ok") is not True or validation.get("totalAssets") != 46:
        errors.append(f"TravellerAppearance expectation is invalid: {validation}")


def validate_identity(factory_root: Path, errors: list[str]) -> None:
    record = read_json(factory_root / "APPROVED-IDENTITY.json", errors, "approved identity")
    if not record:
        return
    exact = {
        "schema": "satoru.traveller-female-approved-identity/1",
        "id": IDENTITY_ID,
        "morphology": "female",
        "status": IDENTITY_STATUS,
        "runtimeEligible": False,
        "source": {"path": IDENTITY_PATH, "sha256": IDENTITY_SHA256},
    }
    if record != exact:
        errors.append("APPROVED-IDENTITY.json does not exactly match the pinned F2 identity")
    source = factory_root / IDENTITY_PATH
    if not source.is_file():
        errors.append(f"approved identity source missing: {source}")
    elif sha256_file(source) != IDENTITY_SHA256:
        errors.append(f"approved identity source SHA mismatch: {source}")


def validate_inventory(factory_root: Path, errors: list[str]) -> None:
    inventory_path = factory_root / "PRODUCTION-INVENTORY-F2.json"
    # The production ledger is a planning artifact, not a promotion input.  Its
    # exact 46-frame inventory is pinned above and checked against the runtime
    # contract; when the ledger is retained in the factory, also detect drift.
    if not inventory_path.is_file():
        return
    inventory = read_json(inventory_path, errors, "production inventory")
    if not inventory:
        return
    identity = inventory.get("identity") if isinstance(inventory.get("identity"), dict) else {}
    counts = inventory.get("counts") if isinstance(inventory.get("counts"), dict) else {}
    if inventory.get("schema") != "satoru.traveller-female-production-ledger/2":
        errors.append("production inventory schema mismatch")
    if identity.get("file") != IDENTITY_PATH or identity.get("sha256") != IDENTITY_SHA256:
        errors.append("production inventory identity path/SHA mismatch")
    if identity.get("immutableForEveryFrame") is not True:
        errors.append("production inventory identity is not immutable")
    if counts.get("runtimeDeliverables") != 46:
        errors.append("production inventory runtimeDeliverables must equal 46")
    if counts.get("qaPassedDeliverables") != 46 or counts.get("manualReviewedDeliverables") != 46:
        errors.append("production inventory QA/manual review counts must both equal 46")
    gates = inventory.get("productionGates") if isinstance(inventory.get("productionGates"), dict) else {}
    if (
        gates.get("allBatchesQaPassed") is not True
        or gates.get("manualVisualReview") != "completed-by-parent"
        or gates.get("promotion") != "pending"
        or gates.get("publicArtWrites") is not False
    ):
        errors.append("production inventory gates are not promotion-ready")

    capability_family = {
        "core": "core", "motion": "core", "room": "room",
        "bodyToad": "gamabunta", "recoverySlug": "recovery",
        "resourcesPenguin": "resources", "shadow": "shadow",
    }
    expected: dict[str, list[str]] = defaultdict(list)
    for spec in ASSET_SPECS:
        expected[capability_family[spec.capability]].append(spec.frame)
    actual: dict[str, list[str]] = defaultdict(list)
    for batch in inventory.get("batches") or []:
        if not isinstance(batch, dict) or batch.get("family") not in expected:
            continue
        for frame in batch.get("frames") or []:
            if isinstance(frame, dict):
                actual[batch["family"]].append(frame.get("runtimeInteractionFrame") or frame.get("id"))
    for family, frame_ids in expected.items():
        if Counter(actual.get(family, [])) != Counter(frame_ids):
            errors.append(f"production inventory frame set differs for {family}")


def validate_batch(
    factory_root: Path,
    batch_kind: str,
    batch: str,
    batch_specs: Sequence[AssetSpec],
    errors: list[str],
) -> list[MaterializedAsset]:
    group = "approval-batches" if batch_kind == "core" else "contact-approval-batches"
    output_dir = factory_root / "outputs" / group / batch
    manifest = read_json(output_dir / "manifest.json", errors, f"{batch} manifest")
    qa = read_json(factory_root / "qa" / group / batch / "qa-report.json", errors, f"{batch} QA")
    if not manifest or not qa:
        return []
    manifest_schema = (
        "satoru.traveller-female-approval-batch/1" if batch_kind == "core"
        else "satoru.traveller-female-contact-approval-batch/1"
    )
    qa_schema = (
        "satoru.traveller-female-approval-qa/1" if batch_kind == "core"
        else "satoru.traveller-female-contact-qa/1"
    )
    if manifest.get("schema") != manifest_schema or manifest.get("id") != batch:
        errors.append(f"{batch}: manifest schema/id mismatch")
    if manifest.get("runtimeEligible") is not False or manifest.get("publicArtWrites") is not False:
        errors.append(f"{batch}: factory manifest must keep runtimeEligible/publicArtWrites false")
    exact_identity = {
        "id": IDENTITY_ID, "path": IDENTITY_PATH, "sha256": IDENTITY_SHA256,
        "status": IDENTITY_STATUS,
    }
    if manifest.get("approvedIdentity") != exact_identity:
        errors.append(f"{batch}: approvedIdentity mismatch")

    expected_frames = [spec.frame for spec in batch_specs]
    expected_canvas = batch_specs[0].canvas
    assets = manifest.get("assets") if isinstance(manifest.get("assets"), dict) else {}
    frames = manifest.get("frames") if isinstance(manifest.get("frames"), dict) else {}
    if manifest.get("canvas") != list(expected_canvas):
        errors.append(f"{batch}: manifest canvas mismatch")
    if set(assets) != set(expected_frames) or set(frames) != set(expected_frames):
        errors.append(f"{batch}: manifest does not contain the exact required frame set")
    if batch_kind == "contact" and manifest.get("requiredFrames") != expected_frames:
        errors.append(f"{batch}: requiredFrames order/content mismatch")

    if qa.get("schema") != qa_schema or qa.get("batch") != batch:
        errors.append(f"{batch}: QA schema/batch mismatch")
    if qa.get("passed") is not True or qa.get("automatedContractPassed") is not True:
        errors.append(f"{batch}: QA is not strict PASS")
    if qa.get("runtimeEligible") is not False:
        errors.append(f"{batch}: factory QA must keep runtimeEligible false")
    qa_frames = qa.get("frames") if isinstance(qa.get("frames"), dict) else {}
    if set(qa_frames) != set(expected_frames):
        errors.append(f"{batch}: QA frame set mismatch")
    expected_pngs = {f"{frame}.png" for frame in expected_frames}
    actual_pngs = {path.name for path in output_dir.glob("*.png") if path.is_file()}
    if actual_pngs != expected_pngs:
        errors.append(f"{batch}: output PNG set differs; expected={sorted(expected_pngs)} got={sorted(actual_pngs)}")

    materialized: list[MaterializedAsset] = []
    for spec in batch_specs:
        filename = f"{spec.frame}.png"
        if assets.get(spec.frame) != filename:
            errors.append(f"{batch}/{spec.frame}: manifest asset filename mismatch")
        frame = frames.get(spec.frame) if isinstance(frames.get(spec.frame), dict) else {}
        if frame.get("canvas") != list(spec.canvas) or (
            batch_kind == "core" and frame.get("mode") != "RGBA"
        ):
            errors.append(f"{batch}/{spec.frame}: manifest canvas/mode mismatch")
        qa_frame = qa_frames.get(spec.frame) if isinstance(qa_frames.get(spec.frame), dict) else {}
        checks = qa_frame.get("checks") if isinstance(qa_frame.get("checks"), dict) else {}
        if qa_frame.get("passed") is not True:
            errors.append(f"{batch}/{spec.frame}: frame QA is not PASS")
        if qa_frame.get("canvas") != list(spec.canvas) or qa_frame.get("mode") != "RGBA":
            errors.append(f"{batch}/{spec.frame}: QA canvas/mode mismatch")
        if not checks or not all(value is True for value in checks.values()):
            errors.append(f"{batch}/{spec.frame}: one or more QA checks are not true")
        source = output_dir / filename
        inspect_png(source, spec.canvas, errors, f"{batch}/{spec.frame}")
        if source.is_file() and not source.is_symlink():
            materialized.append(MaterializedAsset(spec, source, sha256_file(source)))
    return materialized


def preflight(repo_root: Path, factory_root: Path) -> tuple[list[MaterializedAsset], list[str]]:
    errors: list[str] = []
    validate_static_contract(repo_root, errors)
    validate_identity(factory_root, errors)
    validate_inventory(factory_root, errors)
    materialized: list[MaterializedAsset] = []
    for (kind, batch), batch_specs in grouped_specs().items():
        materialized.extend(validate_batch(factory_root, kind, batch, batch_specs, errors))
    if len(materialized) != 46:
        errors.append(f"materialized asset count must be 46, got {len(materialized)}")
    by_source = {
        (asset.spec.output_group, asset.spec.batch, asset.spec.frame): asset
        for asset in materialized
    }
    assets = [
        by_source[(spec.output_group, spec.batch, spec.frame)]
        for spec in ASSET_SPECS
        if (spec.output_group, spec.batch, spec.frame) in by_source
    ]
    hashes = [asset.sha256 for asset in assets]
    duplicate_hashes = sorted(sha for sha, count in Counter(hashes).items() if count > 1)
    if duplicate_hashes:
        errors.append(f"duplicate output PNG content SHA: {duplicate_hashes}")
    if len(by_source) != len(materialized) or [asset.spec.route for asset in assets] != [spec.route for spec in ASSET_SPECS]:
        errors.append("materialized assets are missing, duplicated, or out of contract order")
    return assets, errors


def make_runtime_manifest(assets: Sequence[MaterializedAsset]) -> dict:
    return {
        "schema": RUNTIME_MANIFEST_SCHEMA,
        "id": IDENTITY_ID,
        "revision": REVISION,
        "identitySha256": IDENTITY_SHA256,
        "status": "runtime-approved",
        "runtimeEligible": True,
        "capabilities": {key: True for key in CAPABILITY_KEYS},
        "assets": [
            {"path": asset.spec.route, "sha256": asset.sha256, "canvas": list(asset.spec.canvas)}
            for asset in assets
        ],
    }


def verify_tree(tree_root: Path, assets: Sequence[MaterializedAsset], label: str) -> list[str]:
    errors: list[str] = []
    manifest_path = tree_root / "art/avatars/traveller-core-v1/female/f2-v1/manifest.json"
    manifest = read_json(manifest_path, errors, f"{label} manifest")
    if manifest is not None and manifest != make_runtime_manifest(assets):
        errors.append(f"{label}: manifest differs from deterministic expected manifest")
    expected_files = {tree_root / route_relative(asset.spec.route) for asset in assets}
    expected_files.add(manifest_path)
    actual_files: set[Path] = set()
    for route in target_roots():
        root = tree_root / Path(*PurePosixPath(route).parts[1:])
        if not root.is_dir() or root.is_symlink():
            errors.append(f"{label}: immutable root missing or symlinked: {root}")
            continue
        actual_files.update(path for path in root.rglob("*") if path.is_file())
    if actual_files != expected_files:
        errors.append(
            f"{label}: file set differs; missing={sorted(map(str, expected_files - actual_files))}; "
            f"extra={sorted(map(str, actual_files - expected_files))}"
        )
    for asset in assets:
        path = tree_root / route_relative(asset.spec.route)
        inspect_png(path, asset.spec.canvas, errors, f"{label}:{asset.spec.route}")
        if path.is_file() and not path.is_symlink() and sha256_file(path) != asset.sha256:
            errors.append(f"{label}: SHA mismatch: {asset.spec.route}")
    return errors


def make_report(mode: str, assets: Sequence[MaterializedAsset], errors: Sequence[str], public_writes: bool) -> dict:
    ready = not errors
    return {
        "schema": PLAN_SCHEMA,
        "mode": mode,
        "ready": ready,
        "publicWrites": public_writes,
        "revision": REVISION,
        "identityId": IDENTITY_ID,
        "identitySha256": IDENTITY_SHA256,
        "assetCount": len(assets),
        "expectedAssetCount": 46,
        "capabilities": {key: ready for key in CAPABILITY_KEYS},
        "batches": [batch for _, batch in grouped_specs()],
        "targetRoots": list(target_roots()),
        "runtimeManifest": "/art/avatars/traveller-core-v1/female/f2-v1/manifest.json",
        "errors": list(errors),
    }


def dry_run(repo_root: Path, factory_root: Path, public_root: Path) -> dict:
    del public_root  # Deliberately prove dry-run cannot inspect or mutate public state.
    assets, errors = preflight(repo_root, factory_root)
    return make_report("dry-run", assets, errors, public_writes=False)


def verify(repo_root: Path, factory_root: Path, public_root: Path) -> dict:
    assets, errors = preflight(repo_root, factory_root)
    if not errors:
        errors.extend(verify_tree(public_root, assets, "public"))
    return make_report("verify", assets, errors, public_writes=False)


def mkdir_publish_parents(path: Path, stop: Path) -> list[Path]:
    missing: list[Path] = []
    cursor = path
    while cursor != stop and not cursor.exists():
        missing.append(cursor)
        cursor = cursor.parent
    if cursor != stop and not cursor.exists():
        raise RuntimeError(f"publish parent escapes public root: {path}")
    for directory in reversed(missing):
        directory.mkdir()
    return missing


def promote(
    repo_root: Path,
    factory_root: Path,
    public_root: Path,
    confirm_resources_pass: bool,
) -> dict:
    if not confirm_resources_pass:
        return make_report(
            "promote", (),
            ["promotion requires --confirm-resources-pass after Resources strict QA PASS"],
            public_writes=False,
        )
    assets, errors = preflight(repo_root, factory_root)
    if errors:
        return make_report("promote", assets, errors, public_writes=False)
    roots = target_roots()
    destinations = [public_root / Path(*PurePosixPath(root).parts[1:]) for root in roots]
    existing = [str(path) for path in destinations if path.exists() or path.is_symlink()]
    if existing:
        errors.append(f"immutable target exists; use --verify, never overwrite: {existing}")
        return make_report("promote", assets, errors, public_writes=False)

    public_root.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".traveller-f2-promotion-", dir=public_root.parent))
    published: list[tuple[Path, Path]] = []
    created_parents: list[Path] = []
    try:
        for asset in assets:
            target = stage / route_relative(asset.spec.route)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(asset.source, target)
        manifest = stage / "art/avatars/traveller-core-v1/female/f2-v1/manifest.json"
        manifest.parent.mkdir(parents=True, exist_ok=True)
        manifest.write_text(json.dumps(make_runtime_manifest(assets), indent=2) + "\n", encoding="utf-8")
        stage_errors = verify_tree(stage, assets, "stage")
        if stage_errors:
            return make_report("promote", assets, stage_errors, public_writes=False)

        for route, destination in zip(roots, destinations):
            source_root = stage / Path(*PurePosixPath(route).parts[1:])
            created_parents.extend(mkdir_publish_parents(destination.parent, public_root))
            os.replace(source_root, destination)
            published.append((destination, source_root))
        published_errors = verify_tree(public_root, assets, "public")
        if published_errors:
            raise RuntimeError("; ".join(published_errors))
    except Exception as exc:  # Exact, narrow rollback of roots created by this transaction.
        rollback_errors: list[str] = []
        for destination, source_root in reversed(published):
            try:
                source_root.parent.mkdir(parents=True, exist_ok=True)
                os.replace(destination, source_root)
            except OSError as rollback_exc:
                rollback_errors.append(f"rollback failed for {destination}: {rollback_exc}")
        for directory in created_parents:
            try:
                directory.rmdir()
            except OSError:
                pass
        errors.append(f"promotion transaction failed and was rolled back: {exc}")
        errors.extend(rollback_errors)
        return make_report("promote", assets, errors, public_writes=False)
    finally:
        shutil.rmtree(stage, ignore_errors=True)
    return make_report("promote", assets, (), public_writes=True)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--verify", action="store_true")
    mode.add_argument("--promote", action="store_true")
    parser.add_argument("--repo-root", type=Path)
    parser.add_argument("--confirm-resources-pass", action="store_true")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    repo_root = (args.repo_root or Path(__file__).resolve().parents[2]).resolve()
    factory_root = repo_root / "art-factory/traveller-female-v1-20260818"
    public_root = repo_root / "public"
    if args.dry_run:
        result = dry_run(repo_root, factory_root, public_root)
    elif args.verify:
        result = verify(repo_root, factory_root, public_root)
    else:
        result = promote(repo_root, factory_root, public_root, args.confirm_resources_pass)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["ready"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
