# Shadow Voice v2 — cloud TTS contract and QA

Status: implemented and fully wired in `integration-staging`; pending production deployment and listening QA against the configured Railway key.

## Result

The production path is now OpenAI Speech through Satoru's server. The browser never receives an OpenAI key. `speechSynthesis` is retained only as an explicitly labelled emergency fallback; it is no longer presented as the real Shadow voice.

Files:

- `server.js` — authenticated `/api/shadow/voice` proxy, language profiles, rate/concurrency limits, streaming response and per-user disk cache.
- `public/shadow-voice-v2.js` — playback controller, Shadow speaking state, app bridge, honest system-voice fallback and status events.
- `deploy-icon-system-v1.sh` — copies both runtime files and this contract.

## Official OpenAI basis checked on 2026-07-30

- [Text-to-speech guide](https://developers.openai.com/api/docs/guides/text-to-speech): `gpt-4o-mini-tts` supports instruction-driven delivery and chunked audio streaming; `marin` and `cedar` are the recommended built-in voices.
- [Create speech API reference](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create): `POST /v1/audio/speech`, 4096-character maximum input, `instructions`, `speed`, and MP3/Opus/AAC/FLAC/WAV/PCM output formats.
- The guide lists Russian, Ukrainian, English, German and Spanish as supported. It also warns that built-in voices are optimized for English, so all five language profiles still require listening QA.
- OpenAI requires a clear end-user disclosure that the heard voice is AI-generated. The client shows this disclosure on the first cloud playback of the session, exposes `aiGenerated: true` in its status event and keeps a persistent localized label in Settings.

## Server API

### `GET /api/shadow/voice/status`

Requires the normal `lrpg_sess` session cookie.

Example response:

```json
{
  "configured": true,
  "reason": null,
  "mode": "cloud-ai",
  "provider": "openai",
  "model": "gpt-4o-mini-tts",
  "format": "mp3",
  "languages": {
    "ru": { "tag": "ru-RU", "voice": "marin", "speed": 0.94 },
    "uk": { "tag": "uk-UA", "voice": "marin", "speed": 0.94 },
    "en": { "tag": "en-US", "voice": "marin", "speed": 0.96 },
    "de": { "tag": "de-DE", "voice": "marin", "speed": 0.93 },
    "es": { "tag": "es-ES", "voice": "marin", "speed": 0.96 }
  },
  "maxCharacters": 2400,
  "aiGeneratedDisclosureRequired": true
}
```

The route never returns a key or even a key fragment.

### `POST /api/shadow/voice`

Requires the normal session cookie and `Content-Type: application/json`.

```json
{
  "text": "Я рядом. Выберем один следующий шаг.",
  "language": "ru",
  "context": "calm"
}
```

Supported languages: `ru`, `uk`, `en`, `de`, `es`.

Supported contexts:

- `calm`
- `morning`
- `evening`
- `focus`
- `coach`
- `celebrate`
- `warning`

The client cannot set `model`, `voice`, `instructions`, `format` or `speed`. Those are trusted server settings.

Success is an audio response with:

- `X-Shadow-Voice-Mode: cloud-ai`
- `X-Shadow-Voice-AI-Generated: true`
- `X-Shadow-Voice-Cache: HIT|MISS`
- `X-Shadow-Voice-Language: ru|uk|en|de|es`
- `X-Request-Id: …`

Errors are JSON and include `fallback: "browser-system-voice"`. Important codes:

- `not_logged_in` — 401
- `cloud_voice_requires_pro` — 402
- `cloud_voice_requires_byok` — 403
- `no_openai_key` — 503
- `unsupported_language`, `empty_text`, `bad_json` — 400
- `text_too_long` — 413
- `voice_rate_limit`, `voice_busy` — 429
- `cloud_voice_provider_error`, `cloud_voice_unreachable` — 502

## Secret and access policy

Key resolution order:

1. The signed-in user's existing server-side OpenAI BYOK value from `data/users/<id>/ai-keys.json`.
2. `OPENAI_API_KEY`.
3. The existing `AI_HOUSE_KEY_OPENAI`.

Recommended Railway setup:

```text
OPENAI_API_KEY=<Railway secret>
SHADOW_TTS_ACCESS=authenticated
```

`OPENAI_API_KEY` must be a Railway secret, never a client setting, HTML value, JavaScript constant or committed `.env` file.

`SHADOW_TTS_ACCESS` values:

- `authenticated` (default) — all signed-in users can use the house key.
- `pro` — BYOK works for its owner; the house key is limited to Pro/trial/admin.
- `byok` — cloud speech requires each user to save their own OpenAI key.

Optional voice configuration:

```text
SHADOW_TTS_MODEL=gpt-4o-mini-tts
SHADOW_TTS_FORMAT=mp3
SHADOW_TTS_VOICE_RU=marin
SHADOW_TTS_VOICE_UK=marin
SHADOW_TTS_VOICE_EN=marin
SHADOW_TTS_VOICE_DE=marin
SHADOW_TTS_VOICE_ES=marin
SHADOW_TTS_SPEED_RU=0.94
SHADOW_TTS_SPEED_UK=0.94
SHADOW_TTS_SPEED_EN=0.96
SHADOW_TTS_SPEED_DE=0.93
SHADOW_TTS_SPEED_ES=0.96
```

Only official built-in voice names are accepted; an invalid value falls back to `marin`.

Operational controls:

```text
SHADOW_TTS_RPM=24
SHADOW_TTS_USER_CONCURRENCY=2
SHADOW_TTS_GLOBAL_CONCURRENCY=10
SHADOW_TTS_TIMEOUT_MS=45000
SHADOW_TTS_MAX_CHARS=2400
SHADOW_TTS_MAX_AUDIO_BYTES=8388608
SHADOW_TTS_CACHE_DAYS=30
SHADOW_TTS_CACHE_MAX_FILES=128
SHADOW_TTS_CACHE_MAX_MB=96
```

Generated audio is cached per user under `DATA_DIR/shadow-voice-cache/<user-id>/`. Cache keys include the text, language, context, model, voice, speed and format. Cache writes are atomic and bounded by TTL, file count and byte size.

The server forwards provider audio as chunks while simultaneously filling the cache. The compatibility-first browser controller creates a Blob before playback, so the first uncached phrase does not begin mid-download on iOS. Repeated phrases use the server cache and a small in-memory client cache.

## Client API

After the file is loaded:

```js
await window.ShadowVoiceV2.speak(
  'Я рядом. Выберем один следующий шаг.',
  { language: 'ru', context: 'calm', button: event.currentTarget }
);

window.ShadowVoiceV2.stop();
const status = await window.ShadowVoiceV2.getStatus('ru');
```

Every transition dispatches:

```js
window.addEventListener('shadowvoice:status', (event) => {
  console.log(event.detail);
});
```

States include `loading`, `playing`, `fallback`, `ended`, `stopped` and `error`. Modes are always explicit:

- `cloud-ai`
- `browser-system-voice`
- `unavailable`
- `stopped`

The module automatically replaces the existing global `ttsSpeak`/`ttsStop` functions after `app.js` is ready. It preserves the existing speaker buttons and Shadow speaking pulses.

## Runtime integration

All required runtime points are applied:

1. `index.html` loads `shadow-voice-v2.js` after `app.js`.
2. The service worker precaches the module and uses a bumped cache version.
3. Settings show a localized `Cloud AI · natural voice` status or an explicitly labelled device-system fallback, plus the mandatory AI-generated disclosure.
4. Speaker controls remain available when cloud speech exists even if the browser has no `speechSynthesis`.
5. Morning, evening, focus, coach and celebration calls pass semantic contexts to the server profile.

The old browser voice remains only as a clearly disclosed failure fallback. Production still requires either `OPENAI_API_KEY`, `AI_HOUSE_KEY_OPENAI`, or a user BYOK value.

## QA checklist

Automated:

- `node --check integration-staging/server.js`
- `node --check integration-staging/public/shadow-voice-v2.js`
- `node integration-staging/qa-shadow-voice-v2.mjs`
- unauthenticated status returns 401
- authenticated status returns configuration without secrets
- malformed/empty request is rejected before any provider call
- unsupported language is rejected
- over-limit text is rejected
- response headers distinguish cloud AI and HIT/MISS
- a second identical request uses the per-user cache

Listening matrix:

| Language | Sample | Check |
|---|---|---|
| RU | «Доброе утро. Сегодня не нужно побеждать весь мир — выбери один честный шаг.» | Stress, native consonants, no English accent |
| UK | «Доброго ранку. Обери один крок, який справді підтримає тебе сьогодні.» | Native vowels, no Russian phonetic drift |
| EN | “Good morning. Pick one honest step and let the rest of the day unfold.” | Warm, close, not an announcer |
| DE | „Guten Morgen. Wähle einen ehrlichen nächsten Schritt und beginne ruhig.“ | Compound-word clarity and natural pauses |
| ES | «Buenos días. Elige un paso honesto y deja que el día avance desde ahí.» | Natural Spain pronunciation, no English rhythm |

For every language, listen to all seven contexts and verify that identity stays recognizably the same. If one built-in voice does not stay coherent across all five languages, configure a different approved voice per language and repeat the matrix.

Mobile:

- iOS Safari and installed PWA: user-tap playback succeeds after network delay.
- Android Chrome and installed PWA: playback, stop and replay work.
- switching views calls `ttsStop()` and actually stops cloud audio.
- a cloud failure shows the fallback notice and never labels the device voice as the Shadow cloud voice.
- the first cloud playback clearly discloses that the voice is AI-generated.
