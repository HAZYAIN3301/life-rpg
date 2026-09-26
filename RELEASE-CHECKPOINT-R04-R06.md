# Release queue R04A → R06 — checkpoint (in-repo mirror)

The owner's plan lives outside the repository (`satoru-release-plan-20260924/`:
START, CHECKPOINT, NEXT, video-review CRITERIA/EXECUTION). The cloud session that
works this queue cannot read it, so this file mirrors the queue state for the next
agent. Whoever has the local plan: copy the rows below into its CHECKPOINT/START/NEXT.

Base: v282 `c1f30ed` (published, 3094/3094 on the owner's machine).

| Package | Scope | State | Commit | Deploy / hashes |
|---|---|---|---|---|
| R04A | honest XP / load / insufficient base | **published** v283 | `65a58bb` | both domains `/api/version` commit `65a58bb`, `satoru-v283` at 09:10 UTC 25.09; 20/20 SHA256 (10 files × 2 domains); login page smoke, 0 errors |
| R04B | dense, understandable charts | **published** v284 | `06e7002` | both domains commit `06e7002`, `satoru-v284` at 09:37 UTC; 18/18 SHA256 (9 files × 2); login smoke 0 errors |
| R04C | AI lifecycle: timeout, cancel, late response | **published** v285 | `e4adff1` | both domains commit `e4adff1`, `satoru-v285` at 09:5x UTC; 16/16 SHA256 (8 files × 2); login smoke 0 errors, `/api/ai/analyze` unauthenticated 401 |
| R04D | export | **published** v286 | `1c3adf0` | both domains commit `1c3adf0`, `satoru-v286`; 18/18 SHA256 (9 files × 2); login smoke 0 errors; unauthenticated `/api/account/export` 401 (now reported in UI) |
| R05 | remaining screens by R03B (owner choice 25.09: «Экраны + Тень») | **published** v287 | `6a036a5` | both domains commit `6a036a5`, `satoru-v287`; 12/12 SHA256 (6 files × 2); login smoke 0 errors |
| R06 | Shadow companion coherence: chat, support hints, Den, voice, states and tone | **published** v288 | `3a34a13` | both domains commit `3a34a13`, `satoru-v288` at 11:52 UTC; 12/12 SHA256 (6 files × 2); login smoke 0 errors |
| R07 | follow-up: AI lifecycle on the remaining surfaces (owner 25.09: «делай дальше запланированное») | **published** v289 | `4af8474` | both domains commit `4af8474`, `satoru-v289` at 12:31 UTC; 12/12 SHA256 (6 files × 2); login smoke 0 errors |
| R08 | follow-up: Today touch-target floors (R05 audit remainder) | **published** v290 | `c1e2856` | both domains commit `c1e2856`, `satoru-v290` at 12:36 UTC; 10/10 SHA256 (5 files × 2); login smoke 0 errors |
| R09 | owner decision: one Today hint — one action (rest, overload, mobility; teaser removed) | **published** v291 | `2e345bf` | both domains commit `2e345bf`, `satoru-v291` at 12:48 UTC; 10/10 SHA256 (5 files × 2); login smoke 0 errors |
| R10 | follow-up: hidden content (collapsed sections, Settings groups, light theme) | **published** v292 | `41e00cb` | both domains commit `41e00cb`, `satoru-v292` at 13:10 UTC; 12/12 SHA256 (6 files × 2); login smoke 0 errors |
| R11 | follow-up: dialogs and real content (programs, sphere names, legacy windows) | **published** v293 | `e1d4989` | both domains commit `e1d4989`, `satoru-v293` at 13:36 UTC; 10/10 SHA256 (5 files × 2); login smoke 0 errors |
| v297 | owner 26.09: extension 0.7.0, OISD NSFW adult list (505 602 domains), Adult on by default | **published** v297 | `4b34a47` | both domains commit `4b34a47`, `satoru-v297` at 14:43 UTC 26.09; 16/16 SHA256 (7 site files + ZIP × 2); login smoke WebKit+Chromium 0 page errors |
| v296 | owner reports 26.09: extension package in the Mac app, goal import blocked by legacy quests | **published** v296 | `3accbc7` | both domains commit `3accbc7`, `satoru-v296` at 14:23 UTC 26.09; 10/10 SHA256 (5 files × 2); login smoke WebKit+Chromium 0 page errors |
| R13 | local session 26.09: WebKit parity (Safari click focus, Settings → App on Safari/iOS) | **published** v295 | `b6bb1a8` | both domains commit `b6bb1a8`, `satoru-v295` at 09:02 UTC 26.09; 10/10 SHA256 (5 files × 2); login smoke WebKit+Chromium 0 page errors |
| R12 | follow-up: sign-in, registration and first run | **published** v294 | `0d7f3f5` | both domains commit `0d7f3f5`, `satoru-v294` at 14:02 UTC; 10/10 SHA256 (5 files × 2); login smoke 0 errors |

## Environment notes for this queue

- Full suite must run as a non-root user in the cloud container
  (`HOME=/tmp runuser -u nobody -- node --test --test-concurrency=2 scripts/*.test.js`).
  As root, two morning-outcome write-failure subtests cannot simulate a read-only
  directory and one test self-skips; as `nobody` they pass, matching the owner's Mac.
- Cloud container: only Chromium. WebKit matrix was run locally on 26.09 (R13).
- Settings writes go through `/api/commitments/commit` (WAL); intercept that URL,
  with service workers blocked, to test rejected writes.
- Production exposes `/api/version` (`commit`, `shellCache`) on both domains; deploy
  verification compares it and SHA256 of changed public files with the commit.

## Receipts

- **R04A / v283** `65a58bb` — full suite 3105/3105 PASS, 0 skipped (non-root);
  syntax and `git diff --check` PASS. Pushed fast-forward `c1f30ed..65a58bb` to master.
  Railway web deployed on both domains (~4 min after push). SHA256 match for app.js,
  design-next-v1.css, index.html, sw.js, sphere-load-v1.js, styles.css,
  interface-composition-v1.js, day-load-v1.js, chart-labels-v1.js,
  failure-context-v1.js on satoruapp.com and the Railway domain. Piper/TTS
  unchanged by this package (not re-verified). QA: PROGRESS-MEANING-V283-QA.md.
- **R04B / v284** `06e7002` — full suite 3108/3108 PASS, 0 skipped (non-root);
  fast-forward `64668d8..06e7002`. Both domains deployed (~3 min). SHA256 match for
  app.js, design-next-v1.css, index.html, sw.js, progress-charts-v1.js,
  chart-labels-v1.js, sphere-load-v1.js, styles.css, interface-composition-v1.js.
  QA: CHARTS-V284-QA.md.
- **R04C / v285** `e4adff1` — full suite 3115/3115 PASS, 0 skipped (non-root);
  fast-forward to master. SHA256 match (against the commit's blobs) for app.js,
  design-next-v1.css, index.html, sw.js, ai-request-v1.js, progress-charts-v1.js,
  sphere-load-v1.js, styles.css on both domains. Server change (provider idle
  timeout) is live with the same commit. QA: AI-LIFECYCLE-V285-QA.md.
- **R04D / v286** `1c3adf0` — full suite 3120/3120 PASS, 0 skipped (non-root);
  fast-forward to master. SHA256 match (commit blobs) for app.js, design-next-v1.css,
  index.html, sw.js, calendar-export-v1.js, ai-request-v1.js, progress-charts-v1.js,
  sphere-load-v1.js, styles.css on both domains. QA: EXPORT-V286-QA.md.

## R05/R06 preparation — route audit (Chromium, synthetic dense data)

16 routes (today, notes, calendar, habits, shelf, den, character, pets, goals, tree,
rewards, weekly, stats, party, leaderboard, settings) × RU/EN/DE/UK/ES at 375 and
RU/EN/DE at 1280: 0 horizontal overflow, 0 untranslated Cyrillic in EN/DE/ES,
0 page errors. Objective findings to fold into R05 once its scope is confirmed:
- weekly: task checkbox `toggle-task` 28×28 (SD-08 floor 42);
- settings (RU): labels cut with «…» — «Разбор недели», «Тень подбирает слова
  подсказки», «Чат-помощник» (TY-13); the last also at 1280;
- today: task title edit buttons 23px high and companion toggle 42×40 (R03A area;
  deliberately not changed without the owner's R05 scope);
- pets: disclosure summary 24px high.
- **R05 / v287** `6a036a5` — full suite 3124/3124 PASS, 0 skipped (non-root);
  fast-forward to master. SHA256 match (commit blobs) for app.js, design-next-v1.css,
  index.html, sw.js, styles.css, calendar-export-v1.js on both domains.
  QA: SCREENS-V287-QA.md.
- **R06 / v288** `3a34a13` — full suite 3128/3128 PASS, 0 skipped (non-root);
  fast-forward `c6b27aa..3a34a13` to master. Both domains deployed (~3 min). SHA256
  match (commit blobs) for app.js, design-next-v1.css, index.html, sw.js (changed)
  and styles.css, icon-registry.js (unchanged) on both domains; login page loads the
  v288 shell without console errors. QA: SHADOW-V288-QA.md.

- **R07 / v289** `4af8474` — full suite 3136/3136 PASS, 0 skipped (non-root);
  fast-forward `2bf47a4..4af8474` to master. Both domains deployed (~3 min). SHA256
  match against the commit blobs for app.js, design-next-v1.css, index.html, sw.js
  (changed) and styles.css, ai-request-v1.js on both domains; login page loads the
  v289 shell without console errors. QA: AI-SURFACES-V289-QA.md.

- **R08 / v290** `c1e2856` — full suite 3138/3138 PASS, 0 skipped (non-root);
  fast-forward `d1fdd07..c1e2856`. Both domains deployed (~3 min). SHA256 match
  against the commit blobs for app.js, design-next-v1.css, index.html, sw.js,
  styles.css on both domains; login smoke clean. QA: TODAY-FLOORS-V290-QA.md.

- **R09 / v291** `2e345bf` — full suite 3142/3142 PASS, 0 skipped (non-root);
  fast-forward `a807e8d..2e345bf`. Both domains deployed (~3 min). SHA256 match
  against the commit blobs for app.js, design-next-v1.css, index.html, sw.js,
  styles.css on both domains; login smoke clean. QA: TODAY-HINTS-V291-QA.md.

- **R10 / v292** `41e00cb` — full suite 3146/3146 PASS, 0 skipped (non-root);
  fast-forward `d9916eb..41e00cb`. Both domains deployed (~3 min). SHA256 match
  against the commit blobs for app.js, design-next-v1.css, index.html, sw.js,
  styles.css, telemetry-consent-v1.js on both domains; login smoke clean.
  QA: HIDDEN-CONTENT-V292-QA.md.

- **R11 / v293** `e1d4989` — full suite 3150/3150 PASS, 0 skipped (non-root);
  fast-forward `22806a1..e1d4989`. Both domains deployed (~3 min). SHA256 match
  against the commit blobs for app.js, design-next-v1.css, index.html, sw.js,
  styles.css on both domains; login smoke clean. QA: DIALOGS-V293-QA.md.

- **R12 / v294** `0d7f3f5` — full suite 3152/3152 PASS, 0 skipped (non-root);
  fast-forward `8acdc36..0d7f3f5`. Both domains deployed (~3 min). SHA256 match
  against the commit blobs for app.js, design-next-v1.css, index.html, sw.js,
  styles.css on both domains; login smoke clean. QA: FIRST-RUN-V294-QA.md.

- **R13 / v295** `b6bb1a8` — local session on the owner's Mac. WebKit matrix (69 runs,
  same as Chromium) found three WebKit-only issues, fixed; full suite 3154/3154 PASS,
  0 skipped; fast-forward `58fbe27..b6bb1a8`. Both domains deployed (~2.5 min). SHA256
  match for app.js, design-next-v1.css, index.html, sw.js, styles.css on both domains;
  logged-out page loads v295 in WebKit (iPhone profile) and Chromium without page errors.
  QA: WEBKIT-PARITY-V295-QA.md. Real-device checks: owner checklist (pending).

## Queue status after R06

All packages R04A → R12 are published. Owner decisions 25.09: monetisation gate —
no change until the owner's documents arrive; the companion name «Тень» stays.
The four filtered-out Today hints were resolved in R09 by the owner's choice.
26.09 local session: external plan synced; WebKit matrix done and its three WebKit-only
issues fixed in R13 / v295. Open: real-device checks (owner checklist — VoiceOver,
installed PWA, .ics import in Apple/Google Calendar, iOS share sheet, select height). The next
local session starts from LOCAL-SESSION-PROMPT.md; the synthetic browser audits used
for R04A–R12 are in `scripts/qa/` (Chromium/WebKit/Firefox via QA_BROWSER).
