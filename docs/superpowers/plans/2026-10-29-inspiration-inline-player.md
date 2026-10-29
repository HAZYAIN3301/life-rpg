# Inspiration inline player implementation plan

> Execute inline with superpowers:executing-plans; no subagents by owner rule.

**Goal:** Personal TikTok references/saved links play inside accepted B2.17 cards.
**Spec:** Owner29.10 requires inline playback and confirmed the real7-clip research
probe. Native research/limits: ../satoru-ios/work/inspiration-player-research-20261029/RESULT.md.
**Architecture:** Same-origin isolated wrapper with per-ID frame-src CSP and nested
sandboxed official TikTok player. Strict source/origin/id messages to existing viewer.
Shared catalog admission and daily source/ranking/ownership remain unchanged.
**Stack:** Existing browser/CommonJS modules, Node HTTP host, B2.17 CSS, WKWebView.

## Constraints and review focus

No Apify; no copied video/music; no default external navigation; preserve attribution.
No eager third-party requests; personal save/ref owner unchanged; no global license bypass.
No timeout merely while waiting for initial user Play; bounded buffering/errors/retry.
Close on ended/pagehide/visibility hidden/nav; no auto-next/loop/view rewards.
Test hostile ID, spoofed message, legacy shell navigation, missing/broken source and focus.

- [x] RED/GREEN wrapper URL/message/CSP/close lifecycle tests and personal/global gate.
- [x] Implement wrapper in public/inspiration-tiktok-player.html + focused JS/CSS;
  server.js attaches exact-ID CSP to this route, default deny invalid IDs.
- [x] Integrate only personalMedia path in app.js/ReturnShelf UI/reference controls;
  strict controller wrapper events, late ready, buffering, end, hidden cleanup.
- [x] Five-locale disclosure/privacy; explicit v323 superseding scope contract.
- [x] Actual accepted UI/source/save/reload QA in isolated account, browser375/desktop.
  Owner-authorized iPhone Simulator XCUITest uses actual current shell; dedicated macOS
  research host was not captured. Physical iPhone is not claimed.
- [ ] Cache349/pins/build, full source+live gates and byte contracts. Scoped release,
  production deployment/hash receipt. Preserve private example URLs outside web repo.
