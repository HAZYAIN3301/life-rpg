# Browser Companion v214 — exact-host permission repair

## Incident

Satoru Attention `0.5.2` answered `GET_OPTIONS`, but saving a TikTok boundary failed with
`Only permissions specified in the manifest may be requested`. `Core.hostPatterns` produced
`*://www.tiktok.com/*`, while the manifest declared optional HTTP and HTTPS origins
separately. The catch block then mislabeled that permission error as a lost background worker.

## v214 contract

- Runtime version: `0.5.3`.
- Exact-site permission requests use literal `https://hostname/*` and `http://hostname/*`
  patterns covered by the manifest.
- A denied or rejected host permission is reported as a permission problem, never as a dead worker.
- The v213 sleep-safe request lifecycle remains intact.
- Existing Attention policies, Protection settings, permissions and dynamic rules survive.

## Packages

- Chromium: `public/downloads/satoru-attention-chromium-v214.zip`
- Firefox: `public/downloads/satoru-attention-firefox-v214.zip`
- Safari: `public/downloads/satoru-attention-safari-v214.zip`

## Required gates

1. `npm run build:browser-extension`
2. `node --test extensions/satoru-attention/*.test.js`
3. `node --test scripts/browser-companion-permission-v214.test.js`
4. Full repository test suite with localhost permissions.
5. Live Brave: click `Save boundary`, confirm the native exact-site permission prompt appears,
   grant it, then confirm the policy is saved and the red runtime warning never appears.

## Distribution boundary

Reload rereads the already registered local directory. It is not automatic distribution.
Browser-managed background updates require a signed store item with a stable ID.
