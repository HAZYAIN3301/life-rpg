# Traveller female v1 — QA: `female-core-01`

Automated result: **PASS**
Runtime eligible: **NO — manual art approval is still required**

## Stage contract

- Canvas: `640 × 900` RGBA.
- Floor line: `y=860`.
- Technical key: `#FF00FF`, converted to real alpha.
- Outputs and QA remain inside this factory approval batch.

## Frames

| Frame | Canvas | Bbox | Magenta | Result |
|---|---:|---:|---:|---:|
| `idle` | `[640, 900]` | `[179, 64, 460, 860]` | `0.000000%` | PASS |
| `walk-a` | `[640, 900]` | `[169, 64, 471, 860]` | `0.000000%` | PASS |
| `walk-b` | `[640, 900]` | `[178, 64, 462, 860]` | `0.000000%` | PASS |
| `window-back` | `[640, 900]` | `[212, 60, 428, 860]` | `0.000000%` | PASS |
| `idle-blink` | `[640, 900]` | `[179, 64, 460, 860]` | `0.000000%` | PASS |

## Deterministic blink

- Changed pixels: `659` (`0.114410%`).
- Changed outside measured eye boxes: `0`.
- Alpha identical to idle: `True`.
- Result: **PASS**.

## Manual approval gate

Automated PASS does not approve identity, anatomy or art direction. Review the contact sheet for:

- the same adult female identity, proportions, hair and costume in every frame;
- readable connected locomotion and coherent back-view construction;
- canonical cut-paper material and lighting without style drift;
- no sexualisation, infantilisation, detached anatomy or baked scene content.

Contact sheet: `previews/approval-batches/female-core-01/contact-sheet.png`.
