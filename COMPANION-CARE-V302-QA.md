# R06 — confirmed care, v302

27.09.2026, Codex web lane; synthetic localhost:52000, base v301 `4eeb435`.

## Reproduction and repair

With `/api/commitments/commit` returning 503, pressing Pet displayed bond 1 while
the saved settings still contained 0; the Pet button was disabled. The morning/
evening check-in had the same optimistic write and could add another reward if
submitted again before its form closed.

Pet, moment Pet and check-in now share a serialized `Store.updateNow` writer.
It builds from current settings, checks the saved day/kind marker, and publishes
the companion only after persistence. Failed check-in retains the entered text.
Sound/reaction and closing the form follow success. Existing +1/+2/perk arithmetic,
stage thresholds and journal limit remain unchanged. Account/epoch guards reject
late UI effects. No new storage domain or API was added.

## Evidence

- Full suite **3166/3166 PASS**, app syntax and diff checks PASS.

- Chromium: Pet 503 → no bond change and retry enabled → success → reload preserves
  one point and the saved daily marker.
- Check-in 503 → text and bond unchanged → retry → reload retains one note/award.
- Executed tests: two concurrent Pet calls produce one point, repeated check-in
  produces one note, pending write changes no UI, account switch discards late apply.
- Existing server chest: lost saved response → no premature result → byte-identical
  retry → one confirmed reward → reload retains one opening. Reduced motion enabled.
- Evidence/screenshots live in `work/r05/evidence/`; synthetic accounts are not committed.
- Existing `qa-feature-writes-v253.mjs` rerun against the isolated server and a fresh
  synthetic account: real Notes/Calendar/Habits forms, lost-response identical retries,
  habit Undo, Den light refusal/reset, reload. All six groups passed, zero page errors.
  This does not close the whole habits04 pause/resume and next-day matrix.

## Remaining R06 gates

This closes the reproduced care persistence bug, not the entire reward acceptance.
Entry-task bond still uses a separate legacy save after task completion and needs a
dedicated failure/replay audit. Full stage-transition and streak/day-boundary visual
matrix remains open. No claim that browser checks validate Mac/iPhone downloads.
