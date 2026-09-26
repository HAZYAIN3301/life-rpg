import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = join(root, 'extensions/satoru-attention');
const downloads = join(root, 'public/downloads');
const manifest = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
if (manifest.version !== '0.9.0') throw new Error('v300 expects extension version 0.9.0');
const runtime = readdirSync(source).filter(name => !name.endsWith('.test.js') && /\.(js|html|css|png)$/.test(name));
for (const needed of ['adult-list.js', 'reddit-guard.js', 'reddit-guard.css']) if (!runtime.includes(needed)) throw new Error(`missing ${needed}`);
runtime.push('manifest.json', 'THIRD-PARTY-NOTICES.md', 'rules/adult-redirect.json', 'rules/adult-block.json', 'rules/adult-extra.txt',
  'rules/LICENSE-GPL-3.0.txt', 'rules/LICENSE-MIT-StevenBlack.txt');
for (const locale of readdirSync(join(source, '_locales')).sort()) runtime.push(`_locales/${locale}/messages.json`);
runtime.sort();
const staging = mkdtempSync(join(tmpdir(), 'satoru-attention-v300-'));
const timestamp = new Date('2026-09-26T00:00:00Z');
mkdirSync(downloads, { recursive: true });
try {
  for (const relative of runtime) {
    const target = join(staging, relative);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(source, relative), target);
    utimesSync(target, timestamp, timestamp);
  }
  const primary = join(downloads, 'satoru-attention-chromium-v300.zip');
  rmSync(primary, { force: true });
  execFileSync('zip', ['-X', '-q', primary, ...runtime], { cwd: staging, env: { ...process.env, TZ: 'UTC' } });
  // 0.7.0 carries ~20 MB of bundled rules (~5 MB zipped): one package, no duplicate copies.
  const outputs = ['satoru-attention-chromium-v300.zip'];
  const receipt = { release: 'v300', extensionVersion: manifest.version, target: 'Chrome and Brave desktop', published: false,
    outputs: outputs.map(name => ({ path: `public/downloads/${name}`, bytes: statSync(join(downloads, name)).size,
      sha256: createHash('sha256').update(readFileSync(join(downloads, name))).digest('hex') })),
    runtime: runtime.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(join(source, path))).digest('hex') })) };
  mkdirSync(join(source, 'store-kit-v300'), { recursive: true });
  writeFileSync(join(source, 'store-kit-v300/release.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify({ release: receipt.release, version: manifest.version, outputs: receipt.outputs }, null, 2));
} finally { rmSync(staging, { recursive: true, force: true }); }
