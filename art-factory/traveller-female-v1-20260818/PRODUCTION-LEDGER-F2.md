# Traveller female F2 — full production ledger

Status: **production complete; all factory QA and parent visual review passed;
immutable runtime promotion complete; enabled in PWA v167**.

Factory gate authority: `PRODUCTION-INVENTORY-F2.json`
Runtime authority: `public/art/avatars/traveller-core-v1/female/f2-v1/manifest.json`
Prompt authority: `PRODUCTION-PROMPTS-F2.md`

## Identity lock

- Approved source: `sources/identity-variants-04/candidate-f2-high-ponytail-keyed.png`
- SHA-256: `5d811618fc851eec48eb910c7efc98eec46e23a94919b376d3c64f5ae24d62da`
- Old short-haired female batches are not references.
- Every generated frame uses F2 as identity reference and the exact active male
  asset recorded in the JSON ledger as choreography reference.

## Arithmetic

| Family | Runtime frames | Authored | Derived | Produced | QA | Manual review | Pending generation |
|---|---:|---:|---:|---:|---|---|---:|
| Core + room | 11 | 10 | 1 blink | 11 | PASS | complete | 0 |
| Gamabunta | 13 | 13 | 0 | 13 | PASS | complete | 0 |
| Recovery / Katsuya | 6 | 6 | 0 | 6 | PASS | complete | 0 |
| Resources / Mister P | 12 | 12 | 0 | 12 | PASS | complete | 0 |
| Shadow | 4 | 4 | 0 | 4 | PASS | complete | 0 |
| **Total** | **46** | **45** | **1** | **46** | **PASS** | **complete** | **0** |

The canonical pack remains exactly 46 runtime targets: 45 authored plates plus
the deterministic `idle-blink` derived from `idle`. No generation or promotion
work remains. `PRODUCTION-INVENTORY-F2.json` intentionally preserves the exact
promotion-ready input state; the signed per-file runtime state lives in the
immutable public manifest named above.

## Produced batches

The machine ledger contains every exact source, active male reference and
runtime target. These are the only current F2 production batches; stale split
or pending batch ids are retired.

| Batch id | Frames | Factory QA | Parent visual review |
|---|---|---|---|
| `female-core-f2-01` | `idle`, derived `idle-blink`, `walk-a → walk-b`, `window-back` | PASS | complete |
| `female-poses-f2-01` | `arms-up` | PASS | complete |
| `female-poses-f2-full-01` | `seated` | PASS | complete |
| `female-room-f2-01` | `bench-read-a` | PASS | complete |
| `female-room-f2-full-01` | `bench-rest → bench-portal-reach`; `bench-read-b` | PASS | complete |
| `female-gamabunta-f2-full-01` | all 13 active `pair-v4` contact frames | PASS | complete |
| `female-recovery-f2-full-01` | all 6 active recovery frames | PASS | complete |
| `female-resources-f2-full-01` | all 12 active Mister P frames | PASS | complete |
| `female-shadow-f2-full-01` | `attune-spark → attune-spirit → attune-guardian → attune-keeper` | PASS | complete |

Every authored keyed source is stored at
`sources/approval-batches/<batch-id>/<source>`; outputs and QA reports use
the matching batch id under `outputs` and `qa`.

Recovery keeps the active corrected immutable route:
`stretch-soft-b-keyed.png` →
`pair-v3/female/f2-v1/stretch-soft-b-v155.png`.
The quarantined `pair-v2/stretch-b.png` is never used.

## Per-family stage contract

- Core/room: `640×900`, real alpha, floor `y=860`, frame-specific profile.
- Gamabunta: atomic pair on `1536×1536`, shared ground `y=1470`.
- Katsuya: atomic pair on `1536×1536`; preserve the exact active reference
  composition for each frame rather than imposing Gamabunta geometry.
- Mister P: atomic pair on `1536×1536`, shared ground `y=1470`.
- Shadow: atomic pair on `1254×1254`, reference-bbox placement. Preserve the
  corresponding form's semantic violet while removing technical key.

No pair is assembled from independent character stickers. The approach and
return remain live runtime actors; only the contact/action moment uses the
atomic plate.

## Promotion state

Production and review:

1. Every exact active male reference and authored source path exists.
2. All nine current batches pass their unweakened factory QA.
3. All continuity groups passed ordered side-by-side review.
4. Parent visual inspection approved F2 identity, black-eye grammar, ponytail,
   figure, costume, paper material, choreography and prop contact.
5. All 46 runtime targets are accounted for: 45 authored plus one derived.

Runtime activation:

- `promote_runtime_f2.py --promote --confirm-resources-pass` copied all 46
  files atomically to their exact immutable `/female/f2-v1/` targets and wrote
  the runtime-approved manifest; `--verify` rechecked 46/46 SHA/canvas entries.
- All seven capability gates and four contact-controller female authoring gates
  are enabled; no female resolver can fall back to male.
- The account-owned selector is active in PWA v167 and passed save/reload plus
  real contact-scene QA at mobile, desktop, portrait and landscape sizes.
