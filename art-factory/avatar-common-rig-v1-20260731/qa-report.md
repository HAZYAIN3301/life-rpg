# Common avatar rig v1 — QA report

Status: **PASS — ready for production**

## Art and file checks

- Scholar v2: 8 independently switchable production layers.
- Colorways: teal, blue, violet, crimson and forest.
- Runtime output: 40 RGBA PNG files, each exactly 512×768.
- Every layer composites at `(0,0)`, has real alpha, transparent corners and
  at least one visible pixel.
- Recolors preserve the alpha channel byte-for-byte.
- Traveller remains the canonical body, head, face and joint skeleton.

Machine-readable results:

- `qa-report.json` — per-layer alpha, visibility, checksum and recolor QA.
- `qa-runtime-report.json` — deployed-path and complete slot-space QA.

## Combination checks

- 8 slots expose 1,944 raw combinations across one palette.
- The same contract is valid for all 5 colorways.
- Lantern dependency is deterministic: choosing the Traveller lantern equips
  the Traveller backpack; choosing another backpack removes the lantern.
- Scholar and Traveller clothes and equipment can be mixed without changing
  the body, face or joint coordinates.

## Browser checks

Verified in the real local PWA with the X7 demo profile:

- Traveller and Scholar preset buttons populate slots correctly.
- All 21 Scholar-preset image layers load successfully.
- Mixed Scholar coat + Traveller scarf, goggles, backpack, pouch and lantern
  loads without an empty frame or floating fragments.
- `no hair + no headwear + no eyewear` shows the clean canonical head with no
  leftover glasses, duplicated eyebrows or wig fragments.
- 390×844 viewport uses a one-column slot layout; no avatar images fail.
- Character reaction moves rig pieces around their pivots rather than moving a
  complete character PNG.

## Known boundary

This release provides honest joint-based reactions and shared wardrobe slots.
Walking, sitting, writing and training still require separately authored pose
layers; they are intentionally not represented by whole-image translations.
