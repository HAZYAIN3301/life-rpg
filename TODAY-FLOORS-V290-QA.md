# R08 — remaining touch-target floors on Today, v290

Follow-up from the R05 route audit («today: task title edit buttons 23px high»),
done on the owner's 25.09 instruction to continue the planned remainder. Rule: SD-08
(touch targets ≥42px, 44px where the control sits next to 44px neighbours).

## Before → after

| Control | Before | After |
|---|---|---|
| Quest title (tap to rename), dense Today | 102×23 px — the v282 dense layout reset `min-height` to 0 | full-width 44 px target; the title column lost its 8 px top padding, so the text now sits on the centre line of the 44 px check circle. Row height +13 px at 375 (208 → 221), unchanged column layout at 1280 |
| «Как выбрать сложность?» in the add-quest form | 309×32 px summary | 44 px row |

A sweep of all 16 routes at 375 (RU, dense synthetic data) now finds no control below
42 px except visually hidden radio inputs inside 74–79 px label cards in Settings
(the label is the target).

## Verification

- Unit: `scripts/today-floors-r08.test.js` (2) — the 44 px rules exist and come after
  the v282 reset.
- Full suite 3138/3138 PASS, 0 skipped (non-root); syntax and `git diff --check` PASS.
- Chromium: RU 375 and EN 1280 Today measured (title 44 px, aligned with the check;
  difficulty summary 44 px); screenshots of task rows before/after at 375 and after
  at 1280.

**Not verified here:** WebKit, real devices.

## Publication

`c1e2856` on master 25.09; both domains report it with `satoru-v290` at 12:36 UTC;
10/10 SHA256 matches against the commit (app.js, design-next-v1.css, index.html,
sw.js, styles.css × 2 domains); login page loads the v290 shell without errors.
