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
| R04D | export | in progress | — | — |
| R05/R06 | per NEXT.md (routes / companion) | needs NEXT.md scope | — | — |

## Environment notes for this queue

- Full suite must run as a non-root user in the cloud container
  (`HOME=/tmp runuser -u nobody -- node --test --test-concurrency=2 scripts/*.test.js`).
  As root, two morning-outcome write-failure subtests cannot simulate a read-only
  directory and one test self-skips; as `nobody` they pass, matching the owner's Mac.
- Only Chromium is installed; WebKit checks are recorded as not performed.
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
