// Builds the bundled adult-content rulesets for Satoru Attention 0.8.0 (v299). Sources: OISD NSFW
// (owner decision 26.09) plus, after the owner reported sites that 0.7.0 still let through,
// HaGeZi NSFW, StevenBlack porn-only and Satoru's own supplement (rules/adult-extra.txt).
//   node scripts/build-browser-adult-ruleset-v299.mjs <oisd domainswild2> <hagezi nsfw-onlydomains> <stevenblack porn-only hosts>
// Downloads are not committed; each source's version and SHA-256 are recorded in adult-list.js.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const ext = join(root, 'extensions/satoru-attention');
const [oisdPath, hageziPath, stevenPath] = process.argv.slice(2);
if (!oisdPath || !hageziPath || !stevenPath) throw new Error('pass the OISD, HaGeZi and StevenBlack downloads');

// Platforms that must keep working as a whole even if an upstream list ever names them; only
// adult subdomains (a specific blog, a specific game page) may be listed.
const NEVER = new Set(['satoruapp.com', 'life-rpg-production-416a.up.railway.app', 'railway.app', 'up.railway.app',
  'reddit.com', 'redd.it', 'redditmedia.com', 'redditstatic.com', 'x.com', 'twitter.com', 'twimg.com', 'tumblr.com',
  'imgur.com', 'discord.com', 'discordapp.com', 'discord.gg', 'telegram.org', 't.me', 'bsky.app', 'instagram.com',
  'facebook.com', 'tiktok.com', 'youtube.com', 'google.com', 'blogspot.com', 'github.com', 'wikipedia.org',
  'patreon.com', 'deviantart.com', 'pixiv.net', 'itch.io', 'steamcommunity.com', 'twitch.tv']);
const DOMAIN = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

function read(path, check) {
  const raw = readFileSync(path); const text = raw.toString('utf8');
  const header = (name) => (text.match(new RegExp(`^# ${name}: (.+)$`, 'm')) || [])[1]?.trim() || '';
  check(header);
  const domains = [];
  for (const line of text.split('\n')) {
    const value = line.trim().toLowerCase();
    if (!value || value.startsWith('#')) continue;
    const parts = value.split(/\s+/);
    domains.push((parts.length > 1 ? parts[1] : parts[0]).replace(/^\*\./, '').replace(/\.$/, ''));
  }
  return { raw, header, domains };
}
const sources = [];
const oisd = read(oisdPath, (h) => { if (h('Title') !== 'oisd nsfw' || !/^\d{12}$/.test(h('Version'))) throw new Error('unexpected OISD header'); });
sources.push({ name: 'OISD NSFW', url: 'https://nsfw.oisd.nl/domainswild2', license: 'GPL-3.0', version: oisd.header('Version'), sha256: sha(oisd.raw), entries: oisd.domains.length });
const hagezi = read(hageziPath, (h) => { if (!/^HaGeZi's NSFW/.test(h('Title')) || !h('Version')) throw new Error('unexpected HaGeZi header'); });
sources.push({ name: 'HaGeZi NSFW', url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/nsfw-onlydomains.txt', license: 'GPL-3.0', version: hagezi.header('Version'), sha256: sha(hagezi.raw), entries: hagezi.domains.length });
const steven = read(stevenPath, (h) => { if (!/StevenBlack\/hosts extension porn/.test(h('Title')) || !h('Date')) throw new Error('unexpected StevenBlack header'); });
sources.push({ name: 'StevenBlack porn-only', url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/porn-only/hosts', license: 'MIT', version: steven.header('Date'), sha256: sha(steven.raw), entries: steven.domains.length });
const extraRaw = readFileSync(join(ext, 'rules/adult-extra.txt'));
const extra = extraRaw.toString('utf8').split('\n').map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#'));
sources.push({ name: 'Satoru supplement', url: 'rules/adult-extra.txt', license: 'Satoru', version: '2026-09-26', sha256: sha(extraRaw), entries: extra.length });

const protectedHost = (domain) => [...NEVER].some((keep) => domain === keep || keep.endsWith(`.${domain}`));
const all = new Set();
for (const domain of [...oisd.domains, ...hagezi.domains, ...steven.domains, ...extra]) {
  if (DOMAIN.test(domain) && !protectedHost(domain)) all.add(domain);
}
for (const domain of extra) if (!all.has(domain)) throw new Error(`supplement entry rejected: ${domain}`);
// requestDomains also matches subdomains, so a subdomain of a listed domain is redundant.
const domains = [...all].filter((domain) => {
  const labels = domain.split('.');
  for (let i = 1; i < labels.length - 1; i += 1) if (all.has(labels.slice(i).join('.'))) return false;
  return true;
}).sort();
if (domains.length < 100_000) throw new Error(`list unexpectedly small: ${domains.length}`);

const CHUNK = 1000;
const chunks = [];
for (let i = 0; i < domains.length; i += CHUNK) chunks.push(domains.slice(i, i + CHUNK));
// Redirect (main frame → Satoru block page) needs host access; the block set works without it
// and also stops adult frames embedded in other sites. Allowlist rules (priority 10 000) win.
const redirect = chunks.map((requestDomains, index) => ({ id: index + 1, priority: 9_000,
  action: { type: 'redirect', redirect: { extensionPath: '/block.html' } },
  condition: { requestDomains, resourceTypes: ['main_frame'] } }));
const block = chunks.map((requestDomains, index) => ({ id: index + 1, priority: 8_500,
  action: { type: 'block' }, condition: { requestDomains, resourceTypes: ['main_frame', 'sub_frame'] } }));

mkdirSync(join(ext, 'rules'), { recursive: true });
writeFileSync(join(ext, 'rules/adult-redirect.json'), `${JSON.stringify(redirect)}\n`);
writeFileSync(join(ext, 'rules/adult-block.json'), `${JSON.stringify(block)}\n`);
const meta = { source: 'OISD NSFW + HaGeZi NSFW + StevenBlack + Satoru', license: 'GPL-3.0 (OISD, HaGeZi) · MIT (StevenBlack)',
  version: '20260926', domains: domains.length, rules: chunks.length, sources,
  rulesets: { redirect: 'adult_redirect', block: 'adult_block' } };
writeFileSync(join(ext, 'adult-list.js'), `/* Generated by scripts/build-browser-adult-ruleset-v299.mjs — metadata of rules/adult-*.json.
 * Data: OISD NSFW and HaGeZi NSFW (GPL-3.0, rules/LICENSE-GPL-3.0.txt), StevenBlack porn-only (MIT,
 * rules/LICENSE-MIT-StevenBlack.txt), Satoru supplement (rules/adult-extra.txt). See THIRD-PARTY-NOTICES.md.
 */
(function exposeAdultList(root) {
  const api = Object.freeze(${JSON.stringify(meta, null, 2).replace(/\n/g, '\n  ')});
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SatoruAdultList = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
`);
console.log(JSON.stringify({ domains: domains.length, rules: chunks.length, sources: sources.map((s) => [s.name, s.version, s.entries]) }, null, 2));
