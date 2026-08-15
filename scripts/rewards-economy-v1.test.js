'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

function functionBody(name) {
  const start = APP.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = APP.indexOf('{', start); let depth = 0;
  for (let i = brace; i < APP.length; i += 1) {
    if (APP[i] === '{') depth += 1;
    else if (APP[i] === '}' && --depth === 0) return APP.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

function cookieOf(response) { return (response.headers.get('set-cookie') || '').split(';')[0]; }
async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-rewards-v124-'));
  const port = 45700 + (process.pid % 200);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; child.stdout.on('data', (chunk) => { output += chunk; }); child.stderr.on('data', (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 200; i += 1) {
    if (child.exitCode != null) throw new Error(`server exited ${child.exitCode}: ${output}`);
    try { if ((await fetch(`${base}/api/auth/profiles`)).ok) return { child, dataDir, base }; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  child.kill('SIGTERM'); throw new Error(`server did not start: ${output}`);
}
async function api(base, route, { method = 'GET', cookie = '', body } = {}) {
  const headers = {}; if (cookie) headers.Cookie = cookie; if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await response.json(); } catch {}
  return { response, data, cookie: cookieOf(response) };
}

test('Rewards v124 economy commit is authenticated, allowlisted and account-owned', { timeout: 20000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const { base } = runtime;
  assert.equal((await api(base, '/api/economy/commit', { method: 'POST', body: { data: { rewards: [] } } })).response.status, 401);

  const alpha = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Alpha', email: 'reward-alpha@example.test', password: 'alpha-reward-123' } });
  const beta = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Beta', email: 'reward-beta@example.test', password: 'beta-reward-123' } });
  assert.equal(alpha.response.status, 200); assert.equal(beta.response.status, 200);
  const rewards = [{ id: 'r_walk', name: 'Walk', cost: 80 }];
  const purchases = [{ id: 'p_walk', rewardId: 'r_walk', name: 'Walk', cost: 80, at: '2026-08-10T00:00:00.000Z' }];
  const committed = await api(base, '/api/economy/commit', { method: 'POST', cookie: alpha.cookie, body: { data: { rewards, purchases } } });
  assert.equal(committed.response.status, 200); assert.deepEqual(new Set(committed.data.files), new Set(['rewards', 'purchases']));
  assert.deepEqual((await api(base, '/api/data/rewards', { cookie: alpha.cookie })).data, rewards);
  assert.equal((await api(base, '/api/data/rewards', { cookie: beta.cookie })).response.status, 404, 'query parameters cannot cross account ownership');

  const invalid = await api(base, '/api/economy/commit', { method: 'POST', cookie: alpha.cookie, body: { data: { rewards: {}, tasks: [] } } });
  assert.equal(invalid.response.status, 400);
  assert.deepEqual((await api(base, '/api/data/rewards', { cookie: alpha.cookie })).data, rewards, 'invalid commit writes nothing');
  assert.deepEqual((await api(base, '/api/data/purchases', { cookie: alpha.cookie })).data, purchases, 'paired file remains unchanged');
});

test('daily rewards keep an earned, disclosed and power-free surprise', () => {
  // v159: расписание заменено настоящим розыгрышем на КАЖДОМ открытии. Всё, что ниже про
  // честность, обязано пережить эту замену — иначе «больше драмы» превратилось бы в казино.
  assert.match(APP, /CHEST_RARITY_WEIGHTS = Object\.freeze\(\{ common: 60, rare: 28, epic: 10, legendary: 2 \}\)/);
  assert.match(APP, /CHEST_TYPE_WEIGHTS = Object\.freeze\(\{ gold: 55, cosmetic: 30, voucher: 15 \}\)/);
  assert.match(APP, /COSMETIC_PRICES = Object\.freeze\(\{ common: 200, rare: 450, epic: 900, legendary: 1800 \}\)/);
  assert.match(functionBody('rewardActivityCountForDate'), /!x\.entry/);
  assert.doesNotMatch(functionBody('lootTierCap'), /isPro/);
  assert.match(functionBody('cosmeticCapsulePool'), /!ownsCosmetic\(item\.id\)/);
  assert.match(functionBody('capsuleRandomUnit'), /crypto\.getRandomValues/);
  assert.match(functionBody('rollChestPrize'), /chestOdds/);
  assert.match(functionBody('lootboxCard'), /Шансы сундука открыты/);
  assert.match(functionBody('lootboxCard'), /Free и Pro получают один и тот же набор и одну попытку/);
  assert.match(functionBody('lootboxCard'), /Ставки нет, силу предметы не дают, дубликатов косметики нет/);
  assert.doesNotMatch(APP, /function (?:rollLoot|lootResolve|applyLoot|showLootEditor)\s*\(/);
  assert.match(functionBody('openChest'), /rollChestPrize/);
  assert.doesNotMatch(functionBody('openChest'), /loot-track|loot-window|Math\.random/);
  assert.match(functionBody('commitDailyRewardDialog'), /startChestReel\(overlay\)/);
  assert.match(functionBody('commitDailyRewardDialog'), /skip\.hidden = false; skip\.disabled = false/);
  assert.doesNotMatch(APP, /data-action="(?:open-loot-editor|save-loot-editor|reset-loot-editor)"/);
});

test('шанс не подкручивается: вес не знает ни про Pro, ни про серию неудач, ни про время', () => {
  // Ровно то, что Альберт просил не делать: «без искусственного подкручивания шансов».
  for (const name of ['chestOdds', 'rollChestPrize', 'chestTypesFor']) {
    const body = functionBody(name);
    assert.doesNotMatch(body, /isPro|entitlement|pity|streak|Date\.now|getHours|opened|history/, `${name} подглядывает в состояние игрока`);
  }
  // Веса — замороженные константы, а не переменные, которые кто-то мог бы подвинуть.
  assert.match(APP, /const CHEST_RARITY_WEIGHTS = Object\.freeze/);
  assert.match(APP, /const CHEST_TYPE_WEIGHTS = Object\.freeze/);
  assert.match(APP, /const CHEST_GOLD_BY_RARITY = Object\.freeze/);
});

test('прокрутка идёт при каждом открытии, а лента набрана из настоящего пула', () => {
  const commit = functionBody('commitDailyRewardDialog');
  // Ветки «косметике барабан, золоту нет» больше не существует.
  assert.doesNotMatch(commit, /reward\.type === 'cosmetic_capsule'\) \{[\s\S]{0,120}startChestReel/);
  assert.match(functionBody('openChest'), /chestReelPool\(\)/);
  const pool = functionBody('chestReelPool');
  // Все три типа приза реально попадают на ленту — иначе барабан врал бы о шансах.
  assert.match(pool, /cosmeticCapsulePool\(\)/);
  assert.match(pool, /REWARD_CATALOG/);
  assert.match(pool, /CHEST_GOLD_BY_RARITY/);
  // Заголовок до остановки ленты не называет приз.
  assert.doesNotMatch(functionBody('openChest'), /daily-reward-reveal-title" tabindex="-1">\$\{esc\(reward/);
});

test('редкость награды берётся из её цены, и ваучер не открывает то, что выше его тира', () => {
  const grade = functionBody('rewardRarityByCost');
  // Второго прайс-листа нет: границы те же, что у косметики.
  assert.match(grade, /COSMETIC_PRICES\.legendary/);
  assert.match(grade, /COSMETIC_PRICES\.epic/);
  assert.match(grade, /COSMETIC_PRICES\.rare/);
  assert.match(functionBody('voucherAllowsReward'), /RARITY_ORDER\.indexOf\(rewardRarityByCost\(item\.cost\)\) <= RARITY_ORDER\.indexOf\(voucherRarity\)/);
  assert.match(functionBody('showVoucherReward'), /voucherAllowsReward/);
  // Списывается самый дешёвый подходящий ваучер, а не первый попавшийся.
  assert.match(APP, /RARITY_ORDER\.filter\(\(r\) => owned\.includes\(r\) && voucherAllowsReward\(r, item\)\)\[0\]/);
  // Старые безымянные ваучеры не пропадают и не превращаются в легендарные.
  assert.match(functionBody('ensureLootbox'), /Array\.from\(\{ length: legacy \}, \(\) => 'common'\)/);
});

test('XP and gold payouts have explicit caps and no self-rating multiplier', () => {
  assert.match(APP, /ECONOMY_XP_BONUS_CAP_PCT = 60/);
  assert.match(APP, /ECONOMY_GOLD_BONUS_CAP_PCT = 40/);
  assert.match(APP, /hard: 1\.75/);
  assert.match(functionBody('itemXp'), /Math\.min\(ECONOMY_XP_BONUS_CAP_PCT/);
  assert.match(functionBody('itemGold'), /Math\.min\(ECONOMY_GOLD_BONUS_CAP_PCT/);
  assert.doesNotMatch(functionBody('itemXp'), /hypePct|lootBoostPct/);
  assert.deepEqual(APP.match(/const DESIRE_ENERGY = \{ forced: 1, hyped: 1 \}/)?.[0], 'const DESIRE_ENERGY = { forced: 1, hyped: 1 }');
  assert.match(APP, /Самооценка нужна для рефлексии, а не для оптимизации выплаты/);
});

test('spend and deletion use atomic confirmation without optimistic mutation', () => {
  assert.match(SERVER, /const ECONOMY_COMMIT_TYPES = Object\.freeze/);
  assert.match(SERVER, /economy_commit_failed_no_changes_lost/);
  assert.match(APP, /\/api\/economy\/commit/);
  assert.match(functionBody('showEconomyConfirm'), /role="dialog" aria-modal="true"/);
  assert.match(functionBody('commitEconomyConfirmation'), /const ok = payload \? await economyCommit\(payload\) : false/);
  assert.match(functionBody('commitEconomyConfirmation'), /if \(!ok \|\| !apply\)/);
  assert.match(functionBody('commitEconomyConfirmation'), /apply\(\); closeAccountDialog/);
  assert.match(APP, /showEconomyConfirm\('reward'/);
  assert.match(APP, /showEconomyConfirm\('gear'/);
  assert.match(APP, /showEconomyConfirm\('cosmetic'/);
  assert.match(APP, /showEconomyConfirm\('delete-reward'/);
});

test('rarity tokens, reduced motion and five-locale release copy are complete', () => {
  assert.equal((CSS.match(/var\(--(?:legendary|epic)\)/g) || []).length, 0);
  assert.match(CSS, /Rewards & economy v124/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.rewards-shell \*/);
  assert.match(CSS, /@media \(pointer: coarse\)[\s\S]*\.rewards-shell/);
  for (const key of [
    'Сундук образа',
    'Сундук содержит только косметику, не даёт силу и не требует ставки. Free и Pro получают один и тот же набор и одну попытку.',
    'Шанс выбирает редкость, затем один ещё не полученный предмет этой редкости. Дубликатов нет; косметику всегда можно купить напрямую.',
    'Пропустить церемонию',
    'Самооценка сложности и настроения не меняет выплату.',
    'Снаряжение покупается за заранее указанную цену. Дневные награды не выдают случайную силу; Free и Pro используют одни правила.',
  ]) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const row = APP.match(new RegExp(`'${escaped}': \\{([^}]+)\\}`));
    assert.ok(row, `missing locale row: ${key}`);
    for (const locale of ['en', 'de', 'uk', 'es']) assert.match(row[1], new RegExp(`\\b${locale}:`));
  }
});
