# Web receipts and experiment deferral — v306, 28 September 2026

Owner approved deferring new «30 days with Shadow» runs until after the first free
release. The launch entry, stale setup and start function are gated. Existing active,
stopped and completed records, stop and export remain available. No historical
observations or statuses are rewritten. Full integration is a post-release task.

## Changes and evidence

- Entry tasks previously persisted completion and bond separately. They now use the
  existing settings/tasks WAL owner and CAS boundary. A failed write changes neither.
  An optional task boolean `entryBondAwarded` records the one-time +2 grant. Undo keeps
  it; undo of a legacy completed entry sets it to prevent awarding historical bond
  again. No retrospective subtraction or guessed repair of old missing bond occurs.
  XP stays 0, task gold stays 15. Existing task fields retain their meanings.
- `completeTask` rejects an already completed task. A conflict refresh revealing an
  already committed entry does not mint another reward. A linked boundary is marked
  and archived in the same pair transaction.
- Companion rename uses the serialized settings writer with account/epoch fencing.
  The form and draft survive refusal; success closes it only after persistence.
- Entry reward and companion/pet rename receipts no longer use system emoji.
  Identical simultaneous toasts share one message instead of stacking over controls.
  User-entered emoji and distinct messages are preserved.

## Verified

- Full suite: 3175/3175, zero skipped; JS syntax and diff whitespace checks.
- Executed VM cases: entry refusal, lost response/replay, concurrent completion,
  marker-preserving repeat; rename refusal/retry and late account-switch receipt;
  deferred direct start/stale setup; toast dedup and later retry.
- Real Chromium with isolated synthetic DATA_DIR on 52000: entry request refused,
  response lost after a real server commit, retry/CAS refresh, reload, undo/recomplete:
  exactly +2 total bond. Rename refusal preserves old name and draft, successful retry
  survives reload. Existing experiment JSON still downloads and new launch is absent.
- 40 form layouts: Chromium + WebKit, 375x812 / 1280x900, RU/UK/DE/EN/ES,
  light/dark, reduced motion. No horizontal overflow, rename controls >=42px,
  no page errors. Visually inspected DE mobile light, RU desktop dark and refusal.
- Test harness corrections: protected accounts write via /api/commitments/commit,
  not just /api/data/settings; initialization and Today tab must finish before form
  measurement. Initial incomplete fixture runs are not counted as successful QA.
- Evidence stays local in work/r06/evidence; scripts and fixtures are not published.

## Not closed

Whole-app visual acceptance; PiP typography; remaining system emoji in other reward
receipts; R05 proactive secretary; full stage/streak matrix; remaining habits/settings/
Inspiration/Den/import scenarios and owner device gates. Extension lane unchanged.

## Publication

`e8d73d1`, Railway `19cb7802-07c3-480e-b72b-db6d9896860a` SUCCESS;
both domains confirmed v306 / e8d73d1 at 07:58 UTC, app/index/sw SHA-256 6/6.
Chromium login smoke on both domains: visible form, zero page errors.
