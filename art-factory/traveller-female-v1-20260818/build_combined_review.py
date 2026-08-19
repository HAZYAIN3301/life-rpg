#!/usr/bin/env python3
"""Build the fail-closed 46-frame F2 manual-review package.

This script reads factory outputs and public male references, but writes only to
this female Traveller factory's preview and QA directories. Automated batch QA
is a prerequisite; it never promotes or copies an asset into runtime.
"""

from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path, PurePosixPath

from PIL import Image, ImageDraw, ImageFont

from build_contact_pack import REPO_ROOT, frame_route, load_families
from build_core_pack import ROOT, inside_factory, load_approved_identity, sha256
from promote_runtime_f2 import ASSET_SPECS as RUNTIME_ASSET_SPECS, REVISION


REVIEW_ID = "female-f2-full-46-review"
PREVIEW_ROOT = ROOT / "previews" / REVIEW_ID
QA_ROOT = ROOT / "qa" / REVIEW_ID
INVENTORY_PATH = ROOT / "PRODUCTION-INVENTORY-F2.json"
EXPECTED_FRAME_COUNT = 46
EXPECTED_FAMILY_COUNTS = {
    "core": 7,
    "room": 4,
    "gamabunta": 13,
    "recovery": 6,
    "resources": 12,
    "shadow": 4,
}
FAMILY_ORDER = tuple(EXPECTED_FAMILY_COUNTS)
FAMILY_LABELS = {
    "core": "CORE / POSES",
    "room": "ROOM",
    "gamabunta": "GAMABUNTA / BODY",
    "recovery": "KATSUYA / RECOVERY",
    "resources": "MISTER P / RESOURCES",
    "shadow": "SHADOW",
}
CAPABILITY_FAMILIES = {
    "core": "core",
    "motion": "core",
    "room": "room",
    "bodyToad": "gamabunta",
    "recoverySlug": "recovery",
    "resourcesPenguin": "resources",
    "shadow": "shadow",
}


# Core and room manifests predate per-frame runtime/reference routes. Keep their
# exact reviewed routes here and validate every manifest asset against them.
STANDARD_BATCHES = (
    {
        "family": "core",
        "batch": "female-core-f2-01",
        "frames": (
            (
                "idle",
                "public/art/avatars/traveller-core-v1/male/poses/idle.png",
                "public/art/avatars/traveller-core-v1/female/poses/idle.png",
            ),
            (
                "idle-blink",
                "public/art/avatars/traveller-core-v1/male/motion-v3/idle-blink.png",
                "public/art/avatars/traveller-core-v1/female/motion-v3/idle-blink.png",
            ),
            (
                "walk-a",
                "public/art/avatars/traveller-core-v1/male/motion-v3/walk-a.png",
                "public/art/avatars/traveller-core-v1/female/motion-v3/walk-a.png",
            ),
            (
                "walk-b",
                "public/art/avatars/traveller-core-v1/male/motion-v3/walk-b.png",
                "public/art/avatars/traveller-core-v1/female/motion-v3/walk-b.png",
            ),
            (
                "window-back",
                "public/art/avatars/traveller-core-v1/male/poses/window-back.png",
                "public/art/avatars/traveller-core-v1/female/poses/window-back.png",
            ),
        ),
    },
    {
        "family": "core",
        "batch": "female-poses-f2-01",
        "frames": (
            (
                "arms-up",
                "public/art/avatars/traveller-core-v1/male/poses/arms-up.png",
                "public/art/avatars/traveller-core-v1/female/poses/arms-up.png",
            ),
        ),
    },
    {
        "family": "core",
        "batch": "female-poses-f2-full-01",
        "frames": (
            (
                "seated",
                "public/art/avatars/traveller-core-v1/male/poses/seated.png",
                "public/art/avatars/traveller-core-v1/female/poses/seated.png",
            ),
        ),
    },
    {
        "family": "room",
        "batch": "female-room-f2-full-01",
        "frames": (
            (
                "bench-rest",
                "public/art/avatars/traveller-core-v1/male/room-actions-v4/bench-rest.png",
                "public/art/avatars/traveller-core-v1/female/room-actions-v4/bench-rest.png",
            ),
            (
                "bench-portal-reach",
                "public/art/avatars/traveller-core-v1/male/room-actions-v4/bench-portal-reach.png",
                "public/art/avatars/traveller-core-v1/female/room-actions-v4/bench-portal-reach.png",
            ),
        ),
    },
    {
        "family": "room",
        "batch": "female-room-f2-01",
        "frames": (
            (
                "bench-read-a",
                "public/art/avatars/traveller-core-v1/male/room-actions-v4/bench-read-a.png",
                "public/art/avatars/traveller-core-v1/female/room-actions-v4/bench-read-a.png",
            ),
        ),
    },
    {
        "family": "room",
        "batch": "female-room-f2-full-01",
        "frames": (
            (
                "bench-read-b",
                "public/art/avatars/traveller-core-v1/male/room-actions-v4/bench-read-b.png",
                "public/art/avatars/traveller-core-v1/female/room-actions-v4/bench-read-b.png",
            ),
        ),
    },
)

