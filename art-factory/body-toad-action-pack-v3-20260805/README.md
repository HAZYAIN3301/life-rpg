# BODY Toad action pack v3

Date: 2026-08-05
Status: production candidate

Six complete male-Traveller + Body Toad frames extend the approved atomic-pair
contract.  They are not sliced rigs and are never assembled from independent
hands, joints or clothing layers.

## Actions

- `pushup-down` / `pushup-up`: a continuous push-up loop with the toad counting.
- `stretch-a` / `stretch-b`: assisted seated stretch with physical contact.
- `whistle-a` / `whistle-b`: the toad starts the drill with a brass whistle.

## Geometry and alpha

- Runtime canvas: `1536 × 1536` RGBA.
- Shared ground line: `y=1470`.
- All four corners are transparent.
- Source chroma is a magenta gradient. `build_action_frames.py` removes it by
  a bounded hue mask, resizes with Lanczos and normalizes every silhouette to
  the common ground line.
- Runtime composite remains at `(0,0)`; no per-frame offsets exist in CSS.

## Scale decision

The first stretch and whistle drafts made the seated toad almost as tall as a
standing Traveller. They were rejected before integration. The production
frames keep the toad at roughly 55–60% of Traveller's standing height, matching
the approved Den guardian scale.

## Runtime

`BodyToadV1 2.3.0` exposes `pushup`, `stretch`, and `whistle`. During BODY focus
`DenLifeV1 2.1.0` repeats `whistle → pushup → stretch → squat` for the whole
session. Manual buttons expose the same scenes for QA.
