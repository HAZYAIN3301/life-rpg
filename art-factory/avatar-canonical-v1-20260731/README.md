# Satoru avatar canonical rig v1

This factory freezes the previously approved slim anime cut-paper Traveller as
the only geometry source for future wearable art.

## Non-negotiable rules

- One permanent full body and head mannequin: `runtime/base/body-underlay-full.png`.
- Every runtime PNG is 1024×1536 and composites at `(0, 0)`.
- Arms, legs, shoulders, knees, boots and hands are not independent wardrobe
  slices. A complete outfit/footwear silhouette is one coherent bundle.
- Hair is a bundle (`hair-back` + `hair-front`). Hair-off reveals the canonical
  bald head; a hat may never contain baked-in hair.
- Outfit-off uses the full mannequin. Outfit-on uses the safe underlay plus the
  approved outfit bundle.
- Accessories may be toggled only when the final composite remains one connected
  subject. Detached alpha islands are a QA failure.
- Traveller and Scholar assets are not cross-mixed until Scholar is redrawn on
  this exact mannequin and pose.
- Runtime integration is blocked until the visual toggle matrix passes.

## Build and QA

Run `python3 clean_and_qa.py`. It removes only tiny detached pixels from the
topmost layer that owns them, rebuilds the visual matrix and writes
`qa-report.json`.

The first canonical source is the production-ready
`traveller-v1-wardrobe-v5` package. It reproduces the approved master
pixel-for-pixel; this factory adds the missing post-toggle connectivity gate.