CONTACT_BATCHES = (
    ("gamabunta", "female-gamabunta-f2-full-01"),
    ("recovery", "female-recovery-f2-full-01"),
    ("resources", "female-resources-f2-full-01"),
    ("shadow", "female-shadow-f2-full-01"),
)

MANUAL_CHECKLIST = (
    "F2 identity is stable in every frame: youthful no-sclera face, canonical high ponytail, goggles, palette and cut-paper proportions.",
    "Each female frame preserves the male reference's action, facing, silhouette, staging and relative actor scale.",
    "Physical contacts and occlusions are readable: hands, feet, props, pets and Shadow overlap in the intended order.",
    "Paired and multi-phase motion reads continuously without identity, costume, handedness or framing jumps.",
    "Gamabunta, Katsuya, Mister P and all four Shadow forms retain their canonical identities and markings.",
    "No chroma fringe, dirty matte, clipped silhouette, duplicate limb, broken hand, floor drift or accidental cast-shadow plate remains.",
    "Every listed runtime target is the intended unique destination; manual approval is recorded before any public/art copy.",
)


def repo_path(relative: str, *, label: str) -> Path:
    if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
        raise ValueError(f"invalid {label} route: {relative!r}")
    path = (REPO_ROOT / relative).resolve()
    try:
        path.relative_to(REPO_ROOT.resolve())
    except ValueError as error:
        raise ValueError(f"{label} route escapes repository: {relative}") from error
    return path


def standard_manifest_path(batch: str) -> Path:
    return inside_factory(ROOT / "outputs" / "approval-batches" / batch / "manifest.json")


def standard_qa_path(batch: str) -> Path:
    return inside_factory(ROOT / "qa" / "approval-batches" / batch / "qa-report.json")


def contact_manifest_path(batch: str) -> Path:
    return inside_factory(
        ROOT / "outputs" / "contact-approval-batches" / batch / "manifest.json"
    )


def contact_qa_path(batch: str) -> Path:
    return inside_factory(
        ROOT / "qa" / "contact-approval-batches" / batch / "qa-report.json"
    )


def standard_reference_map() -> dict[tuple[str, str], str]:
    references: dict[tuple[str, str], str] = {}
    for spec in STANDARD_BATCHES:
        batch = str(spec["batch"])
        for frame, reference, _legacy_runtime in spec["frames"]:
            key = (batch, str(frame))
            if key in references:
                raise ValueError(f"duplicate standard reference mapping: {key}")
            references[key] = str(reference)
    return references


def immutable_runtime_path(route: str) -> Path:
    """Validate an exact TravellerAppearance URL and map it to repo public/."""
    pure = PurePosixPath(route)
    marker = f"/female/{REVISION}/"
    if (
        not route.startswith("/art/")
        or marker not in route
        or "/male/" in route
        or ".." in pure.parts
        or pure.suffix.lower() != ".png"
    ):
        raise ValueError(f"unsafe or mutable female F2 runtime target: {route}")
    path = (REPO_ROOT / "public" / Path(*pure.parts[1:])).resolve()
    public_art = (REPO_ROOT / "public" / "art").resolve()
    try:
        path.relative_to(public_art)
    except ValueError as error:
        raise ValueError(f"runtime target escapes public/art: {route}") from error
    return path


