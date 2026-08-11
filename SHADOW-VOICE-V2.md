# Shadow Voice v2.4 — локальный Piper TTS, два тембра

Status: runtime и отдельный Piper-сервис реализованы 2026-08-11. До production нужны отдельный deploy Piper, приватный service URL в Satoru и real-device listening QA.

## Решение

Тень говорит через Piper, работающий как отдельный приватный сервис. Пользователю не нужен API key, подписка на голос или дополнительная установка. Повторные реплики кэшируются сервером Satoru. Браузер получает только готовый WAV через авторизованный same-origin API.

Системный `speechSynthesis` не включается автоматически: при сбое текст остаётся на экране, интерфейс сообщает ошибку. Device voice доступен только явным вызовом с `browserFallback: true`.

OpenAI Speech сохранён как необязательный совместимый provider и не используется по умолчанию.

## Состав

- `piper-tts/Dockerfile` — изолированный HTTP-сервис Piper и десять закреплённых голосов.
- `piper-tts/README.md` — deploy и конфигурация.
- `server.js` — `/api/shadow/voice`, health check Piper, лимиты и per-user cache.
- `public/shadow-voice-v2.js` — загрузка, playback/stop, speaking state и explicit fallback.
- `public/app.js` — локализованный статус и preview.
- `scripts/shadow-voice-piper-v141.test.js` — fake-provider integration test.

## Голоса

| Язык | Женский | Лицензия | Мужской | Лицензия |
|---|---|---|---|---|
| RU | `ru_RU-irina-medium` | Unknown | `ru_RU-denis-medium` | CC0 |
| UK | `uk_UA-lada-x_low` | Apache-2.0 | `uk_UA-oleksa-high` | Apache-2.0 |
| EN | `en_US-ljspeech-high` | Public domain | `en_US-john-medium` | Public domain |
| DE | `de_DE-kerstin-low` | CC0 | `de_DE-thorsten-high` | CC0 |
| ES | `es_AR-daniela-high` | CC BY-SA 4.0 | `es_ES-davefx-medium` | CC0 |

