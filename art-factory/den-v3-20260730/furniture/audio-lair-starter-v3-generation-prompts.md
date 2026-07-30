# Den v3 — audio-lair starter furniture prompt set

Batch owner: `audio_lair_audit`
Date: 2026-07-30
Generation mode: built-in ImageGen, exactly one object and one finished layer per prompt.

## Reference roles

- `../den-v3-runtime-1536x864.png` — canonical 16:9 room, camera angle, warm/cool lighting and placement context.
- `../../traveller-v1-corrected-delivery/previews/current-assembled-corrected.png` — target cut-paper character material language and edge quality.
- `../../runtime-staging/life-rpg/public/art/pets/fortune-v2/fortune-v2-preview.png` — target painterly detail density and premium finish.

References guide style and perspective only. They are not to be copied into the generated layer.

## Shared production contract

- One prompt produces one isolated furniture item.
- Perfectly flat chroma-key green `#00ff00` background.
- No room, floor, wall, cast shadow, reflection, text, labels, people, animals or extra props.
- Premium 2D cut-paper / paper-craft silhouette with painterly material detail, visible paper layering and restrained tactile grain.
- Palette: charcoal, dark walnut, leather brown, muted teal, aged copper and parchment cream.
- Light: warm amber key from upper-left/front, restrained cool rim from upper-right.
- Camera: almost frontal, shallow three-quarter depth, slight top-surface visibility, straight verticals; compatible with the canonical Den v3 room.
- Readable at small runtime size; strong outer silhouette; no tiny floating pieces.
- Avoid flat SVG geometry, childish clip-art, glossy plastic 3D, photorealism and baked-in environment lighting.

## surface-crate

Target slot: `surface`
Runtime intent: compact starter work surface at the lower-right of the Den.

```text
Create one isolated compact folding campaign table for a premium life-RPG den interface. The table is a clever traveller's field desk: a broad empty dark-walnut tabletop, sturdy folding crossed supports, restrained aged-copper hinges and braces, a narrow muted-teal inlay and subtle parchment-paper layered edges. It must look functional, memorable and suitable for a detailed paper-cut traveller avatar, not like a generic wooden crate. Keep the tabletop completely empty so later props can be composited on it.

Premium 2D cut-paper / paper-craft construction with painterly material finish, tactile paper fibres, layered cut edges, controlled highlights and finely painted wood grain. Strong clean silhouette readable at small size. Nearly frontal shallow three-quarter view, slightly visible tabletop, straight verticals. Warm amber key light from upper-left/front and a restrained cool upper-right rim, matching the supplied Den v3 interior. Wide 4:3 object composition with comfortable green margin around the entire object.

Background must be perfectly flat uniform chroma-key green #00ff00. No room, no floor, no wall, no cast shadow, no reflection, no text, no labels, no character, no pet, no loose tools, no books, no objects on the tabletop, no scenery. No flat SVG icon, no simplistic geometry, no glossy plastic 3D and no photorealism. Exactly one complete table, fully visible and not cropped.
```

## comfort-bonsai

Target slot: `comfort`
Runtime intent: calm organic accent at the lower-left of the Den.

```text
Create one isolated “Bonsai of the Path” for a premium life-RPG den interface. A compact old bonsai with an expressive twisting trunk, exposed roots and exactly three to five broad, clearly separated foliage masses. Foliage is deep desaturated blue-teal mixed with dusty sage, shaped into a memorable windswept traveller silhouette. The tree sits in one low faceted hexagonal charcoal ceramic pot with an aged-copper rim and a narrow muted-teal band. Add only restrained parchment-coloured cut-paper highlights; keep every branch and leaf mass attached to the main object.

Premium 2D cut-paper / paper-craft construction with painterly botanical detail, tactile paper fibres, layered cut edges and controlled material shading. Strong clean silhouette readable at small size, with no fragile floating leaves. Nearly frontal shallow three-quarter view, slight visibility of the pot opening, straight verticals. Warm amber key light from upper-left/front and a restrained cool upper-right rim, matching the supplied Den v3 interior. Tall 4:5 object composition with comfortable green margin around the entire object.

Background must be perfectly flat uniform chroma-key green #00ff00. No room, no floor, no wall, no cast shadow, no reflection, no text, no label, no character, no pet, no stones, no gardening tools and no extra props. No neon green foliage, no flat SVG icon, no childish clip-art, no glossy plastic 3D and no photorealism. Exactly one complete bonsai and pot, fully visible and not cropped.
```

## keepsake-blades

Target slot: `keepsake`
Runtime intent: recognisable traveller keepsake at the lower-right wall-side zone.

```text
Create one isolated freestanding traveller's blade rack for a premium life-RPG den interface. A compact dark-walnut display stand holding exactly two fully sheathed travel blades: one full-length practical sword and one clearly shorter utility blade. Both weapons remain safely in their scabbards. Use leather-brown wraps, muted-teal scabbard panels, small aged-copper fittings and restrained parchment-paper edge highlights. The rack and both sheathed blades must form one connected, stable silhouette that reads immediately as a keepsake weapon stand, not as loose weapons or a coat rack.

Premium 2D cut-paper / paper-craft construction with painterly material finish, tactile paper fibres, layered cut edges, finely painted wood and leather, controlled metallic glints. Strong clean silhouette readable at small size. Nearly frontal shallow three-quarter view, slight top visibility, straight verticals. Warm amber key light from upper-left/front and a restrained cool upper-right rim, matching the supplied Den v3 interior. Tall 4:5 object composition with comfortable green margin around the entire object.

Background must be perfectly flat uniform chroma-key green #00ff00. No room, no floor, no wall, no cast shadow, no reflection, no text, no labels, no character, no pet, no blood, no exposed blade edge, no extra weapon and no scenery. No flat SVG icon, no simplistic geometry, no glossy plastic 3D and no photorealism. Exactly one complete connected rack with exactly two sheathed blades, fully visible and not cropped.
```

## Post-processing contract

1. Remove the green key with `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`.
2. Tight-crop by non-zero alpha.
3. Resize in premultiplied-alpha space to a maximum subject long edge of 960 px.
4. Add 32 px side/top safety padding and 24 px bottom padding; round canvas dimensions up to a 16 px multiple.
5. Preserve the bottom contact baseline and export RGBA PNG.
6. Composite using the current Den v3 slot positions recorded in `audio-lair-starter-v3-manifest.fragment.json`.