def expected_runtime_targets() -> list[str]:
    return [spec.route for spec in RUNTIME_ASSET_SPECS]


def load_manual_review_approval(entries: list[dict[str, object]]) -> dict[str, object]:
    """Load auditable 46/46 manual-review evidence from the production ledger."""
    if not INVENTORY_PATH.is_file():
        raise ValueError("manual-review evidence inventory is missing")
    payload = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))
    counts = payload.get("counts")
    gates = payload.get("productionGates")
    batches = payload.get("batches")
    if (
        payload.get("schema") != "satoru.traveller-female-production-ledger/2"
        or not isinstance(counts, dict)
        or counts.get("runtimeDeliverables") != EXPECTED_FRAME_COUNT
        or counts.get("qaPassedDeliverables") != EXPECTED_FRAME_COUNT
        or counts.get("manualReviewedDeliverables") != EXPECTED_FRAME_COUNT
        or not isinstance(gates, dict)
        or gates.get("allBatchesQaPassed") is not True
        or gates.get("manualVisualReview") != "completed-by-parent"
        or gates.get("promotion") != "pending"
        or gates.get("publicArtWrites") is not False
        or not isinstance(batches, list)
    ):
        raise ValueError("production inventory does not prove 46/46 manual approval")
    expected_batches = {str(entry["batch"]) for entry in entries}
    actual_batches: set[str] = set()
    reviewed_frames = 0
    for batch in batches:
        if not isinstance(batch, dict):
            raise ValueError("production inventory has an invalid batch record")
        batch_id = str(batch.get("id", ""))
        frames = batch.get("frames")
        if (
            batch_id in actual_batches
            or batch.get("qa") != "PASS"
            or "manual-review-complete" not in str(batch.get("status", ""))
            or not isinstance(frames, list)
        ):
            raise ValueError(f"production inventory batch is not manually approved: {batch_id}")
        actual_batches.add(batch_id)
        reviewed_frames += len(frames)
    if actual_batches != expected_batches or reviewed_frames != EXPECTED_FRAME_COUNT:
        raise ValueError(
            "production inventory manual-review batch/frame coverage differs from review contract"
        )
    return {
        "source": str(INVENTORY_PATH.relative_to(ROOT)),
        "sourceSha256": sha256(INVENTORY_PATH),
        "reviewerRecord": gates["manualVisualReview"],
        "qaPassedFrames": counts["qaPassedDeliverables"],
        "manuallyReviewedFrames": counts["manualReviewedDeliverables"],
        "batches": len(actual_batches),
        "approved": True,
    }


def review_contract() -> list[dict[str, object]]:
    """Return the exact immutable TravellerAppearance 46-frame order."""
    entries: list[dict[str, object]] = []
    references = standard_reference_map()
    families = load_families()
    for runtime_spec in RUNTIME_ASSET_SPECS:
        batch = runtime_spec.batch
        frame = runtime_spec.frame
        family = CAPABILITY_FAMILIES[runtime_spec.capability]
        kind = "standard" if runtime_spec.batch_kind == "core" else "contact"
        if kind == "standard":
            key = (batch, frame)
            if key not in references:
                raise ValueError(f"missing standard male reference mapping: {key}")
            reference = references[key]
            entries.append(
                {
                    "family": family,
                    "frame": frame,
                    "batch": batch,
                    "kind": "standard",
                    "manifest": str(standard_manifest_path(batch).relative_to(ROOT)),
                    "qaReport": str(standard_qa_path(batch).relative_to(ROOT)),
                    "reference": reference,
                    "runtimeTarget": runtime_spec.route,
                }
            )
        else:
            config = families[family]
            route = frame_route(config, frame)
            entries.append(
                {
                    "family": family,
                    "frame": frame,
                    "batch": batch,
                    "kind": "contact",
                    "manifest": str(contact_manifest_path(batch).relative_to(ROOT)),
                    "qaReport": str(contact_qa_path(batch).relative_to(ROOT)),
                    "reference": str(route["reference"]),
                    "runtimeTarget": runtime_spec.route,
                }
            )
    for order, entry in enumerate(entries, start=1):
        entry["order"] = order
        entry["targetKey"] = f"{entry['family']}/{entry['frame']}"
    validate_contract(entries)
    return entries


