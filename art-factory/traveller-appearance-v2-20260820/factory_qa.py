#!/usr/bin/env python3
"""QA report for the factory-only Traveller Appearance v2 mask pack."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from build_mask_inventory import atomic_json
from palette_parity import validate_golden_vectors
from semantic_masks import ROOT, load_inventory, safe_relative, scoped_assets, validate_inventory, validate_mask_set


def make_report(scope: str, foundation_only: bool = False) -> dict[str, object]:
    inventory = load_inventory()
    foundation = validate_inventory(inventory)
    parity = validate_golden_vectors()
    report: dict[str, object] = {
        "schema": "satoru.traveller-semantic-mask-qa/1",
        "factory": "traveller-appearance-v2-20260820",
        "scope": "foundation" if foundation_only else scope,
        "foundation": foundation.payload(),
        "goldenParity": parity.payload(),
        "publicArtWrites": False,
        "runtimeEligible": False,
    }
    if foundation_only or not foundation.passed or not parity.passed:
        report["maskGate"] = {
            "evaluated": False,
            "status": "manual-mask-production-pending" if foundation.passed and parity.passed else "foundation-invalid",
        }
        report["passed"] = foundation.passed and parity.passed
        return report
    masks = validate_mask_set(scoped_assets(scope, inventory))
    report["maskGate"] = {"evaluated": True, **masks.payload()}
    report["passed"] = foundation.passed and parity.passed and masks.passed
    return report


def markdown(report: dict[str, object]) -> str:
    foundation = report["foundation"]
    gate = report["maskGate"]
    lines = [
        "# Traveller Appearance v2 · factory QA",
        "",
        f"- Scope: **{report['scope']}**",
        f"- Foundation: **{'PASS' if foundation['passed'] else 'FAIL'}**",
        f"- Golden pixel parity: **{'PASS' if report['goldenParity']['passed'] else 'FAIL'}**",
        f"- Overall: **{'PASS' if report['passed'] else 'FAIL'}**",
        "- Runtime eligible: **NO — public promotion is a separate reviewed step**",
        "- Public art writes: **NO**",
        "",
        f"Pinned base assets: **{foundation['facts'].get('verifiedBaseAssets', 0)}/92**",
    ]
    if gate.get("evaluated"):
        facts = gate.get("facts", {})
        lines.extend([
            f"Semantic masks: **{facts.get('passed', 0)}/{facts.get('required', 0)}**",
            f"Missing manual masks/mattes: **{facts.get('missing', 0)}**",
        ])
    else:
        lines.append(f"Mask gate: **{gate.get('status')}**")
    errors = (
        list(foundation.get("errors", []))
        + list(report["goldenParity"].get("errors", []))
        + list(gate.get("errors", []))
    )
    if errors:
        lines.extend(["", "## Errors", ""] + [f"- {error}" for error in errors])
    lines.extend([
        "",
        "A machine PASS proves canvas, SHA, channel containment and pixel isolation.",
        "It never replaces manual review of hair/skin/eye ownership or guardian exclusion.",
        "",
    ])
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scope", choices=("approval", "all"), default="approval")
    parser.add_argument("--foundation-only", action="store_true")
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--output", help="factory-relative JSON path")
    args = parser.parse_args()
    report = make_report(args.scope, args.foundation_only)
    if args.write:
        default = f"qa/{'foundation' if args.foundation_only else args.scope}/qa-report.json"
        destination = safe_relative(ROOT, args.output or default, suffix=".json")
        atomic_json(destination, report)
        destination.with_suffix(".md").write_text(markdown(report), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
