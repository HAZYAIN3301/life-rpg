'use strict';
/* Подключение `failure-context-v1` (DISCIPLINE-ARENA-PLAN §4) и `after-lapse-v1` (§12).
 *
 * Собственная логика модулей уже покрыта `failure-context-v1.test.js` и
 * `after-lapse-v1.test.js`. Здесь проверяется ровно то, что появилось при
 * подключении: гейты, которые модуль закрыть не может (час дня, дни эпизода,
 * начало окна), и контракт поверхности. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');

const FC = require('../public/failure-context-v1.js');
const AL = require('../public/after-lapse-v1.js');

const day = (n) => {
  const d = new Date(Date.UTC(2026, 6, 14) + n * 86400000);
  return d.toISOString().slice(0, 10);
};

test('оба модуля доехали в offline shell, а не только в разметку', () => {
  for (const f of ['failure-context-v1.js', 'after-lapse-v1.js']) {
    assert.match(html, new RegExp(`<script src="${f}\\?v=`), `${f} нет в index.html`);
    assert.match(sw, new RegExp(`'${f}'`), `${f} нет в SHELL sw.js`);
  }
  // Без бампа офлайн-клиенты получили бы старый shell без новых файлов.
  assert.match(sw, /const CACHE = 'satoru-v233'/);
});

test('§4: контекст провала молчит до вечера, пока день не закрыт', () => {
  // Гейт, которого у модуля нет и быть не может — он видит только дни, не часы.
  // «Сегодня ноль» в девять утра означает «ещё не начал», а не «день потерян».
  assert.match(app, /if \(new Date\(\)\.getHours\(\) < 18 && !dayClosed\(today\)\) return '';/);
});

test('§4: наружу уходят только счётчики модуля — ни одного утешения', () => {
  const block = app.slice(app.indexOf('function failureContextHTML('), app.indexOf('function afterLapseNudgeHTML('));
  assert.ok(block.length > 200 && block.length < 4000);
  // Каждое подставляемое значение — поле ответа модуля, а не собранная фраза.
  for (const f of ['fc.observed', 'fc.normal', 'fc.good', 'fc.bad', 'fc.sinceLastBad']) {
    assert.ok(block.includes(f), `не использовано поле ${f}`);
  }
  for (const bad of ['не расстраивайся', 'ничего страшного', 'бывает', 'зато', 'всё будет']) {
    assert.ok(!block.toLowerCase().includes(bad), `утешение в §4: «${bad}»`);
  }
  // Гейт «никогда не сравнивать с людьми» — на поверхности его тоже нет.
  for (const bad of ['rank', 'percentile', 'others', 'среднего', 'у других']) {
    assert.ok(!block.includes(bad), `сравнение с людьми в §4: «${bad}»`);
  }
});

test('§4: пример плана даёт ровно 22 обычных, 5 хороших, 3 таких', () => {
  const days = [];
  for (let i = 0; i < 30; i++) days.push({ date: day(i), doneCount: 3 });
  for (const i of [2, 7, 11, 19, 24]) days[i].doneCount = 8;   // хорошие
  for (const i of [4, 16, 29]) days[i].doneCount = 0;          // потерянные, последний — сегодня
  const fc = FC.failureContext(days, day(29));
  assert.equal(fc.normal, 22);
  assert.equal(fc.good, 5);
  assert.equal(fc.bad, 3);
  assert.equal(fc.sinceLastBad, 13);                            // прошлый был 16-м днём
});

test('§4: в обычный и хороший день модуль молчит — иначе это шум', () => {
  const days = [];
  for (let i = 0; i < 30; i++) days.push({ date: day(i), doneCount: 3 });
  assert.equal(FC.failureContext(days, day(29)), null);
  days[29].doneCount = 9;
  assert.equal(FC.failureContext(days, day(29)), null);
});

test('день эпизода исключается из окна, а не кладётся нулём', () => {
  // Поездка не содержит закрытых дел и по счётчику выглядит потерянной. Нулевой
  // день назвал бы её провалом и заодно занизил бы норму обоим модулям.
  assert.match(app, /if \(episodeCoversDay\(ds\)\) continue;/);
  const hist = app.slice(app.indexOf('function arenaDayHistory('), app.indexOf('function failureContextHTML('));
  assert.ok(hist.includes('episodeCoversDay'), 'эпизоды не исключаются');
});

test('окно не начинается раньше первого прожитого в приложении дня', () => {
  // Иначе у новичка два десятка никогда не существовавших дней стали бы
  // «потерянными», и первая же строка сообщила бы выдуманную статистику.
  assert.match(app, /const start = first && first > from \? first : from;/);
});

test('§12: карточка ничем не блокирует — в ней нет ни одного действия', () => {
  const block = app.slice(app.indexOf('function afterLapseNudgeHTML('), app.indexOf('function afterLapseNoteSpoken('));
  assert.ok(block.includes('lapse-nudge'));
  assert.ok(!block.includes('data-action'), 'в карточке §12 появилось действие — гейт «ничего не блокировать»');
  for (const bad of ['disabled', 'cap', 'limit', 'запрет']) {
    assert.ok(!block.includes(bad), `в §12 появилось ограничение: «${bad}»`);
  }
});

test('§12: «вчера потеряно» решает вызывающий тем же классификатором, что §4', () => {
  // Модуль намеренно не решает это сам: два независимых классификатора однажды
  // разошлись бы в ответе про один и тот же день.
  assert.match(app, /F\.classifyDay\(yEntry, F\.typicalDone\(hist\)\) !== 'bad'/);
  assert.match(app, /const arenaHist = arenaDayHistory\(today\);/);
});

test('§12: сегодняшняя дата не отдаётся модулю — иначе карточка мигнёт и исчезнет', () => {
  assert.match(app, /afterLapseSaid\) \|\| \[\]\)\.filter\(\(d\) => d < today\)/);
  // Почему фильтр обязателен: с сегодняшней датой внутри модуль замолкает сразу.
  const base = { today: day(10), yesterdayLost: true, todayPlanned: 8, history: [1, 2, 3, 4, 5].map((i) => ({ date: day(i), planned: 3 })) };
  assert.ok(AL.afterLapseNudge({ ...base, saidOn: [] }), 'сигнал должен быть');
  assert.equal(AL.afterLapseNudge({ ...base, saidOn: [day(10)] }), null);
  // А в следующие дни он обязан работать: это и есть «сказать один раз».
  assert.equal(AL.afterLapseNudge({ ...base, today: day(11), saidOn: [day(10)] }), null);
  assert.ok(AL.afterLapseNudge({ ...base, today: day(13), saidOn: [day(10)] }), 'после COOLDOWN_DAYS молчание снимается');
});

test('§12: «сказали» записывается только победителю pickNudge', () => {
  // Запись при сборке html молчала бы завтра из-за фразы, которую не видели.
  assert.match(app, /if \(nudgeWin && nudgeWin\.id === 'afterLapse'\) afterLapseNoteSpoken\(today\);/);
  assert.match(app, /\{ id: 'afterLapse', tier: 2, html: lapseNudge \}/);
});

test('норма считается по прошлому, а не по сегодняшнему раздутому плану', () => {
  assert.match(app, /const past = hist\.filter\(\(d\) => d\.date < today\);/);
});

test('новая copy покрыта всеми пятью языками', () => {
  const keys = [
    'дней в счёте', 'обычных', 'хороших', 'таких, как сегодня', 'прошлый такой',
    'заведено', 'обычно',
    'Вчера день не сложился. Сегодня стоит обычный день, а не героический — отыгрываться не нужно.',
    'Если хочется опоры — выбери 1–3 дела в ядро дня. Остальное останется в списке и никуда не денется.',
  ];
  for (const key of keys) {
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(app, new RegExp(`'${esc}'\\s*:\\s*\\{ en:[\\s\\S]{0,900}de:[\\s\\S]{0,900}uk:[\\s\\S]{0,900}es:`), `нет полного словаря для «${key}»`);
  }
});

test('подпись остаётся отдельным текст-узлом — двоеточие рисует CSS', () => {
  // Со вшитым в разметку двоеточием строка перестала бы совпадать со словарём.
  assert.match(css, /\.kv-k::after \{ content: ':'; \}/);
  assert.match(app, /<span class="kv-k">\$\{t\(k\)\}<\/span><b class="kv-v">\$\{v\}<\/b>/);
});

test('числа не окрашены: цвет здесь стал бы оценкой', () => {
  // Собираем ИМЕННО свои правила по селекторам, а не срезом до далёкого маркера:
  // срез ловил любую вставку соседа и падал на исправном чужом коде.
  // ⚠️ Префикс `.fc-` брать НЕЛЬЗЯ: он занят ригом Кота Удачи (`.fc-rig`,
  // `.fc-bell`, `fcV2TiredBody`), и широкий шаблон затягивал чужие правила.
  // Из-за этого столкновения ключ-значение переименованы в `.kv-*`.
  const block = (css.match(/^\.(fail-context|kv-[a-z]+|lapse-[a-z]+)\b[^\n]*\{[^}]*\}/gm) || []).join('\n');
  assert.ok(block.includes('.fail-context') && block.includes('.lapse-'), 'правила §4/§12 не найдены');
  assert.ok(block.includes('var(--muted)') && block.includes('var(--text-strong)'));
  for (const bad of ['--danger', '--bad', 'red', '#f0', '#e0']) {
    assert.ok(!block.includes(bad), `акцентный цвет в приборной строке: «${bad}»`);
  }
  // Только существующие роли и шкала — новых токенов не заводим.
  for (const tok of block.match(/var\(--[a-z0-9-]+\)/g) || []) {
    assert.match(tok, /var\(--(sp|type|font|text|muted|measure)/, `новый токен ${tok}`);
  }
});