def validate_contract(entries: list[dict[str, object]]) -> None:
    if len(entries) != EXPECTED_FRAME_COUNT:
        raise ValueError(
            f"combined review must contain {EXPECTED_FRAME_COUNT} frames, got {len(entries)}"
        )
    counts: dict[str, int] = defaultdict(int)
    target_keys: set[str] = set()
    runtime_targets: set[str] = set()
    for expected_order, entry in enumerate(entries, start=1):
        if entry.get("order") != expected_order:
            raise ValueError("combined review order is not contiguous")
        family = str(entry["family"])
        counts[family] += 1
        key = str(entry["targetKey"])
        runtime = str(entry["runtimeTarget"])
        if key in target_keys:
            raise ValueError(f"duplicate combined review target key: {key}")
        if runtime in runtime_targets:
            raise ValueError(f"duplicate combined review runtime target: {runtime}")
        target_keys.add(key)
        runtime_targets.add(runtime)
        repo_path(str(entry["reference"]), label="male reference")
        immutable_runtime_path(runtime)
    if dict(counts) != EXPECTED_FAMILY_COUNTS:
        raise ValueError(
            f"combined review family counts differ: {dict(counts)!r}"
        )
    if len(runtime_targets) != EXPECTED_FRAME_COUNT:
        raise ValueError("combined review does not have 46 unique runtime targets")
    actual_runtime_targets = [str(entry["runtimeTarget"]) for entry in entries]
    expected = expected_runtime_targets()
    if actual_runtime_targets != expected:
        raise ValueError(
            "combined review runtime targets/order differ from immutable "
            "TravellerAppearance expectation"
        )


def grouped_batches(entries: list[dict[str, object]]) -> list[tuple[str, list[dict[str, object]]]]:
    order: list[str] = []
    groups: dict[str, list[dict[str, object]]] = defaultdict(list)
    for entry in entries:
        batch = str(entry["batch"])
        if batch not in groups:
            order.append(batch)
        groups[batch].append(entry)
    return [(batch, groups[batch]) for batch in order]


def require_batch_artifacts(entries: list[dict[str, object]], *, is_file=None) -> None:
    """Fail closed when any batch manifest or QA report is unavailable.

    ``is_file`` is injectable so the smoke test can prove the Resources-missing
    gate after the real Resources batch has landed, without moving artifacts.
    """
    checker = is_file or (lambda path: path.is_file())
    missing: list[str] = []
    for _batch, batch_entries in grouped_batches(entries):
        manifest_path = inside_factory(ROOT / str(batch_entries[0]["manifest"]))
        qa_path = inside_factory(ROOT / str(batch_entries[0]["qaReport"]))
        if not checker(manifest_path):
            missing.append(str(manifest_path.relative_to(ROOT)))
        if not checker(qa_path):
            missing.append(str(qa_path.relative_to(ROOT)))
    if missing:
        raise ValueError(
            "missing required batch artifact(s):\n- " + "\n- ".join(missing)
        )


