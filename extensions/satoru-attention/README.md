# Satoru Attention — Brave/Chromium companion v1

Manifest V3 extension for the desktop R3 attention boundary. It controls only sites that
the person explicitly adds. The first setup remains deliberately small: one site, one
purpose, one limit. A second save for the same site adds or updates that purpose without
erasing the other purposes.

## Install

The public entry point is:

`https://life-rpg-production-416a.up.railway.app/browser-companion.html`

It provides the current download and a guided three-step test installation. The production
one-click route is Chrome Web Store distribution; the upload-ready ZIP and listing copy are
described in `PUBLISH-CHECKLIST.md` and `STORE-LISTING.md`.

### Brave test build (unpacked)

1. Open `brave://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this exact `extensions/satoru-attention/` directory.
5. The options page opens. Add one site and approve the browser permission prompt for
   that exact hostname.

Pin Satoru Attention from Brave's Extensions toolbar menu. Its badge shows `NEW` before
setup, the configured-site count while idle, `ON` while a boundary is active,
and `!` when the boundary has been reached. Badge failure never changes enforcement.

The broad `http://*/*` / `https://*/*` entries are only **optional capability declarations**
required for user-selected custom domains. Before a site is selected, the extension cannot
read or change it. The options UI calls `chrome.permissions.request` only with
`Core.hostPatterns(hostname)`: only the chosen hostname, for HTTP/HTTPS. Permanent
host access in the manifest is limited to the exact Satoru production origin for the
read-only bridge.

## Behavior

- A configured site is redirected to `gate.html` until a purpose and bounded duration are
  explicitly chosen.
- Only one attention session can be open at a time.
- Adaptive/Trust may have at most one bounded extension. Control has no ordinary extension.
- Control offers an emergency exit both during the active contract and at the boundary.
  It requires a persistent 90-second delay, a short reason, and a local budget of one pass
  per seven days. Granting it closes the original contract as `unknown` and creates a new,
  separate five-minute emergency-access session. The reason is validated but not retained.
- A dynamic redirect rule blocks new navigation. A dynamically registered `document_start`
  guard rechecks an already open page every 15 seconds and on visibility/page restore. An
  alarm plus an all-tabs reconciliation closes matching open tabs at the boundary.
- Policy, session, emergency budget and the last 100 minimal episode summaries live only in
  `chrome.storage.local`. No visited URL, query, watched item or emergency reason is stored.
- Browser/service-worker restart reloads the session snapshot, reconstructs redirect rules
  and registered guards, and redirects open tabs when the deadline has passed.

### Malformed storage and clock rollback

Malformed local state normalizes to an empty inert state. On startup reconciliation removes
orphan dynamic rules, so corrupt data cannot leave an unexplained permanent block.
An orphan active session without its matching normalized policy is quarantined instead of
becoming an uncloseable global lock.

Policy/session mutations save and apply browser enforcement as one transaction. If a Chrome
API update fails, the previous snapshot is restored and reconciled. If that recovery itself
cannot complete, the response explicitly reports recovery state and schedules another local
reconciliation; the UI never reports false success or renders a storage failure as no rules.

While a managed page is open, the guard persists a monotonic clock observation at most once
per 30 seconds. If the wall clock moves backwards by more than two minutes, access is denied
with `clock_rollback`; extension/Control/emergency mutations also stop. Correct the device
time to continue. Small NTP corrections remain tolerated.

### Exact hosts, active tabs and Incognito

- A configured `example.com` permission covers only that exact hostname. Add another hostname
  explicitly if it needs its own boundary. Satoru's
  production host is reserved and cannot itself be configured as a blocked site.
- Existing managed tabs are redirected at policy activation, session end, deadline alarm,
  extension startup and permission reconciliation; the in-page guard covers alarm delay.
- Chromium/Brave disables extensions in private windows by default. If the person explicitly
  enables **Allow in private/Incognito**, matching private tabs are handled by the same local
  policy. The browser can still revoke this permission or disable the extension.

## Satoru bridge v1

The content script runs only on:

`https://life-rpg-production-416a.up.railway.app/*`

It never sends policies, purpose, outcome, hostname, browsing history or account data.

Announcement:

```js
{
  source: 'satoru-attention-extension',
  type: 'SATORU_ATTENTION_EXTENSION_READY',
  version: '0.1.0'
}
```

Status request from the page (request ID: 1–64 ASCII identifier characters):

```js
{
  source: 'satoru-app',
  type: 'SATORU_ATTENTION_STATUS_REQUEST',
  requestId: '...'
}
```

Read-only response:

```js
{
  source: 'satoru-attention-extension',
  type: 'SATORU_ATTENTION_STATUS_RESPONSE',
  requestId: '...',
  status: {
    installed: true,
    version: '0.1.0',
    configuredSites: 1,
    active: null // or { app, phase: 'active'|'boundary', remainingSeconds, mode }
  }
}
```

Open-options request/result:

```js
{ source: 'satoru-app', type: 'SATORU_ATTENTION_OPEN_OPTIONS', requestId: '...' }
{ source: 'satoru-attention-extension', type: 'SATORU_ATTENTION_OPEN_OPTIONS_RESULT', requestId: '...', ok: true }
```

All `window.postMessage` traffic is checked against the exact production origin and
`event.source === window`. The background accepts bridge messages only from that exact
content-script sender.

Gate links to Satoru are generated from a closed allowlist only:

- `?do=gate&app=<tiktok|youtube|instagram|x|reddit|web>&source=extension`
- `?do=return&app=<tiktok|youtube|instagram|x|reddit|web>&source=extension`

## Security and honest limits

- No `tabs`, history, cookies, identity, native messaging, downloads, clipboard or account
  permission.
- No network request, remote sync, destructive action, profile/admin operation, reward,
  punishment, XP, gold or streak mutation.
- Policies never tighten themselves. Statistics never change a rule.
- This is a real boundary for selected websites inside Brave/Chromium, not an OS-level app
  blocker. A person can always disable or uninstall the extension. It cannot control native
  TikTok/YouTube apps, another browser, a phone, or a game console.
- Incognito and custom host permissions remain explicit browser choices.

## Development and QA

```bash
npm test
```

The package has no dependencies. Tests cover the pure engine, restart recovery, malformed
state, clock rollback, emergency delay/budget, purpose merging, permission scope, manifest
permissions, bridge schema, locale parity, light/dark/reduced-motion and accessibility hooks.

## Asset ledger

`icon-192.png` is the dedicated Satoru Attention mark. Its checked-in source is
`public/browser-companion-icon-v1.svg`; the matching web asset is
`public/browser-companion-icon-v1.png`.
