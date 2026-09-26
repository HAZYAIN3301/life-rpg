# v297 — Satoru Attention 0.7.0: adult-content blocking at list scale

Owner report 26.09: in Brave the extension did not block the most popular adult sites;
wanted NextDNS-level coverage. Owner decisions the same day: OISD NSFW list, shipped inside
the extension (GPL-3.0 as a separate data file), Adult checked by default.

## Cause

The blocking mechanism worked (verified: listed pornhub/xvideos blocked), but the Adult
category contained **11 domains**. spankbang, eporner, beeg, xhamster mirrors and every
other site outside those 11 opened. All categories were also unchecked by default.

## Change

- `scripts/build-browser-adult-ruleset-v297.mjs` turns the OISD NSFW download (version
  202609261407, SHA-256 in `adult-list.js`) into **505 602 domains** in 506 rules per set:
  syntax check, lower-case, subdomains of a listed parent dropped, Satoru's own hosts never
  listed. Two static DNR rulesets: `adult_block` (main + embedded frames, no host access
  needed) and `adult_redirect` (main frames → Satoru block page, needs all-site access).
- The service worker enables exactly the sets the settings need (`Protection.adultRulesets`):
  protection on + Adult + not in recreation → block set, plus redirect set with all-site
  access. Dynamic allowlist (priority 10 000) wins over both. Health compares the enabled
  rulesets too, so a mismatch is never shown as active.
- A setup that never stored categories starts with Adult checked; saved choices are kept.
- Options show the real count (catalog + list) and «Bundled OISD NSFW list · N domains ·
  version · GPL-3.0» in five languages. THIRD-PARTY-NOTICES, `rules/LICENSE-OISD.txt`, README.
- Extension 0.7.0 → `downloads/satoru-attention-chromium-v297.zip` (5.4 MB, one package).
  App installer, instruction page and browser picker link to it; the site's service worker no
  longer precaches the ZIP (it would have cost every visitor ~5 MB). Privacy page version 0.7.0.
  No new permission.

## Verification

- Extension unit tests 49/49 (new: default category, saved choice kept, ruleset choice with
  and without host access, recreation, disabled, counts; manifest, rule shape, priorities,
  unique valid domains, popular sites present, own hosts absent). Web suite 3159/3159.
- Chromium with the unpacked **ZIP** (all hostnames resolved to a closed local port, so no
  request reached any real site): default setup blocks pornhub, spankbang, eporner, beeg,
  xhamster.desi, rule34.xxx; wikipedia/github pass; allowlisted spankbang passes;
  recreation and «off» pass everything; with all-site access listed sites land on the Satoru
  block page and health is `active`. Options RU/EN: Adult checked, «505 613 доменов».
- Spike before the decision: OISD 507k, HaGeZi 85k and StevenBlack 77k static sets all load.

## Limits

Tabs already open on a listed site switch only on their next navigation. Private windows are
covered only if Brave allows the extension there. Brave/Chrome: the owner must replace the
unpacked folder and press Reload (store updates later). New list = new extension build.
