# Browser Companion Discovery v200 — release/QA handoff

Date: 2026-08-29
Scope: discovery, installation and visibility of the existing Satoru Attention browser companion. The attention policy/session/enforcement contract remains v199-compatible.

## Outcome

- Existing signed-in accounts see one full-width release notice near the top of `Today`, after the extension status probe completes.
- The notice has three explicit outcomes: `Install in 2 minutes`, `Remind me in 3 days`, and `Do not remind me`.
- A new account is not interrupted during onboarding/first use. Its first real post-onboarding use is recorded, and the notice becomes eligible only on a later active visit at least 24 hours later.
- `later` and `never` are durable settings writes. A failed write leaves the notice visible with Retry-safe error copy; there is no false success.
- Starting an install changes the primary action to `Finish installation`. It deliberately stays recoverable until the extension answers the read-only presence probe.
- The Settings entry now opens the same guided installer instead of exposing a ZIP with unexplained developer instructions.

Pure timing/state logic: `public/browser-companion-discovery-v1.js` (`browser-companion-v200`, 24-hour new-user delay, 3-day reminder delay).

## Installation surface

The in-app modal and the independent public route `/browser-companion.html` use the same three-step flow:

1. download one runtime ZIP;
2. open `brave://extensions` (or `chrome://extensions`);
3. enable Developer mode, choose `Load unpacked`, and select the extracted `Satoru Attention` folder.

The public page places the download above the fold, explains privacy/limits, has a one-tap copy action for both browser addresses, and is available without authentication. RU/EN/DE/UK/ES copy, dark/light, coarse touch and reduced motion are explicit.

True one-click install is intentionally not faked. Chromium desktop allows ordinary user distribution through Chrome Web Store; off-store packages remain a developer/test flow on macOS/Windows. Official references:

- https://developer.chrome.com/docs/extensions/how-to/distribute
- https://support.brave.com/hc/en-us/articles/360017909112-How-can-I-add-extensions-to-Brave

The upload-ready package, listing copy and exact owner checklist are prepared in:

- `public/downloads/satoru-attention-store-v200.zip`
- `extensions/satoru-attention/STORE-LISTING.md`
- `extensions/satoru-attention/PUBLISH-CHECKLIST.md`

Publishing still requires the owner's Chrome Web Store developer account and review. Once a real listing URL exists, set `BROWSER_COMPANION_STORE_URL` in `public/app.js`; the existing primary action will then open the signed store install instead of the test modal.

## Visibility after install

- Dedicated Satoru Attention mark replaces the old `?` placeholder in the extension, Today notice and install page. Vector source: `public/browser-companion-icon-v1.svg`; exact 192px runtime asset: `public/browser-companion-icon-v1.png`.
- The toolbar badge shows `NEW` before first setup, configured-site count while idle, `ON` during a live window, and `!` at the boundary.
- Badge failure is cosmetic and caught; it is never part of the enforcement transaction.
- Options starts with a localized reminder to pin Satoru Attention in the Brave/Chromium toolbar.

## Security and privacy invariants

- The extension still has no `<all_urls>`, remote code, telemetry, account mutation, reward mutation or browsing-history upload.
- Permanent host access is limited to the exact production Satoru origin. Each controlled site requires a separate user-granted optional host permission.
- Satoru receives only the existing bounded, read-only status schema. It does not receive hostname, purpose, outcome, URL history or page contents.
- Discovery writes only the release-notice choice/timestamps. It cannot create/modify attention rules or start/close a session.
- Installed status hides the notice only while the extension proves it is present; an interrupted test installation is not recorded as success.

## Automated QA

- Focused app/discovery/package gate: **16/16 pass**.
- Extension engine/integration gate: **31/31 pass**.
- Guide/current-shell/Today regression gate after v200 pin update: **62/62 pass**.
- Syntax: `public/app.js`, `server.js`, discovery/landing scripts and extension service worker: **pass**.
- Full sparse-worktree suite: **1151/1168 pass; 17 fail**. All 17 failures are the pre-existing sparse-checkout class: missing immutable `public/art/**`, font/audio or `art-factory/**` assets. No v200 product-code, server, extension, locale, transaction or layout test fails.

## Browser QA

In-app Browser against the local Node server:

- `360×800`: Today notice and modal; no document horizontal overflow; actions stack at full touch width.
- `375×812`: install section and browser-address controls; no horizontal overflow.
- `1280×900`: Today release notice and independent landing-page hero; expected desktop hierarchy.
- New account: notice absent during first active use.
- Existing account: notice present after probe.
- `Remind me in 3 days`: notice hides after awaited save and remains hidden after reload.
- Install modal: labelled dialog, inert backdrop, visible focus, Escape, focus trap and focus return to `Finish installation` verified.
- Reduced-motion CSS removes arrival/sheen motion; no unsolicited audio is played. Explicit opening uses the normal restrained UI-open sound.

One visual QA defect was found and fixed during this pass: the previous extension icon was the project's placeholder question mark. A second QA defect was also fixed: async replacement of the Today notice could leave modal focus on `body` after Escape; close now resolves the fresh trigger and restores focus.

## Release artifacts

- `public/downloads/satoru-attention-v200.zip`
- `public/downloads/satoru-attention-store-v200.zip`
- Both runtime ZIPs contain the same 19 files, with `manifest.json` at archive root and no tests/docs/package metadata.
- ZIP SHA-256 before commit: `6b8d4cb820c4135e22490436ac5cf2e665de33f4f0a822681b440ec0ab411b7d`.
- Icon SHA-256: `b652539f04dce6b98bf8ef3d47609fedf2e4c63b19b9f042339ee0b8e76825d8`.
- Integrated PWA cache after rebasing over Inspiration Learning v201 was `satoru-v202`; the later Interface Hierarchy v203 release correctly advances the shared shell to `satoru-v203` without changing the extension package bytes.

## Production verification

- Discovery v200 (`586bba8`) reached `origin/master` inside exact fast-forward release `82fcd74` together with the later v203 shell.
- Railway services `life-rpg` and `piper-tts` both completed with `success`.
- Production Today shows the bounded announcement with install / remind in 3 days / do not remind outcomes; the open-tab PWA update path was exercised before the production DOM smoke.
- `public/downloads/satoru-attention-v200.zip` is byte-identical in production. SHA-256: `6b8d4cb820c4135e22490436ac5cf2e665de33f4f0a822681b440ec0ab411b7d`.
- The shared production shell is now intentionally `satoru-v203`; v200 discovery code and package remain unchanged beneath the newer cache pin.
