# Fortune Cat Art Factory — 2026-07-16

Versioned staging area for `ART-BATCH-FACTORY.md`. Nothing in this directory is loaded by `public/app.js`.

- `art-manifest.json` — batches, slots, pivots, z-order and deliverables.
- `outputs/` — transparent 1024×1024 production candidates.
- `previews/` — contact sheets and assembled QA compositions.
- `qa-report.json` / `qa-report.md` — machine- and human-readable validation reports.
- `factory-qa.mjs` — assembles previews and validates size/alpha/corners/coverage/chroma fringe.
- `fit-generated-layer.py` — fits a generated recolor into the approved layer's exact alpha geometry.
- `place-generated-layer.py` — places a new isolated item inside its final master-canvas box.

Current staging batch: 24 generated PNG assets across state faces, the `ivory-vermilion` skin, props, wearables, and the single allowed `spirit + calm` Shadow style-check.

The approved `public/art/pets/fortune-v2/` obsidian-gold source is read-only for this batch.

The final QA report is authoritative for this staging batch. Runtime integration remains intentionally disabled until visual approval.