Источники: [Piper](https://github.com/OHF-Voice/piper1-gpl), [voice catalog](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/VOICES.md). Движок Piper имеет GPL-3.0; его отделение в самостоятельный сервис намеренное. Перед коммерческим релизом сохранить notices образа и повторно проверить model cards закреплённых голосов.

## API Satoru

Оба endpoint требуют обычную cookie `lrpg_sess`.

### `GET /api/shadow/voice/status`

Status выполняет короткий `/info` health check и не заявляет `configured:true`, если Piper недоступен.

```json
{
  "configured": true,
  "reason": null,
  "mode": "server-neural",
  "provider": "piper",
  "model": "piper-tts-1.6",
  "format": "wav",
  "languages": {
    "ru": { "tag": "ru-RU", "voices": { "female": "ru_RU-irina-medium", "male": "ru_RU-denis-medium" }, "speed": 1 }
  },
  "maxCharacters": 2400,
  "aiGeneratedDisclosureRequired": true
}
```

### `POST /api/shadow/voice`

```json
{
  "text": "Я рядом. Выберем один следующий шаг.",
  "language": "ru",
  "gender": "female",
  "context": "calm"
}
```

Языки: `ru`, `uk`, `en`, `de`, `es`. Контексты: `calm`, `morning`, `evening`, `focus`, `coach`, `celebrate`, `warning`.

Успех возвращает `audio/wav` и заголовки:

- `X-Shadow-Voice-Mode: server-neural`
- `X-Shadow-Voice-Provider: piper`
- `X-Shadow-Voice-Cache: HIT|MISS`
- `X-Shadow-Voice-Language: ru|uk|en|de|es`
- `X-Shadow-Voice-Gender: female|male`
- `X-Request-Id: …`

Основные ошибки: `not_logged_in` 401, invalid input 400/413, rate/concurrency 429, `local_voice_unreachable` или provider/invalid-audio error 502. Ошибка не запускает device voice автоматически.

## Конфигурация

Piper-сервис:

```text
PORT=5000
```

Satoru:

```text
SHADOW_TTS_PROVIDER=piper
PIPER_TTS_URL=http://piper-private-service:5000
```

Опциональная замена голосов:

```text
PIPER_TTS_VOICE_RU_FEMALE=ru_RU-irina-medium
PIPER_TTS_VOICE_RU_MALE=ru_RU-denis-medium
PIPER_TTS_VOICE_UK_FEMALE=uk_UA-lada-x_low
PIPER_TTS_VOICE_UK_MALE=uk_UA-oleksa-high
PIPER_TTS_VOICE_EN_FEMALE=en_US-ljspeech-high
PIPER_TTS_VOICE_EN_MALE=en_US-john-medium
PIPER_TTS_VOICE_DE_FEMALE=de_DE-kerstin-low
PIPER_TTS_VOICE_DE_MALE=de_DE-thorsten-high
PIPER_TTS_VOICE_ES_FEMALE=es_AR-daniela-high
PIPER_TTS_VOICE_ES_MALE=es_ES-davefx-medium
```

Операционные лимиты: `SHADOW_TTS_RPM`, `SHADOW_TTS_USER_CONCURRENCY`, `SHADOW_TTS_GLOBAL_CONCURRENCY`, `SHADOW_TTS_TIMEOUT_MS`, `SHADOW_TTS_MAX_CHARS`, `SHADOW_TTS_MAX_AUDIO_BYTES`, `SHADOW_TTS_CACHE_DAYS`, `SHADOW_TTS_CACHE_MAX_FILES`, `SHADOW_TTS_CACHE_MAX_MB`.

Кэш хранится в `DATA_DIR/shadow-voice-cache/<user-id>/`. Ключ включает пользователя, provider, модель, формат, язык, gender, voice, speed, Piper variability, context и текст. Женский и мужской WAV никогда не делят один cache key.

Все профили используют нейтральный темп Piper (`length_scale=1`), соответствующий прослушанным официальным samples.

`ru_RU-irina-medium` выбран продуктово, но остаётся release blocker: официальный model card указывает лицензию исходного датасета как `Unknown`. `es_AR-daniela-high` требует отдельного CC BY-SA attribution/share-alike review.

OpenAI включается только явно:

```text
SHADOW_TTS_PROVIDER=openai
OPENAI_API_KEY=<server secret>
```

## Client API

```js
await window.ShadowVoiceV2.speak(
  'Я рядом. Выберем один следующий шаг.',
  { language: 'ru', gender: 'female', context: 'calm', button: event.currentTarget }
);

window.ShadowVoiceV2.stop();
const status = await window.ShadowVoiceV2.getStatus('ru');
```

Состояния: `loading`, `playing`, `fallback`, `ended`, `stopped`, `error`. Режимы: `server-neural`, `cloud-ai`, `browser-system-voice`, `unavailable`, `stopped`.

## QA

Автоматически:

- syntax check server/client;
- authenticated status и отсутствие secrets;
- реальный `/info` health check;
- WAV/RIFF validation;
- корректный voice для каждого языка;
- per-user `MISS → HIT` без второго provider call;
- system fallback отсутствует по умолчанию и работает только explicit opt-in.

Listening matrix:

| Язык | Текст |
|---|---|
| RU | «Доброе утро. Сегодня не нужно побеждать весь мир — выбери один честный шаг.» |
| UK | «Доброго ранку. Обери один крок, який справді підтримає тебе сьогодні.» |
| EN | “Good morning. Pick one honest step and let the rest of the day unfold.” |
| DE | „Guten Morgen. Wähle einen ehrlichen nächsten Schritt und beginne ruhig.“ |
| ES | «Buenos días. Elige un paso honesto y deja que el día avance desde ahí.» |

Release gates: iOS Safari/PWA и Android Chrome/PWA playback, stop/replay, переключение view останавливает звук, отказ Piper оставляет transcript и показывает error, первый playback содержит понятное раскрытие синтетического голоса.
