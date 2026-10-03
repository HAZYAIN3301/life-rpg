# Store preparation QA — 03.10.2026

Candidate on a8180070; runtime v322; extension 0.10.2.

- Full web suite: **3276/3276** (work/store-20261003/suite-final.log).
- Extension suite: **54/54**, including all five locale tables and unchanged protection.
- Package ZIP byte-for-byte against runtime sources; every bundled license/ruleset retained.
  Historical 0.10.1 ZIP receipt remains checked; live-source/download checks moved to v322.
- Chromium + WebKit: policies, five languages, 375/1280 widths, light/dark and reduced motion;
  no page errors or horizontal overflow. All 45 application-policy sections present.
- Exact-source unpacked extension loaded in isolated Chrome; displayed version 0.10.2.
  New first screenshot rendered with synthetic English locale and no owner data.
  Old screenshots 2–4 visually inspected: unchanged lock, block and chess surfaces.
- JS syntax and diff checks passed. Offline/prod receipts are recorded in external CHECKPOINT
  after execution; local policy browser routing does not verify the production CDN.
- Native local commit 0d92fe4: Release archive iOS and Mac Catalyst without signing;
  archive Info.plist version 10, Swift 18/18, shared contracts PASS.

No store dashboard read/write, signature, upload, legal declaration or submission in this
pass. No physical microphone/speaker test. Last recorded TestFlight state is build 9.
Apple screenshots from 23.09 were not recaptured. Inspiration/player/rights/trader decisions
remain; the prepared matrix cannot certify unknown third-party tracking behavior.

Found and corrected during QA: old extension-version allowlists and cache descriptor
assertions needed 0.10.2/v322. No behavioral assertions were removed to hide a failure.
Local translation drafts were reviewed; incorrect owner-name and Speech/OCR translations
were corrected before assembling the policy.
