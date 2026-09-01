# Browser Companion v212 — Brave runtime reconnect hotfix

## Incident

Brave loaded Satoru Attention `0.5.0`, but an options tab that survived an unpacked
extension Reload displayed `runtime_unavailable`. The Manifest V3 service worker itself
was healthy: its DevTools console contained zero errors and it woke normally. Two
compatibility gaps remained:

1. Brave may omit `sender.url` for its own options page and expose the extension URL only as
   `sender.tab.url`. The worker ignored that field and denied the page's privileged messages.
2. The recovery control was a JavaScript `location.reload()` button. After the extension
   context was invalidated, recovery still depended on code owned by that stale document.

## v212 contract

- Runtime version: `0.5.1`.
- An extension UI sender is accepted only when it has the current extension ID and an
  extension URL in `sender.url`, `sender.documentUrl`, `sender.tab.url` or `sender.origin`.
  A content script's tab URL is the visited website, so it cannot use this privileged path.
- **Reconnect now** is a native link to a new `options.html` navigation. It does not call
  `chrome.runtime`, so it works after the old runtime object was revoked.
- Automatic recovery uses the same fresh-document URL and performs at most one retry.
- Saved Attention policies, Protection settings and dynamic rules are not cleared.

## Packages

- Chromium: `public/downloads/satoru-attention-chromium-v212.zip`
- Firefox: `public/downloads/satoru-attention-firefox-v212.zip`
- Safari: `public/downloads/satoru-attention-safari-v212.zip`
- Store upload aliases are generated from those three engine packages by
  `scripts/build-browser-companion-v212.mjs`.

## Required gates

1. `npm run build:browser-extension`
2. `node --test extensions/satoru-attention/*.test.js`
3. `node --test scripts/browser-companion-runtime-reconnect-v212.test.js`
4. `npm test`
5. Brave live path: overwrite the files in the already loaded unpacked directory, press
   Reload once, open a fresh Settings page and confirm the saved Attention/Protection state
   loads without `runtime_unavailable`. Test mutations in a temporary profile; do not change
   a user's live blocking rules merely to prove the reconnect path.

## Distribution boundary

Reload only rereads files from the directory already registered with the browser. It does
not download a newer ZIP. Browser-managed automatic updates begin only after the extension
is signed and published under a stable store item ID.
