(function initShadowVoiceV2(global) {
  'use strict';

  if (global.ShadowVoiceV2 && global.ShadowVoiceV2.version === '2.0.0') return;

  const LANGUAGE_TAGS = {
    ru: 'ru-RU',
    uk: 'uk-UA',
    en: 'en-US',
    de: 'de-DE',
    es: 'es-ES',
  };
  const CONTEXTS = new Set(['calm', 'morning', 'evening', 'focus', 'coach', 'celebrate', 'warning']);
  const COPY = {
    ru: {
      disclosure: 'Голос Тени сгенерирован ИИ.',
      fallback: 'Облачный голос недоступен — используется явно выбранный голос устройства.',
      failed: 'Не удалось воспроизвести голос Тени.',
    },
    uk: {
      disclosure: 'Голос Тіні згенеровано ШІ.',
      fallback: 'Хмарний голос недоступний — використовується явно обраний голос пристрою.',
      failed: 'Не вдалося відтворити голос Тіні.',
    },
    en: {
      disclosure: 'The Shadow voice is AI-generated.',
      fallback: 'Cloud voice is unavailable — using the explicitly selected device voice.',
      failed: 'The Shadow voice could not be played.',
    },
    de: {
      disclosure: 'Die Stimme des Schattens wurde von KI erzeugt.',
      fallback: 'Die Cloud-Stimme ist nicht verfügbar – die ausdrücklich gewählte Systemstimme wird verwendet.',
      failed: 'Die Stimme des Schattens konnte nicht wiedergegeben werden.',
    },
    es: {
      disclosure: 'La voz de la Sombra está generada por IA.',
      fallback: 'La voz en la nube no está disponible; se usa la voz del dispositivo elegida explícitamente.',
      failed: 'No se pudo reproducir la voz de la Sombra.',
    },
  };
  const config = {
    endpoint: '/api/shadow/voice',
    statusEndpoint: '/api/shadow/voice/status',
    browserFallback: false,
    requestTimeoutMs: 50000,
    memoryCacheEntries: 8,
  };

  let runId = 0;
  let activeButton = null;
  let abortController = null;
  let media = null;
  let mediaUrl = '';
  let pulseTimer = null;
  let pendingPlayback = null;
  let legacyStop = null;
  let bridgeInstalled = false;
  let disclosureShown = false;
  const fallbackNotices = new Set();
  const memoryCache = new Map();
  let state = {
    state: 'idle',
    mode: null,
    language: null,
    reason: null,
    cache: null,
    requestId: null,
    at: Date.now(),
  };

  class ShadowVoiceError extends Error {
    constructor(code, message, status, detail) {
      super(message || code || 'shadow_voice_error');
      this.name = 'ShadowVoiceError';
      this.code = code || 'shadow_voice_error';
      this.status = status || 0;
      this.detail = detail || null;
    }
  }

  function languageCode(value) {
    const code = String(value || '').trim().toLowerCase().replace('_', '-').slice(0, 2);
    return LANGUAGE_TAGS[code] ? code : 'ru';
  }

  function currentLanguage() {
    try {
      if (typeof global.lang === 'function') return languageCode(global.lang());
    } catch {}
    return languageCode(document.documentElement.lang || navigator.language || 'ru');
  }

  function normalizeText(value) {
    return String(value || '')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 2400);
  }

  function normalizeContext(value) {
    return CONTEXTS.has(value) ? value : 'calm';
  }

  function emit(nextState, detail) {
    state = Object.assign({}, state, detail || {}, { state: nextState, at: Date.now() });
    try {
      global.dispatchEvent(new CustomEvent('shadowvoice:status', { detail: Object.assign({}, state) }));
    } catch {}
    return state;
  }

  function notify(message) {
    try {
      if (typeof global.toast === 'function') global.toast(message);
    } catch {}
  }

  function shadowRigState(value) {
    try {
      if (!global.ShadowRig) return;
      if (value) global.ShadowRig.setGlobalState(value);
      else global.ShadowRig.clearGlobalState();
    } catch {}
  }

  function shadowPulse() {
    try {
      if (global.ShadowRig && typeof global.ShadowRig.speechPulse === 'function') global.ShadowRig.speechPulse();
    } catch {}
  }

  function startPulse() {
    stopPulse();
    shadowPulse();
    pulseTimer = global.setInterval(shadowPulse, 150);
  }

  function stopPulse() {
    if (pulseTimer) global.clearInterval(pulseTimer);
    pulseTimer = null;
  }

  function buttonIcon(name, fallback) {
    try {
      if (typeof global.satoruIconHTML === 'function') return global.satoruIconHTML(name, 'tts-glyph', fallback);
    } catch {}
    return fallback;
  }

  function setButtonPlaying(button, playing) {
    if (!button) return;
    try {
      button.classList.toggle('on', !!playing);
      button.setAttribute('aria-pressed', playing ? 'true' : 'false');
      button.innerHTML = playing
        ? buttonIcon('media.stop', '■')
        : buttonIcon('media.sound', '◇');
    } catch {}
  }

  function cleanupMedia(cancelSystemSpeech) {
    stopPulse();
    if (media) {
      try {
        media.onplay = null;
        media.onended = null;
        media.onerror = null;
        media.pause();
        media.removeAttribute('src');
        media.load();
      } catch {}
    }
    media = null;
    if (mediaUrl) {
      try { URL.revokeObjectURL(mediaUrl); } catch {}
      mediaUrl = '';
    }
    if (cancelSystemSpeech) {
      try { global.speechSynthesis.cancel(); } catch {}
    }
  }

  function resetUi() {
    setButtonPlaying(activeButton, false);
    activeButton = null;
    shadowRigState(null);
  }

  function settlePlayback(token, result, nextState) {
    if (token !== runId) return result;
    const pending = pendingPlayback;
    pendingPlayback = null;
    cleanupMedia(true);
    resetUi();
    emit(nextState || 'idle', {
      mode: result.mode || null,
      reason: result.reason || null,
      cache: result.cache || null,
      requestId: result.requestId || null,
    });
    if (pending && pending.token === token) pending.resolve(result);
    return result;
  }

  function rejectPlayback(token, error) {
    if (token !== runId) return;
    const pending = pendingPlayback;
    pendingPlayback = null;
    cleanupMedia(false);
    if (pending && pending.token === token) pending.reject(error);
  }

  function stop(options) {
    const opts = options || {};
    runId += 1;
    if (abortController) {
      try { abortController.abort(); } catch {}
      abortController = null;
    }
    const pending = pendingPlayback;
    pendingPlayback = null;
    cleanupMedia(true);
    resetUi();
    if (pending) pending.resolve({ mode: 'stopped', reason: opts.reason || 'stopped' });
    if (!opts.silent) emit('stopped', { mode: null, reason: opts.reason || 'stopped', cache: null, requestId: null });
    return { mode: 'stopped' };
  }

  function cacheKey(text, language, context) {
    return `${language}\u0000${context}\u0000${text}`;
  }

  function memoryCacheGet(key) {
    const item = memoryCache.get(key);
    if (!item) return null;
    memoryCache.delete(key);
    memoryCache.set(key, item);
    return item;
  }

  function memoryCachePut(key, item) {
    memoryCache.delete(key);
    memoryCache.set(key, item);
    while (memoryCache.size > config.memoryCacheEntries) {
      memoryCache.delete(memoryCache.keys().next().value);
    }
  }

  async function responseError(response) {
    let payload = null;
    try { payload = await response.clone().json(); } catch {}
    const code = payload && payload.error ? payload.error : `http_${response.status}`;
    return new ShadowVoiceError(code, code, response.status, payload);
  }

  async function fetchCloudAudio(text, language, context, token) {
    const key = cacheKey(text, language, context);
    const cached = memoryCacheGet(key);
    if (cached) return Object.assign({}, cached, { cache: 'MEMORY' });

    const controller = new AbortController();
    abortController = controller;
    const timeout = global.setTimeout(() => {
      try { controller.abort(new DOMException('Shadow voice timeout', 'TimeoutError')); } catch { controller.abort(); }
    }, config.requestTimeoutMs);
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'Accept': 'audio/*, application/json' },
        body: JSON.stringify({ text, language, context }),
        signal: controller.signal,
      });
      if (token !== runId) throw new DOMException('Stopped', 'AbortError');
      if (!response.ok) throw await responseError(response);
      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.toLowerCase().startsWith('audio/')) {
        throw new ShadowVoiceError('invalid_audio_response', 'Cloud voice returned a non-audio response', 502);
      }
      const blob = await response.blob();
      if (token !== runId) throw new DOMException('Stopped', 'AbortError');
      if (!blob.size) throw new ShadowVoiceError('empty_audio_response', 'Cloud voice returned empty audio', 502);
      const item = {
        blob,
        cache: response.headers.get('X-Shadow-Voice-Cache') || null,
        requestId: response.headers.get('X-Request-Id') || null,
        mode: response.headers.get('X-Shadow-Voice-Mode') || 'server-neural',
        provider: response.headers.get('X-Shadow-Voice-Provider') || null,
      };
      memoryCachePut(key, item);
      return item;
    } finally {
      global.clearTimeout(timeout);
      if (abortController === controller) abortController = null;
    }
  }

  function showAiDisclosure(language) {
    if (disclosureShown) return;
    disclosureShown = true;
    notify(COPY[language].disclosure);
  }

  function showFallbackNotice(language, reason) {
    const key = language + ':' + reason;
    if (fallbackNotices.has(key)) return;
    fallbackNotices.add(key);
    notify(COPY[language].fallback);
  }

  function playCloud(item, language, token) {
    return new Promise((resolve, reject) => {
      if (token !== runId) return resolve({ mode: 'stopped' });
      pendingPlayback = { token, resolve, reject };
      mediaUrl = URL.createObjectURL(item.blob);
      media = new Audio();
      media.preload = 'auto';
      media.playsInline = true;
      media.src = mediaUrl;
      media.onplay = () => {
        if (token !== runId) return;
        showAiDisclosure(language);
        emit('playing', {
          mode: item.mode,
          language,
          reason: null,
          cache: item.cache,
          requestId: item.requestId,
          aiGenerated: true,
        });
        startPulse();
      };
      media.onended = () => settlePlayback(token, {
        mode: item.mode,
        language,
        cache: item.cache,
        requestId: item.requestId,
        aiGenerated: true,
      }, 'ended');
      media.onerror = () => rejectPlayback(token, new ShadowVoiceError('audio_playback_failed'));
      const playPromise = media.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => rejectPlayback(token, error));
      }
    });
  }

  function textChunks(text) {
    const sentences = text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [text];
    const chunks = [];
    let current = '';
    for (const sentence of sentences) {
      const next = `${current} ${sentence}`.trim();
      if (next.length <= 240) {
        current = next;
        continue;
      }
      if (current) chunks.push(current);
      current = sentence.trim();
      while (current.length > 240) {
        let cut = current.lastIndexOf(' ', 230);
        if (cut < 80) cut = 230;
        chunks.push(current.slice(0, cut).trim());
        current = current.slice(cut).trim();
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  function bestSystemVoice(language) {
    const tag = LANGUAGE_TAGS[language].toLowerCase();
    let voices = [];
    try { voices = global.speechSynthesis.getVoices() || []; } catch {}
    return voices
      .filter((voice) => String(voice.lang || '').replace('_', '-').toLowerCase().slice(0, 2) === language)
      .sort((a, b) => {
        const score = (voice) => {
          const name = String(voice.name || '');
          let value = String(voice.lang || '').replace('_', '-').toLowerCase() === tag ? 100 : 0;
          if (/premium|enhanced|natural|neural|siri/i.test(name)) value += 60;
          if (voice.localService) value += 20;
          if (/compact|espeak|translate/i.test(name)) value -= 50;
          return value;
        };
        return score(b) - score(a);
      })[0] || null;
  }

  function playSystemFallback(text, language, reason, token) {
    if (!('speechSynthesis' in global) || typeof global.SpeechSynthesisUtterance !== 'function') {
      const result = { mode: 'unavailable', language, reason: 'no_system_speech' };
      resetUi();
      emit('error', result);
      notify(COPY[language].failed);
      return Promise.resolve(result);
    }
    showFallbackNotice(language, reason);
    emit('fallback', {
      mode: 'browser-system-voice',
      language,
      reason,
      cache: null,
      requestId: null,
      aiGenerated: false,
    });
    const chunks = textChunks(text);
    const voice = bestSystemVoice(language);
    let prefs = { rate: 0.92, pitch: 0.96 };
    try {
      if (typeof global.ttsPrefs === 'function') prefs = Object.assign(prefs, global.ttsPrefs());
    } catch {}

    return new Promise((resolve, reject) => {
      pendingPlayback = { token, resolve, reject };
      let index = 0;
      const speakNext = (useVoice) => {
        if (token !== runId) return;
        if (index >= chunks.length) {
          settlePlayback(token, { mode: 'browser-system-voice', language, reason, aiGenerated: false }, 'ended');
          return;
        }
        const utterance = new SpeechSynthesisUtterance(chunks[index]);
        utterance.lang = LANGUAGE_TAGS[language];
        utterance.rate = Math.max(0.72, Math.min(1.18, Number(prefs.rate) || 0.92));
        utterance.pitch = Math.max(0.72, Math.min(1.18, Number(prefs.pitch) || 0.96));
        if (voice && useVoice) utterance.voice = voice;
        utterance.onstart = () => {
          if (token !== runId) return;
          shadowRigState('speaking');
          startPulse();
        };
        utterance.onboundary = shadowPulse;
        utterance.onend = () => {
          index += 1;
          speakNext(true);
        };
        utterance.onerror = () => {
          if (token !== runId) return;
          if (voice && useVoice) return speakNext(false);
          settlePlayback(token, { mode: 'browser-system-voice', language, reason: 'system_voice_failed' }, 'error');
          notify(COPY[language].failed);
        };
        try { global.speechSynthesis.speak(utterance); }
        catch {
          settlePlayback(token, { mode: 'browser-system-voice', language, reason: 'system_voice_failed' }, 'error');
          notify(COPY[language].failed);
        }
      };
      speakNext(true);
    });
  }

  async function speak(value, options) {
    const opts = options || {};
    const text = normalizeText(value);
    if (!text) return { mode: 'unavailable', reason: 'empty_text' };
    const button = opts.button || null;
    const sameButton = button && activeButton === button && ['loading', 'playing', 'fallback'].includes(state.state);
    stop({ silent: true, reason: sameButton ? 'toggle' : 'replaced' });
    if (sameButton) return { mode: 'stopped', reason: 'toggle' };

    const token = ++runId;
    const language = languageCode(opts.language || currentLanguage());
    const context = normalizeContext(opts.context);
    activeButton = button;
    setButtonPlaying(button, true);
    shadowRigState('speaking');
    emit('loading', {
      mode: 'server-neural',
      language,
      reason: null,
      cache: null,
      requestId: null,
      aiGenerated: true,
    });

    try {
      const item = await fetchCloudAudio(text, language, context, token);
      if (token !== runId) return { mode: 'stopped' };
      return await playCloud(item, language, token);
    } catch (error) {
      if (token !== runId || (error && error.name === 'AbortError')) return { mode: 'stopped' };
      const reason = error && (error.code || error.name) ? (error.code || error.name) : 'cloud_voice_failed';
      cleanupMedia(false);
      const useBrowserFallback = opts.browserFallback === true || (config.browserFallback && opts.browserFallback !== false);
      if (useBrowserFallback) {
        return playSystemFallback(text, language, reason, token);
      }
      resetUi();
      emit('error', { mode: 'server-neural', language, reason, aiGenerated: true });
      notify(COPY[language].failed);
      return { mode: 'unavailable', language, reason };
    }
  }

  async function getStatus(language) {
    const response = await fetch(config.statusEndpoint, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) throw await responseError(response);
    const result = await response.json();
    return Object.assign({}, result, { requestedLanguage: languageCode(language || currentLanguage()) });
  }

  function configure(options) {
    const next = options || {};
    if (typeof next.endpoint === 'string' && next.endpoint.startsWith('/')) config.endpoint = next.endpoint;
    if (typeof next.statusEndpoint === 'string' && next.statusEndpoint.startsWith('/')) config.statusEndpoint = next.statusEndpoint;
    if (typeof next.browserFallback === 'boolean') config.browserFallback = next.browserFallback;
    if (Number(next.requestTimeoutMs) >= 5000 && Number(next.requestTimeoutMs) <= 120000) config.requestTimeoutMs = Number(next.requestTimeoutMs);
    return Object.assign({}, config);
  }

  function legacyBridgeSpeak(text, button, context) {
    return speak(text, { button, language: currentLanguage(), context: normalizeContext(context) });
  }

  function legacyBridgeStop() {
    stop({ reason: 'app-stop' });
    if (legacyStop) {
      try { legacyStop(); } catch {}
    }
  }

  function installLegacyBridge() {
    if (bridgeInstalled) return true;
    if (typeof global.ttsSpeak !== 'function' || typeof global.ttsStop !== 'function') return false;
    if (global.ttsSpeak === legacyBridgeSpeak) return true;
    legacyStop = global.ttsStop;
    global.ttsSpeak = legacyBridgeSpeak;
    global.ttsStop = legacyBridgeStop;
    bridgeInstalled = true;
    emit('idle', { bridgeInstalled: true });
    return true;
  }

  const api = {
    version: '2.0.0',
    speak,
    stop,
    getStatus,
    configure,
    installLegacyBridge,
    getState: () => Object.assign({}, state),
    isBridgeInstalled: () => bridgeInstalled,
  };
  global.ShadowVoiceV2 = Object.freeze(api);

  let bridgeAttempts = 0;
  function installWhenReady() {
    if (installLegacyBridge()) return;
    bridgeAttempts += 1;
    if (bridgeAttempts < 100) global.setTimeout(installWhenReady, 50);
  }
  installWhenReady();
})(window);