def preflight(entries: list[dict[str, object]]) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    """Resolve exact artifacts and fail before any review directory is created."""
    identity = load_approved_identity()
    require_batch_artifacts(entries)

    resolved_by_key: dict[str, dict[str, object]] = {}
    batch_statuses: list[dict[str, object]] = []
    for batch, batch_entries in grouped_batches(entries):
        kind = str(batch_entries[0]["kind"])
        manifest_path = inside_factory(ROOT / str(batch_entries[0]["manifest"]))
        qa_path = inside_factory(ROOT / str(batch_entries[0]["qaReport"]))
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        qa = json.loads(qa_path.read_text(encoding="utf-8"))
        expected_manifest_schema = (
            "satoru.traveller-female-approval-batch/1"
            if kind == "standard"
            else "satoru.traveller-female-contact-approval-batch/1"
        )
        expected_qa_schema = (
            "satoru.traveller-female-approval-qa/1"
            if kind == "standard"
            else "satoru.traveller-female-contact-qa/1"
        )
        if (
            manifest.get("schema") != expected_manifest_schema
            or manifest.get("id") != batch
            or manifest.get("runtimeEligible") is not False
            or manifest.get("publicArtWrites") is not False
            or manifest.get("approvedIdentity") != identity
        ):
            raise ValueError(f"unsafe, stale or wrong-identity manifest: {manifest_path.relative_to(ROOT)}")
        if (
            qa.get("schema") != expected_qa_schema
            or qa.get("batch") != batch
            or qa.get("passed") is not True
            or qa.get("automatedContractPassed") is not True
            or qa.get("runtimeEligible") is not False
        ):
            raise ValueError(f"batch QA is missing or not PASS: {qa_path.relative_to(ROOT)}")

        assets = manifest.get("assets")
        if not isinstance(assets, dict):
            raise ValueError(f"manifest has no asset map: {manifest_path.relative_to(ROOT)}")
        expected_frames = [str(entry["frame"]) for entry in batch_entries]
        if kind == "contact":
            if manifest.get("requiredFrames") != expected_frames or set(assets) != set(expected_frames):
                raise ValueError(f"contact frame order/set mismatch in {manifest_path.relative_to(ROOT)}")
        elif any(frame not in assets for frame in expected_frames):
            raise ValueError(f"standard manifest frame set mismatch in {manifest_path.relative_to(ROOT)}")

        batch_statuses.append(
            {
                "batch": batch,
                "kind": kind,
                "family": batch_entries[0]["family"],
                "frames": len(batch_entries),
                "manifest": str(manifest_path.relative_to(ROOT)),
                "qaReport": str(qa_path.relative_to(ROOT)),
                "automatedQaPassed": True,
                "runtimeEligible": False,
            }
        )
        for entry in batch_entries:
            frame = str(entry["frame"])
            asset = assets[frame]
            if not isinstance(asset, str) or Path(asset).name != asset:
                raise ValueError(f"unsafe output asset route for {batch}/{frame}: {asset!r}")
            output_path = inside_factory(manifest_path.parent / asset)
            reference_path = repo_path(str(entry["reference"]), label="male reference")
            if not output_path.is_file() or not reference_path.is_file():
                raise ValueError(
                    f"missing output/reference for {entry['targetKey']}: "
                    f"{output_path.relative_to(ROOT)} / {entry['reference']}"
                )
            if kind == "contact":
                frame_facts = manifest.get("frames", {}).get(frame, {})
                if frame_facts.get("reference") != entry["reference"]:
                    raise ValueError(f"contact reference mismatch for {batch}/{frame}")
            try:
                with Image.open(reference_path) as image:
                    reference_size = list(image.size)
                    reference_mode = image.mode
                    image.verify()
                with Image.open(output_path) as image:
                    output_size = list(image.size)
                    output_mode = image.mode
                    image.verify()
            except (OSError, SyntaxError) as error:
                raise ValueError(f"unreadable review image for {entry['targetKey']}: {error}") from error
            resolved_entry = {
                    **entry,
                    "referenceSha256": sha256(reference_path),
                    "referenceCanvas": reference_size,
                    "referenceMode": reference_mode,
                    "femaleOutput": str(output_path.relative_to(ROOT)),
                    "femaleOutputSha256": sha256(output_path),
                    "femaleCanvas": output_size,
                    "femaleMode": output_mode,
                    "batchQaPassed": True,
                    "manualReview": "approved",
                }
            resolved_by_key[str(entry["targetKey"])] = resolved_entry

    # A standard approval batch may contribute non-adjacent semantic frames
    # (bench-read-b is intentionally ordered after bench-read-a). Batch-level
    # validation is grouped for efficiency, but the review must retain the
    # canonical 1..46 contract order.
    resolved = [resolved_by_key[str(entry["targetKey"])] for entry in entries]
    validate_contract(resolved)
    output_routes = [str(entry["femaleOutput"]) for entry in resolved]
    if len(set(output_routes)) != EXPECTED_FRAME_COUNT:
        raise ValueError("combined review does not have 46 unique female outputs")
    return resolved, batch_statuses


def checker(size: tuple[int, int], cell: int = 20) -> Image.Image:
    image = Image.new("RGB", size, "#0d1724")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            fill = "#223348" if (x // cell + y // cell) % 2 else "#18283a"
            draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=fill)
    return image


