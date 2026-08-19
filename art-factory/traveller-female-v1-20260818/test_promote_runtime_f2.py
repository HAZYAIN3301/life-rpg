#!/usr/bin/env python3
"""Isolated smoke tests for promote_runtime_f2.py (never writes real public/)."""

from __future__ import annotations

import importlib.util
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image


SCRIPT = Path(__file__).with_name("promote_runtime_f2.py")
SPEC = importlib.util.spec_from_file_location("promote_runtime_f2", SCRIPT)
assert SPEC and SPEC.loader
PROMOTE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = PROMOTE
SPEC.loader.exec_module(PROMOTE)


class PromotionFixture:
    def __init__(self, repo_root: Path, root: Path) -> None:
        self.repo_root = repo_root
        self.root = root
        self.factory = root / "factory"
        self.public = root / "public"
        self.public.mkdir(parents=True)

    def build(self) -> None:
        canonical_factory = self.repo_root / "art-factory/traveller-female-v1-20260818"
        self.factory.mkdir(parents=True)
        shutil.copyfile(
            canonical_factory / "APPROVED-IDENTITY.json",
            self.factory / "APPROVED-IDENTITY.json",
        )
        shutil.copyfile(
            canonical_factory / "PRODUCTION-INVENTORY-F2.json",
            self.factory / "PRODUCTION-INVENTORY-F2.json",
        )
        identity = self.factory / PROMOTE.IDENTITY_PATH
        identity.parent.mkdir(parents=True)
        shutil.copyfile(canonical_factory / PROMOTE.IDENTITY_PATH, identity)

        image_index = 0
        for (kind, batch), batch_specs in PROMOTE.grouped_specs().items():
            group = "approval-batches" if kind == "core" else "contact-approval-batches"
            output = self.factory / "outputs" / group / batch
            qa_dir = self.factory / "qa" / group / batch
            output.mkdir(parents=True)
            qa_dir.mkdir(parents=True)
            canvas = batch_specs[0].canvas
            frames = [spec.frame for spec in batch_specs]
            manifest_frames = {}
            qa_frames = {}
            for frame in frames:
                image_index += 1
                path = output / f"{frame}.png"
                image = Image.new("RGBA", canvas, (0, 0, 0, 0))
                x = image_index % canvas[0]
                y = (image_index * 7) % canvas[1]
                image.putpixel((x, y), ((image_index * 17) % 255, 40, 80, 255))
                image.save(path)
                image.close()
                manifest_frames[frame] = {"canvas": list(canvas), "mode": "RGBA"}
                qa_frames[frame] = {
                    "canvas": list(canvas),
                    "mode": "RGBA",
                    "passed": True,
                    "checks": {"fixture": True},
                }
            manifest = {
                "schema": (
                    "satoru.traveller-female-approval-batch/1" if kind == "core"
                    else "satoru.traveller-female-contact-approval-batch/1"
                ),
                "id": batch,
                "runtimeEligible": False,
                "publicArtWrites": False,
                "approvedIdentity": {
                    "id": PROMOTE.IDENTITY_ID,
                    "path": PROMOTE.IDENTITY_PATH,
                    "sha256": PROMOTE.IDENTITY_SHA256,
                    "status": PROMOTE.IDENTITY_STATUS,
                },
                "canvas": list(canvas),
                "assets": {frame: f"{frame}.png" for frame in frames},
                "frames": manifest_frames,
            }
            if kind == "contact":
                manifest["requiredFrames"] = frames
            qa = {
                "schema": (
                    "satoru.traveller-female-approval-qa/1" if kind == "core"
                    else "satoru.traveller-female-contact-qa/1"
                ),
                "batch": batch,
                "passed": True,
                "automatedContractPassed": True,
                "runtimeEligible": False,
                "frames": qa_frames,
            }
            (output / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            (qa_dir / "qa-report.json").write_text(json.dumps(qa), encoding="utf-8")


class PromoteRuntimeF2Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.repo_root = Path(__file__).resolve().parents[2]

    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="f2-promotion-test-")
        self.fixture = PromotionFixture(self.repo_root, Path(self.temp.name))
        self.fixture.build()

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_contract_is_exactly_46_ordered_unique_routes(self) -> None:
        routes = [spec.route for spec in PROMOTE.ASSET_SPECS]
        self.assertEqual(len(routes), 46)
        self.assertEqual(len(set(routes)), 46)
        result = PROMOTE.dry_run(
            self.repo_root, self.fixture.factory, self.fixture.public,
        )
        self.assertTrue(result["ready"], result["errors"])
        self.assertEqual(result["assetCount"], 46)
        self.assertFalse(result["publicWrites"])

    def test_dry_run_is_read_only_even_when_public_does_not_exist(self) -> None:
        shutil.rmtree(self.fixture.public)
        result = PROMOTE.dry_run(
            self.repo_root, self.fixture.factory, self.fixture.public,
        )
        self.assertTrue(result["ready"], result["errors"])
        self.assertFalse(result["publicWrites"])
        self.assertFalse(self.fixture.public.exists())

    def test_missing_resources_qa_fails_closed(self) -> None:
        qa = (
            self.fixture.factory / "qa/contact-approval-batches"
            / "female-resources-f2-full-01/qa-report.json"
        )
        qa.unlink()
        result = PROMOTE.dry_run(
            self.repo_root, self.fixture.factory, self.fixture.public,
        )
        self.assertFalse(result["ready"])
        self.assertFalse(result["publicWrites"])
        self.assertTrue(any("female-resources-f2-full-01 QA: missing" in error for error in result["errors"]))

    def test_identity_mismatch_fails_closed(self) -> None:
        record_path = self.fixture.factory / "APPROVED-IDENTITY.json"
        record = json.loads(record_path.read_text(encoding="utf-8"))
        record["source"]["sha256"] = "0" * 64
        record_path.write_text(json.dumps(record), encoding="utf-8")
        result = PROMOTE.dry_run(
            self.repo_root, self.fixture.factory, self.fixture.public,
        )
        self.assertFalse(result["ready"])
        self.assertTrue(any("pinned F2 identity" in error for error in result["errors"]))

    def test_duplicate_output_content_fails_closed(self) -> None:
        output = (
            self.fixture.factory / "outputs/contact-approval-batches"
            / "female-shadow-f2-full-01"
        )
        shutil.copyfile(output / "attune-spark.png", output / "attune-spirit.png")
        result = PROMOTE.dry_run(
            self.repo_root, self.fixture.factory, self.fixture.public,
        )
        self.assertFalse(result["ready"])
        self.assertTrue(any("duplicate output PNG content SHA" in error for error in result["errors"]))

    def test_promote_in_temp_tree_then_verify_and_refuse_overwrite(self) -> None:
        result = PROMOTE.promote(
            self.repo_root,
            self.fixture.factory,
            self.fixture.public,
            confirm_resources_pass=True,
        )
        self.assertTrue(result["ready"], result["errors"])
        self.assertTrue(result["publicWrites"])
        manifest_path = (
            self.fixture.public
            / "art/avatars/traveller-core-v1/female/f2-v1/manifest.json"
        )
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(manifest["schema"], PROMOTE.RUNTIME_MANIFEST_SCHEMA)
        self.assertEqual(manifest["status"], "runtime-approved")
        self.assertTrue(manifest["runtimeEligible"])
        self.assertEqual(
            [asset["path"] for asset in manifest["assets"]],
            [spec.route for spec in PROMOTE.ASSET_SPECS],
        )
        self.assertEqual(len(manifest["assets"]), 46)

        verified = PROMOTE.verify(
            self.repo_root, self.fixture.factory, self.fixture.public,
        )
        self.assertTrue(verified["ready"], verified["errors"])
        self.assertFalse(verified["publicWrites"])

        second = PROMOTE.promote(
            self.repo_root,
            self.fixture.factory,
            self.fixture.public,
            confirm_resources_pass=True,
        )
        self.assertFalse(second["ready"])
        self.assertFalse(second["publicWrites"])
        self.assertTrue(any("never overwrite" in error for error in second["errors"]))

    def test_promote_requires_explicit_resources_confirmation(self) -> None:
        result = PROMOTE.promote(
            self.repo_root,
            self.fixture.factory,
            self.fixture.public,
            confirm_resources_pass=False,
        )
        self.assertFalse(result["ready"])
        self.assertFalse(result["publicWrites"])
        self.assertEqual(list(self.fixture.public.iterdir()), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
