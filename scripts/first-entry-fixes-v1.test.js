'use strict';
// Ночная ветка 14.10: правки первого входа по проходу нового человека (FIRST-60S-AUDIT.md).
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public/styles.css'), 'utf8');

test('ответ анкеты без ИИ не теряется: раскладывается в результат, шаг и «почему»', () => {
  const code = APP.slice(APP.indexOf('function questionnaireManualSeed('), APP.indexOf('function questionnaireManualFromDOM() {'));
  const ctx = { State: { _questionnaireManual: {} }, questionnaireCurrent: () => ({ rawAnswer: 'Хочу сдать экзамен по немецкому B2 в декабре. Это откроет учёбу. Сегодня выучу 20 слов.' }) };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  ctx.questionnaireManualSeedFromAnswer();
  assert.deepEqual({ ...ctx.State._questionnaireManual }, { result: 'Хочу сдать экзамен по немецкому B2 в декабре.', step: 'Сегодня выучу 20 слов.', why: 'Это откроет учёбу.' });
  ctx.State._questionnaireManual = { result: 'уже начато' }; ctx.questionnaireManualSeedFromAnswer();
  assert.equal(ctx.State._questionnaireManual.result, 'уже начато', 'начатую человеком форму не перезаписываем');
  assert.equal(ctx.questionnaireManualSeed('   '), null);
  assert.match(APP, /if \(action === 'questionnaire-manual'\) \{ questionnaireSourceFromDOM\(\); questionnaireManualSeedFromAnswer\(\);/);
  assert.equal(/\(\?<=/.test(APP), false, 'без lookbehind: старый Safari не разберёт весь файл');
});

test('новому человеку — нейтральный пример, понятные слова и кнопка без рода, на всех языках', () => {
  assert.equal(APP.includes('первое видео о Satoru'), false, 'пример про видео владельца');
  assert.equal(APP.includes('Assistant и Guide'), false);
  assert.equal(APP.includes('Я сохранил → продолжить'), false);
  for (const key of ['Например: хочу к весне пробежать 5 км без остановки', 'Только цель и первый шаг попадут в личный контекст Тени и гида', 'Код сохранён → продолжить']) {
    const at = APP.indexOf(`  '${key}`); assert.ok(at > 0, key);
    const line = APP.slice(at, APP.indexOf('\n', at));
    for (const l of ['en:', 'de:', 'uk:', 'es:']) assert.ok(line.includes(l), `${key}: нет ${l}`);
  }
});

test('выбор аватара читается экранным диктором; перечёркнуто только название дела', () => {
  assert.match(APP, /data-action="pick-avatar" data-av="\$\{a\}" aria-label="\$\{esc\(t\('Аватар'\)\)\} \$\{i \+ 1\}" aria-pressed=/);
  assert.match(CSS, /\.task\.done \.t-title \{ color: var\(--muted\); \}\n\.task\.done \.t-title \.t-title-copy \{ text-decoration: line-through; \}/);
  assert.equal(/\.task\.done \.t-title \{ text-decoration: line-through/.test(CSS), false, 'чип цели и сферы не зачёркиваются');
});
