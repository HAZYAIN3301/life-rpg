# Browser Companion v211 — cross-browser release contract

## Outcome

Satoru Attention `0.5.0` now has one audited source tree and three generated browser-engine
packages:

- Chromium: Chrome, Microsoft Edge, Brave, Opera and Vivaldi;
- Firefox: MV3 manifest with an event-page background, stable AMO ID and Mozilla disclosure;
- Safari: Safari Web Extension manifest with both supported background environments.

The public `/browser-companion.html` page detects the current browser, lets the person choose
another one, switches package/instructions without reload, and exposes an immediate persistent
RU/EN/DE/UK/ES language selector (`?lang=` plus local storage). Test packages are labelled as
test packages; the site never pretends a ZIP is a one-click signed install.

## Updates

The options page shows the installed version and calls the browser's native
`runtime.requestUpdateCheck()` API. Signed store installations update automatically and the
button requests an immediate check. Unpacked/temporary builds cannot be silently replaced by
a website; their honest QA path remains Reload. Publication/account/signature steps are in
`extensions/satoru-attention/PUBLISH-CHECKLIST.md`.

## Build

```bash
npm run build:browser-extension
```

The builder copies runtime files into isolated staging directories, writes a target manifest,
creates root-manifest ZIPs and produces exact store aliases. Tests compare store aliases to
their engine package byte-for-byte and inspect manifests from inside each ZIP.

## Security and privacy invariants

- Permanent host access is still only the Satoru production origin.
- Exact-site Attention permissions remain opt-in per hostname.
- Browser Protection requests broad optional access only after its explicit switch.
- No remote JavaScript, analytics, sync storage or browsing-history transfer was introduced.
- Firefox declares no collection/transmission; this describes off-device collection, while
  local rules and sessions remain documented in the listing.

## QA gates

- extension runtime suite;
- focused package/bridge/discovery/multibrowser suite;
- JavaScript syntax for extension, builder, landing, app and service worker;
- complete repository suite;
- browser QA at desktop and narrow mobile viewport for language, package switching, overflow,
  touch targets and console errors;
- production byte/hash verification after Railway deploy.

## Verified release candidate

- complete repository suite: **1295/1295 PASS**;
- extension runtime/security suite: **47/47 PASS**;
- focused package/bridge/discovery/multibrowser suite: **24/24 PASS**;
- syntax, ZIP structure and whitespace gates: PASS;
- browser QA: desktop RU, Firefox package/address switching, EN persistence, `375×812`,
  no horizontal overflow, `44px` language touch target, zero console warnings/errors.

Release-candidate SHA-256:

- Chromium: `5a4494015d51fd2546767af40adc5a45d1fa9bd54579a4f9b4baab410342d7f6`;
- Firefox: `232cd238d0f109b70543693e6131cb37d7479c3fb76c930c146bf2785556b76d`;
- Safari: `9e91200add1c0bed269976740c92d39e4ba01b02cf3a6f94d84378703b599cf8`.

Commit, deployment status and production byte verification are appended to the matching
DEVLOG entry after release.
