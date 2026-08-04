# BODY Guardian + Traveller Pair v2 — runtime integration

Date: 2026-08-03  
Scope: approved BODY toad and approved male Traveller

## What ships

- One canonical guardian for domain `body`: `Жабий сэнсэй`.
- Four toad states on a shared `1024 × 1024` stage: `calm`, `thriving`, `strained`, `restoring`.
- Deterministic calm breathing loop and decoded state cross-fades.
- One active male Traveller with three standalone authored poses: `idle`, `arms-up`, `window-back`.
- Five authored pair frames on one `1536 × 1536` stage with shared ground line `y=1470`:
  - `greet-contact` — readable fist-bump;
  - `rest-contact` and `rest-pet` — Traveller is physically seated on the floor and moves his hand from the toad's shoulder to its brow ridge;
  - `train-low` and `train-high` — two articulated phases of the warm-up loop.
- Pair frames decode before the separate avatar and guardian are hidden. The original state returns after a finite timer.
- Two-pose loops use a discrete frame switch; there is no opacity overlap that could create doubled hands, faces, or limbs.
- Pair composition is atomic. Runtime never attempts to align a hand and shoulder from unrelated sprites.

## Domain ownership and state mapping

The guardian belongs to canonical domain `body`, not to every user-created sphere. Runtime selects the highest-XP top-level sphere for which `canonOf(sphere) === "body"`.

| Existing pet state | BODY visual state | Meaning |
|---|---|---|
| `hungry` | `strained` | body lacks recent attention |
| `growing` | `calm` | sustainable rhythm |
| `full` | `thriving` | domain is progressing |
| `overfed` | `restoring` | overload should turn into recovery |

## Honest animation boundary

The approved standalone toad is flattened, so it retains grounded full-sprite breathing and authored state swaps. Physical contact and exercise use separately authored whole-pair frames. No cut masks, floating joint fragments, uniform squash, or viewport-specific manual offsets are used.

Implemented:

- a finite two-frame petting loop with hand-to-shoulder and hand-to-brow contact;
- fist-bump contact;
- a finite two-pose exercise loop;
- floor-correct seated rest;
- reduced-motion fallback to a static authored frame.

Separate future batch:

- walking around the room;
- standalone face blink layer;
- more guardians and corresponding matched-pose packs.

## Den Life v1 addendum — 2026-08-04

`public/den-life-v1.js` supplies sparse deterministic direction around this
asset contract. It animates only the full standalone sprite and calls the
existing atomic `train` pair once when a running focus session belongs to
canonical domain `body`. It never slices the approved toad.

The director pauses for manual interactions, locomotion, room actions, pair
contact, edit mode, overlays, hidden documents, and reduced-motion. A blocked
pair remains pending until it successfully starts.

## Active and archived avatar scope

- Active: male Traveller only.
- Active standalone poses: `idle`, `arms-up`, `window-back`.
- Archived but not loaded: rejected female draft and old `seated` pose designed around an absent chair.
- Personalization remains focused on guardians and the Den rather than combinatorial human clothing.

## Files

- Runtime module: `public/body-toad-v1.js`.
- Toad runtime assets: `public/art/pets/body-toad-v1/states/` and `motion/`.
- Pair runtime assets: `public/art/pets/body-toad-v1/pair-v2/`.
- Source pair assets: `sources/body-toad/pair-v2/`.
- Normalizer: `build_body_pair_v2.py`.
- Pair QA: `outputs/body-toad/pair-v2/qa-report.json`.
- Visual proof: `previews/body-toad-pair-v2-contact-sheet.jpg`.
- Contract tests: `scripts/body-toad-v1.test.js`, `scripts/traveller-core-v2.test.js`.

## QA contract

- Pair frames: exactly `1536 × 1536`.
- Shared ground line: `y=1470`.
- Real alpha and zero-alpha corners.
- No female asset in active constants, prefetch, or service-worker shell.
- No standalone `seated` pose in active controls.
- JavaScript syntax and full Node suite must pass.
- Browser acceptance: all three interactions render in the Den, restore cleanly, survive mobile viewport changes, and produce zero console errors.
