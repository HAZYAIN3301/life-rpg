'use strict';
/* 🔴 Тело запроса собирается КАК БАЙТЫ и декодируется один раз.
 *
 * Было `data += chunk`, где chunk — Buffer: каждый кусок превращался в строку отдельно,
 * и многобайтовый символ, попавший на границу кусков, разрывался — оба огрызка
 * становились U+FFFD. Тело больше ~16 КБ рвётся на куски всегда, поэтому каждая большая
 * запись молча портила по символу на каждой границе, и порча уходила на диск: у клиента
 * «счета», в файле «��чета». Отсюда же брался неснимаемый конфликт версий —
 * клиент и сервер сравнивали разные строки и не могли сойтись никогда.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const SERVER = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

function readBodyFromSource() {
  const at = SERVER.indexOf('function readBody(req, maxBytes)');
  assert.notEqual(at, -1, 'readBody должен существовать');
  const src = SERVER.slice(at, SERVER.indexOf('\nasync function boardV2RequestJson', at));
  // eslint-disable-next-line no-new-func
  return new Function('Buffer', `${src}; return readBody;`)(Buffer);
}

test('многобайтовый символ на границе кусков не разрывается', async () => {
  const readBody = readBodyFromSource();
  const text = JSON.stringify({ title: 'счета за месяц', tail: 'я'.repeat(50) });
  const full = Buffer.from(text, 'utf8');
  // Режем ровно посередине двухбайтовой «с» — так делает сеть при большом теле.
  const cut = full.indexOf(Buffer.from('счета', 'utf8')) + 1;
  assert.ok(cut > 1, 'подготовка теста: нужна многобайтовая буква внутри тела');
  const chunks = [full.subarray(0, cut), full.subarray(cut)];

  const req = { on(event, handler) { this['_' + event] = handler; return this; } };
  const promise = readBody(req, 1024 * 1024);
  for (const chunk of chunks) req._data(chunk);
  req._end();
  const got = await promise;

  assert.equal(got, text, 'тело должно доехать байт в байт');
  assert.ok(!got.includes('�'), 'ни одного символа-замены: иначе порча уходит на диск');
  assert.deepEqual(JSON.parse(got).title, 'счета за месяц');
});

test('ответы внешних сервисов тоже собираются как байты', () => {
  // Тот же дефект жил в чтении ответов ИИ и озвучки: русский ответ длиннее одного куска
  // приезжал с «�» в середине.
  const bad = SERVER.match(/resp\.on\('data', \(c\) => d \+= c\)/g) || [];
  assert.equal(bad.length, 0, 'ответ внешнего сервиса нельзя накапливать строкой');
  assert.ok(SERVER.includes("resp.on('data', (c) => ch.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))"),
    'куски ответа собираются буферами');
});
