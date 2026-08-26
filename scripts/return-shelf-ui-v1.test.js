'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const UI = require('../public/return-shelf-ui-v1.js');
const t = (value) => value;
const item = (id, over = {}) => Object.assign({ id, kind: 'energy', title: `Материал ${id}`, why: 'вернуться к делу' }, over);

test('готовый экран выдаёт конечную пачку и один завершитель на материал', () => {
  const html = UI.render({
    state: 'ready', filter: 'all', liveCount: 12, freeCount: 28,
    items: [item('a'), item('b'), item('c')], archived: [], rate: { moved: 2, seen: 3 },
  }, t);
  assert.equal((html.match(/class="card return-shelf-item/g) || []).length, 3);
  assert.equal((html.match(/class="return-shelf-complete-form/g) || []).length, 3);
  assert.match(html, /Пачка конечна[^<]*<\/p>/);
  assert.doesNotMatch(html, /data-action="shelf-load-more"|<video|<audio|likes-count|views-count/i);
});

test('практический материал показывает ожидаемый вывод, точку остановки и время', () => {
  const html = UI.render({ state: 'ready', filter: 'practical', liveCount: 1, freeCount: 39, archived: [], rate: {}, items: [item('p', {
    kind: 'practical', expect: 'собрать один переход', stopAt: 'глава 3', minutes: 20,
  })] }, t);
  assert.match(html, /собрать один переход/);
  assert.match(html, /глава 3/);
  assert.match(html, />20 мин</);
  assert.match(html, /data-filter="practical" aria-pressed="true"/);
});

test('композер имеет постоянные подписи, paste fallback и обязательные смысловые поля', () => {
  const html = UI.render({ state: 'ready', composerOpen: true, filter: 'all', items: [], archived: [], rate: {}, tasks: [], goals: [] }, t);
  assert.match(html, /id="return-shelf-add-form"/);
  assert.match(html, /name="url" type="url"/);
  assert.match(html, /name="why"[^>]*required/);
  assert.match(html, /name="expect"/);
  assert.match(html, /data-shelf-practical hidden/);
  assert.doesNotMatch(html, /type="file"|<video|<audio|playsinline/);
});

test('пустая Полка остаётся компактной, пока человек сам не открыл добавление', () => {
  const html = UI.render({ state: 'ready', composerOpen: false, filter: 'all', items: [], archived: [], rate: {} }, t);
  assert.match(html, /data-action="shelf-toggle-composer"/);
  assert.match(html, /Полка пока пуста/);
  assert.doesNotMatch(html, /id="return-shelf-add-form"/);
});

test('ошибка загрузки не выглядит пустой Полкой и содержит Retry', () => {
  const html = UI.render({ state: 'error', error: 'invalid' }, t);
  assert.match(html, /role="alert"/);
  assert.match(html, /Данные Полки повреждены/);
  assert.match(html, /data-action="shelf-retry"/);
  assert.doesNotMatch(html, /Полка пока пуста/);
});

test('пользовательский текст и URL экранируются', () => {
  const html = UI.render({ state: 'ready', filter: 'all', items: [item('x', {
    title: '<img src=x onerror=alert(1)>', why: '"не код"', url: 'https://example.test/?q=<x>',
  })], archived: [], rate: {} }, t);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
  assert.match(html, /&quot;не код&quot;/);
  assert.doesNotMatch(html, /href=/, 'источник не должен обходить Attention-гейт обычной ссылкой');
});

test('интеграция держит Полку в More и подключает domain до UI и app', () => {
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  assert.match(app, /shelf:\s*renderShelf/);
  assert.match(app, /MOBILE_MORE_SECTION_IDS[^\n]*'library'/);
  assert.match(app, /group\('mobile-more-support'[\s\S]{0,500}sectionEntry\('library'\)/);
  const domainAt = index.indexOf('return-shelf-v1.js');
  const uiAt = index.indexOf('return-shelf-ui-v1.js');
  const appAt = index.indexOf('app.js?v=20260826-appearance-feedback-v183');
  assert.ok(domainAt >= 0 && uiAt > domainAt && appAt > uiAt);
  assert.match(sw, /satoru-v183/);
  assert.match(sw, /return-shelf-v1\.js/);
  assert.match(sw, /return-shelf-ui-v1\.js/);
});

test('app glue fence-ит malformed load и не начисляет награды', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(src, /function validateShelfEnvelope/);
  assert.match(src, /response\.status === 422/);
  assert.match(src, /if \(State\._shelfLoadError \|\| !validateShelfEnvelope\(value\)\) return false/);
  const shelfBlock = src.slice(src.indexOf('//  Return Shelf R2'), src.indexOf('function renderSettings()', src.indexOf('//  Return Shelf R2')));
  assert.doesNotMatch(shelfBlock, /gold|xpAwarded|awardXp|checkAchievements|publishLeaderboard/i);
  assert.match(shelfBlock, /State\._goalsComposerOpen = true; State\._goalsFocusAfterCommit = '#add-goal input\[name="title"\]'/);
});

test('все новые смысловые строки Полки имеют EN/DE/UK/ES варианты', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');
  const keys = [
    'Полка возвращения', 'Возвращение', 'Данные Полки повреждены', 'Не удалось загрузить Полку',
    'Сохрани результат, а не новую бесконечность', 'Что я отсюда беру', 'Практический · с конкретным выводом',
    'Ожидаемый практический вывод', 'Открыть через границу', 'Отложить без наказания', 'Пока не измерено',
    'Всё', 'Практика', 'Время', 'Просмотр не даёт XP или золото. Отложить можно без наказания.',
  ];
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll("'", "\\'");
    assert.match(src, new RegExp(`'${escaped}': \\{ en: [^\\n]+ de: [^\\n]+ uk: [^\\n]+ es: [^\\n]+ \\}`), key);
  }
});

test('визуальный контракт Полки сохраняет touch floor, mobile work contour и reduced motion', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public/styles.css'), 'utf8');
  const shelfAt = css.indexOf('Return Shelf R2');
  const shelfCss = css.slice(shelfAt, shelfAt + 18000);
  assert.doesNotMatch(shelfCss, /body:has\(\.return-shelf-shell\) #ai-fab[^}]*display:\s*none/);
  assert.match(shelfCss, /min-height:\s*var\(--touch-min\)/);
  assert.match(shelfCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.return-shelf-shell \*[\s\S]*?animation:\s*none !important/);
  assert.match(shelfCss, /@media \(min-width: 901px\)[\s\S]*?\.return-shelf-complete-form\s*\{[^}]*grid-template-columns:/);
});
