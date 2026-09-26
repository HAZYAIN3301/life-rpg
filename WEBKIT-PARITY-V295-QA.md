# R13 — WebKit (Safari engine) parity, v295

First run of the R04A–R12 synthetic audits in WebKit, on the owner's Mac (the cloud
session had Chromium only). Local isolated servers, `DATA_DIR=./qa-data`, synthetic
accounts only; `/api/ai/*` intercepted, no microphone. Rules applied: R03B / TY-13
(no system emoji in controls, text ≥ 12 px), SD-08 touch floors, focus return (R11),
AI lifecycle focus (R07), honest platform copy (EXECUTION R07: "Platform copy говорит
о реальной возможности").

## Matrix

Same commands, same seeded data shape, WebKit vs Chromium (69 runs each):
hidden / dialog / shadow / aisurf at RU/EN/DE/UK/ES 375 light+dark and EN/DE 1280
light+dark; aisurf-flow × 5 languages; auth-audit and ob-audit at 375/1280 × light/dark
(5 languages inside each). All runs exit 0, 0 page errors in both engines.

Differences found only in WebKit:

| Finding | Cause | Result |
|---|---|---|
| Settings → App: «🔔 Enable notifications» / «🔕 …» with emoji, «🌅 … 🌙» in the status line | the Web Push branch renders only where `PushManager` exists (Safari); Chromium audits never saw it | **fixed**: `status.bell` / `status.bell-muted` registry icons, text via `emojiFree`, status line without emoji (4 languages) |
| iPhone/iPad Safari tab: «Notifications are not available in this browser.» at 11.5 px | on iOS Web Push exists only in the Home Screen app; copy was untrue and under 12 px | **fixed**: 12 px; on iOS (not installed) — «On iPhone and iPad, notifications work in the installed app: Share → Add to Home Screen» (5 languages) |
| iPhone/iPad: «Download for Android (.apk)» offered | no platform check | **fixed**: hidden on iOS |
| AI pending (day recap, proposals): focus on `BODY`, Chromium on «Cancel request» | Safari does not focus a button on click/tap; `aiSurfaceRunButton` moves focus only if the run button had it | **fixed** globally: `focusActivatedControl` (capture-phase, trusted clicks only) focuses the pressed button/link/summary before action handlers run — Safari now matches Chromium for every opener read from `document.activeElement` |
| Native `<select>` 23 px high (menulist) on macOS WebKit | macOS WebKit ignores `min-height` on native selects | **not changed**: platform control; 1 px under the 24 px fine-pointer floor on desktop Safari. iPhone rendering is on the owner's device checklist |
| Modal backdrop not blurred | `backdrop-filter` not rendered in Playwright WebKit | cosmetic, overlay still dims; not changed |

Everything else (inline links 14 vs 15 px, settings checkbox 12 vs 13 px, documented
intentional results in `scripts/qa/README.md`) is identical in both engines.

WebKit-only flows checked separately: `.ics` export downloads in WebKit with an iPhone
profile (3 events, lines ≤ 75 octets, CRLF only, `…@gojo` UIDs, localized toast);
«Your week» → Share calls `navigator.share` 26 ms after the tap with user activation
still active and a 126 KB PNG. Visual (WebKit screenshots, RU 375 light/dark, EN 1280):
Today, Progress charts, week window, Shadow chat, Den, Settings → Interface — same as
Chromium apart from the backdrop blur.

## Verification of the fix

- Unit: `scripts/webkit-parity-r13.test.js` (2) — click focus on a DOM double (trusted,
  untrusted download link, disabled, already focused, non-control), capture-phase
  registration before `onClick`; app card without emoji/11.5 px, iOS hint and APK gate,
  translations without emoji.
- WebKit on the candidate: aisurf-flow RU/EN — pending focus `ai-surface-cancel` (was
  `BODY`), identical to Chromium; Settings audits RU 375 light/dark — no emoji; app card
  with iPhone profile — 0 emoji, 0 text < 12 px; desktop WebKit dark — bell icon rendered.
- Candidate re-run (38 runs: dialog/hidden/shadow/aisurf RU/EN 375 light+dark, EN 1280,
  aisurf-flow RU/EN × WebKit and Chromium): 0 page errors; versus v294 only the intended
  changes (AI pending focus, no 🔔). One Chromium «loot-modal not opened» was data state
  (chest already claimed by the WebKit run on the same accounts); a fresh account opens
  it in both engines.
- Full suite 3154/3154 PASS, 0 skipped (Mac, TMPDIR inside ~/Projects); `node --check`
  and `git diff --check` PASS. Pin-regex tests and the v274 push-card double updated
  for v295 / `isIOS`.

**Not verified here:** real iPhone/iPad (VoiceOver, installed PWA, share sheet,
Apple/Google Calendar import) — owner checklist.
