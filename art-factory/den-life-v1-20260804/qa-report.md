# Den Life v2 — QA report

Date: 2026-08-04  
Result: PASS

## Automated

- JavaScript syntax: PASS for runtime modules and `public/app.js`.
- Full project suite: `15/15` PASS.
- Director rebind is idempotent for the same focus context.
- BODY focus is distinct from other canonical domains.
- BODY action is repeatable; no completed-session latch remains.
- `train` accepts the v2 `8400 ms` hold and returns a promise covering
  approach, contact, and return.
- Idle breathing GIF is no longer used by the guardian runtime.
- PWA shell is `satoru-v94`; HTML asset tags use `20260804-den-life-v2`.

## Browser acceptance

- Real demo BODY task created and its focus timer started.
- Den reported canonical focus `body`.
- A 26-second trace captured two separate BODY cycles.
- Approach used `walk-a.png` / `walk-b.png`; the static idle frame fades to
  zero instead of covering the walk.
- Guardian stayed at the same `159 × 159` desktop slot during approach.
- Contact frame stayed active for approximately 8.4 seconds and alternated the
  two authored squat frames.
- Automatic bench reading was observed without pressing the room-action
  buttons.
- Desktop scene retained coherent depth and actor anchors.
- Mobile `390 × 844`: room `364 × 205`, Traveller `85 × 127`, guardian
  `56 × 56`, contact composition `131 × 131`; no actor/UI clipping.
- Browser console errors: `0`; warnings: `0`.

## Visual finding fixed during QA

The walk frames were present in DOM but the active idle frame still contributed
opacity during approach, making locomotion read as sliding. V2 now forcibly
hides that idle frame only while `data-locomotion="walk"`; the actual stride is
visible on desktop and mobile.

## Remaining authored-art backlog

Push-ups, stretching, whistle coaching, and additional frog micro-actions are
explicitly not marked complete. They need approved full-frame assets before
runtime integration.
