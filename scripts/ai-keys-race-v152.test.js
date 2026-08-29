'use strict';
/* fb_msi18cbi65qh — «даже раз установив ИИ, каждый раз при новом заходе снова
 * требует подключить, хотя он подключен».
 *
 * Диагноз: `State.aiKeys = {}` ставился СИНХРОННО до ответа сервера, а пустой
 * объект неотличим от «ключей нет». Любой гейт, отрисованный в это окно, честно
 * сообщал неправду. Загрузку при этом дёргали три экрана, а `canUseAi()`
 * спрашивают из двух десятков мест — отсюда «сходил в настройки и заработало». */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');

const ensure = app.slice(app.indexOf('function ensureAiKeys()'), app.indexOf('function aiHouseOK()'));

test('загрузка не выдаёт незнание за пустой список ключей', () => {
  // Ровно эта строка и была багом.
  assert.ok(!/State\.aiKeys = \{\};\s*fetch/.test(app), 'aiKeys снова заполняется пустышкой до ответа');
  assert.ok(!ensure.includes('State.aiKeys = {};'), 'ensureAiKeys не должен ставить {} до ответа');
  // `null` держится до ответа и означает «ещё не знаем».
  assert.match(ensure, /if \(State\.aiKeys !== null \|\| _aiKeysBusy\) return Promise\.resolve\(\);/);
});

test('запрос уходит один раз за сессию, а не на каждый рендер', () => {
  assert.match(ensure, /_aiKeysBusy = true;/);
  assert.match(ensure, /\.finally\(\(\) => \{ _aiKeysBusy = false; \}\)/);
});

test('401 — определённый ответ, сетевая ошибка оставляет «не знаем»', () => {
  // Разница принципиальная: «сессии нет» — это факт, а оборванная сеть не даёт
  // права утверждать, что у человека нет ключей.
  assert.match(ensure, /r\.status === 401 \? \{\} : r\.json\(\)/);
  const c = ensure.slice(ensure.indexOf('.catch('), ensure.indexOf('.finally('));
  assert.ok(!c.includes('State.aiKeys'), 'сетевая ошибка не должна фиксировать состояние ключей');
});

test('ответ есть до первой отрисовки — гейты не успевают соврать', () => {
  // Запрос стартует в начале initApp и ожидается перед render(): так он
  // перекрывается остальными загрузками и не добавляет отдельного круга.
  assert.match(app, /const aiKeysReady = ensureAiKeys\(\);/);
  const init = app.slice(app.indexOf('async function initApp()'));
  const wait = init.indexOf('await aiKeysReady;');
  const appPhase = init.indexOf("State.phase = 'app';", wait);
  const firstRender = init.indexOf('render();', appPhase);
  assert.ok(wait > 0, 'ответ не ожидается перед отрисовкой');
  assert.ok(wait < appPhase && appPhase < firstRender, 'ожидание должно стоять ДО первого app render()');
});

test('во время initApp загрузка не дёргает render() сама', () => {
  // Иначе отрисовка пошла бы посреди недособранного состояния.
  assert.match(ensure, /if \(State\.phase === 'app'\) render\(\);/);
});

test('подсказка не говорит «добавь ключ», пока ответ не пришёл', () => {
  const hint = app.slice(app.indexOf('function aiSourceHint()'), app.indexOf('function aiHandleErr('));
  const unknown = hint.indexOf('!aiKeysKnown()');
  const addKey = hint.indexOf("t('Добавь ключ в Настройках.')");
  assert.ok(unknown > 0, 'нет состояния «ещё не знаем»');
  assert.ok(unknown < addKey, 'проверка незнания должна стоять до совета добавить ключ');
  assert.match(app, /function aiKeysKnown\(\) \{ return State\.aiKeys !== null; \}/);
});

test('новая строка переведена на все пять языков', () => {
  assert.match(app, /'Проверяю подключение…'\s*:\s*\{ en:[\s\S]{0,300}de:[\s\S]{0,300}uk:[\s\S]{0,300}es:/);
});

test('обновлённый offline shell', () => {
  assert.match(sw, /const CACHE = 'satoru-v196'/);
});
