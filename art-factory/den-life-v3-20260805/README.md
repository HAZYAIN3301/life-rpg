# Den Life v3

Date: 2026-08-05
Status: production candidate

## Fixed from user QA

- Walking frames and translation now share the same `2200 ms` duration, so
  Traveller no longer runs in place after arriving.
- Room standing scale is larger; the rear bench/window position scales to
  `.78`, matching the authored sitting/reading layer.
- Sitting and reading first walk to the bench, then swap the complete pose and
  walk home after completion. No direct standing-to-seated teleport remains.
- Reading opens an original paper portal before the book frame appears.
- Manual actions set a director `holdUntil`; an already-running automatic
  callback can no longer overwrite that hold when it resolves.
- The portal is anchored by Traveller's hand rather than over the toad.
- Toad blink uses an instant 115 ms eye-state swap instead of a long crossfade.
- BODY approach stops at the same meeting distance used by the atomic pair.

## New BODY loop

BODY focus continuously rotates `whistle → pushup → stretch → train` with short
recovery gaps. Every action uses authored full-pair frames from
`body-toad-action-pack-v3-20260805`.
