# Traveller female v1 — approval review

Status: **NOT RUNTIME ELIGIBLE**. No file from this factory has been copied to `public/art` and the female selector remains disabled.

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

1. Albert approves or corrects the female identity, costume, proportions and current four candidate groups.
2. Manually approve the corrected Shadow Spark contact; its automated geometry/alpha/chroma gate now passes.
3. Produce the remaining launch inventory on the approved identity: core/locomotion/workshop and all Gamabunta, Katsuya, Mister P and Shadow contact plates.
4. Run full canvas/grounding/alpha/reference QA and runtime screenshots with zero male-path requests.
5. Only then copy a complete pack to `public/art`, mark `female` selectable and expose the 42px gender control.
