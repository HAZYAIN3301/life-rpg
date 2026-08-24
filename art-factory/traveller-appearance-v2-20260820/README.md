# Traveller Appearance v2 — semantic-mask foundation

Factory-only foundation for deterministic skin, hair and eye recolouring. It
does not write to `public/` or enable runtime controls. All 92 mask/matte pairs
have now been authored and are eligible for whole-inventory machine QA. Manual
review remains a separate closed gate, so no mask is runtime-approved yet.

## Pinned inventory

- 92 immutable RGBA base PNGs: 46 male + 46 female F2.
- Core/motion/room: 11 frames per variant on `640×900`.
- Gamabunta, Katsuya and Mister P pair art: 31 frames per variant on
  `1536×1536`.
- Shadow pair art: 4 frames per variant on `1254×1254`.
- Every asset in `inventory.json` pins its exact route, canvas and SHA-256.

## Authoring contract

Each base needs two manually authored, same-canvas factory inputs:

1. `palette-masks-v1/<variant>/<capability>/<base filename>` — RGB PNG.
   Red is skin coverage, green is hair/eyebrows and blue is canonical
   Traveller eye marks. `R + G + B` may never exceed 255.
2. `traveller-mattes-v1/<variant>/<capability>/<base filename>` — L PNG.
   This is Traveller-only coverage and must exclude every guardian, Shadow,
   prop, particle and room element. It is a factory QA aid and is never a
   public runtime asset.

The future immutable public route for a validated mask is
`/art/avatars/traveller-appearance-v2/palette-masks-v1/<variant>/<capability>/<base filename>`.
Promotion remains a separate reviewed change.

An all-black mask or matte is invalid. Skin and hair must have coverage in
every frame. Eyes must also have coverage except for the two explicit
`core/window-back` assets, whose inventory entries declare
`expectedEmptyChannels: ["eyes"]`. PNGs with ICC, gAMA, sRGB, cHRM or
transparency metadata are rejected.

Do not derive these masks from global HSV thresholds. Pair images share skin,
hair and eye-like colours with Gamabunta, Katsuya, Mister P and Shadow. Start
from an isolated Traveller selection, manually correct anti-aliased boundaries,
then inspect the RGB overlay and deliberately unnatural diagnostic recolour.

## Approval batch 01

The first review is exactly 12 asset variants: male and female versions of
`core/idle`, `core/window-back`, `body-toad/greet-contact`,
`recovery-slug/breathe-in`, `resources-penguin/greet-contact` and
`shadow/attune-guardian`.

This batch covers the three canvas contracts, front/back views, all four
non-core scene families and the highest contamination risks. Missing or invalid
manual inputs block both QA and review-sheet creation without writing output.
The review sheet shows four panels: immutable base, cyan Traveller matte,
packed semantic RGB and a deliberately unnatural diagnostic recolour.

## Authored palettes and promotion

`palette-catalog.json` is the canonical OKLab ramp and algorithm contract.
`palette-golden-vectors.json` supplies byte-exact vectors for Python/JS parity,
including alpha preservation, paper-lightness residuals, packed-channel blends
and `floor(value * 255 + 0.5)` rounding.

`inventory.json` declares `producedMasks`, but validation measures complete
mask/matte pairs and rejects a stale count, wrong status transition, partial
pairs and orphan PNGs. A complete pair is not a manual approval.

`manual-approvals.json` is the separate human gate. Each approval must bind an
asset id to its validated base, mask and matte SHA. Only 92/92 machine PASS plus
92/92 ordered manual approvals can make `promote_runtime_manifest.py` emit
schema `satoru.traveller-semantic-mask-runtime/1` with status
`runtime-approved` and `runtimeEligible: true`. The earlier candidate manifest
always remains runtime-ineligible.

## Commands

Run from this directory:

```sh
python3 -B build_mask_inventory.py --foundation-only
python3 -B build_mask_inventory.py --scope approval
python3 -B factory_qa.py --scope approval
python3 -B build_review.py --scope approval
python3 -B palette_parity.py
python3 -B promote_runtime_manifest.py
python3 -B factory_smoke_test.py
```

The approval commands continue to cover the frozen 12-frame risk sample. Use
`--scope all` for the complete 92-frame machine gate and review sheet. Full
promotion still fails closed while `manual-approvals.json` remains `pending`.
`--scope all --write-candidate <path>` is gated on strict validation of all 92
assets and still emits a runtime-ineligible factory candidate requiring a
separate final approval.
