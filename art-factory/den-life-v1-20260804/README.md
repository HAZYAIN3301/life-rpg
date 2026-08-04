# Den Life v1

Date: 2026-08-04  
Status: runtime candidate, QA passed

## Purpose

This batch adds calm autonomous presence to the approved male Traveller + BODY
guardian vertical slice without pretending that the flattened toad is a joint
rig.

## Runtime contract

`public/den-life-v1.js` is a deterministic director layered on Den Stage v1.

- The complete toad sprite receives three quiet ambient beats: `observe`,
  `brace`, and `settle`.
- Each beat lasts `2.2–2.8 s` and is followed by at least `12.8 s` of calm.
- No forearm, face, or leg is synthesized from the flattened source.
- Physical contact continues to use decoded atomic pair frames.
- A running focus task mapped to canonical domain `body` triggers one automatic
  joint warm-up per focus session.
- The automatic scene is considered consumed only after the pair actually
  starts. A transition race remains retryable.
- Manual interactions postpone ambient direction instead of competing with it.
- Traveller locomotion, authored room actions, pair contact, edit mode, hidden
  tabs, modals, tutorials, and reduced-motion all block ambient direction.

## Priority order

1. Manual user action.
2. Existing pair or authored Traveller room action.
3. BODY-focus warm-up (once per focus session).
4. Quiet guardian ambient beat.
5. Stillness.

Stillness is an intentional state. The room does not need permanent movement.

## Honest boundary

This batch does not add a skeletal toad rig, walking, blinking, props, ten
domain vignettes, or a pet wing. Those require newly authored topology or
matched frames. The next intended vertical slice is MONEY / RESOURCES with the
existing Fortune Cat, followed by the first reusable domain-scene prop system.
