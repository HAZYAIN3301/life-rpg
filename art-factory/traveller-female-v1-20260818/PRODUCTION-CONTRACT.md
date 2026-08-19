# Traveller female v1 — production contract

Date: 2026-08-19
Status: F2 identity approved / first approval wave QA PASS / not runtime eligible
Runtime integration: closed

This factory produces a second canonical Traveller morphology. It does not
recolour or distort the approved male silhouette and it does not create the
cross-product of every appearance option. Choreography, world-space anchors,
props and runtime timing are shared; authored body/contact geometry remains
morphology-specific.

## Non-negotiable stage contract

- Canonical canvas: `640 × 900` RGBA PNG.
- Floor line: `y = 860` (the alpha bounding-box bottom is exactly `860`).
- Horizontal placement: centred from the measured alpha bounds.
- Scale is profile-driven, never inferred from one global fit:
  - core `idle`/walk: height `796`; `window-back`: `800`;
  - pose `arms-up`: `829`; `seated`: `693`;
  - room-action group: height `790`, maximum width `500`.
- Generation key: flat technical magenta `#FF00FF`.
- Production output: real alpha, transparent corners, no baked shadow, scene,
  text, logo or magenta halo.
- Runtime offsets are forbidden as a substitute for incorrect normalization.

The factory removes the non-uniform technical key, despills antialiased and
resampled edges, crops from measured alpha, applies the recorded frame profile,
and places the visible bottom on the shared floor. It never invents anatomy or
missing frames. Canonical teal and rust cannot enter the two-leading-channel
magenta despill branch and are covered by the synthetic smoke test.

## Identity and style

- The only approved identity is `female-f2-high-ponytail`, pinned by
  `APPROVED-IDENTITY.json` to
  `sources/identity-variants-04/candidate-f2-high-ponytail-keyed.png` and SHA-256
  `5d811618fc851eec48eb910c7efc98eec46e23a94919b376d3c64f5ae24d62da`.
- Young-adult female Traveller; confident mechanic-adventurer, not a child,
  chibi, mature redesign or pin-up.
- Same cut-paper vector family, material depth, lighting direction and detail
  density as the approved Traveller.
- Stable solid-black oval eyes without sclera, high ponytail with two
  face-framing locks, narrower shoulders, defined waist, fuller athletic
  hips/thighs, costume construction and palette across every authored pose.
- The silhouette is recognisably female inside the practical full-coverage
  costume and remains compatible with the existing Den scale.
- Complete connected anatomy in every pose: no sliced joints, floating hands,
  detached boots or prop-dependent body parts.

## Approval routing

Every build is isolated by a safe batch id:

```text
sources/approval-batches/<batch-id>/<frame>-keyed.png
outputs/approval-batches/<batch-id>/<frame>.png
outputs/approval-batches/<batch-id>/manifest.json
previews/approval-batches/<batch-id>/contact-sheet.png
qa/approval-batches/<batch-id>/qa-report.json
qa/approval-batches/<batch-id>/qa-report.md
```

The first approval batch is intentionally narrow:

1. `idle` — identity and scale gate;
2. `idle-blink` — derived locally, never generated;
3. `walk-a` and `walk-b` — complementary connected locomotion poses;
4. `window-back` — the existing window-dwell contract.

Approved F2 batch id: `female-core-f2-01`.

Automated QA passing means only that the files satisfy the measurable stage
contract. It never changes `runtimeEligible` to true. Visual approval must
confirm identity continuity, cut-paper craft, pose readability, anatomy and
absence of chroma contamination before any separate integration task may copy
assets to `public/art`.

## Deterministic blink

The blink is made only after `idle` is approved at its normalized `640 × 900`
position. Two eye boxes must be measured on that exact frame and supplied to
the builder:

```text
--eye-boxes '[[left,top,right,bottom],[left,top,right,bottom]]'
```

