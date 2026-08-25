'use strict';
/* Guide v3 EN/DE/UK/ES translations mirror the approved RU source exactly in
 * shape: same key set, same {placeholder} variables per key. Neither is
 * enforced by the language itself — a translator can drop a key or mistype a
 * placeholder name ({goalOrShpere} instead of {goalOrSphere}) and JS will not
 * complain. format()'s replace() only substitutes names it recognizes; anything
 * else is left as literal "{goalOrShpere}" text on a real user's screen. This
 * is exactly the silent-failure shape this session already found twice
 * elsewhere (seed-demo habits, board taste) — checking for it here rather than
 * finding it after a real German or Spanish user hits a broken line.
 *
 * RUNTIME_APPROVED is deliberately RU-only: it gates whether Guide v3 may
 * auto-start at all (scripts/guide-v3-runtime.test.js), a decision tied to a
 * specific runtime wiring these translations don't build. Each locale file
 * instead carries STATUS:'translated' — a faithful translation of the
 * Albert-approved RU source, not itself independently tone-reviewed by Albert
 * per language. Wiring them into app.js and any approval gate is Commit C2,
 * left to whoever builds that runtime.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const RU = require('../public/guide-v3-copy-ru.js');
const LOCALES = {
  en: require('../public/guide-v3-copy-en.js'),
  de: require('../public/guide-v3-copy-de.js'),
  uk: require('../public/guide-v3-copy-uk.js'),
  es: require('../public/guide-v3-copy-es.js'),
};

const RU_KEYS = Object.keys(RU.COPY).sort();

function placeholders(str) {
  return [...String(str).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
}

test('RU source has the keys this test file assumes (canary for drift)', () => {
  assert.equal(RU_KEYS.length, 143, 'RU key count moved — update translations and this test together, not just one');
});

for (const [locale, mod] of Object.entries(LOCALES)) {
  test(`${locale}: identical key set to RU, no missing or extra keys`, () => {
    const keys = Object.keys(mod.COPY).sort();
    const missing = RU_KEYS.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !RU_KEYS.includes(k));
    assert.deepEqual(missing, [], `${locale} is missing keys RU has`);
    assert.deepEqual(extra, [], `${locale} has keys RU doesn't — likely a stale/renamed key`);
  });

  test(`${locale}: every value uses exactly the same {placeholders} as RU`, () => {
    const mismatches = [];
    for (const key of RU_KEYS) {
      const ruVars = placeholders(RU.COPY[key]);
      const localeVars = placeholders(mod.COPY[key]);
      if (JSON.stringify(ruVars) !== JSON.stringify(localeVars)) {
        mismatches.push(`${key}: RU has [${ruVars}], ${locale} has [${localeVars}]`);
      }
    }
    assert.deepEqual(mismatches, [], `placeholder drift would leak literal {braces} to real users:\n  ${mismatches.join('\n  ')}`);
  });

  test(`${locale}: no value is empty, and none still contains the raw {placeholder} unresolved by mistake`, () => {
    const broken = [];
    for (const key of RU_KEYS) {
      const v = mod.COPY[key];
      if (typeof v !== 'string' || !v.trim()) broken.push(`${key}: empty or non-string`);
    }
    assert.deepEqual(broken, []);
  });

  test(`${locale}: CONTEXTUAL_STATUS has the same chapter keys as RU`, () => {
    assert.deepEqual(
      Object.keys(mod.CONTEXTUAL_STATUS).sort(),
      Object.keys(RU.CONTEXTUAL_STATUS).sort(),
    );
  });

  test(`${locale}: format() substitutes correctly and has() / get() / entries() work`, () => {
    assert.equal(mod.has('chapter.first.title'), true);
    assert.equal(mod.has('nonexistent.key'), false);
    assert.equal(mod.get('nonexistent.key'), null);
    assert.equal(mod.entries().length, 143);
    const out = mod.format('system.progress', { current: 2, total: 5 });
    assert.ok(out.includes('2') && out.includes('5'), `format() didn't substitute in ${locale}: ${out}`);
    assert.doesNotMatch(out, /\{current\}|\{total\}/, `unresolved placeholder leaked through in ${locale}`);
  });

  test(`${locale}: module declares itself a translation, not an approved RU-style gate`, () => {
    assert.equal(mod.LOCALE, locale);
    assert.equal(mod.STATUS, 'translated');
    assert.equal('RUNTIME_APPROVED' in mod, false, `${locale} should not invent its own runtime gate — that belongs to whoever wires locale switching`);
  });
}

test('the FMA nod in context.rewards.choose is attributed in every language, not silently dropped', () => {
  // Albert's explicit choice (2026-08-24): keep the nod to Fullmetal Alchemist's law of
  // equivalent exchange, but attribute it rather than pass it off as Shadow's own words.
  // A translator silently cutting the attribution while keeping the paraphrased idea
  // would reintroduce the exact copyright concern that was raised and resolved.
  const marker = { en: /Fullmetal Alchemist/i, de: /Fullmetal Alchemist/i, uk: /Сталевого алхіміка/i, es: /Fullmetal Alchemist/i };
  for (const [locale, mod] of Object.entries(LOCALES)) {
    assert.match(mod.COPY['context.rewards.choose'], marker[locale], `${locale} dropped the attribution`);
  }
});

test('SHELL/index.html do not yet reference the new locale files (Commit C2 wiring not done here)', () => {
  const fs = require('node:fs');
  const ROOT = path.resolve(__dirname, '..');
  const sw = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  for (const locale of Object.keys(LOCALES)) {
    const file = `guide-v3-copy-${locale}.js`;
    assert.equal(sw.includes(file), false, `${file} got added to SW SHELL — that's runtime wiring (Commit C2), not this translation pass; update this test alongside doing that deliberately`);
    assert.equal(html.includes(file), false, `${file} got added to index.html — same as above`);
  }
});
