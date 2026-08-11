# Shadow Den v1

Production set for Shadow interactions inside the Den.

## Runtime contract

- Solo actions use the current canonical Shadow form through `ShadowRig`: greet, listen, think, speak.
- Pair actions use one atomic Traveller + Shadow frame per evolution form: Spark, Spirit, Guardian, Keeper.
- Pair frames are decorative scene actors (`alt=""`, `aria-hidden="true"`); the triggering controls keep the accessible name.
- Manual actions do not grant repeat rewards. The existing once-per-day bond action remains separate.
- Den Life may schedule quiet Shadow solo and pair beats, but postpones itself after manual interaction.
- A pair scene is never assembled from independently scaled portraits. The authored frame owns contact, gaze, overlap and shared lighting.

## Files

- `sources/pair-attune-*-keyed.png` — built-in ImageGen source on a flat `#FF0000` key field.
- `outputs/pair-v1/attune-*.png` — approved transparent runtime masters.
- `public/art/companions/shadow-den-v1/pair-v1/attune-*.png` — runtime copies.
- `PROMPTS.md` — generation prompts and reference roles.
- `art-manifest.json` — asset map and measured alpha facts.
- `qa-report.md` — production and runtime QA.

## Keying decision

The source field was removed with a border-derived hard key (`tolerance=35`, `force=true`) and no despill. Red despill was rejected because it damaged Traveller skin, scarf and gold accents. At Den scale the remaining sub-pixel red fringe is not perceptible in the authored room; the transparent shape and character colours remain intact.
