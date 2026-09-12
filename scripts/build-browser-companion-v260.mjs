import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = join(root, 'extensions/satoru-attention');
const downloads = join(root, 'public/downloads');
const manifest = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
if (manifest.version !== '0.6.0') throw new Error('v260 expects extension version 0.6.0');
const runtime = readdirSync(source).filter(name => !name.endsWith('.test.js') && /\.(js|html|css|png)$/.test(name));
runtime.push('manifest.json', 'THIRD-PARTY-NOTICES.md');
for (const locale of readdirSync(join(source, '_locales')).sort()) runtime.push(`_locales/${locale}/messages.json`);
runtime.sort();
const staging = mkdtempSync(join(tmpdir(), 'satoru-attention-v260-'));
const timestamp = new Date('2026-09-12T00:00:00Z');
mkdirSync(downloads, { recursive: true });
try {
  for (const relative of runtime) {
    const target = join(staging, relative);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(source, relative), target);
    utimesSync(target, timestamp, timestamp);
  }
  const primary = join(downloads, 'satoru-attention-chromium-v260.zip');
  rmSync(primary, { force: true });
  execFileSync('zip', ['-X', '-q', primary, ...runtime], { cwd: staging, env: { ...process.env, TZ: 'UTC' } });
  const outputs = ['satoru-attention-chromium-v260.zip', 'satoru-attention-chrome-store-v260.zip', 'satoru-attention-v260.zip', 'satoru-attention-store-v260.zip'];
  for (const name of outputs.slice(1)) copyFileSync(primary, join(downloads, name));
  const receipt = { release: 'v260', extensionVersion: manifest.version, target: 'Chrome and Brave desktop', published: false,
    outputs: outputs.map(name => ({ path: `public/downloads/${name}`, bytes: statSync(join(downloads, name)).size,
      sha256: createHash('sha256').update(readFileSync(join(downloads, name))).digest('hex') })),
    runtime: runtime.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(join(source, path))).digest('hex') })) };
  mkdirSync(join(source, 'store-kit-v260'), { recursive: true });
  writeFileSync(join(source, 'store-kit-v260/release.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify({ release: receipt.release, version: manifest.version, outputs: receipt.outputs }, null, 2));
} finally { rmSync(staging, { recursive: true, force: true }); }
