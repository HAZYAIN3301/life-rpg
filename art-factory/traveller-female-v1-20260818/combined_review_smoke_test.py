#!/usr/bin/env python3
"""Smoke coverage for the fail-closed F2 46-frame review builder."""

from __future__ import annotations

import copy
import json
import subprocess
from collections import Counter

import build_combined_review as review


def expect_value_error(action, needle: str) -> None:
    try:
        action()
    except ValueError as error:
        assert needle in str(error), (needle, str(error))
    else:
        raise AssertionError(f"expected ValueError containing {needle!r}")


def main() -> None:
    contract = review.review_contract()
    assert len(contract) == 46
    assert [entry["order"] for entry in contract] == list(range(1, 47))
    assert Counter(entry["family"] for entry in contract) == Counter(
        review.EXPECTED_FAMILY_COUNTS
    )
    assert len({entry["targetKey"] for entry in contract}) == 46
    assert len({entry["runtimeTarget"] for entry in contract}) == 46
    runtime_targets = [entry["runtimeTarget"] for entry in contract]
    assert all("/female/f2-v1/" in target for target in runtime_targets)
    assert runtime_targets == review.expected_runtime_targets()

    runtime_contract = review.REPO_ROOT / "public/traveller-appearance-v1.js"
    program = (
        "const a=require(process.argv[1]);"
        "process.stdout.write(JSON.stringify(a.expectedAssets('female')));"
    )
    completed = subprocess.run(
        ["node", "-e", program, str(runtime_contract)],
        capture_output=True,
        text=True,
        timeout=20,
        check=True,
    )
    assert runtime_targets == json.loads(completed.stdout)
    assert contract[0]["targetKey"] == "core/idle"
    assert contract[-1]["targetKey"] == "shadow/attune-keeper"

    recovery_soft_b = next(
        entry
        for entry in contract
        if entry["targetKey"] == "recovery/stretch-soft-b"
    )
    assert "pair-v3/stretch-soft-b-v155.png" in recovery_soft_b["reference"]
    assert recovery_soft_b["runtimeTarget"].endswith(
        "pair-v3/female/f2-v1/stretch-soft-b-v155.png"
    )

    resources = [entry for entry in contract if entry["family"] == "resources"]
    assert len(resources) == 12
    assert {entry["batch"] for entry in resources} == {
        "female-resources-f2-full-01"
    }

    identity = review.load_approved_identity()
    assert identity == {
        "id": "female-f2-high-ponytail",
        "path": "sources/identity-variants-04/candidate-f2-high-ponytail-keyed.png",
        "sha256": "5d811618fc851eec48eb910c7efc98eec46e23a94919b376d3c64f5ae24d62da",
        "status": "identity-approved/runtime-not-yet",
    }

    duplicate_runtime = copy.deepcopy(contract)
    duplicate_runtime[1]["runtimeTarget"] = duplicate_runtime[0]["runtimeTarget"]
    expect_value_error(
        lambda: review.validate_contract(duplicate_runtime),
        "duplicate combined review runtime target",
    )

    wrong_order = copy.deepcopy(contract)
    wrong_order[0]["runtimeTarget"], wrong_order[1]["runtimeTarget"] = (
        wrong_order[1]["runtimeTarget"],
        wrong_order[0]["runtimeTarget"],
    )
    expect_value_error(
        lambda: review.validate_contract(wrong_order),
        "runtime targets/order differ",
    )

    expect_value_error(
        lambda: review.require_batch_artifacts(
            contract,
            is_file=lambda path: "female-resources-f2-full-01" not in str(path),
        ),
        "female-resources-f2-full-01",
    )

    # This call is intentionally read-only. Before Resources exists it proves
    # fail-closed behavior; once the batch lands, it validates all 46 resolved
    # references/outputs and the unchanged builder contract instead.
    resource_manifest = review.contact_manifest_path(
        "female-resources-f2-full-01"
    )
    resource_qa = review.contact_qa_path("female-resources-f2-full-01")
    if not resource_manifest.is_file() or not resource_qa.is_file():
        expect_value_error(
            lambda: review.preflight(contract),
            "female-resources-f2-full-01",
        )
        state = "EXPECTED FAIL-CLOSED (Resources batch absent)"
    else:
        resolved, batch_statuses = review.preflight(contract)
        assert len(resolved) == 46
        assert [entry["order"] for entry in resolved] == list(range(1, 47))
        assert len({entry["femaleOutput"] for entry in resolved}) == 46
        assert all(entry["batchQaPassed"] is True for entry in resolved)
        assert all(entry["manualReview"] == "approved" for entry in resolved)
        assert all(batch["automatedQaPassed"] is True for batch in batch_statuses)
        assert all(batch["runtimeEligible"] is False for batch in batch_statuses)
        manual_approval = review.load_manual_review_approval(resolved)
        assert manual_approval["approved"] is True
        assert manual_approval["qaPassedFrames"] == 46
        assert manual_approval["manuallyReviewedFrames"] == 46
        report = review.build_report(resolved, batch_statuses, manual_approval)
        assert report["status"] == "manual-review-approved"
        assert report["manualReviewApproved"] is True
        assert report["manualReviewRequired"] is False
        assert report["runtimeEligible"] is True
        assert report["promotionRequired"] is True
        assert report["publicArtWrites"] is False
        assert all(check["checked"] is True for check in report["manualReviewChecklist"])
        state = "PASS (all 46 factory artifacts resolved)"

    assert len(review.MANUAL_CHECKLIST) >= 7
    print(f"combined F2 review smoke: {state}")


if __name__ == "__main__":
    main()
