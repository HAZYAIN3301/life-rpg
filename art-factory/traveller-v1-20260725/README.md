# Traveller Avatar Art Factory — 2026-07-25

Versioned staging factory for the new modular Satoru Traveller Avatar. Nothing in this directory is loaded by the application runtime.

- Master canvas: `1024×1536`.
- Every production layer is a full-canvas transparent PNG and composites at `(0,0)`.
- `left` / `right` are character-relative, not viewer-relative.
- Pivots are real joints or attachment points and are never drawn into production art.
- Goggles, scarf, backpack, pouch and lantern are separate removable assets.
- The lantern owns its chain; the backpack must not contain a duplicate chain.
- Runtime integration and publication stay disabled until an assembled visual batch is approved.

## Factory layout

- `generated/traveller-assembled-control-keyed.png` — immutable green-key generation source.
- `outputs/control/traveller-assembled.png` — transparent assembled control master.
- `outputs/base/` — anatomy and clothing layers.
- `outputs/states/` — expression-only layers.
- `outputs/wearables/` — head, neck and back slot items.
- `outputs/accessories/` — pouch, lantern and future replaceable hand items.
- `previews/` — isolated contact sheets and assembled QA comparisons.
- `art-manifest.json` — authoritative IDs, z-order, pivots, dependencies and slots.
- `factory-qa.py` — validates PNG contracts and builds previews from current outputs without project package dependencies.

## Current gate

The control master is fixed. The first split contains only `avatar-torso`, `avatar-head`, and `avatar-face-eyes`. Remaining layers and all appearance variants are deferred until this split proves coordinate alignment and style continuity.
