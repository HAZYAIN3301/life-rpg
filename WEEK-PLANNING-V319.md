# Week planning completion — v319, 02.10.2026

Base: 90841f51 / v318. No native, provider, pricing or reward changes.

Reproduced v318 defect: proposal 09:05 became 09:00 in moveCalendarTask;
23:55 became 23:45. A valid proposal could overlap the recurring appointment it avoided.

## Behavior

- Planner writes exact minutes through the existing task writer. Manual schedule editor
  and undo preserve exact minutes too; calendar dragging retains quarter-hour snapping.
  Invalid hours (24:00, 99:00) are rejected instead of clamped. Editor accepts up to 23:59.
- A rejected write restores the original unknown duration; it does not invent 30 minutes.
- Unplaced tasks are shown by name with a short reason: duration missing / no free slot.
  Their action opens the existing schedule editor. Closing/saving returns to the preserved
  draft recurring schedule and original week, invalidating the old proposal.
- Recurring settings collapse after preview so results are visible. Saving recurring
  settings remains inside that section; applying task moves is a separate action.
- Owner/write-epoch guard prevents reopening the old draft after an account switch.
  Changed tasks invalidate the proposal before writes; no XP/gold changes or new task creation.

## Evidence

- scripts/calendar-exact-time-v1.test.js: proposal after 09:05 boundary → exact write;
  late-day minutes; invalid time rejection; drag snapping; failed-write duration rollback.
- Local isolated DATA_DIR on port 52020, Chromium/WebKit: missing duration → editor →
  draft return → 09:05/09:15 proposals → apply → reload → reopen/save → same exact time.
  Stale preview rejected; capacity reason retained; 375/1280px × five languages × two
  themes (40 layouts across engines), reduced motion, no overflow/pageerror.
- Logs/screens: work/week-20261002; synthetic fixtures removed through normal task writer.
  Full suite: 3268/3268 PASS; node --check and git diff --check PASS.
  Deployment receipt is recorded in the external release-plan CHECKPOINT.

## Remaining product plan

1. Real AI conversation with the owner's configured provider; UI tests use mocked replies.
2. Distribute the prepared native changes (452a68b) as a new build; physical iPhone acceptance
   for speaker, dictation and photo OCR. Build 9 does not contain those changes.
3. Header symbol selection by owner. Family Controls remains a separate native release.
4. Economy/multiplayer: real pair acceptance and desirability of furniture before expanding
   the catalog or monetization; existing RELEASE-OWNER-REVIEW-V314.md remains applicable.

This release finishes the existing week workflow; it does not claim physical-device or live
AI acceptance, nor a validated long-term multiplayer economy.
