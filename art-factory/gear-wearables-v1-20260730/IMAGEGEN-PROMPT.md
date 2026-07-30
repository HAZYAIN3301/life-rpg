# w1 material source · imagegen handoff

## References

1. `../traveller-v1-wardrobe-v5/previews/neutral-transparent.png` —
   authoritative cut-paper texture, edge treatment, lighting and palette.
2. `../traveller-scholar-v1-20260728/previews/scholar-approved-transparent.png`
   — authoritative detail level and the same Satoru rendering language.

References define style only. They do not define item geometry or avatar
placement.

## Prompt

> Create a single isolated full-length training sword asset for the Satoru
> life-RPG avatar wardrobe.
>
> Exactly one recognizable beginner's training sword: a blunt wooden
> practice blade inspired by a bokken, but with a compact fantasy crossguard
> and a leather-wrapped grip so it reads immediately as a sword at small
> size. Common-tier, humble and practical, not magical, no glow, no gems.
> Warm walnut blade, darker brown grip, muted brass crossguard and pommel.
> Slightly charming handmade asymmetry and visible layered paper fibers.
>
> Full object visible with generous padding; perfectly vertical, tip
> pointing straight up, pommel down; centered orthographic front view; no
> perspective tilt. No hand, character, sheath, badge, frame, text, symbols,
> extra objects or cast shadow.
>
> Uniform solid chroma green background `#00FF00` covering every background
> pixel including corners. No gradient, texture or green reflection.
>
> Square raster source, detailed enough for both a 96px inventory icon and
> deterministic placement on 1024×1536 paper-doll avatars.

## Source and alpha

- keyed output: `generated/w1-material-keyed.png`;
- chroma-removed output: `generated/w1-material-alpha.png`;
- production silhouette is not copied from the model: it is rebuilt by
  `build_w1_pilot.py` from `SWORD_PARTS` and fixed landmarks.
