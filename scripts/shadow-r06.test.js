'use strict';
// R06: одна Тень — подсказки переведены и без системных эмодзи, фраза Тени заменяет строку целиком,
// голосовые и чат-кнопки ≥44px, иконки Логова и кнопки Тени видимы.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const NEXT = fs.readFileSync(path.join(root, 'public/design-next-v1.css'), 'utf8');

function fnSource(name) {
  const at = APP.indexOf(`function ${name}(`);
  assert.notEqual(at, -1, name);
  let depth = 0;
  for (let i = APP.indexOf('{', at); i < APP.length; i += 1) {
    if (APP[i] === '{') depth += 1;
    else if (APP[i] === '}' && --depth === 0) return APP.slice(at, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const applyNudgeVoice = new Function('esc', `${fnSource('applyNudgeVoice')}\nreturn applyNudgeVoice;`)(esc);

test('Shadow voice replaces the whole support line even when it starts with a registry icon', () => {
  const icon = '<span class="satoru-icon satoru-icon--glyph inline-glyph" data-icon-id="system.day-end" aria-hidden="true"></span>';
  const html = `<div class="card nudge-card"><span class="nudge-boost">${icon} <span>4 дня без записей об отдыхе.</span></span><button class="nudge" data-action="x">Go</button></div>`;
  const out = applyNudgeVoice(html, 'Пауза — тоже ход <b>');
  assert.match(out, /<span class="nudge-boost"><span class="satoru-icon[^>]*><\/span> Пауза — тоже ход &lt;b&gt;<\/span><button/);
  assert.doesNotMatch(out, /без записей/, 'the static text is replaced, not left next to the voiced one');
  const plain = applyNudgeVoice('<div><button class="nudge">A</button><span class="nudge-boost">старый текст</span></div>', 'новый');
  assert.match(plain, /<span class="nudge-boost">новый<\/span><\/div>$/);
  const noBoost = applyNudgeVoice('<div class="card"><b>X</b></div>', 'фраза');
  assert.match(noBoost, /^<div class="card"><p class="nudge-voice">фраза<\/p><b>X<\/b><\/div>$/);
});

test('Today support hints use registry icons and translated text instead of system emoji', () => {
  const block = APP.slice(APP.indexOf('const restNudge = '), APP.indexOf('const arenaHist = arenaDayHistory(today);'));
  for (const glyph of ['🌿', '🎖', '🤸', '🎒', '🌅', '🧘', '⚡']) {
    assert.doesNotMatch(block, new RegExp(`(?:>|nudge-boost">)${glyph}`), `${glyph} still leads a hint`);
  }
  // R09 removed the «System» teaser (status.xp); its discovery lives in the Shadow drip line.
  for (const id of ['status.balance', 'action.import', 'activity.workout', 'system.calendar', 'period.day', 'activity.yoga']) {
    assert.match(block, new RegExp(`satoruIconHTML\\('${id.replace('.', '\\.')}'`), id);
  }
  assert.doesNotMatch(block, />Включить<|>Позже<|>Не показывать<|>\+ Растяжка 10 мин</, 'buttons go through t()');
  const keys = ['сидячих планов — вставить разминку 10 мин', 'баланс — это тоже квест', 'Мобилка спины и плеч', 'Растяжка 10 мин', 'Это не медицинский совет — при болях сверься со специалистом.'];
  for (const key of keys) {
    const at = APP.indexOf(`'${key}': {`);
    assert.notEqual(at, -1, key);
    const row = APP.slice(at, APP.indexOf('\n', at));
    for (const lang of ['en', 'de', 'uk', 'es']) assert.match(row, new RegExp(`\\b${lang}: ['"]`), `${key} → ${lang}`);
    assert.ok(block.includes(`t('${key}')`), `${key} is rendered through t()`);
  }
});

test('dynamic translations of rest and notes hints still match without the leading emoji', () => {
  const pick = (needle) => {
    const line = APP.split('\n').find((l) => l.includes(needle) && l.trim().startsWith('[/^'));
    assert.ok(line, needle);
    return new Function(`return ${line.trim().slice(1, line.trim().indexOf('$/,') + 2)};`)();
  };
  const rest = pick('без записей об отдыхе');
  assert.ok(rest.test('4 дня без записей об отдыхе. Если сейчас нужна пауза — можно её выбрать.'));
  assert.ok(rest.test('🌿 5 дней без записей об отдыхе. Если сейчас нужна пауза — можно её выбрать.'));
  const notes = pick('(?:заметка|заметки|заметок) — открыть');
  assert.ok(notes.test('3 заметки — открыть'));
  assert.ok(notes.test('📝 1 заметка — открыть'));
});

test('Shadow controls keep 44px targets, visible Den glyphs and a 12px streak badge', () => {
  assert.match(NEXT, /\.chat-form \.cap-add\{min-width:44px;min-height:44px;color:var\(--on-accent\)\}/);
  assert.match(NEXT, /\.tts-btn\{[^}]*min-width:44px;min-height:44px/);
  assert.match(NEXT, /\.today-support \.secretary-toggle\{min-width:44px;min-height:44px/);
  assert.match(NEXT, /\.chat-msg\.me\{color:var\(--on-accent\)\}/);
  assert.match(NEXT, /\.den-stats \.satoru-icon--glyph\{[^}]*background:currentColor\}/);
  assert.match(NEXT, /#ai-fab \.fab-streak:not\(\[hidden\]\)\{[^}]*font-size:var\(--type-micro\)/);
  assert.doesNotMatch(APP, /fs\.textContent = '🔥' \+ st/);
  assert.match(APP, /satoruIconHTML\('period\.streak', 'inline-glyph', '🔥'\)\}\$\{st\}/);
  assert.match(APP, /data-action="chat-plan-file">\$\{satoruIconHTML\('action\.import'/);
  assert.match(APP, /satoruIconHTML\('media\.stop', 'button-glyph', '■'\)[\s\S]{0,200}satoruIconHTML\('media\.microphone', 'button-glyph', '🎙'\)/);
});
