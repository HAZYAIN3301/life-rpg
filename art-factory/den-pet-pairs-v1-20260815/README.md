# Den pet-pair v1

First production pair for autonomous resident-to-resident scenes.

- Source: two ImageGen frames on a technical blue field.
- Geometry: authored atomically; no independent portrait composition.
- Normalization: `1536×1536` RGBA via `build_assets.py`.
- Runtime: `public/art/pets/den-pet-pairs-v1/body-recovery/`.
- QA: real alpha, transparent border, non-empty bbox and shared canvas.
- Reward contract: decorative resident life only; never grants XP, gold or bond.

Run: `python3 build_assets.py`.
