'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../public/assistant-wake-v1.js');

test('распознаёт русский и латинский вызов в начале фразы', () => {
  assert.deepEqual(W.parseTranscript('Сатору, убери лишние цели'), {
    triggered: true, transcript: 'Сатору, убери лишние цели', command: 'убери лишние цели',
  });
  assert.equal(W.parseTranscript('Hey Satoru: plan my day').command, 'plan my day');
  assert.equal(W.parseTranscript('Okay, Satoru').triggered, true);
});

test('одно имя открывает помощника с пустым безопасным черновиком', () => {
  const out = W.parseTranscript('Сатору');
  assert.equal(out.triggered, true);
  assert.equal(out.command, '');
});

test('имя в середине чужой речи не является вызовом', () => {
  assert.equal(W.parseTranscript('В подкасте сказали про Satoru и привычки').triggered, false);
  assert.equal(W.parseTranscript('Расскажи, что умеет Сатору').triggered, false);
});

test('похожие слова и пустой ввод не срабатывают', () => {
  for (const value of ['', 'сатурн', 'сатори', 'saturday', 'эй, помощник']) {
    assert.equal(W.parseTranscript(value).triggered, false, value);
  }
});

test('модуль не отправляет сообщения и не исполняет действия', () => {
  const surface = Object.keys(W).join(' ').toLowerCase();
  for (const forbidden of ['send', 'execute', 'apply', 'fetch', 'delete']) assert.equal(surface.includes(forbidden), false);
  assert.equal(W.supported({ SpeechRecognition() {} }), true);
  assert.equal(W.supported({}), false);
});
