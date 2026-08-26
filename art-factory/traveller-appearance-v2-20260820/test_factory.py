#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image, PngImagePlugin

from build_review import build_review
from palette_parity import validate_golden_vectors
from promote_runtime_manifest import build_runtime_manifest, validate_manual_gate
from reference_recolor import recolor_image
from semantic_masks import (
    MANUAL_APPROVALS_PATH,
    PUBLIC_MASK_ROOT,
    Validation,
    candidate_manifest,
    load_inventory,
    load_palette_catalog,
    measure_production_state,
    read_json,
    scoped_assets,
    validate_contract,
    validate_inventory,
    validate_mask_set,
    validate_palette_catalog,
    validate_semantic_mask,
)


class FoundationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.inventory = load_inventory()

    def test_exact_92_asset_inventory_and_pinned_bases(self) -> None:
        contract = validate_contract()
        self.assertTrue(contract.passed, contract.errors)
        result = validate_inventory(self.inventory)
        self.assertTrue(result.passed, result.errors)
        self.assertEqual(result.facts["assets"], 92)
        self.assertEqual(result.facts["frameKeys"], 46)
        self.assertEqual(result.facts["verifiedBaseAssets"], 92)
        self.assertTrue(result.facts["paletteContractPassed"])
        self.assertTrue(result.facts["paletteCatalogPassed"])
        production = measure_production_state(self.inventory["assets"])
        self.assertEqual(result.facts["producedMasks"], production["producedMasks"])
        self.assertEqual(result.facts["producedMasks"], self.inventory["counts"]["producedMasks"])
        self.assertEqual(result.facts["producedMasks"], 92)
        self.assertEqual(result.facts["productionStatus"], "manual-mask-production-complete")
        self.assertEqual(result.facts["approvalProducedMasks"], 12)
        self.assertEqual(result.facts["approvalStatus"], "manual-masks-complete")
        self.assertEqual(production["partialAssetIds"], [])

    def test_all_routes_use_immutable_palette_mask_revision(self) -> None:
        for asset in self.inventory["assets"]:
            suffix = f'{asset["variant"]}/{asset["capability"]}/{Path(asset["baseRoute"]).name}'
            self.assertEqual(asset["maskRoute"], PUBLIC_MASK_ROOT + suffix)
            self.assertEqual(asset["maskFile"], "palette-masks-v1/" + suffix)
            self.assertEqual(asset["matteFile"], "traveller-mattes-v1/" + suffix)

    def test_approval_batch_is_exact_audited_twelve(self) -> None:
        actual = [asset["id"] for asset in scoped_assets("approval", self.inventory)]
        self.assertEqual(actual, [
            "male-v1:core:idle", "female-f2-v1:core:idle",
            "male-v1:core:window-back", "female-f2-v1:core:window-back",
            "male-v1:body-toad:greet-contact", "female-f2-v1:body-toad:greet-contact",
            "male-v1:recovery-slug:breathe-in", "female-f2-v1:recovery-slug:breathe-in",
            "male-v1:resources-penguin:greet-contact", "female-f2-v1:resources-penguin:greet-contact",
            "male-v1:shadow:attune-guardian", "female-f2-v1:shadow:attune-guardian",
        ])

    def test_only_audited_closed_or_back_views_declare_empty_eyes(self) -> None:
        declared = {
            asset["id"]: asset["expectedEmptyChannels"]
            for asset in self.inventory["assets"]
            if asset.get("expectedEmptyChannels")
        }
        self.assertEqual(declared, {
            "male-v1:core:window-back": ["eyes"],
            "female-f2-v1:core:window-back": ["eyes"],
            "male-v1:motion:idle-blink": ["eyes"],
            "female-f2-v1:motion:idle-blink": ["eyes"],
            "male-v1:room:bench-read-b": ["eyes"],
            "male-v1:recovery-slug:breathe-in": ["eyes"],
            "female-f2-v1:recovery-slug:breathe-in": ["eyes"],
            "male-v1:recovery-slug:breathe-out": ["eyes"],
            "female-f2-v1:recovery-slug:breathe-out": ["eyes"],
            "male-v1:recovery-slug:restore-contact": ["eyes"],
            "female-f2-v1:recovery-slug:restore-contact": ["eyes"],
            "male-v1:recovery-slug:stretch-a": ["eyes"],
            "female-f2-v1:recovery-slug:stretch-a": ["eyes"],
            "male-v1:recovery-slug:stretch-soft-b": ["eyes"],
            "female-f2-v1:recovery-slug:stretch-soft-b": ["eyes"],
        })

    def test_authored_palette_and_golden_vectors_pass(self) -> None:
        palette = validate_palette_catalog()
        self.assertTrue(palette.passed, palette.errors)
        self.assertEqual(palette.facts["targets"], 17)
        golden = validate_golden_vectors()
        self.assertTrue(golden.passed, golden.errors)
        self.assertEqual(golden.facts["passed"], 3)

    def test_factory_candidate_stays_ineligible_and_final_manifest_is_explicit(self) -> None:
        results = [
            Validation(True, (), {
                "asset": asset["id"],
                "baseSha256": asset["baseSha256"],
                "maskSha256": hashlib.sha256((asset["id"] + ":mask").encode()).hexdigest(),
                "matteSha256": hashlib.sha256((asset["id"] + ":matte").encode()).hexdigest(),
            })
            for asset in self.inventory["assets"]
        ]
        candidate = candidate_manifest(self.inventory, results)
        self.assertFalse(candidate["runtimeEligible"])
        gate = {
            "schema": "satoru.traveller-semantic-mask-manual-approvals/1",
            "status": "approved",
            "requiredAssets": 92,
            "approvalRevision": "test-review-v1",
            "approvedBy": "test-reviewer",
            "assets": [
                {
                    "id": result.facts["asset"],
                    "decision": "approved",
                    "baseSha256": result.facts["baseSha256"],
                    "maskSha256": result.facts["maskSha256"],
                    "matteSha256": result.facts["matteSha256"],
                }
                for result in results
            ],
        }
        manual = validate_manual_gate(self.inventory, results, gate)
        self.assertTrue(manual.passed, manual.errors)
        manifest = build_runtime_manifest(self.inventory, results, gate, load_palette_catalog())
        self.assertEqual(manifest["schema"], "satoru.traveller-semantic-mask-runtime/1")
        self.assertEqual(manifest["status"], "runtime-approved")
        self.assertTrue(manifest["runtimeEligible"])
        self.assertEqual(manifest["goldenVectors"]["algorithm"], "oklab-paper-preserving-v1")
        frames = [
            frame
            for variant in manifest["variants"]
            for capability in variant["capabilities"]
            for frame in capability["frames"]
        ]
        self.assertEqual(len(frames), 92)
        self.assertTrue(all({"variant", "capability", "frame"} <= set(frame) for frame in frames))

    def test_pending_manual_gate_never_promotes(self) -> None:
        results = [Validation(True, (), {"asset": asset["id"]}) for asset in self.inventory["assets"]]
        gate = {
            "schema": "satoru.traveller-semantic-mask-manual-approvals/1",
            "status": "pending",
            "requiredAssets": 92,
            "approvalRevision": None,
            "approvedBy": None,
            "assets": [],
        }
        result = validate_manual_gate(self.inventory, results, gate)
        self.assertFalse(result.passed)
        self.assertIn("manual gate incomplete", " ".join(result.errors))

    def test_live_manual_approval_gate_remains_pending(self) -> None:
        gate = read_json(MANUAL_APPROVALS_PATH)
        self.assertEqual(gate, {
            "schema": "satoru.traveller-semantic-mask-manual-approvals/1",
            "status": "pending",
            "requiredAssets": 92,
            "approvalRevision": None,
            "approvedBy": None,
            "assets": [],
        })

    def test_audited_twelve_can_be_recorded_as_ordered_partial_manual_gate(self) -> None:
        approval_ids = self.inventory["approvalBatch"]["assetVariantIds"]
        results = [
            Validation(True, (), {
                "asset": asset_id,
                "baseSha256": "a" * 64,
                "maskSha256": "b" * 64,
                "matteSha256": "c" * 64,
            })
            for asset_id in approval_ids
        ]
        gate = {
            "schema": "satoru.traveller-semantic-mask-manual-approvals/1",
            "status": "in-progress",
            "requiredAssets": 92,
            "approvalRevision": None,
            "approvedBy": None,
            "assets": [
                {
                    "id": asset_id,
                    "decision": "approved",
                    "baseSha256": "a" * 64,
                    "maskSha256": "b" * 64,
                    "matteSha256": "c" * 64,
                }
                for asset_id in approval_ids
            ],
        }
        manual = validate_manual_gate(self.inventory, results, gate)
        self.assertFalse(manual.passed)
        self.assertEqual(manual.facts["approved"], 12)
        self.assertNotIn("canonical inventory order", " ".join(manual.errors))

    def test_missing_manual_masks_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = validate_mask_set(
                scoped_assets("approval", self.inventory),
                factory_root=Path(directory),
            )
            self.assertFalse(result.passed)
            self.assertEqual(result.facts["required"], 12)
            self.assertEqual(result.facts["passed"], 0)
            self.assertEqual(result.facts["missing"], 12)

    def test_review_writes_nothing_when_masks_are_missing(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            empty_factory = Path(directory) / "factory"
            empty_factory.mkdir()
            output = Path(directory) / "review.png"
            with self.assertRaisesRegex(ValueError, "review blocked"):
                build_review(
                    "approval",
                    output,
                    inventory=self.inventory,
                    factory_root=empty_factory,
                )
            self.assertFalse(output.exists())


class SyntheticMaskTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.repo = self.root / "repo"
        self.factory = self.root / "factory"
        (self.repo / "public/art/test").mkdir(parents=True)
        (self.factory / "masks").mkdir(parents=True)
        (self.factory / "mattes").mkdir(parents=True)
        self.base_path = self.repo / "public/art/test/base.png"
        base = np.zeros((4, 4, 4), dtype=np.uint8)
        base[1:3, 1:3] = [120, 80, 50, 255]
        Image.fromarray(base, "RGBA").save(self.base_path)
        self.mask_path = self.factory / "masks/base.png"
        self.matte_path = self.factory / "mattes/base.png"
        mask = np.zeros((4, 4, 3), dtype=np.uint8)
        mask[1, 1] = [255, 0, 0]
        mask[1, 2] = [0, 255, 0]
        mask[2, 1] = [0, 0, 255]
        matte = np.zeros((4, 4), dtype=np.uint8)
        matte[1:3, 1:3] = 255
        Image.fromarray(mask, "RGB").save(self.mask_path)
        Image.fromarray(matte, "L").save(self.matte_path)
        digest = hashlib.sha256(self.base_path.read_bytes()).hexdigest()
        self.asset = {
            "id": "test-v1:core:base",
            "canvas": [4, 4],
            "baseRoute": "/art/test/base.png",
            "baseSha256": digest,
            "maskFile": "masks/base.png",
            "matteFile": "mattes/base.png",
        }

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def validate(self):
        return validate_semantic_mask(self.asset, repo_root=self.repo, factory_root=self.factory)

    def test_valid_packed_rgb_mask_passes(self) -> None:
        result = self.validate()
        self.assertTrue(result.passed, result.errors)
        self.assertEqual(result.facts["maximumChannelSum"], 255)
        self.assertEqual(result.facts["channelPixels"], {"skin": 1, "hair": 1, "eyes": 1})

    def test_produced_count_measures_complete_pairs_and_reports_partials(self) -> None:
        complete = measure_production_state([self.asset], factory_root=self.factory)
        self.assertEqual(complete["producedMasks"], 1)
        self.assertEqual(complete["partialAssetIds"], [])
        self.matte_path.unlink()
        partial = measure_production_state([self.asset], factory_root=self.factory)
        self.assertEqual(partial["producedMasks"], 0)
        self.assertEqual(partial["partialAssetIds"], [self.asset["id"]])

    def test_all_black_mask_and_matte_fail_closed(self) -> None:
        Image.new("RGB", (4, 4), (0, 0, 0)).save(self.mask_path)
        mask_errors = " ".join(self.validate().errors)
        self.assertIn("semantic mask is all black", mask_errors)
        self.assertIn("required skin channel is empty", mask_errors)
        Image.new("L", (4, 4), 0).save(self.matte_path)
        matte_errors = " ".join(self.validate().errors)
        self.assertIn("Traveller matte is all black", matte_errors)

    def test_per_channel_nonzero_with_explicit_back_view_eye_exception(self) -> None:
        mask = np.asarray(Image.open(self.mask_path).convert("RGB")).copy()
        mask[..., 2] = 0
        Image.fromarray(mask, "RGB").save(self.mask_path)
        self.assertIn("required eyes channel is empty", " ".join(self.validate().errors))
        self.asset["expectedEmptyChannels"] = ["eyes"]
        result = self.validate()
        self.assertTrue(result.passed, result.errors)

    def test_colour_management_metadata_is_rejected(self) -> None:
        mask = Image.open(self.mask_path).convert("RGB")
        metadata = PngImagePlugin.PngInfo()
        metadata.add_text("gAMA", "0.45455")
        mask.save(self.mask_path, pnginfo=metadata)
        self.assertIn("colour-management", " ".join(self.validate().errors))

    def test_channel_sum_overflow_is_rejected(self) -> None:
        mask = np.asarray(Image.open(self.mask_path).convert("RGB")).copy()
        mask[1, 1] = [200, 100, 0]
        Image.fromarray(mask, "RGB").save(self.mask_path)
        self.assertIn("red + green + blue exceeds 255", " ".join(self.validate().errors))

    def test_guardian_or_background_contamination_is_rejected(self) -> None:
        mask = np.asarray(Image.open(self.mask_path).convert("RGB")).copy()
        mask[0, 0] = [255, 0, 0]
        Image.fromarray(mask, "RGB").save(self.mask_path)
        errors = " ".join(self.validate().errors)
        self.assertIn("semantic coverage escapes Traveller matte", errors)
        self.assertIn("transparent base pixels", errors)

    def test_recolour_preserves_alpha_and_every_pixel_outside_mask(self) -> None:
        base = Image.open(self.base_path).convert("RGBA")
        mask = Image.open(self.mask_path).convert("RGB")
        result = recolor_image(base, mask, {"skin": "#755596", "hair": "#342a4a", "eyes": "#183f48"})
        before = np.asarray(base)
        after = np.asarray(result)
        packed = np.asarray(mask)
        outside = packed.max(axis=2) == 0
        self.assertTrue(np.array_equal(before[..., 3], after[..., 3]))
        self.assertTrue(np.array_equal(before[..., :3][outside], after[..., :3][outside]))
        self.assertTrue(np.any(before[..., :3][~outside] != after[..., :3][~outside]))


if __name__ == "__main__":
    unittest.main()
