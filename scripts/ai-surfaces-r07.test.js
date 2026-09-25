'use strict';
// R07: у каждой ИИ-поверхности один запрос с таймаутом; закрытие окна, новый запрос или выход
// из аккаунта его прерывают, поздний ответ не попадает в интерфейс; окна — диалоги на пяти языках.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const AiRequest = require('../public/ai-request-v1.js');

const APP = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

function fnSource(name) {
  const at = APP.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(at >= 0, name);
  const end = APP.indexOf('\n}', at);
  return APP.slice(at, end + 2);
}

function lifecycle() {
  const map = APP.match(/const AI_SURFACE_TIMEOUT_MS = Object\.freeze\(\{[^}]*\}\);/);
  assert.ok(map);
  const context = vm.createContext({ window: { AiRequestV1: AiRequest }, State: { me: { id: 'account-a' } }, Store: { _writeEpoch: 1 } });
  vm.runInContext(`${map[0]}\nconst _aiSurfaceRequests = new Map();\n${fnSource('aiSurfaceCancel')}\n${fnSource('aiSurfaceCancelAll')}\n${fnSource('aiSurfaceRun')}\nthis.api = { aiSurfaceRun, aiSurfaceCancel, aiSurfaceCancelAll, AI_SURFACE_TIMEOUT_MS, size: () => _aiSurfaceRequests.size };`, context);
  return context;
}

// Сетевой запрос, который отвечает, когда скажет тест, и честно реагирует на abort.
function pendingFetch() {
  let resolve, signal;
  const fetcher = (s) => { signal = s; return new Promise((yes, no) => { resolve = yes; s.addEventListener('abort', () => no(Object.assign(new Error('aborted'), { name: 'AbortError' }))); }); };
  return { fetcher, answer: (value) => resolve(value), aborted: () => signal.aborted };
}

test('a new request on the same surface cancels the previous one and only the newer answer counts', async () => {
  const { api } = lifecycle();
  const first = pendingFetch(), second = pendingFetch();
  const a = api.aiSurfaceRun('dayrec', first.fetcher);
  const b = api.aiSurfaceRun('dayrec', second.fetcher);
  assert.equal(first.aborted(), true, 'the older network request is aborted');
  second.answer({ ok: true });
  assert.equal((await a).status, 'cancelled');
  assert.deepEqual(await b, { status: 'done', value: { ok: true } });
  assert.equal(api.size(), 0);
});

test('an answer for a closed surface or a previous account is stale', async () => {
  const ctx = lifecycle();
  let open = true;
  const closed = pendingFetch();
  const run = ctx.api.aiSurfaceRun('episode', closed.fetcher, () => open);
  open = false; closed.answer({ ok: true });
  assert.equal((await run).status, 'stale');

  for (const change of [(c) => { c.State.me.id = 'account-b'; }, (c) => { c.Store._writeEpoch += 1; }]) {
    const c = lifecycle(), p = pendingFetch();
    const pending = c.api.aiSurfaceRun('profile', p.fetcher);
    change(c); p.answer({ ok: true });
    assert.equal((await pending).status, 'stale');
  }
});

test('the provider timeout ends the request; a timeout or failure for a closed surface stays silent', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { api } = lifecycle();
  assert.equal(api.AI_SURFACE_TIMEOUT_MS.cat, 20000);
  assert.equal(api.AI_SURFACE_TIMEOUT_MS.propose, 120000);
  assert.equal(api.AI_SURFACE_TIMEOUT_MS.moment, 8000);
  const hang = pendingFetch();
  const run = api.aiSurfaceRun('cat', hang.fetcher);
  t.mock.timers.tick(20000);
  const out = await run;
  assert.equal(out.status, 'timeout');
  assert.equal(hang.aborted(), true);

  let open = true;
  const gone = pendingFetch();
  const silent = api.aiSurfaceRun('stuck', gone.fetcher, () => open);
  open = false;
  t.mock.timers.tick(30000);
  assert.equal((await silent).status, 'stale');

  const failing = api.aiSurfaceRun('treemap', async () => { throw new Error('offline'); }, () => false);
  assert.equal((await failing).status, 'stale');
});

test('sign-out cancels every pending surface', async () => {
  const { api } = lifecycle();
  const a = pendingFetch(), b = pendingFetch();
  const runs = [api.aiSurfaceRun('dayrec', a.fetcher), api.aiSurfaceRun('propose', b.fetcher)];
  api.aiSurfaceCancelAll();
  assert.deepEqual((await Promise.all(runs)).map((r) => r.status), ['cancelled', 'cancelled']);
  assert.equal(a.aborted() && b.aborted(), true);
});

