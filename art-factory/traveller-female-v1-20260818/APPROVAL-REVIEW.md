# Traveller female v1 — approval review

Status: **NOT RUNTIME ELIGIBLE**. No file from this factory has been copied to `public/art` and the female selector remains disabled.

## Batch result

| Batch | Automated QA | Manual art gate | Decision |
|---|---|---|---|
| Core: idle, walk A/B, back view + derived blink | PASS | Required | Review candidate identity and locomotion |
| Pose: arms up | PASS | Required | Review candidate |
| Room: bench read A | PASS | Required | Review candidate and prop contact |
| Gamabunta: greet contact | PASS | Required | Review candidate and fist contact |
| Shadow Spark: attune | **FAIL** | Required | **Regenerate; do not promote or stretch** |

All eight real keyed inputs normalized to true alpha with `0%` visible magenta residue. The deterministic blink changes only the measured eye boxes and preserves alpha exactly.

The Shadow candidate is centered and preserves the intended width, but its visible height is only `0.676251×` the male reference (`[309,357,1060,992]` versus `[309,205,1060,1144]`). Its seated composition also does not reproduce the reference contact at the canonical scale. This is a generation problem, not a key-removal problem; the QA threshold was not weakened and the art was not stretched.

## Review surfaces

- Core identity and locomotion: `previews/approval-batches/female-core-01/contact-sheet.png`
- Arms-up pose: `previews/approval-batches/female-poses-01/contact-sheet.png`
- Reading pose: `previews/approval-batches/female-room-01/contact-sheet.png`
- Gamabunta contact: `previews/contact-approval-batches/female-gamabunta-01/contact-sheet.png`
- Shadow contact: `previews/contact-approval-batches/female-shadow-01/contact-sheet.png`

## Promotion gate

1. Albert approves or corrects the female identity, costume, proportions and current four candidate groups.
2. Regenerate Shadow Spark contact against the exact reference scale/choreography and pass automated plus manual review.
3. Produce the remaining launch inventory on the approved identity: core/locomotion/workshop and all Gamabunta, Katsuya, Mister P and Shadow contact plates.
4. Run full canvas/grounding/alpha/reference QA and runtime screenshots with zero male-path requests.
5. Only then copy a complete pack to `public/art`, mark `female` selectable and expose the 42px gender control.