def font(size: int, *, bold: bool = False) -> ImageFont.ImageFont:
    candidates = (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
        if bold
        else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    )
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def preview_image(path: Path, size: tuple[int, int]) -> Image.Image:
    stage = checker(size)
    with Image.open(path) as opened:
        image = opened.convert("RGBA")
        image.thumbnail((size[0] - 18, size[1] - 18), Image.Resampling.LANCZOS)
        left = (size[0] - image.width) // 2
        top = (size[1] - image.height) // 2
        stage.paste(image, (left, top), image)
    return stage


def render_family_sheet(
    family: str,
    entries: list[dict[str, object]],
    destination: Path,
) -> None:
    columns = 3 if len(entries) >= 6 else 2
    card_width = 620
    card_height = 350
    header = 116
    rows = math.ceil(len(entries) / columns)
    sheet = Image.new(
        "RGB",
        (columns * card_width, header + rows * card_height),
        "#07111d",
    )
    draw = ImageDraw.Draw(sheet)
    title_font = font(28, bold=True)
    label_font = font(17, bold=True)
    meta_font = font(14)
    draw.text(
        (26, 22),
        f"F2 FULL REVIEW / {FAMILY_LABELS[family]}",
        fill="#e5f5f8",
        font=title_font,
    )
    draw.text(
        (26, 64),
        f"{len(entries)} frames  ·  M REF vs F2 CAND  ·  AUTOMATED QA PASS / MANUAL APPROVED",
        fill="#7bdcf6",
        font=meta_font,
    )
    image_size = (286, 245)
    for index, entry in enumerate(entries):
        column = index % columns
        row = index // columns
        left = column * card_width
        top = header + row * card_height
        draw.rounded_rectangle(
            (left + 8, top + 8, left + card_width - 9, top + card_height - 9),
            radius=12,
            fill="#0d1a2a",
            outline="#24445b",
            width=2,
        )
        reference = repo_path(str(entry["reference"]), label="male reference")
        candidate = inside_factory(ROOT / str(entry["femaleOutput"]))
        for offset, path, tag in (
            (18, reference, "M REF"),
            (316, candidate, "F2 CAND"),
        ):
            preview = preview_image(path, image_size)
            sheet.paste(preview, (left + offset, top + 22))
            draw.rectangle(
                (left + offset + 7, top + 29, left + offset + 80, top + 56),
                fill="#0a1724",
            )
            draw.text(
                (left + offset + 14, top + 34),
                tag,
                fill="#72e2ff",
                font=meta_font,
            )
        draw.text(
            (left + 20, top + 280),
            f"{int(entry['order']):02d}  {entry['frame']}",
            fill="#f1f7f8",
            font=label_font,
        )
        draw.text(
            (left + 20, top + 313),
            str(entry["batch"]),
            fill="#91a8bb",
            font=meta_font,
        )
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, optimize=True)


def markdown(report: dict[str, object]) -> str:
    lines = [
        "# Female Traveller F2 — full 46-frame review",
        "",
        f"Automated package: **{'PASS' if report['automatedReviewPassed'] else 'FAIL'}**",
        "Manual review: **APPROVED — 46/46 frames**",
        "Runtime eligible: **YES for atomic promotion; this builder made no public/art writes**",
        "",
        f"Approved identity: `{report['approvedIdentity']['id']}`  ",
        f"SHA-256: `{report['approvedIdentity']['sha256']}`",
        f"Runtime revision: **`{report['runtimeExpectation']['revision']}` (immutable, exact ordered contract match)**",
        "",
        "## Counts",
        "",
        f"- Frames: **{report['counts']['frames']} / {EXPECTED_FRAME_COUNT}**",
        f"- Unique runtime targets: **{report['counts']['uniqueRuntimeTargets']}**",
        f"- Unique female outputs: **{report['counts']['uniqueFemaleOutputs']}**",
        "",
        "## Batch QA",
        "",
        "| Batch | Family | Frames | Automated QA | Runtime |",
        "|---|---|---:|---:|---:|",
    ]
    for batch in report["batches"]:
        lines.append(
            f"| `{batch['batch']}` | `{batch['family']}` | {batch['frames']} | "
            f"{'PASS' if batch['automatedQaPassed'] else 'FAIL'} | NO |"
        )
    lines.extend(["", "## Family sheets", ""])
    for family in FAMILY_ORDER:
        facts = report["families"][family]
        lines.append(
            f"- `{family}` — {facts['frames']} frames — `{facts['sheet']}`"
        )
    lines.extend(
        [
            "",
            "## Manual-review checklist",
            "",
        ]
    )
    lines.extend(
        f"- [{'x' if check['checked'] else ' '}] {check['item']}"
        for check in report["manualReviewChecklist"]
    )
    lines.extend(
        [
            "",
            "## Ordered targets",
            "",
            "| # | Family | Frame | Male reference | F2 output | Runtime target |",
            "|---:|---|---|---|---|---|",
        ]
    )
    for entry in report["frames"]:
        lines.append(
            f"| {entry['order']} | `{entry['family']}` | `{entry['frame']}` | "
            f"`{entry['reference']}` | `{entry['femaleOutput']}` | "
            f"`{entry['runtimeTarget']}` |"
        )
    lines.extend(
        [
            "",
            "Automated QA plus the recorded 46/46 manual review authorize the",
            "immutable pack for the separate atomic promotion gate. This review",
            "builder itself performs no public/runtime writes.",
            "",
        ]
    )
    return "\n".join(lines)


