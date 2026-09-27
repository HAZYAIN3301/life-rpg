# R05 — saved routes, v301

Codex web lane, 27 September 2026. Base `5ad3134`, isolated worktree
`satoru-codex-web-20260927`, localhost:52000 and synthetic `qa-data` only.

## Before → after

- The owner/admin experiment disappeared after starting except for a Stop button;
  stopping removed its only entry. Other support now shows the saved status, day,
  localized interval and next-step explanation. Stop and export remain reachable;
  stopped/completed records retain export. This uses `settings.secretary.experimentV1`,
  does not start another experiment or expose the feature to ordinary accounts.
- Skipping Board calibration, accepting an order and reloading brought calibration
  back in front of the order. A saved active order, completion or custom order now
  opens the actual Board. Empty first entry retains optional calibration.
- The task boundary dialog used a platform sword emoji; it now uses the same
  `difficulty.protected` registry asset as its related task controls.

## Browser checks

- Task created through Today, boundary accepted, reload: linked time remains;
  revise → synthetic 503 → entered result preserved → retry → reload retains result.
- Experiment start → reload → saved active status; stop → reload → stopped status;
  JSON download succeeds. Refused stop leaves it active; retry persists stopped state.
- Board v2 accepted order returns directly after reload. Completion 503 creates no
  reward task; retry and reload yield exactly one completion and the private journal.
- Three long custom orders created and accepted through the UI; all three remain
  reachable after reload at 375px, without calibration or page overflow.
- Chromium + WebKit: 40 stopped-status layout checks (375/1280 × five languages ×
  dark/light), reduced motion, export target ≥42px, no horizontal page overflow or
  page errors. Screenshots inspected for mobile German/light and desktop Russian/dark.
- Native export is not covered by browser download checks.

Evidence: `work/r05/evidence/` (local, deliberately not committed). Browser scripts
are local QA aids, not production code. Synthetic setup used the existing serialized
Store writer; route actions used the UI and existing domain endpoints.

## Scope and remaining acceptance

This is a focused R05 repair, not acceptance of every Secretary route. The proactive
offer → accept/refuse → prepared task loop and experiment feedback/review timing still
need their dedicated end-to-end pass. Existing contract tests remain in the full suite.
R06 rewards, habits04, scenarios06–10 and device receipts remain separate gates.
No reward arithmetic, data owners, payment/Pro, extension or native code changed.

Shell and active immutable-pin tests advance together to v301. Release/test receipts
are recorded at the top of DEVLOG and RELEASE-CHECKPOINT-R04-R06.