test('every AI call in the app carries an abort signal and each surface uses the shared lifecycle', () => {
  const calls = [...APP.matchAll(/fetch\('\/api\/ai\/(?:chat|analyze|propose)'[\s\S]{0,160}/g)].map((m) => m[0]);
  assert.ok(calls.length >= 13);
  for (const call of calls) assert.match(call, /\bsignal\b/, call.slice(0, 80));
  const surfaces = { aiCatSuggest: 'cat', stuckAiStep: 'stuck', dayRecRun: 'dayrec', epRun: 'episode', runPropose: 'propose', treeMapRun: 'treemap', refreshProfile: 'profile', questionnaireAnalyze: 'onboard', momentLine: 'moment', nudgeVoiceFetch: 'nudgeVoice' };
  for (const [fn, key] of Object.entries(surfaces)) assert.match(fnSource(fn), new RegExp(`aiSurfaceRun\\('${key}'`), fn);
  assert.match(fnSource('clearAllData'), /aiSurfaceCancelAll\(\)/);
  assert.match(fnSource('closeTreeDialog'), /aiSurfaceCancel\('treemap'\)/);
  assert.match(fnSource('updateCatSuggest'), /aiSurfaceCancel\('cat'\)/);
  assert.match(APP, /action === 'stuck-cancel'\) \{\n\s+aiSurfaceCancel\('stuck'\)/);
  assert.match(APP, /action === 'ai-surface-cancel'\) \{ aiSurfaceUserCancel\(/);
  // Шаг от Тени не перетирает то, что человек начал писать сам, и только заполняет поле.
  assert.match(fnSource('stuckAiStep'), /field\.value !== typed/);
});

test('AI dialogs are labelled dialogs that close on Escape, and dictation follows the interface language', () => {
  for (const [fn, heading, close] of [['openDayRecap', 'dayrec-heading', 'dayrec-close'], ['openEpisode', 'ep-heading', 'ep-close'], ['openProposeModal', 'propose-heading', 'propose-close']]) {
    const src = fnSource(fn);
    assert.match(src, new RegExp(`role="dialog" aria-modal="true" aria-labelledby="${heading}"`), fn);
    assert.match(src, new RegExp(`id="${heading}"`), fn);
    assert.match(src, new RegExp(`aiSurfaceCloseHTML\\('${close}'\\)`), fn);
    assert.match(src, /rememberAiSurfaceOpener\(\)/, fn);
  }
  assert.match(fnSource('aiSurfaceCloseHTML'), /aria-label="\$\{esc\(t\('Закрыть'\)\)\}"/);
  assert.match(APP, /const surface = \['propose', 'episode', 'dayrec'\]\.find\(\(key\) => document\.getElementById\(AI_SURFACE_UI\[key\]\.modal\)\);\n\s+if \(surface\) \{ e\.preventDefault\(\); closeAiSurfaceModal\(surface\); return; \}/);
  for (const fn of ['dayRecMicToggle', 'epMicToggle']) {
    assert.doesNotMatch(fnSource(fn), /'ru-RU'/, fn);
    assert.match(fnSource(fn), /rec\.lang = speechLangTag\(\)/, fn);
  }
});

test('touched AI dialogs show registry icons instead of system emoji', () => {
  const EMOJI = /[🤖📥📊📋🎒🎤⏹⏳🎯➕🚩💡]/u;
  for (const fn of ['openDayRecap', 'dayRecRun', 'renderDayRecCards', 'openEpisode', 'epRun', 'openProposeModal', 'runPropose', 'renderProposalCards', 'proposalLabel', 'openTreeMapAI', 'treeMapRun', 'renderTreeMapCards', 'updateCatSuggest', 'aiCatSuggest', 'stuckAiStep']) {
    // Эмодзи допустим только как запасной символ третьим аргументом satoruIconHTML или внутри ключа t().
    const src = fnSource(fn).replace(/satoruIconHTML\('[^']+', '[^']*', '[^']*'\)/g, '').replace(/t\('(?:[^'\\]|\\.)*'\)/g, '');
    assert.doesNotMatch(src, EMOJI, fn);
  }
});

test('new AI dialog copy is translated into all four languages', () => {
  const lines = APP.split('\n');
  const start = lines.findIndex((l) => l.startsWith('const I18N_EN = {'));
  const end = lines.findIndex((l) => l.startsWith('for (const ru in I18N_EXTRA)'));
  const ctx = vm.createContext({});
  vm.runInContext(`${lines.slice(start, end + 1).join('\n')}\nthis.I18N = I18N;`, ctx);
  const keys = [
    'Запрос отменён. Текст на месте — можно повторить.',
    'Тень не ответила за полторы минуты. Запрос отменён, текст на месте — можно повторить.',
    'Тень не ответила за две минуты. Запрос отменён, текст на месте — можно повторить.',
    'Тень не ответила за полторы минуты. Профиль не изменён — повтори попытку.',
    'Тень не ответила за полторы минуты. Текст сохранён — можно повторить или продолжить вручную.',
    'Отменить запрос', 'Разобрать день', 'Записать день', 'Импорт целей текстом', 'Оценить уровни сфер',
    'Применить выбранные', 'Подобрать сферу через ИИ', 'Тень подбирает сферу…', 'Тень не ответила вовремя — выбери сферу вручную',
    'Тень подбирает шаг…', 'Тень не ответила вовремя — напиши шаг сам', 'Тень предлагает', 'Тень оформляет предложения…',
  ];
  for (const key of keys) for (const l of ['en', 'de', 'uk', 'es']) assert.ok(ctx.I18N[l][key], `${key} → ${l}`);
  for (const fn of ['openDayRecap', 'openEpisode', 'openProposeModal', 'renderProposalCards', 'renderDayRecCards', 'aiCatSuggest', 'stuckAiStep', 'proposalLabel']) {
    for (const m of fnSource(fn).matchAll(/\bt\('((?:[^'\\]|\\.)*)'\)/g)) {
      const key = m[1];
      if (!/[А-Яа-яЁё]/.test(key)) continue;
      for (const l of ['en', 'de', 'uk', 'es']) assert.ok(ctx.I18N[l][key], `${fn}: ${key} → ${l}`);
    }
  }
});
