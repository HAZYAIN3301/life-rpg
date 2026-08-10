const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');

test('Character exposes exactly the approved headwear, neck, and back slots', () => {
  const block = app.match(/const CHARACTER_WARDROBE_V1_SLOTS = \[([\s\S]*?)\n\];/);
  assert.ok(block, 'wardrobe slot allowlist must exist');
  const keys = [...block[1].matchAll(/runtimeKey: '([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(keys, ['headwear', 'neck', 'back']);
  assert.doesNotMatch(block[1], /weapon|armor|amulet|rightHand|waist|earwear/);
});

test('Equipped, owned, and seen are independent and the equip handler validates input', () => {
  assert.match(app, /appearance\.slots\[slot\.runtimeKey\] === item\.value/);
  assert.match(app, /avatarWardrobeV1 = \{ schemaVersion: 1, owned: \[\.\.\.owned\], seen: \[\.\.\.seen\] \}/);
  assert.match(app, /function characterWardrobeV1Owned\(\)/);
  assert.match(app, /const CHARACTER_WARDROBE_V1_BASELINE_SEEN = \[[\s\S]*?'headwear:scholar-hat-draft'/);
  assert.doesNotMatch(app, /CHARACTER_WARDROBE_V1_BASELINE_SEEN = CHARACTER_WARDROBE_V1_SLOTS\.flatMap/);
  assert.match(app, /const owned = !remove && \(ownedItems\.has\(item\.id\) \|\| equipped\)/);
  assert.match(app, /const isNew = owned && !seen\.has\(item\.id\)/);
  assert.match(app, /if \(!slot \|\| !item \|\| !AVATAR_SLOT_VALUES\[slot\.runtimeKey\]\.has\(item\.value\)\) return;/);
  assert.match(app, /aria-pressed="\$\{equipped\}"/);
  for (const label of ['Надето', 'В наличии', 'Новое']) assert.match(app, new RegExp(label));
});

test('Character rarity uses canonical tokens and non-colour frame grammars', () => {
  for (const id of ['common', 'rare', 'epic', 'legendary']) {
    assert.match(css, new RegExp(`--rarity-${id}:`));
    assert.match(css, new RegExp(`rarity-${id}`));
  }
  assert.match(app, /function characterWardrobeV1RarityColor\(rarityId\)/);
  assert.match(app, /`var\(--rarity-\$\{rarityId\}\)`/);
  assert.match(css, /rarity-rare[^\n]*box-shadow/);
  assert.match(css, /rarity-epic[^\n]*clip-path/);
  assert.match(css, /rarity-legendary[^\n]*border-style: double/);
});

test('Wardrobe navigation is inline, focus-restored, touch-sized, and offline-safe', () => {
  assert.match(app, /go-wardrobe'[\s\S]{0,180}_characterFocusAfterCommit = '#character-wardrobe'/);
  assert.doesNotMatch(app, /go-wardrobe'\) \{[^}]*setTimeout\(openAvatarForgeEditor/);
  // A mobile-sheet transition owns the focus handoff centrally, rather than
  // relying on a wardrobe-only special case.
  assert.match(app, /const fromMobileSheet = !!secBtn\.closest\('#mobile-nav-sheet'\)/);
  assert.match(app, /if \(fromMobileSheet\) closeMobileNavSheet\(\{ restoreFocus: false \}\)/);
  assert.match(app, /<h2 id="character-route-title">\$\{t\('Персонаж'\)\}<\/h2>/);
  assert.match(app, /data-character-panel="rhythm"\$\{secondaryOpen\('rhythm'\)\}/);
  assert.match(app, /State\._characterSecondaryOpen = 'rhythm'/);
  assert.match(app, /State\._characterFocusAfterCommit = `\[data-action="bal-drill"/);
  assert.match(app, /e\.target\.matches\?\.\('\.character-secondary-panel > summary'\)[\s\S]{0,180}panel\.open = !panel\.open/);
  assert.match(app, /data-action="character-wardrobe-slot"/);
  assert.match(app, /data-action="character-wardrobe-equip"/);
  assert.match(css, /--character-subtab-active-fg:/);
  assert.match(css, /body:has\(\.character-shell\) \.navsubtab\.active/);
  assert.match(css, /@media \(pointer: coarse\), \(max-width: 600px\)[\s\S]*character-wardrobe-item[\s\S]*var\(--touch-min\)/);
  assert.match(css, /@media \(min-width: 901px\) and \(max-height: 900px\)[\s\S]*character-wardrobe-preview-panel[\s\S]*character-wardrobe-slots \{ gap: var\(--sp-1\)/);
  const cache = Number((sw.match(/const CACHE = 'satoru-v(\d+)'/) || [])[1]);
  assert.ok(cache >= 114, `expected SW cache >=114, got ${cache}`);
  for (const file of ['avatar-forge-v1.html', 'traveller-scarf-alpha.png', 'scholar-hat-alpha.png', 'scholar-backpack-front-alpha.png', 'day-observation-v1.js']) {
    assert.match(sw, new RegExp(file.replaceAll('.', '\\.') ));
  }
});

test('New wardrobe copy has complete EN/DE/UK/ES rows', () => {
  const keys = ['Три слота. Один ясный образ.', 'Голова', 'Шея', 'Спина', 'Надето', 'В наличии', 'Новое', 'Рюкзак Scholar', 'Позы для работы, разминки и отдыха.', 'Колесо ритма', 'Женский'];
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const row = app.match(new RegExp(`'${escaped}': \\{([^\\n]+)\\}`));
    assert.ok(row, `missing i18n row for ${key}`);
    for (const locale of ['en', 'de', 'uk', 'es']) assert.match(row[1], new RegExp(`${locale}:`), `${key} missing ${locale}`);
  }
  assert.equal((app.match(/^  'Все':/gm) || []).length, 1, 'I18N_EXTRA must not override the canonical Все row');
});
