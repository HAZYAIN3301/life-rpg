# Shadow evolution v3 — canonical image-generation record

## Provenance note

The image tool did not persist a verbatim generation log next to the PNGs.
Therefore the text below is the **reconstructed production prompt contract**:
it records the exact canonical requirements recovered from the resulting
approved assets, the art audit and the normalization script. It must not be
misrepresented as a byte-for-byte transcript of the original tool request.

The approved Spirit was not regenerated. It remained the absolute identity and
material reference:

`references/shadow-spirit-approved.png`

The other three forms were generated as isolated chroma-keyed subjects, had
their green background removed, then were normalized onto the shared runtime
canvas.

## Shared canonical prompt

```text
Create one canonical evolution form of Shadow, the central companion and personal secretary character for the Satoru life-RPG.

Use the approved Spirit reference as the absolute source for family identity and medium. The result must unmistakably be the same being: rounded friendly face, black-violet oval eyes with a restrained lavender inner glow, tiny readable mouth, upward smoke-flame crown, and a tapering spectral construction.

Art direction: dark indigo and muted purple handcrafted cut-paper layers; clean readable silhouette; subtle warm-gold outlines and tiny warm accents; restrained smoky-watercolour translucency printed inside the matte paper; soft shallow shadows only between paper layers. Front-facing and centred. Calm, emotionally safe, attentive and intelligent — a trusted secretary and companion, never a monster or raid boss.

Keep the complete subject fully visible with generous padding. No text, logo or watermark. No scenery, floor, prop, reflection or cast shadow. Generate the isolated character on a perfectly flat uniform #00FF00 chroma-key field solely for deterministic background removal; the green must not illuminate or tint the subject. Final production output after post-process must have a transparent background.

Avoid photorealism, glossy 3D, realistic or liquid smoke, cinematic lighting, oversized glossy anime eyes, horror, skulls, anger, weapons, bodybuilder anatomy, complex armour, random particles, duplicated limbs, cropped silhouette, green spill and green fringe.
```

## Spark / Искра — reconstructed production prompt

Reference stack:

1. `references/shadow-spirit-approved.png` — identity and material;
2. legacy Spark — evolution semantics only, never its rendering style.

```text
Create the Spark tier by applying the shared canonical Shadow prompt.

Spark is the compact seed-like first evolution: one rounded indigo flame body, one tall clear S-curved flame crown, three to five large readable paper layers, a friendly small face, black-violet oval eyes with lavender inner glow, a tiny mouth and no separate humanoid torso. No arms, hands, armour, rune, crown or halo. It must read as the younger form of the approved Spirit, not as a generic fireball.

Front-facing, centred and fully visible. Preserve a simple animation-safe silhouette and large facial features that remain readable at 48–60 pixels.
```

Canonical pipeline files:

- keyed generation: `generated/shadow-spark-v3-keyed.png`;
- alpha output: `outputs/shadow-spark-v3.png`;
- normalized runtime: `runtime/shadow-spark-calm.png`.

## Guardian / Страж — reconstructed production prompt

Reference stack:

1. `references/shadow-spirit-approved.png` — identity and material;
2. legacy Guardian — protective silhouette and diamond motif only.

```text
Create the Guardian tier by applying the shared canonical Shadow prompt.

Guardian is the confident protective intermediate evolution of the same being: a taller humanoid layered-flame body, the same rounded face and oval lavender-glowing eyes, two clear arms and exactly two readable hands, broad smoke-wisp shoulders, one restrained central violet diamond sigil and a tapering spectral lower body. The pose is calm and dependable with hands relaxed at the sides.

Use a layered smoke mantle, not metal plate armour. No weapon, no crown and no full halo. Strong but warm; never muscular, aggressive, monstrous or boss-like.
```

Canonical pipeline files:

- keyed generation: `generated/shadow-guardian-v3-keyed.png`;
- alpha output: `outputs/shadow-guardian-v3.png`;
- normalized runtime: `runtime/shadow-guardian-calm.png`.

## Keeper / Хранитель — reconstructed production prompt

Reference stack:

1. `references/shadow-spirit-approved.png` — identity and material;
2. legacy Keeper — final-tier scale, halo and diamond hierarchy only.

```text
Create the Keeper tier by applying the shared canonical Shadow prompt.

Keeper is the final wise evolution of the same companion: a broad serene layered-flame figure, the same friendly rounded face and oval lavender-glowing eyes, exactly two arms and two open welcoming hands, a large central violet diamond, a flowing spectral mantle and one clean circular flame halo crowned by one smaller diamond. The pose is open, quiet and reassuring.

Keeper should feel ancient and intimate, like an old trusted friend, mentor and secretary. Never depict a villain, demon, warlord, raid boss, combat pose, weapon or heavy armour.
```

Canonical pipeline files:

- keyed generation: `generated/shadow-keeper-v3-keyed.png`;
- alpha output: `outputs/shadow-keeper-v3.png`;
- normalized runtime: `runtime/shadow-keeper-calm.png`.

## Deterministic runtime normalization

All four forms use canvas `1024×1024`, pivot `[512,535]`, composite origin
`(0,0)` and the following progression boxes:

| Form | Target box |
|---|---|
| Spark | `[362,320,662,750]` |
| Spirit | `[350,250,673,820]` |
| Guardian | `[272,140,752,900]` |
| Keeper | `[202,70,822,950]` |

The prompt supplies character material and design. The normalization script,
not the prompt, is authoritative for runtime scale and coordinates.
