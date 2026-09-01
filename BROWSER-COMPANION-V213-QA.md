# Browser Companion v213 — Manifest V3 sleep-safe options

## Incident

Satoru Attention `0.5.1` loaded and answered `GET_OPTIONS`, but later displayed
`runtime_unavailable`. The service worker had not crashed. The options page kept a
long-lived heartbeat `Port`, and Brave disconnected it when the Manifest V3 worker entered
its normal idle lifecycle. The UI treated that normal sleep as a fatal runtime loss.

## v213 contract

- Runtime version: `0.5.2`.
- The options page does not use `chrome.runtime.connect`, heartbeat timers or `onDisconnect`.
- Every real action uses `chrome.runtime.sendMessage`, which wakes a sleeping worker and
  retries once after a short bounded delay.
- A red runtime error and native reconnect link appear only when that concrete request fails.
- A document invalidated by an unpacked Reload still navigates to a fresh options document.
- Existing Attention policies, Protection settings, permissions and dynamic rules survive.

## Packages

- Chromium: `public/downloads/satoru-attention-chromium-v213.zip`
- Firefox: `public/downloads/satoru-attention-firefox-v213.zip`
- Safari: `public/downloads/satoru-attention-safari-v213.zip`

## Required gates

1. `npm run build:browser-extension`
2. `node --test extensions/satoru-attention/*.test.js`
3. `node --test scripts/browser-companion-runtime-sleep-v213.test.js`
4. Full repository test suite with localhost permissions.
5. Live Brave: load fresh settings, wait longer than the worker idle window, confirm no red
   runtime warning, save the existing boundary, close and reopen settings, confirm persistence.

## Distribution boundary

Reload rereads the already registered local directory. It is not automatic distribution.
Browser-managed background updates require a signed store item with a stable ID.
