# Browser Protection v210 — implementation and QA contract

## Why the old options page failed

Reloading or replacing an unpacked Manifest V3 extension terminates its previous service
worker and invalidates extension pages created by that runtime. The old options UI retried
the same dead `chrome.runtime.sendMessage` twice and could only show a manual reload notice.
It did not clear saved settings; it lost the page-to-worker connection.

v210 performs one guarded startup reload when Chrome reports an invalidated context, then
keeps a named heartbeat port. A later disconnect exposes a direct reconnect action. The
single query marker prevents a reload loop.

## Protection contract

- Browser Protection is disabled by default and is separate from exact-host Attention.
- Enabling it explicitly requests optional HTTP/HTTPS all-site access.
- Allowlist priority is 10000, main-page block/redirect 9000, subresource block 8000 and
  strict search/YouTube filters 7000.
- Categories and denylist pause during Recreation Time; bypass protection does not.
- Stored data is settings only. The blocked URL is neither persisted nor displayed.
- Saving settings and applying DNR rules is transactional. A rejected DNR update restores
  the prior settings/rules and schedules reconciliation.
- The catalog is local and generated from the exact revisions in
  `extensions/satoru-attention/THIRD-PARTY-NOTICES.md`.

## Honest boundary

This is browser-level protection. It cannot prevent removal of the extension, control a
different browser, stop an OS-level VPN or protect Incognito unless the extension is allowed
there. Those limitations are visible before the user applies protection.

## Release gates

1. Pure engine tests: domain normalization, allowlist precedence, category/subdomain
   coverage, cross-midnight schedule, bypass persistence and DNR compilation.
2. Integration tests: permission separation, worker rollback, heartbeat recovery, locale
   parity, no remote telemetry, external-script CSP and no instant block-page bypass.
3. Package tests: manifest references, v0.4.0, both v210 ZIPs and local catalog presence.
4. Visual QA: options and block pages at desktop and 375px mobile, dark/light paths, no
   horizontal overflow and at least 44px interactive targets.
5. Production verification: v210 cache pins and downloadable ZIP SHA-256 match the commit.
