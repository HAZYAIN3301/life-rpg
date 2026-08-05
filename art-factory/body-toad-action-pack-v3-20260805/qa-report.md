# BODY Toad action pack v3 — QA

Date: 2026-08-05
Result: PASS (local production candidate)

## Asset checks

- 6/6 runtime PNG files are `1536 × 1536` RGBA.
- 6/6 share `groundY=1470`.
- 24/24 canvas corners are transparent.
- Push-up, stretch and whistle each have two complete frames.
- Rejected oversized stretch/whistle drafts are absent from runtime.

## Runtime checks

- `BodyToadV1 2.3.0` decodes both frames before swapping.
- Manual buttons start all three new modes.
- BODY focus sequence is persistent: whistle, push-up, stretch, squat.
- Pair scene replaces both independent actors only after the approach.
- Reduced-motion mode keeps a stable first frame.
- Full project tests: `15/15` PASS.

## Visual acceptance

- Desktop push-up and corrected stretch checked in the coherent workshop.
- All contact remains inside the rug/meeting area.
- No limb slicing, clothing drift or viewport-specific actor offsets.
- Final production/deploy smoke test remains required after commit.
