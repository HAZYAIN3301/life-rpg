'use strict';
const { chromium } = require(process.env.SATORU_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'extensions/satoru-attention/store-kit-v260');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.SATORU_BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 440, height: 420 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.join(output, 'store-assets.html')).href);
    await page.evaluate(() => Promise.all([...document.images].map(img => img.decode())));
    const assets = [{ selector: '#promo', file: 'small-promo-440x280.png', width: 440, height: 280 }, { selector: '#store-icon', file: 'store-icon-128.png', width: 128, height: 128 }];
    for (const item of assets) {
      await page.locator(item.selector).screenshot({ path: path.join(output, item.file), omitBackground: true });
      item.sha256 = hash(path.join(output, item.file));
      delete item.selector;
    }
    const manifest = { release: 'v260', method: 'Deterministic browser rendering of exact text and the existing Satoru extension mark; no generated art or changed logo.', sources: [{ file: 'store-assets.html', sha256: hash(path.join(output, 'store-assets.html')) }, { file: '../icon-192.png', sha256: hash(path.join(output, '../icon-192.png')) }], assets };
    fs.writeFileSync(path.join(output, 'store-assets.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(JSON.stringify(manifest));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
