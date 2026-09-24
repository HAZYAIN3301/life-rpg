# Task menu and actual time — R01A, v276

Scope: the owner's September 24 review, task menu layering and actual-time entry.
Base d1f3e9a. No redesign of unrelated screens, reward rules or saved schema.

## Before → after

- The open task menu was inside the same z-index=2 stacking context as each later
  row's disclosure. Real pointer hit-testing found both neighbouring summaries
  above it. The open context now rises above its peers; adjacent rows no longer
  intercept menu clicks. The long daily-priority action is shortened.
- Actual time used `window.prompt`, only accepted total minutes, defaulted missing
  actual time to the estimate, and optimistically mutated State before persistence.
  It now opens an in-app dialog with explicit hours/minutes, the task name,
  localized labels, cancel/save and a clear “Time spent” row action.
- The new editor waits for the existing paired commitment/task write receipt.
  Failure retains the draft; a lost-response retry is an absolute, idempotent
  update. A conflicting newer actual value requires reopening instead of overwrite.
  Account/write-epoch guards prevent a stale form from writing to another account.
- An active or paused timer for the same task must be stopped before manually
  replacing its total. Editing does not complete a task or re-award XP/gold.
- Shared dialog initial focus no longer steals focus when the user has already
  selected an input before the animation-frame callback. This race was exposed
  during rapid hours→minutes input in the real browser.

## Contract

`TaskActualV1.minutes` requires two nonnegative integer components, minutes 0–59,
and a safe integer total. Empty or invalid input cannot silently clear time.
Explicit zero retains the existing `actualMin: null` convention. Update changes
only the selected task's `actualMin`; timestamps, completion, estimate, links,
XP and gold fields are preserved. Storage remains minutes. No migration.
`commitmentDataCommit` owns CAS/retry/account fencing; no direct JSON writes or
replacement storage path were added. New module is loaded before app.js and cached.

## Evidence

Synthetic localhost accounts only, isolated DATA_DIR and PUSH_SCHED=off.
Evidence/harness: `work/r01a/` in the task checkout; durable copy under the local
release plan's `work/r01a/`. No private owner recording, account or transcript is
included in this public document. Browser storage/auth files remain local only.

- Before: `evidence/before.json`, `before-menu.png`: actual native browser prompt
  observed and two overlapping summaries win hit-testing.
- Chrome: `after.json`: 0/59/60/125, server readback/reload, blank rejection,
  Escape/focus restoration, 503/draft/retry and committed-but-lost response/retry.
- `matrix.json`: pending write cannot duplicate or dismiss; completed-task time
  update leaves all other task fields and skills/days/achievements/lootbox/purchases
  unchanged after reload. Running/paused timer protected, editing after stop works.
- Five languages RU/UK/DE/EN/ES: actual UI language controls, touch opening,
  keyboard focus containment, 375×812 / 1280×900, no horizontal overflow.
  Light/dark and reduced-motion checked; screenshots use synthetic task titles.
- WebKit: `webkit.json`: ten-task dense list, menu hit-testing and actual-time
  save/readback at both viewport widths, zero page errors. This is WebKit browser
  coverage, not a claim to have retested the owner's installed native build.
- `contrast.json`: actual dialog text/input/action contrast measured in light/dark;
  minimum 4.5:1 required. Mobile actual-time touch target at least 44px.
- Four new behavioral unit tests; 61/61 initial targeted checks; final full suite
  3083/3083 PASS. JS syntax and diff whitespace checked. Cache/active pin checks
  updated to v276; historical archived app builds unchanged.

Publication receipt is recorded in the release-plan checkpoint after the commit.
R01B (notes), global icon/font work, other review items and installed native QA
remain separate tasks. PWA cache version is bumped; installed SW upgrade is not
part of these service-worker-blocked browser fixtures.
