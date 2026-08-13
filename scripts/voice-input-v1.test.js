'use strict';
/* Голосовой ввод везде (fb_msp3icn49ttl, решение Альберта 13.08).
 *
 * Больше половины файла — про то, куда голос НЕ идёт. Продиктованный вслух
 * пароль уходит в облачный распознаватель и звучит в комнате: это вред, а не
 * неудобство, поэтому исключения проверяются жёстче самой функции. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const V = require('../public/voice-input-v1.js');
const src = fs.readFileSync(path.join(path.resolve(__dirname, '..'), 'public/voice-input-v1.js'), 'utf8');

// Поле-заглушка той же формы, что настоящий элемент.
const field = (over) => Object.assign({ tagName: 'INPUT', type: 'text', name: '', id: '', placeholder: '', autocomplete: '', class: '', getAttribute() { return null; } }, over);

test('обычные поля ввода получают голос', () => {
  assert.equal(V.isEligible(field({ tagName: 'TEXTAREA', id: 'reflection' })), true, 'рефлексия — главный кейс репорта');
  assert.equal(V.isEligible(field({ id: 'first-line' })), true);
  assert.equal(V.isEligible(field({ id: 'stuck-step' })), true);
  assert.equal(V.isEligible(field({ tagName: 'TEXTAREA', id: 'chat-input' })), true);
  assert.equal(V.isEligible(field({ type: undefined, id: 'task-title' })), true, 'input без type — это text');
  assert.equal(V.isEligible({ tagName: 'DIV', isContentEditable: true }), true);
});

test('🔴 пароль, PIN, код восстановления и ИИ-ключ — никогда', () => {
  const forbidden = [
    { type: 'password' },
    { id: 'pin' }, { name: 'newPin' }, { id: 'pin-code' },
    { name: 'recovery' }, { id: 'recovery-code' },
    { id: 'api-key' }, { name: 'apiKey' }, { placeholder: 'вставь ключ' },
    { name: 'token' }, { id: 'secret' },
    { autocomplete: 'current-password' }, { autocomplete: 'new-password' }, { autocomplete: 'one-time-code' },
    { tagName: 'TEXTAREA', id: 'api-key' },
  ];
  for (const over of forbidden) {
    assert.equal(V.isEligible(field(over)), false, `голос допущен к секрету: ${JSON.stringify(over)}`);
  }
});

test('🔴 секрет узнаётся по любому из признаков, а не только по типу', () => {
  // Поле пароля, у которого type забыли, всё равно должно отпасть.
  assert.equal(V.looksSecret(field({ type: 'text', name: 'password' })), true);
  assert.equal(V.looksSecret(field({ type: 'text', 'aria-label': 'PIN', getAttribute(n) { return n === 'aria-label' ? 'PIN' : null; } })), true);
  assert.equal(V.looksSecret(field({ class: 'field pin-input' })), true);
});

test('обычные слова с похожими буквами секретом не считаются', () => {
  // Иначе «ключевое слово» или «декодировать» потеряли бы голос ни за что.
  for (const over of [{ id: 'keyword' }, { name: 'decode-hint' }, { placeholder: 'Ключевые мысли дня' }, { id: 'passenger' }]) {
    assert.equal(V.looksSecret(field(over)), false, `ложная тревога: ${JSON.stringify(over)}`);
  }
});

test('поля, где голос бессмысленен, пропускаются', () => {
  for (const type of V.NON_TEXT_TYPES) {
    assert.equal(V.isEligible(field({ type })), false, `type=${type}`);
  }
  assert.equal(V.isEligible(field({ type: 'email' })), false, 'адрес голосом — источник ошибок');
  assert.equal(V.isEligible(field({ type: 'tel' })), false);
});

test('выключенные, только для чтения и явно отказавшиеся', () => {
  assert.equal(V.isEligible(field({ disabled: true })), false);
  assert.equal(V.isEligible(field({ readOnly: true })), false);
  assert.equal(V.isEligible(field({ getAttribute: (n) => (n === 'data-no-voice' ? '1' : null) })), false);
  assert.equal(V.isEligible(field({ closest: (s) => (s === '[data-no-voice]' ? {} : null) })), false, 'отказ можно поставить на контейнер');
});

test('при любом сомнении — нет', () => {
  assert.equal(V.isEligible(null), false);
  assert.equal(V.isEligible(undefined), false);
  assert.equal(V.isEligible('текст'), false);
  assert.equal(V.isEligible({}), false);
  assert.equal(V.isEligible({ tagName: 'BUTTON' }), false);
  assert.equal(V.isEligible({ tagName: 'DIV' }), false, 'просто div без contenteditable');
});

test('🔴 распознанное ДОПИСЫВАЕТСЯ, а не затирает написанное', () => {
  // В рефлексии человек часто уже что-то напечатал; стереть это было бы худшим
  // из возможных поведений.
  const r = V.insertText('Уже написал', 11, 11, 'и добавил голосом');
  assert.equal(r.value, 'Уже написал и добавил голосом');
  assert.equal(r.caret, r.value.length);
});

test('вставка идёт в позицию курсора и заменяет выделение', () => {
  const mid = V.insertText('начало конец', 7, 7, 'середина');
  assert.equal(mid.value, 'начало середина конец');
  const sel = V.insertText('заменить это', 9, 12, 'то');
  assert.equal(sel.value, 'заменить то');
});

test('пробел ставится сам, но не в начале поля', () => {
  assert.equal(V.insertText('', 0, 0, 'первое слово').value, 'первое слово');
  assert.equal(V.insertText('есть ', 5, 5, 'ещё').value, 'есть ещё', 'второй пробел не нужен');
  assert.equal(V.insertText('есть', 4, 4, 'ещё').value, 'есть ещё');
});

test('пустая расшифровка ничего не портит', () => {
  assert.equal(V.insertText('текст', 5, 5, '').value, 'текст');
  assert.equal(V.insertText('текст', 5, 5, '   ').value, 'текст');
  assert.equal(V.insertText('текст', 5, 5, null).value, 'текст');
  assert.equal(V.insertText(null, 0, 0, 'а').value, 'а');
});

test('кривые координаты курсора не роняют вставку', () => {
  assert.equal(V.insertText('abc', -5, 99, 'x').value.includes('x'), true);
  assert.equal(V.insertText('abc', undefined, undefined, 'x').value, 'abc x');
  assert.equal(V.insertText('abc', 2, 1, 'x').value, 'ab x c', 'конец раньше начала — не теряем текст');
});

test('язык распознавания идёт за интерфейсом', () => {
  assert.equal(V.langTag('ru'), 'ru-RU');
  assert.equal(V.langTag('de'), 'de-DE');
  assert.equal(V.langTag('uk'), 'uk-UA');
  assert.equal(V.langTag('es'), 'es-ES');
  assert.equal(V.langTag('en'), 'en-US');
  assert.equal(V.langTag('zz'), 'ru-RU', 'неизвестный — язык владельца');
  assert.equal(V.langTag(null), 'ru-RU');
});

test('без поддержки в браузере кнопки не будет вовсе', () => {
  // Мёртвая кнопка хуже отсутствующей: она обещает то, чего нет.
  assert.equal(V.supported({}), false);
  assert.equal(V.supported(null), false);
  assert.equal(V.supported({ SpeechRecognition: function () {} }), true);
  assert.equal(V.supported({ webkitSpeechRecognition: function () {} }), true);
  assert.equal(V.attach({}), null, 'attach на окружении без поддержки ничего не创ает');
});

test('🔴 приложение узнаёт о голосовом вводе так же, как о наборе', () => {
  // Программная установка value не порождает input, а на нём висит автосохранение.
  assert.match(src, /dispatchEvent\(new w\.Event\('input', \{ bubbles: true \}\)\)/);
});

test('фокус не уходит из поля при нажатии на кнопку', () => {
  assert.match(src, /btn\.addEventListener\('mousedown', \(e\) => e\.preventDefault\(\)\)/);
});

test('модуль не читает State и не зовёт переводчик', () => {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  for (const bad of ['State.', 'Store.', 'i18n']) {
    assert.ok(!code.includes(bad), `модуль полез в приложение: «${bad}»`);
  }
  assert.equal(/\bt\(/.test(code), false);
  // Тексты приходят снаружи — значит их переведёт вызывающий код.
  assert.equal(typeof V.setLabels, 'function');
});

test('тач-цель кнопки не меньше 42px', () => {
  assert.match(src, /width:42px;height:42px/);
});