def build_report(
    entries: list[dict[str, object]],
    batch_statuses: list[dict[str, object]],
    manual_approval: dict[str, object],
) -> dict[str, object]:
    identity = load_approved_identity()
    families: dict[str, dict[str, object]] = {}
    for index, family in enumerate(FAMILY_ORDER, start=1):
        family_entries = [entry for entry in entries if entry["family"] == family]
        families[family] = {
            "frames": len(family_entries),
            "sheet": f"previews/{REVIEW_ID}/{index:02d}-{family}.png",
            "orders": [entry["order"] for entry in family_entries],
        }
    return {
        "schema": "satoru.traveller-female-f2-combined-review/1",
        "id": REVIEW_ID,
        "status": "manual-review-approved",
        "approvedIdentity": identity,
        "runtimeExpectation": {
            "source": "public/traveller-appearance-v1.js",
            "revision": REVISION,
            "immutable": True,
            "exactOrderedMatch": True,
        },
        "automatedReviewPassed": True,
        "manualReviewRequired": False,
        "manualReviewApproved": True,
        "manualReview": manual_approval,
        "runtimeEligible": True,
        "promotionRequired": True,
        "runtimePromotionState": "approved-by-review-not-copied",
        "publicArtWrites": False,
        "counts": {
            "frames": len(entries),
            "uniqueRuntimeTargets": len({entry["runtimeTarget"] for entry in entries}),
            "uniqueFemaleOutputs": len({entry["femaleOutput"] for entry in entries}),
            "families": {
                family: len([entry for entry in entries if entry["family"] == family])
                for family in FAMILY_ORDER
            },
            "batches": len(batch_statuses),
        },
        "families": families,
        "batches": batch_statuses,
        "manualReviewChecklist": [
            {"item": item, "checked": True} for item in MANUAL_CHECKLIST
        ],
        "frames": entries,
    }


def main() -> None:
    try:
        contract = review_contract()
        entries, batch_statuses = preflight(contract)
        manual_approval = load_manual_review_approval(entries)
        report = build_report(entries, batch_statuses, manual_approval)
    except ValueError as error:
        raise SystemExit(
            f"combined F2 review preflight failed; nothing was written:\n{error}"
        ) from error

    for index, family in enumerate(FAMILY_ORDER, start=1):
        family_entries = [entry for entry in entries if entry["family"] == family]
        render_family_sheet(
            family,
            family_entries,
            inside_factory(PREVIEW_ROOT / f"{index:02d}-{family}.png"),
        )
    QA_ROOT.mkdir(parents=True, exist_ok=True)
    (QA_ROOT / "review-summary.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (QA_ROOT / "review-summary.md").write_text(
        markdown(report),
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "review": REVIEW_ID,
                "frames": len(entries),
                "uniqueRuntimeTargets": report["counts"]["uniqueRuntimeTargets"],
                "automatedReviewPassed": True,
                "manualReviewRequired": False,
                "manualReviewApproved": True,
                "runtimeEligible": True,
                "publicArtWrites": False,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
