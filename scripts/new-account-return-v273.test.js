'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../public/app.js'), 'utf8');
const helper = source.match(/function observedQuietDaysBefore\(max\) \{[\s\S]*?\n\}/)[0];
function run(events, gap) {
  const context = { todayStr: () => '2026-09-24', xpEvents: () => events,
    quietDaysBefore: () => gap };
  vm.createContext(context); vm.runInContext(helper, context);
  return context.observedQuietDaysBefore(30);
}
test('new account and activity today do not invent an absence', () => {
  assert.equal(run([], 30), 0);
  assert.equal(run([{date:'2026-09-24'}], 30), 0);
  assert.equal(run([{date:'2026-09-25'}], 30), 0);
});
test('existing history preserves the measured return interval', () => {
  assert.equal(run([{date:'2026-09-10'}], 13), 13);
  assert.equal(run([{date:'2026-09-23'}], 0), 0);
});
test('first screen offers translated actions in all four non-Russian locales', () => {
  const dict = source.match(/const I18N_EXTRA = (\{[\s\S]*?\n\});/)[1];
  const translations = vm.runInNewContext('(' + dict + ')');
  for (const key of ['Первый результат','Первый вход','Сначала — одна настоящая польза',
    'Уточнить','Восстановиться','Сделать маленький шаг','Можно остановиться','Вернуться позже']) {
    for (const language of ['en','de','uk','es']) assert.ok(translations[key]?.[language], key + ': ' + language);
  }
});
