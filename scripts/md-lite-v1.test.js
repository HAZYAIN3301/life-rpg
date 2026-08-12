'use strict';
/* Читаемый ответ Тени в чате (fb_ms4lg28wwpe4). Половина файла — про то, что
 * ответ модели это НЕДОВЕРЕННЫЙ ввод. */
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/md-lite-v1.js');

test('реальный ответ из репорта становится читаемым', () => {
  const real = [
    'Вот как работают эти две механики в Satoru:',
    '⚡ **Энергия** — это шкала твоей дневной нагрузки.',
    '* **Как тратится:** Каждое дело забирает часть энергии.',
    '* **Как восстанавливается:** Пассивно, со временем.',
    '* **На что влияет:** Энергия **ничего не блокирует**.',
  ].join('\n');
  const html = M.render(real);
  assert.ok(!html.includes('**'), 'звёздочки остались видны — ровно то, на что была жалоба');
  assert.ok(html.includes('<b>Энергия</b>'));
  assert.ok(html.includes('<ul>') && html.includes('</ul>'));
  assert.equal((html.match(/<li>/g) || []).length, 3);
});

test('🔴 HTML из ответа модели экранируется, а не исполняется', () => {
  // Текст приходит по сети и может содержать пользовательские данные.
  const html = M.render('<img src=x onerror=alert(1)> и <script>alert(2)</script>');
  assert.ok(!html.includes('<img'), 'тег прошёл в разметку');
  assert.ok(!html.includes('<script'), 'скрипт прошёл в разметку');
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('&lt;script'));
});

test('🔴 разметку нельзя внести через markdown', () => {
  const html = M.render('**<b onmouseover=alert(1)>жирный</b>**');
  // Слово «onmouseover» ОСТАЁТСЯ — как экранированный текст, и это правильно:
  // человек должен видеть, что ему прислали. Проверять надо не подстроку, а то,
  // что в выводе нет ни одного тега с атрибутом: наши теги все голые.
  assert.ok(html.includes('&lt;b'), 'чужой тег должен остаться видимым текстом');
  assert.equal(html.match(/<[a-z]+\s[^>]*>/i), null, 'в выводе появился тег с атрибутом');
  const tags = [...html.matchAll(/<\/?([a-z]+)>/gi)].map((m) => m[1].toLowerCase());
  const allowed = new Set(['b', 'i', 'code', 'p', 'br', 'ul', 'ol', 'li']);
  for (const tag of tags) assert.ok(allowed.has(tag), `неразрешённый тег: ${tag}`);
});

test('🔴 ссылок и картинок нет — переход наружу по тексту модели недопустим', () => {
  const html = M.render('[клик](https://example.test) и ![кар](https://example.test/i.png)');
  assert.ok(!html.includes('<a '), 'появилась ссылка');
  assert.ok(!html.includes('<img'), 'появилась картинка');
  assert.ok(html.includes('example.test'), 'адрес остаётся видимым текстом, а не исчезает');
});

test('код не превращается в разметку', () => {
  const html = M.render('используй `**не жирный**` в коде');
  assert.ok(html.includes('<code>**не жирный**</code>'));
  assert.ok(!html.includes('<b>'));
});

test('нумерованный список отличается от маркированного', () => {
  const ol = M.render('1. первый\n2. второй');
  assert.ok(ol.includes('<ol>') && (ol.match(/<li>/g) || []).length === 2);
  const ul = M.render('- первый\n- второй');
  assert.ok(ul.includes('<ul>'));
});

test('заголовок становится жирной строкой, а не <h2> в пузыре', () => {
  const html = M.render('## Энергия\nтекст');
  assert.ok(html.includes('<b>Энергия</b>'));
  assert.ok(!html.includes('<h2'));
});

test('курсив не срабатывает на середине слова и на умножении', () => {
  assert.ok(!M.render('2*3*4 = 24').includes('<i>'), 'арифметика превратилась в курсив');
  assert.ok(M.render('это *важно* здесь').includes('<i>важно</i>'));
});

test('абзацы и переносы сохраняются', () => {
  const html = M.render('первая строка\nвторая строка\n\nновый абзац');
  assert.equal((html.match(/<p>/g) || []).length, 2);
  assert.ok(html.includes('<br>'));
});

test('пустое и мусорное на входе', () => {
  assert.equal(M.render(''), '');
  assert.equal(M.render('   \n\n  '), '');
  assert.equal(M.render(null), '');
  assert.equal(M.render(undefined), '');
});

test('очень длинный ответ обрезается по потолку', () => {
  const huge = 'а'.repeat(M.MAX_INPUT + 5000);
  assert.ok(M.render(huge).length < (M.MAX_INPUT + 5000));
});

test('незакрытая разметка не ломает вывод', () => {
  for (const s of ['**без пары', '`код без пары', '* один\n**', '###']) {
    const html = M.render(s);
    assert.equal(typeof html, 'string');
    assert.ok(!html.includes('<script'));
  }
});
