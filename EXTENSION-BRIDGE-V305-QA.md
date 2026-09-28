# v305 — Satoru Attention 0.10.1: the extension recognises satoruapp.com

Found 28.09 while planning the owner's remote session: the extension knew only the old Railway
address. On https://satoruapp.com (the address everyone uses) the read-only status bridge never
ran, so Satoru could not see an installed extension (the discovery card kept offering «finish
installation»), «Return to Satoru» links and the boundary-test link opened the Railway host, and
satoruapp.com could be added to a site rule or the denylist. Lane: Claude (extension).

## Change

- `manifest.json`: permanent host and bridge content script on `https://satoruapp.com/*` in
  addition to the Railway host (exactly these two). Done before the Chrome Web Store submission:
  a later store update adding a host would disable the extension until each user re-approves.
- `bridge.js`: runs only on those two origins and answers the page's own origin.
- `core.js`: `SATORU_ORIGIN` = satoruapp.com (links), `SATORU_ORIGINS` for the bridge sender check;
  `RESERVED_HOSTS` / protection `RESERVED_DOMAINS` include satoruapp.com and www.satoruapp.com.
- Block page and boundary-test receipt link to satoruapp.com. Privacy page (5 languages) and store
  listing name both addresses. Store kit `store-kit-v305/` (submit this ZIP; v300 kit marked old).

## Verification

- Extension tests 54/54 (updated invariants: exactly two Satoru hosts; satoruapp.com rejected as a
  rule host; deep links point to satoruapp.com). Web suite 3168/3168.
- Chromium with the extension against a local HTTPS stand-in (self-signed, hosts mapped locally,
  synthetic page that asks the bridge like the app does): satoruapp.com → READY 0.10.1 and a status
  response; Railway host → the same; evil.example → nothing.

**Published:** `f67e8a3`, both domains `satoru-v305` at 07:02 UTC 28.09; SHA-256 16/16 (incl. the
v305 ZIP); sign-in smoke in WebKit (iPhone) and Chromium without page errors.

**Owner's Brave, 28.09 (remote, with his permission):** Brave had loaded the unpacked folder
`~/Downloads/satoru-attention-chromium-v297` (0.7.0; protection on, health `active`). The verified
v305 ZIP was extracted over that folder (same path keeps the extension ID and settings) and Brave
was restarted, but Brave keeps the unpacked manifest until «Reload» on the extensions page — the
bridge still answered 0.7.0 on the Railway host and nothing on satoruapp.com (as expected for
0.7.0). Internal `brave://` pages are not reachable remotely; the owner presses «Reload» at home.

**Not verified:** the real satoruapp.com page with the owner's installed extension (needs his Brave).
