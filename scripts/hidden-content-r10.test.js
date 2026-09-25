'use strict';
// R10: скрытые разделы (свёрнутые <details>, группы Настроек) держат те же полы, что и видимые экраны:
// переведённое согласие на телеметрию, иконки реестра вместо эмодзи, светлая тема без тёмных пятен.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const NEXT = fs.readFileSync(path.join(root, 'public/design-next-v1.css'), 'utf8');
const Telemetry = require('../public/telemetry-consent-v1.js');

function dictionaries() {
  const lines = APP.split('\n');
  const start = lines.findIndex((l) => l.startsWith('const I18N_EN = {'));
  const end = lines.findIndex((l) => l.startsWith('for (const ru in I18N_EXTRA)'));
  const ctx = vm.createContext({});
  vm.runInContext(`${lines.slice(start, end + 1).join('\n')}\nthis.I18N = I18N;`, ctx);
  const a = APP.indexOf('const ACTIONABLE_COPY = {');
  vm.runInContext(APP.slice(a, APP.indexOf('\n};', a) + 3).replace('const ACTIONABLE_COPY', 'this.AC'), ctx);
  return ctx;
}

test('every telemetry purpose the person decides on is translated into all four languages', () => {
  const { I18N, AC } = dictionaries();
  const purposes = Telemetry.PURPOSE_LIST || Telemetry.PURPOSES || Object.values(Telemetry).find((v) => Array.isArray(v) && v[0] && v[0].label);
  assert.ok(Array.isArray(purposes) && purposes.length >= 5, 'purpose list is exported');
  const keys = purposes.flatMap((p) => [p.label, p.description, p.whyNotOptional]).filter(Boolean)
    .concat(['Каждая цель включается отдельно. Улучшение продукта не означает оптимизацию вовлечения.', 'ИИ оценит уровни по твоему описанию']);
  for (const key of keys) for (const l of ['en', 'de', 'uk', 'es']) assert.ok(I18N[l][key] || (AC[l] || {})[key], `${key} → ${l}`);
});

test('Settings headings and buttons use registry icons; program cards are named in the interface language', () => {
  for (const raw of ["${t('🌙 Тёмная')}", "${t('☀️ Светлая')}", "<h3>${t('🔊 Звук')}</h3>", "${t('▶ Проверить звук')}", "${t('📲 Приложение')}", "${t('📥 Скачать для Android (.apk)')}",
    "🌿 ${t('Отдых с границей')}", "${t('🎯 Фокус и Помодоро')}", "⚖️ ${t('Путь дисциплины')}", '<h3>🎖 Стартовый уровень</h3>', '>🤖 Оценить через ИИ<', "${t('📦 Программы-данжи')}",
    "${t('🧠 Что Тень о тебе помнит')}", "'🤖 ' + t('Обновить через ИИ')", '<h3>🤖 ИИ-ассистент (свой ключ)</h3>', "${t('📂 Импорт тренировок файлом')}", "${t('📂 Выбрать файлы')}", '<h3>🏃 Strava</h3>', "${t('🏃 Strava — авто-импорт тренировок')}"]) {
    assert.ok(!APP.includes(raw), raw);
  }
  assert.match(APP, /aria-label="\$\{esc\(t\('Программа'\)\)\}: \$\{esc\(t\(p\.name\)\)\} — \$\{esc\(t\(p\.tagline\)\)\}"/);
  assert.match(APP, /title="\$\{esc\(t\('ИИ оценит уровни по твоему описанию'\)\)\}"/);
});

test('light theme replaces the dark translucent console fills and rank text keeps the text colour', () => {
  const rule = NEXT.match(/:root\[data-design=next\]\[data-theme="light"\] :is\(([^)]*)\)\{background:color-mix\(in srgb,var\(--text\) 5%,transparent\)\}/);
  assert.ok(rule, 'light override exists');
  for (const sel of ['.knob', '.wk-prog', '.wk-hint', '.rank-row', '.goal-form', '.pm-row', '.import-row']) assert.ok(rule[1].split(',').includes(sel), sel);
  assert.match(NEXT, /:root\[data-design=next\]\[data-theme="light"\] \.cal\{background:repeating-linear-gradient/);
  assert.match(NEXT, /:root\[data-design=next\] \.rr-rank\{color:var\(--text\)\}/);
});

test('hidden Settings text reaches 12px and accent swatches are 44px on touch', () => {
  const tiny = NEXT.match(/:root\[data-design=next\] :is\(([^)]*)\)\{font-size:var\(--type-micro\)\}/);
  assert.ok(tiny);
  for (const sel of ['.cal-h', '.pc-meta', '.telemetry-purpose__state', '.actionable-kicker', '.account-profile-layout-label', '.shadow-voice-picker legend']) assert.ok(tiny[1].includes(sel), sel);
  assert.match(NEXT, /@media \(max-width:600px\),\(pointer:coarse\)\{\n :root\[data-design=next\] \.accent-sw\{width:44px;height:44px\}/);
  assert.match(NEXT, /@media \(min-width:601px\) and \(pointer:fine\)\{\n :root\[data-design=next\] \.pet-hint\{min-height:24px\}/, 'the desktop floor must not shrink the touch target');
});
