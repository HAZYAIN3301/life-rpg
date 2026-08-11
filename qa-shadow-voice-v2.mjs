import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./public/shadow-voice-v2.js', import.meta.url), 'utf8');
const events = [];
const notices = [];

class FakeCustomEvent {
  constructor(type, options) {
    this.type = type;
    this.detail = options && options.detail;
  }
}

class FakeUtterance {
  constructor(text) {
    this.text = text;
  }
}

class FakeAudio {
  play() {
    queueMicrotask(() => {
      if (this.onplay) this.onplay();
      queueMicrotask(() => { if (this.onended) this.onended(); });
    });
    return Promise.resolve();
  }
  pause() {}
  removeAttribute() {}
  load() {}
}

const classNames = new Set();
const button = {
  classList: { toggle: (name, on) => on ? classNames.add(name) : classNames.delete(name) },
  setAttribute() {},
  innerHTML: '',
};
const speechSynthesis = {
  cancel() {},
  getVoices() { return [{ name: 'QA Natural', lang: 'ru-RU', localService: true }]; },
  speak(utterance) {
    queueMicrotask(() => {
      if (utterance.onstart) utterance.onstart();
      if (utterance.onboundary) utterance.onboundary();
      if (utterance.onend) utterance.onend();
    });
  },
};
let fetchImpl = async () => new Response(new Blob(['fake-mp3'], { type: 'audio/mpeg' }), {
  status: 200,
  headers: {
    'Content-Type': 'audio/mpeg',
    'X-Shadow-Voice-Cache': 'MISS',
    'X-Request-Id': 'qa-request',
    'X-Shadow-Voice-Mode': 'server-neural',
    'X-Shadow-Voice-Provider': 'piper',
  },
});

const windowObject = {
  lang: () => 'ru',
  toast: (message) => notices.push(message),
  ttsSpeak() {},
  ttsStop() {},
  ttsPrefs: () => ({ rate: 0.92, pitch: 0.96 }),
  satoruIconHTML: (name) => `<i>${name}</i>`,
  ShadowRig: {
    setGlobalState() {},
    clearGlobalState() {},
    speechPulse() {},
  },
  speechSynthesis,
  SpeechSynthesisUtterance: FakeUtterance,
  dispatchEvent: (event) => events.push(event),
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
};
const sandbox = {
  window: windowObject,
  document: { documentElement: { lang: 'ru' } },
  navigator: { language: 'ru-RU' },
  CustomEvent: FakeCustomEvent,
  SpeechSynthesisUtterance: FakeUtterance,
  Audio: FakeAudio,
  Blob,
  Response,
  URL,
  DOMException,
  AbortController,
  queueMicrotask,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  fetch: (...args) => fetchImpl(...args),
  console,
};

vm.runInNewContext(source, sandbox, { filename: 'shadow-voice-v2.js' });
const voice = windowObject.ShadowVoiceV2;

assert.equal(voice.version, '2.0.0');
assert.equal(voice.isBridgeInstalled(), true);
assert.equal(windowObject.ttsSpeak.name, 'legacyBridgeSpeak');

const cloud = await voice.speak('Я рядом.', { language: 'ru', context: 'calm', button });
assert.equal(cloud.mode, 'server-neural');
assert.equal(cloud.cache, 'MISS');
assert.equal(cloud.requestId, 'qa-request');
assert.equal(classNames.has('on'), false);
assert.ok(notices.some((message) => message.includes('сгенерирован ИИ')));
assert.ok(events.some((event) => event.type === 'shadowvoice:status' && event.detail.state === 'playing' && event.detail.mode === 'server-neural'));

fetchImpl = async () => new Response(JSON.stringify({
  error: 'no_openai_key',
  fallback: 'browser-system-voice',
}), {
  status: 503,
  headers: { 'Content-Type': 'application/json' },
});

const unavailable = await voice.speak('Облако недоступно.', { language: 'ru', context: 'calm', button });
assert.equal(unavailable.mode, 'unavailable');
assert.equal(unavailable.reason, 'no_openai_key');
assert.ok(notices.some((message) => message.includes('Не удалось воспроизвести голос Тени')));
assert.ok(!events.some((event) => event.type === 'shadowvoice:status' && event.detail.state === 'fallback'));

const fallback = await voice.speak('Явный системный резерв.', { language: 'ru', context: 'calm', button, browserFallback: true });
assert.equal(fallback.mode, 'browser-system-voice');
assert.equal(fallback.reason, 'no_openai_key');
assert.ok(notices.some((message) => message.includes('явно выбранный голос устройства')));

console.log('shadow-voice-v2 client QA: ok');