There are deliberately no guessed female eye coordinates in the factory. The
builder removes dark eye marks only inside the supplied boxes, inpaints from
neighbouring opaque paper, draws two closed lid curves and then restores the
idle alpha channel byte-for-byte. QA requires:

- identical alpha to `idle`;
- every changed pixel contained by an eye box;
- changed canvas ratio no greater than `0.6%`;
- no unrelated silhouette, clothing or texture drift.

## Source and write safety

- All required keyed inputs are preflighted before an output directory is
  created or a PNG is written.
- A source must have a measurable technical-magenta border. Already flattened,
  transparent or incorrectly keyed input is rejected rather than guessed.
- Existing batch outputs are not overwritten unless `--overwrite` is supplied
  explicitly.
- Batch ids and frame ids are validated; traversal and absolute output paths
  are rejected.
- Both scripts resolve every write under this factory directory.
- These scripts contain no promotion, copy, deploy or `public/art` code.
- Rejected generations remain in their source batch or are moved manually to a
  separately named archive; they are never silently promoted.

## Commands after generation

The approved F2 core batch is reproduced with the pinned identity and measured
eye boxes:

```bash
python3 art-factory/traveller-female-v1-20260818/build_core_pack.py \
  --batch female-core-f2-01 \
  --frames idle,walk-a,walk-b,window-back \
  --eye-boxes '[[278,166,295,194],[322,165,340,193]]'

python3 art-factory/traveller-female-v1-20260818/factory_qa.py \
  --batch female-core-f2-01
```

Do not substitute other identity files or guessed eye coordinates. Both core
and contact builders fail before writing when the pinned identity path or SHA
does not match.

## Later batches

After the core identity gate passes, the same builder routes explicitly listed
frames through their own `pose` or `room` scale profile. `arms-up` and `seated`
must not share the room-action profile; `bench-rest`, `bench-read-a`, and
`bench-read-b` intentionally share one room profile.

## Atomic contact batches

Contact geometry is authored and reviewed as a complete pair, never inferred
from the 640×900 Traveller plate. `contact-families.json` is the canonical
machine-readable contract.

```text
sources/approval-batches/<batch-id>/<frame>-keyed.png
outputs/contact-approval-batches/<batch-id>/<frame>.png
outputs/contact-approval-batches/<batch-id>/manifest.json
previews/contact-approval-batches/<batch-id>/contact-sheet.png
qa/contact-approval-batches/<batch-id>/qa-report.{json,md}
```

- `gamabunta`: `1536×1536`, ground `y=1470`, thirteen current pair-v4
  filenames, reference horizontal composition and a `#FF00FF` input key.
- `shadow`: `1254×1254`, four evolution-form plates, reference-bbox placement,
  and a `#FF00FF` input key. Semantic violet is preserved by using only bright
  technical-key extraction plus low-alpha edge cleanup.
- `--frames` may route a narrow approval subset, but every selected name must
  exist in the family's manifest. With no `--frames`, the complete family is
  required before the builder writes anything.
- Contact QA compares each candidate beside the active male reference, but
  never promotes or writes to the runtime tree.

Commands:

```bash
python3 art-factory/traveller-female-v1-20260818/build_contact_pack.py \
  --family gamabunta --batch female-gamabunta-01 --frames greet-contact
python3 art-factory/traveller-female-v1-20260818/contact_qa.py \
  --batch female-gamabunta-01

python3 art-factory/traveller-female-v1-20260818/build_contact_pack.py \
  --family shadow --batch female-shadow-01 --frames attune-spark
python3 art-factory/traveller-female-v1-20260818/contact_qa.py \
  --batch female-shadow-01
```

The first F2 approval wave is summarized in
`previews/female-f2-approval-overview.png`: eight authored frames plus the
deterministic blink all pass measurable QA, but remain approval-only. Palette
masks for hair, skin, eyes and clothing are a later layer contract. They must
not be baked into this morphology approval batch.
