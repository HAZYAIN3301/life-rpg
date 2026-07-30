# Den v3 — audio-lair starter furniture QA

Date: 2026-07-30
Batch owner: `audio_lair_audit`
Result: **PASS — 3/3 production layers**

## Scope

This independent art-only batch adds one rig-ready transparent starter layer for each requested Den v3 slot:

- `surface-crate` — folding campaign table;
- `comfort-bonsai` — Bonsai of the Path;
- `keepsake-blades` — two-blade keepsake rack.

No runtime integration was performed. `app.js` and `styles.css` were not changed.

## Automated QA

| Item | Canvas | Alpha bbox | Coverage | Chroma-like | Edge chroma | Result |
|---|---:|---:|---:|---:|---:|---:|
| `surface-crate` | 1024×704 | 32,44–992,680 | 57.07% | 1 px / 0.000243% | 30 / 0.269421% | PASS |
| `comfort-bonsai` | 848×1024 | 35,40–813,1000 | 47.36% | 0 px | 12 / 0.028356% | PASS |
| `keepsake-blades` | 640×1024 | 37,40–602,1000 | 37.78% | 0 px | 0 | PASS |

All three files:

- are RGBA PNGs with real transparency;
- have four fully transparent corners;
- fit within the 960 px maximum subject long edge;
- preserve a stable bottom contact baseline;
- have safety padding and a canvas rounded to 16 px;
- pass the chroma contamination thresholds.

Machine-readable results: `audio-lair-starter-v3-qa.json`.

## Visual QA

- Premium cut-paper / painterly material treatment is consistent across the three objects.
- Warm upper-left light and restrained cool upper-right rim match the Den v3 background.
- Perspective is compatible with the canonical 16:9 room: nearly frontal, shallow depth and slight top visibility.
- Each item remains recognisable at its current runtime display size.
- No text, characters, pets, baked cast shadows, detached decoration or unwanted background survived the alpha pass.
- The table has a deliberately empty surface for future prop composition.
- The bonsai uses broad connected foliage masses, so a later leaf motion rig does not depend on tiny fragments.
- The keepsake rack reads as one connected object with exactly two sheathed blades and supports a future local glint animation.

## Placement QA

The scene composite uses the current runtime slot values, without manual per-preview nudging:

| Slot | Placement |
|---|---|
| `surface` | right 7%, bottom 3%, width 20%, z-index 4 |
| `comfort` | left 0%, bottom 18%, width 13%, z-index 3 |
| `keepsake` | right 0%, bottom 18%, width 13%, z-index 3 |

At those values:

- all three items stay inside the 1536×864 room;
- the centre staging corridor remains clear for Traveller, Shadow and pets;
- silhouettes remain separated enough to identify the slots;
- the lower-right table and blade rack create a plausible furnished cluster without covering the room's primary focal area.

Preview: `previews/audio-lair-starter-v3-den-composite.png`.
Contact sheet: `previews/audio-lair-starter-v3-contact-sheet.png`.

## Production provenance

- One item was generated per prompt and per layer.
- Source generation used a flat `#00ff00` background.
- Chroma removal used the ImageGen skill's local `remove_chroma_key.py` helper with soft matte and despill.
- Tight normalization and QA were produced by `build-audio-lair-starter-furniture-v3.py`.
- Prompts and post-processing contract are frozen in `audio-lair-starter-v3-generation-prompts.md`.

## Runtime boundary

This batch is ready for integration but is intentionally not wired into the app. The integrator should use the production PNGs and slot data from `audio-lair-starter-v3-manifest.fragment.json`; source-green and raw-alpha files are provenance only.
