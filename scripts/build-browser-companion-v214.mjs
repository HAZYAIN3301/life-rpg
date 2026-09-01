import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE = join(ROOT, 'extensions', 'satoru-attention');
const DOWNLOADS = join(ROOT, 'public', 'downloads');
const RELEASE = 'v214';
const EXPECTED_VERSION = '0.5.3';
const OMIT = new Set([
  'README.md', 'PUBLISH-CHECKLIST.md', 'STORE-LISTING.md', 'package.json',
  'core.test.js', 'integration.test.js', 'protection.test.js',
]);

function copyRuntime(destination) {
  cpSync(SOURCE, destination, {
    recursive: true,
    filter(source) {
      const name = basename(source);
      return !OMIT.has(name) && !name.startsWith('manifest.') && !name.endsWith('.test.js');
    },
  });
}

function targetManifest(target) {
  const manifest = JSON.parse(readFileSync(join(SOURCE, 'manifest.json'), 'utf8'));
  if (manifest.version !== EXPECTED_VERSION) throw new Error(`Expected ${EXPECTED_VERSION}, found ${manifest.version}`);
  if (target === 'firefox') {
    delete manifest.minimum_chrome_version;
    manifest.background = { scripts: ['service-worker.js'] };
    manifest.browser_specific_settings = {
      gecko: {
        id: 'satoru-attention@satoru.app',
        strict_min_version: '128.0',
        data_collection_permissions: { required: ['none'] },
      },
    };
  }
  if (target === 'safari') {
    delete manifest.minimum_chrome_version;
    manifest.background = {
      scripts: ['service-worker.js'],
      service_worker: 'service-worker.js',
      preferred_environment: ['service_worker', 'document'],
    };
    manifest.browser_specific_settings = { safari: { strict_min_version: '17.0' } };
  }
  return manifest;
}

function zipTarget(target, filename) {
  const stagingRoot = mkdtempSync(join(tmpdir(), `satoru-attention-${target}-`));
  const extensionRoot = join(stagingRoot, 'extension');
  copyRuntime(extensionRoot);
  writeFileSync(join(extensionRoot, 'manifest.json'), `${JSON.stringify(targetManifest(target), null, 2)}\n`);
  const output = join(DOWNLOADS, filename);
  rmSync(output, { force: true });
  execFileSync('zip', ['-X', '-q', '-r', output, '.'], { cwd: extensionRoot });
  rmSync(stagingRoot, { recursive: true, force: true });
  return output;
}

mkdirSync(DOWNLOADS, { recursive: true });
const chromium = zipTarget('chromium', `satoru-attention-chromium-${RELEASE}.zip`);
const firefox = zipTarget('firefox', `satoru-attention-firefox-${RELEASE}.zip`);
const safari = zipTarget('safari', `satoru-attention-safari-${RELEASE}.zip`);

for (const alias of [
  `satoru-attention-${RELEASE}.zip`,
  `satoru-attention-store-${RELEASE}.zip`,
  `satoru-attention-chrome-store-${RELEASE}.zip`,
  `satoru-attention-edge-store-${RELEASE}.zip`,
  `satoru-attention-opera-store-${RELEASE}.zip`,
]) copyFileSync(chromium, join(DOWNLOADS, alias));
copyFileSync(firefox, join(DOWNLOADS, `satoru-attention-firefox-amo-${RELEASE}.zip`));
copyFileSync(safari, join(DOWNLOADS, `satoru-attention-safari-app-store-${RELEASE}.zip`));

console.log(JSON.stringify({ release: RELEASE, version: EXPECTED_VERSION, outputs: [chromium, firefox, safari].map((file) => file.slice(ROOT.length + 1)) }, null, 2));
