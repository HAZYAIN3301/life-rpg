#!/usr/bin/env python3
"""Build the deterministic runtime manifest after machine and manual gates pass."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from build_mask_inventory import atomic_json
from palette_parity import GOLDEN_PATH, validate_golden_vectors
from semantic_masks import (
    MANUAL_APPROVALS_PATH,
    ROOT,
    Validation,
    load_inventory,
    load_palette_catalog,
    read_json,
    safe_relative,
    scoped_assets,
    sha256_file,
    validate_inventory,
    validate_mask_set,
    validate_palette_catalog,
    validate_semantic_mask,
)


MANUAL_SCHEMA = "satoru.traveller-semantic-mask-manual-approvals/1"
RUNTIME_SCHEMA = "satoru.traveller-semantic-mask-runtime/1"


def validate_manual_gate(
    inventory: dict[str, object],
    results: list[Validation],
    gate: dict[str, object],
) -> Validation:
    errors: list[str] = []
    assets = [item for item in inventory.get("assets", []) if isinstance(item, dict)]
    measured = {str(result.facts.get("asset")): result for result in results}
    approvals = gate.get("assets") if isinstance(gate.get("assets"), list) else []
    if gate.get("schema") != MANUAL_SCHEMA:
        errors.append("manual approval schema mismatch")
    if gate.get("requiredAssets") != 92:
        errors.append("manual gate must declare 92 required assets")
    expected_status = "pending" if not approvals else "in-progress" if len(approvals) < 92 else "approved"
    if gate.get("status") != expected_status:
        errors.append(f"manual gate status must transition to {expected_status}")
    approval_ids: list[str] = []
    for index, approval in enumerate(approvals):
        if not isinstance(approval, dict):
            errors.append(f"manual approval[{index}] must be an object")
            continue
        asset_id = approval.get("id")
        approval_ids.append(str(asset_id))
        result = measured.get(str(asset_id))
        if approval.get("decision") != "approved":
            errors.append(f"{asset_id}: manual decision must be approved")
        if result is None or not result.passed:
            errors.append(f"{asset_id}: cannot approve an absent or machine-failing mask")
            continue
        for key in ("baseSha256", "maskSha256", "matteSha256"):
            if approval.get(key) != result.facts.get(key):
                errors.append(f"{asset_id}: manual approval {key} does not match validated pixels")
    expected_ids = [str(asset["id"]) for asset in assets]
    if len(set(approval_ids)) != len(approval_ids):
        errors.append("manual approvals contain duplicate ids")
    positions = {asset_id: index for index, asset_id in enumerate(expected_ids)}
    known_approval_ids = [asset_id for asset_id in approval_ids if asset_id in positions]
    if len(known_approval_ids) != len(approval_ids):
        errors.append("manual approvals contain ids outside the exact inventory")
    elif known_approval_ids != sorted(known_approval_ids, key=positions.__getitem__):
        errors.append("manual approvals must follow canonical inventory order")
    if len(approvals) > 92:
        errors.append("manual approvals exceed the exact inventory")
    if len(approvals) == 92:
        if gate.get("status") != "approved":
            errors.append("full manual gate must be approved")
        if not isinstance(gate.get("approvedBy"), str) or not gate["approvedBy"].strip():
            errors.append("full manual gate requires approvedBy")
        if not isinstance(gate.get("approvalRevision"), str) or not gate["approvalRevision"].strip():
            errors.append("full manual gate requires a stable approvalRevision")
    elif gate.get("approvedBy") is not None or gate.get("approvalRevision") is not None:
        errors.append("incomplete manual gate cannot claim reviewer or approval revision")
    if len(approvals) != 92:
        errors.append(f"manual gate incomplete: {len(approvals)}/92 approved")
    return Validation(
        not errors,
        tuple(errors),
        {"required": 92, "approved": len(approvals), "status": expected_status},
    )


def build_runtime_manifest(
    inventory: dict[str, object],
    results: list[Validation],
    gate: dict[str, object],
    palette_catalog: dict[str, object],
) -> dict[str, object]:
    manual = validate_manual_gate(inventory, results, gate)
    if not manual.passed:
        raise ValueError("manual runtime gate failed: " + "; ".join(manual.errors))
    measured = {str(result.facts["asset"]): result for result in results}
    assets = [item for item in inventory["assets"] if isinstance(item, dict)]
    return {
        "schema": RUNTIME_SCHEMA,
        "id": "traveller-appearance-v2",
        "status": "runtime-approved",
        "runtimeEligible": True,
        "maskRevision": "palette-masks-v1",
        "paletteCatalog": palette_catalog,
        "paletteCatalogSha256": sha256_file(ROOT / "palette-catalog.json"),
        "goldenVectors": read_json(GOLDEN_PATH),
        "goldenVectorsSha256": sha256_file(GOLDEN_PATH),
        "manualApproval": {
            "revision": gate["approvalRevision"],
            "approvedBy": gate["approvedBy"],
        },
        "variants": [
            {
                "id": variant,
                **inventory["variants"][variant],
                "capabilities": [
                    {
                        "id": capability,
                        "frames": [
                            {
                                "id": asset["id"],
                                "variant": asset["variant"],
                                "capability": asset["capability"],
                                "frame": asset["frame"],
                                "canvas": asset["canvas"],
                                "baseRoute": asset["baseRoute"],
                                "baseSha256": asset["baseSha256"],
                                "maskRoute": asset["maskRoute"],
                                "maskSha256": measured[str(asset["id"])].facts["maskSha256"],
                            }
                            for asset in assets
                            if asset["variant"] == variant and asset["capability"] == capability
                        ],
                    }
                    for capability in ("core", "motion", "room", "body-toad", "recovery-slug", "resources-penguin", "shadow")
                ],
            }
            for variant in inventory["variantOrder"]
        ],
    }


def promotion_report(manual_path: Path = MANUAL_APPROVALS_PATH) -> tuple[dict[str, object], dict[str, object] | None]:
    inventory = load_inventory()
    foundation = validate_inventory(inventory)
    palette = validate_palette_catalog()
    parity = validate_golden_vectors()
    report: dict[str, object] = {
        "schema": "satoru.traveller-semantic-mask-promotion-report/1",
        "runtimeEligible": False,
        "foundation": foundation.payload(),
        "palette": palette.payload(),
        "goldenParity": parity.payload(),
    }
    if not (foundation.passed and palette.passed and parity.passed):
        report["status"] = "foundation-or-palette-failed"
        return report, None
    assets = scoped_assets("all", inventory)
    results = [validate_semantic_mask(asset) for asset in assets]
    machine = validate_mask_set(assets, results=results)
    report["machineGate"] = machine.payload()
    if not machine.passed:
        report["status"] = "machine-mask-gate-failed"
        return report, None
    try:
        manual_payload = read_json(manual_path)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        report["manualGate"] = Validation(False, (f"unreadable manual gate: {exc}",), {}).payload()
        report["status"] = "manual-gate-failed"
        return report, None
    manual = validate_manual_gate(inventory, results, manual_payload)
    report["manualGate"] = manual.payload()
    if not manual.passed:
        report["status"] = "manual-gate-failed"
        return report, None
    manifest = build_runtime_manifest(inventory, results, manual_payload, load_palette_catalog())
    report["runtimeEligible"] = True
    report["status"] = "runtime-approved"
    return report, manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manual-approvals", default="manual-approvals.json", help="factory-relative JSON gate")
    parser.add_argument("--output", default="build/runtime-manifest-v1.json", help="factory-relative JSON output")
    args = parser.parse_args()
    manual_path = safe_relative(ROOT, args.manual_approvals, suffix=".json")
    output = safe_relative(ROOT, args.output, suffix=".json")
    report, manifest = promotion_report(manual_path)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if manifest is None:
        raise SystemExit(1)
    atomic_json(output, manifest)
    print(output.relative_to(ROOT))


if __name__ == "__main__":
    main()
