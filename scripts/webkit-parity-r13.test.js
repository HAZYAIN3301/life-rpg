'use strict';
// R13: то, что видно только в Safari/WebKit — фокус после щелчка и карточка «Приложение» в Настройках.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const fnSource = (name) => { const at = APP.search(new RegExp(`(?:async )?function ${name}\\(`)); assert.ok(at >= 0, name); return APP.slice(at, APP.indexOf('\n}', at) + 2); };

test('a real click focuses the pressed control, as Chromium does, so dialogs know their opener', () => {
  class Element {}
  const document = { activeElement: null };
  const focusActivatedControl = new Function('Element', 'document', `${fnSource('focusActivatedControl')}\nreturn focusActivatedControl;`)(Element, document);
  const control = (extra = {}) => Object.assign(new Element(), { disabled: false, calls: [], focus(opts) { this.calls.push(opts); document.activeElement = this; } }, extra);
  const target = (ctl) => Object.assign(new Element(), { closest: (sel) => { assert.equal(sel, 'button, a[href], summary'); return ctl; } });

  const button = control(); document.activeElement = { tagName: 'BODY' };
  focusActivatedControl({ isTrusted: true, target: target(button) });
  assert.deepEqual(button.calls, [{ preventScroll: true }]);
  assert.equal(document.activeElement, button);

  // Programmatic a.click() of a temporary download link must not steal focus.
  const link = control(); document.activeElement = button;
  focusActivatedControl({ isTrusted: false, target: target(link) });
  assert.deepEqual(link.calls, []);
  assert.equal(document.activeElement, button);

  const disabled = control({ disabled: true });
  focusActivatedControl({ isTrusted: true, target: target(disabled) });
  assert.deepEqual(disabled.calls, []);

  focusActivatedControl({ isTrusted: true, target: target(button) });
  assert.equal(button.calls.length, 1, 'already focused control is left alone');

  focusActivatedControl({ isTrusted: true, target: target(null) });
  focusActivatedControl({ isTrusted: true, target: { closest: () => { throw new Error('text node'); } } });

  const init = fnSource('init');
  const capture = init.indexOf("document.addEventListener('click', focusActivatedControl, true);");
  assert.ok(capture >= 0, 'registered in the capture phase');
  assert.ok(capture < init.indexOf("document.addEventListener('click', onClick);"), 'runs before the action handlers read document.activeElement');
});

test('Settings app card: registry icons, 12px note and an honest iPhone hint', () => {
  const card = fnSource('pwaCard');
  for (const raw of ["${t('🔔 Включить уведомления')}", "${t('🔕 Выключить уведомления')}", "${t('📲 Установить приложение')}", '🌅', '🌙', 'font-size:11.5px']) {
    assert.ok(!card.includes(raw), raw);
  }
  assert.match(card, /satoruIconHTML\('status\.bell', 'button-glyph', ''\)\} \$\{esc\(emojiFree\(t\('🔔 Включить уведомления'\)\)\)\}/);
  assert.match(card, /satoruIconHTML\('status\.bell-muted', 'button-glyph', ''\)/);
  assert.match(card, /isIOS\(\) && !installed \? 'На iPhone и iPad уведомления работают в установленном приложении/);
  assert.match(card, /const apk = State\.apkAvailable && !isIOS\(\) \?/, 'no Android download offered on iPhone/iPad');
  const isIOS = (ua, touch) => new Function('navigator', 'window', `${fnSource('isIOS')}\nreturn isIOS();`)({ userAgent: ua, maxTouchPoints: touch }, {});
  assert.equal(isIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5), true);
  assert.equal(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 5), true, 'iPadOS desktop-class UA');
  assert.equal(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 0), false, 'Mac');
  assert.equal(isIOS('Mozilla/5.0 (Linux; Android 14)', 5), false);

  const lines = APP.split('\n');
  const start = lines.findIndex((l) => l.startsWith('const I18N_EN = {'));
  const end = lines.findIndex((l) => l.startsWith('for (const ru in I18N_EXTRA)'));
  const ctx = vm.createContext({});
  vm.runInContext(`${lines.slice(start, end + 1).join('\n')}\nthis.I18N = I18N;`, ctx);
  for (const key of ['✓ компаньон зовёт утром и вечером', 'На iPhone и iPad уведомления работают в установленном приложении: Поделиться → «На экран Домой».']) {
    for (const l of ['en', 'de', 'uk', 'es']) {
      assert.ok(ctx.I18N[l][key], `${key} → ${l}`);
      assert.doesNotMatch(ctx.I18N[l][key], /\p{Extended_Pictographic}/u, `${key} → ${l} emoji`);
    }
  }
});
