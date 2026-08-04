# Den Life v2

Date: 2026-08-04  
Status: production candidate, QA passed

## Why v2 exists

Den Life v1 used sparse, one-shot direction. In practice it looked static: a
BODY focus could show one contact scene and then remain still, rerenders reset
the ambient timer, and the approach translated the standing PNG.

V2 changes the runtime contract without pretending that flattened art is a
skeletal rig.

## Runtime contract

`public/den-life-v1.js` retains its filename for cache compatibility, but now
exports director version `2.0.0`.

- The director survives ordinary Den rerenders and only resets when the focus
  context actually changes.
- Outside focus it cycles through authored actions: guardian blink/look,
  window visit, bench rest, and bench reading.
- BODY focus continuously alternates a coach beat and the authored two-frame
  Traveller–toad squat scene for the whole active session.
- One BODY cycle is roughly 14.6 seconds: approach, 8.4 seconds of training,
  return, then a short recovery gap.
- Traveller approach and return use the authored `walk-a` / `walk-b` frames.
  The standing frame is explicitly hidden while locomotion is active.
- The guardian remains at its reserved Den Stage slot during approach; it is
  never translated like a floating PNG.
- The atomic pair replaces both independent actors only during physical
  contact, preserving hands, posture, scale, and occlusion.
- Manual actions, overlays, editing, hidden tabs, reduced motion, and another
  active authored scene keep priority over autonomous direction.

## Honest boundary

This is a frame-driven vertical slice, not a bone rig. It contains real walking,
face-state swaps, autonomous sitting/reading/window actions, and a repeating
BODY squat loop. It does not yet contain newly illustrated push-ups, stretching,
whistle coaching, or a skeletal frog blink. Those require additional approved
full-frame drawings and must not be simulated by scaling or rotating a whole
PNG.

## Next production slice

Author a compact BODY action pack on the same composition contract: push-up
down/up, stretch A/B, and coach whistle A/B. The persistent v2 director can then
rotate these actions without another architecture rewrite.
