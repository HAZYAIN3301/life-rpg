# Satoru Attention — cross-browser companion v4

Manifest V3 extension for the desktop R3 attention boundary across Chromium, Firefox and
Safari. It controls only sites that
the person explicitly adds. The first setup remains deliberately small: one site and a
prebuilt pack of allowed entry scenarios. A concrete task is named at the gate, while the
time cap, mode, daily budget, entry count and cooldown are decided beforehand.

## Install

The public entry point is:

`https://life-rpg-production-416a.up.railway.app/browser-companion.html`

It provides the current download and a guided three-step test installation. The production
one-click route is signed store distribution. The build creates Chromium, Firefox and Safari
packages plus upload aliases for Chrome Web Store, Edge Add-ons, Opera Add-ons, Firefox AMO
and Apple App Store; the remaining owner-account steps are in `PUBLISH-CHECKLIST.md`.

### Test build (unpacked or temporary)

1. Open the browser-specific extension page shown on the public installation page:
   `chrome://extensions` (Chrome), `edge://extensions` (Edge),
   `brave://extensions` (Brave), `opera://extensions` (Opera),
   `vivaldi://extensions` (Vivaldi), `about:debugging#/runtime/this-firefox`
   (Firefox), or Safari's **Develop > Allow Unsigned Extensions** flow.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this exact `extensions/satoru-attention/` directory.
5. The options page opens. Add one attention site and approve the prompt for that exact
   hostname. Browser Protection is a separate optional switch and requests all-site access
   because category blocking cannot work with an exact-host grant.

Pin Satoru Attention from Brave's Extensions toolbar menu. Its badge shows `NEW` before
setup, the configured-site count while idle, `ON` while a boundary is active,
and `!` when the boundary has been reached. Badge failure never changes enforcement.

The broad `http://*/*` / `https://*/*` entries are **optional capability declarations**.
Ordinary Attention policies request only `Core.hostPatterns(hostname)`: the chosen exact
hostname over HTTP/HTTPS. Enabling Browser Protection is the only flow that requests the
broad optional grant; it is necessary to redirect blocked pages, block subresources and
apply strict request filters. Permanent host access remains limited to the exact Satoru
production origin for the read-only bridge.

## Browser Protection v1

- Seven opt-in categories: social networks, video streaming, online gaming, dating,
  gambling, adult content and piracy.
- Local denylist and allowlist with subdomain coverage. Allowlist rules have the highest
  DNR priority.
- Recreation Time pauses selected categories and the denylist on chosen days and hours.
  Bypass protection stays active during that window.
- SafeSearch adds strict parameters to Google, Bing and DuckDuckGo searches.
- YouTube Restricted Mode applies the official `YouTube-Restrict: Strict` request header.
- Bypass protection blocks bundled browser-visible VPN, proxy, Tor and encrypted-DNS
  endpoints. It does not disable a native VPN or change system DNS.
- Main-frame blocks land on a local page without an instant override. The original address
  is not persisted.

The catalog is generated from the public MIT-licensed NextDNS `services`,
`dns-bypass-methods` and `piracy-blocklists` repositories plus a small reviewed local set.
Exact revisions and attribution are in `THIRD-PARTY-NOTICES.md`. This adopts the useful
NextDNS policy model inside one browser; it is not NextDNS and does not claim DNS-level
coverage.

### Updating an unpacked build

Reloading an unpacked extension invalidates options tabs created by the old Manifest V3
runtime. v0.5.2 accepts Brave's extension-page sender when its URL is exposed only through
`sender.tab.url` and deliberately does not keep a long-lived heartbeat port. Manifest V3
workers are allowed to sleep; every real options action wakes the worker with a bounded
`sendMessage` request and retries once. **Reconnect now** is a native link to a fresh options
document for a genuinely invalidated tab. Stored rules and dynamic blocking rules survive.

## Behavior

- A configured site is redirected to `gate.html` until a purpose and bounded duration are
  explicitly chosen.
- One site can expose several pre-approved scenarios. The TikTok starter pack enables
  publish (12 min), create/edit (25 min), references (10 min) and one saved item (8 min),
  all in Control; rest and “not sure” are disabled. The site also has a 50-minute daily
  budget, three entries and a ten-minute cooldown.
- The gate may shorten a scenario but cannot increase its pre-approved window or invent a
  disabled reason. Work scenarios require a concrete task; research requires a topic.
- Looser Control changes (more time/entries, less cooldown, weaker mode, extra scenario or
  pausing the guard) are queued until the next local day. Tighter changes apply immediately.
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
- At expiry the site stays shielded until the person records `done`, `unfinished but stayed
  on task`, `escaped` or `unknown`. Finishing early is always allowed because it closes
  access rather than weakening the boundary.

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
  version: '0.5.2'
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
    version: '0.5.2',
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

- No permanent `tabs`, history, cookies, identity, native messaging, downloads, clipboard or account
  permission.
- No network request, remote sync, destructive action, profile/admin operation, reward,
  punishment, XP, gold or streak mutation.
- Policies never tighten themselves. Statistics never change a rule.
- This is a real boundary and content filter inside the installed browser, not an OS-level app
  blocker. A person can always disable or uninstall the extension. It cannot control native
  TikTok/YouTube apps, another browser, a phone, or a game console.
- Incognito and custom host permissions remain explicit browser choices.

## Development and QA

```bash
npm test
```

The package has no runtime dependencies. Tests cover both pure engines, catalog breadth,
allowlist priority, cross-midnight Recreation Time, DNR compilation, restart recovery,
stale-page reconnection, permission scope, locale parity, accessibility, visual themes,
package integrity and the read-only Satoru bridge.

## Asset ledger

`icon-192.png` is the dedicated Satoru Attention mark. Its checked-in source is
`public/browser-companion-icon-v1.svg`; the matching web asset is
`public/browser-companion-icon-v1.png`.
