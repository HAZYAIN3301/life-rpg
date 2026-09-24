# Package 01 — First Value, 24 September 2026

Local candidate `satoru-v275`, branch `codex/first-value-20260924`, base
`940854a2d5c3dfc50ce63493636843da7b66bbef`. Not pushed or deployed.

## Reproduced and fixed

- Recovery's primary action called the missing `openRecoveryFromShortcut` and
  threw instead of opening a dialog. It now opens the existing recovery launcher
  with the promised ten-minute default and returns keyboard focus to its opener.
- Later First Value states fell back to Russian in other languages. Added the
  missing EN/DE/UK/ES strings for routes, progress, confirmed results and retry.
- Pausing exposed `user_choice` or `time_boundary`. Known reasons now have human
  descriptions in all five languages; stored data and transitions are unchanged.
- Shell cache and active pins updated together. Existing pin assertions track
  the new candidate; integration must allocate the final version from fresh master.

## Verification

`scripts/qa-first-value-v275.cjs` uses actual registration, forms, password login,
and server readback on an isolated localhost server. No injected app State or
DOM removal. Five new synthetic accounts, zero page errors:

| Locale | Verified path |
|---|---|
| RU | Manual questionnaire → goal/task → task completion → goal checklist step → Today task → completed goal step; reload |
| EN | Defer setup → do_now → task → pause/resume → saved completion |
| DE | Defer setup → clarify → goal with first step → confirmed result |
| UK | Defer setup → recover → ten-minute dialog → Escape/focus return → saved boundary |
| ES | Manual questionnaire: rejected write → visible retry; committed write with lost response → retry → exactly one goal and one task |

All five scenarios retain exact goals, tasks and First Value data after closing
the browser context and signing in again. Screenshots at 375×812 and 1280×900,
empty and populated states: no horizontal overflow. Visual review of all five
result languages, EN pause/empty and desktop states found no changed-card layout
blocker. Synthetic task titles deliberately remain in English.

550/550 targeted Node tests PASS, including the changed shell-pin tests, First
Value/new-account-return/questionnaire server suites and six new regressions.
The earlier baseline run also passed 73/73, including goal-step and quest-goal
link contracts. Syntax checks and `git diff --check` PASS. Full release suite
is reserved for integration; these counts are not full-product certification.

Evidence (local, not committed):
`/Users/al.prokopets/Projects/satoru-release-plan-20260924/work/package-01/`
contains `final/receipt.json`, screenshots, `browser-final.log`,
`targeted-final.log`, baseline logs and before-fix reproductions. The original
receipt's phrase “without duplicate rewards” is broader than its assertions:
that check compared goal/task data, not a separate reward ledger. The harness
wording has been corrected; do not treat the receipt as a ledger audit.

## Boundaries and follow-up

AI-assisted questionnaire, OAuth, installed PWA/service-worker upgrade, Safari,
WKWebView/native and real devices were not retested. Service workers were blocked
in this browser harness. No production data, external AI or push was used.
All three First Value routes and the manual-plan outcome were exercised; this
does not exhaust every entity variant or error path. Package 03 owns broader
auth/storage fault coverage, package 11 native acceptance, package 12 release QA.

An EN achievement toast still contains Russian outside the First Value card
(visible in `final/en-result-1280.png`); leave it for package 10 localization.
No change to economy, saved schemas, CAS/WAL, CSS or recovery contracts.

To reproduce, start `server.js` with `HOST=127.0.0.1`, an unused `PORT`, isolated
`DATA_DIR`, `PUSH_SCHED=off`, and `TMPDIR` under Projects. Expose Playwright via
`NODE_PATH`; run the harness with matching `QA_BASE`, fresh `QA_OUT` and optional
`QA_CHROME`. It creates five accounts; respect the registration rate limit when
rerunning. Stop that isolated server afterward.
