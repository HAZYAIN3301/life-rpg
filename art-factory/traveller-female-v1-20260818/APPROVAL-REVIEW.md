# Traveller female F2 — approval review

Status: **IDENTITY APPROVED; APPROVAL WAVE READY; NOT RUNTIME ELIGIBLE**. Albert approved F2 (`candidate-f2-high-ponytail-keyed.png`) on 2026-08-19. No F2 file from this factory has been copied to `public/art`; the female selector remains disabled until the complete 46-frame inventory passes QA.

## Canonical identity

- Identity id: `female-f2-high-ponytail`
- Source: `sources/identity-variants-04/candidate-f2-high-ponytail-keyed.png`
- SHA-256: `5d811618fc851eec48eb910c7efc98eec46e23a94919b376d3c64f5ae24d62da`
- Locked traits: young adult high ponytail, two face-framing locks, solid-black oval eyes without sclera, canonical cut-paper costume, narrower shoulders, defined waist and fuller athletic hips/thighs.
- All earlier short-haired female approval batches are historical controls and cannot be promoted or mixed into F2.

## F2 approval-wave result

| Batch | Automated QA | Manual art gate | Decision |
|---|---|---|---|
| `female-core-f2-01`: idle, walk A/B, back + derived blink | PASS | Review continuity | Ready for review |
| `female-poses-f2-01`: arms up | PASS | Review expression/anatomy | Ready for review |
| `female-room-f2-01`: bench read A | PASS | Review seat/book contact | Ready for review |
| `female-gamabunta-f2-01`: greet contact | PASS | Review fist contact/occlusion | Ready for review |
| `female-shadow-f2-01`: Spark attune | PASS | Review hand distance/Shadow identity | Ready for review |

All outputs have real alpha, transparent corners, canonical canvases and measurable placement. Core/pose/room bottom is exactly `y=860`; Gamabunta is grounded at `y=1470`; Shadow matches the male reference height with `0.5px` centre delta. The initial F2 Shadow build exposed an enclosed technical-magenta hole behind the hair: the factory now removes only enclosed components demonstrably sampled from the border key palette, while preserving semantic Shadow violet. Final technical-key residue is below the unchanged `0.05%` gate.

Combined cross-batch review: `previews/female-f2-approval-overview.png`.

## Historical first wave

## Batch result

| Batch | Automated QA | Manual art gate | Decision |
|---|---|---|---|
| Core: idle, walk A/B, back view + derived blink | PASS | Required | Review candidate identity and locomotion |
| Pose: arms up | PASS | Required | Review candidate |
| Room: bench read A | PASS | Required | Review candidate and prop contact |
| Gamabunta: greet contact | PASS | Required | Review candidate and fist contact |
| Shadow Spark v1: attune | **FAIL** | Archived as rejected | Do not promote or stretch |
| Shadow Spark v2: attune | PASS | Required | Review corrected candidate |

All eight real keyed inputs normalized to true alpha with `0%` visible magenta residue. The deterministic blink changes only the measured eye boxes and preserves alpha exactly.

Shadow v1 remains preserved as an honest rejected control: its visible height was only `0.676251×` the male reference (`[309,357,1060,992]` versus `[309,205,1060,1144]`). Shadow v2 was regenerated rather than stretched. A border-connected matte fix removes the non-uniform technical background without erasing the semantic purple actor; its normalized bbox is `[324,205,1046,1144]`, reference height ratio `1.0`, width ratio `0.961385`, centre delta `0.5px` and technical-key residue `0.044126%` against a `0.05%` gate.

## Review surfaces

- Core identity and locomotion: `previews/approval-batches/female-core-01/contact-sheet.png`
- Arms-up pose: `previews/approval-batches/female-poses-01/contact-sheet.png`
- Reading pose: `previews/approval-batches/female-room-01/contact-sheet.png`
- Gamabunta contact: `previews/contact-approval-batches/female-gamabunta-01/contact-sheet.png`
- Shadow rejected control: `previews/contact-approval-batches/female-shadow-01/contact-sheet.png`
- Shadow corrected candidate: `previews/contact-approval-batches/female-shadow-02/contact-sheet.png`

## Promotion gate

1. Manually review the combined F2 approval wave for identity continuity, ponytail construction, anatomy, prop/contact occlusion and readable choreography.
2. Produce the remaining launch inventory on F2 only: core/locomotion/workshop and all Gamabunta, Katsuya, Mister P and Shadow contact plates.
3. Run full canvas/grounding/alpha/reference QA and runtime screenshots with zero male-path requests.
4. Promote to new immutable F2 URLs; never overwrite the cached rejected female pose URLs in place.
5. Only then mark `female` selectable and expose the accessible gender control.
