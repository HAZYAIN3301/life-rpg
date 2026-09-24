# Package 02 — goal JSON regression, 2026-09-24

PASS on the v275 candidate containing package 01 (`9c7fd18`). The v269 importer
already handles this package's cases; no additional runtime changes needed.
The owner authorized immediate publication of packages 01–02 on 24 September,
overriding the release plan's earlier local-only rule.

## Real browser checks

Isolated localhost server, five synthetic registrations via normal UI, no app
State injection. Plan → Goals → import → external-AI JSON bridge. No AI call.

- Three proposals: one sphere, a numeric goal (`current: "1,5 км"`,
  `target: "10 км"`, `unit: "км"`), and its child checklist goal with two steps.
  Also a project and a next-action task. Server readback confirms 1.5/10, two
  goals, two steps, parent link and one task; exact goals survive reload.
- `ten` and `10 miles` with declared `км`: inline error, Apply disabled,
  editable source retained, server goals unchanged.
- 301 proposals: explicit rejection, no Apply button, no partial save.
- Actual `/api/goals/commit` intercepted once with HTTP 503: dialog remains,
  localized error appears, goals unchanged; retry saves exactly one package.
- A held real commit disables Apply. A second activation issues no second
  request; releasing the request yields the saved result above.
- RU/EN/DE/UK/ES: metric-error copy, successful import and reload. Mobile 375×812,
  desktop 1280×900; long DE/UK error text and editable JSON remain accessible.
  Keyboard expands the source, tabs to reparse, and applies the valid selection.
  Screenshots reviewed; zero page errors and checked mobile horizontal overflow.

Full release runner `node --test --test-concurrency=2 scripts/*.test.js`:
**3079/3079 PASS**, including package 01 regressions, v269 importer, goals v185
and server transaction tests. Runtime candidate unchanged after this run.

Local evidence and exact fixture:
`/Users/al.prokopets/Projects/satoru-release-plan-20260924/work/package-02/`
(`receipt.json`, `fixture.json`, screenshots, `full-tests.log`).

## Remaining scope

The importer dialog still has older Russian labels/help in other locales;
v269 error messages are translated. This is recorded for package 10, not claimed
as complete localization. No full-account import, external AI generation, native
device or Safari coverage here. Lost-response/concurrent-account fault coverage
belongs to package 03; this package tested a definite rejected write and retry.
Production SHA/deployment verification is recorded in the release-plan checkpoint
after push; a local browser PASS alone does not prove publication.
