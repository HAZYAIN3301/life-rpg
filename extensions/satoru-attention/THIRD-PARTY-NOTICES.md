# Third-party notices

`protection-catalog.js` contains domain metadata derived from these public NextDNS
repositories on 2026-08-30:

- `nextdns/services` at `4b73ad9798dc4f75842c9e21c1c45b04be524412`
- `nextdns/dns-bypass-methods` at `58c57dbc42970c759c7b0744f5fd3ceb01519dc6`
- `nextdns/piracy-blocklists` at `ba633781c489f976b330e4f9e16a3eeaa828c210`

The generated catalog is a local build artifact. Satoru Attention is independent from
NextDNS and does not use NextDNS accounts, APIs or trademarks as an endorsement.

## MIT License

Copyright (c) 2022 NextDNS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Adult-content rulesets (OISD NSFW since 0.7.0; HaGeZi, StevenBlack, Satoru since 0.8.0)

- Files: `rules/adult-redirect.json`, `rules/adult-block.json` (generated), metadata `adult-list.js`
  (name, URL, license, upstream version and SHA-256 of every source).
- OISD NSFW — https://nsfw.oisd.nl/domainswild2, maintainer Stephan van Ruth, https://oisd.nl.
  License: GNU General Public License v3.0.
- HaGeZi's NSFW — https://github.com/hagezi/dns-blocklists. License: GNU General Public License v3.0.
- Full GPL-3.0 text for both: `rules/LICENSE-GPL-3.0.txt`.
- StevenBlack hosts, porn-only alternate — https://github.com/StevenBlack/hosts. License: MIT,
  text in `rules/LICENSE-MIT-StevenBlack.txt`.
- Satoru supplement — `rules/adult-extra.txt`, part of this extension.
- The lists are shipped as separate data files; domains are unchanged apart from normalisation
  (lower-case, syntax check, removal of subdomains already covered by a listed parent, never
  Satoru's own hosts or whole general platforms such as reddit.com, tumblr.com or itch.io).
- Rebuild: `node scripts/build-browser-adult-ruleset-v299.mjs <oisd> <hagezi> <stevenblack>` in
  the web repository.
