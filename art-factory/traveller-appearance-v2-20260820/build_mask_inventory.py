#!/usr/bin/env python3
"""Validate the 92-frame inventory and optionally emit a factory candidate."""

from __future__ import annotations

import argparse
import json
import os
import tempfile
from pathlib import Path

from palette_parity import validate_golden_vectors
from semantic_masks import (
    ROOT,
    candidate_manifest,
    load_inventory,
    safe_relative,
    scoped_assets,
    validate_inventory,
    validate_semantic_mask,
)


def atomic_json(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except BaseException:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scope", choices=("approval", "all"), default="all")
    parser.add_argument("--foundation-only", action="store_true")
    parser.add_argument("--write-candidate", help="factory-relative JSON destination")
    args = parser.parse_args()
    inventory = load_inventory()
    foundation = validate_inventory(inventory)
    parity = validate_golden_vectors()
    payload: dict[str, object] = {
        "schema": "satoru.traveller-semantic-mask-preflight/1",
        "scope": args.scope,
        "foundation": foundation.payload(),
        "goldenParity": parity.payload(),
        "runtimeEligible": False,
        "publicArtWrites": False,
    }
    if not foundation.passed or not parity.passed:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        raise SystemExit(1)
    if args.foundation_only:
        payload["status"] = "foundation-ready-manual-masks-pending"
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return
    assets = scoped_assets(args.scope, inventory)
    results = [validate_semantic_mask(asset) for asset in assets]
    errors = [error for result in results for error in result.errors]
    payload["masks"] = {
        "required": len(assets),
        "passed": sum(result.passed for result in results),
        "errors": errors,
        "frames": [result.payload() for result in results],
    }
    payload["status"] = "mask-qa-pass" if not errors else "manual-masks-missing-or-invalid"
    if args.write_candidate:
        if args.scope != "all" or errors:
            raise SystemExit("runtime candidate requires strict PASS for all 92 masks")
        destination = safe_relative(ROOT, args.write_candidate, suffix=".json")
        atomic_json(destination, candidate_manifest(inventory, results))
        payload["candidate"] = str(destination.relative_to(ROOT))
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
