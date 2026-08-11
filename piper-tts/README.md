# Satoru Piper TTS

Private local neural speech service for Shadow/Jarvis. It has no user API keys
and no per-character provider billing.

## Runtime

Build this directory as a separate private service, then point the main Satoru
service at it:

```text
SHADOW_TTS_PROVIDER=piper
PIPER_TTS_URL=http://<private-piper-host>:5000
```

The service exposes Piper's `/synthesize`, `/info`, and `/voices` endpoints.
Only the main Satoru server should reach it; browsers continue to use the
authenticated same-origin `/api/shadow/voice` route.

## Voice set

| Locale | Piper voice | Dataset license |
|---|---|---|
| RU | `ru_RU-denis-medium` | CC0 |
| UK | `uk_UA-mykyta-high` | Apache-2.0 |
| EN | `en_US-joe-medium` | CC0 |
| DE | `de_DE-thorsten-high` | CC0 |
| ES | `es_ES-davefx-medium` | CC0 |

Piper itself is installed from the Open Home Foundation `piper-tts` package.
The current upstream engine is GPL-3.0; keeping it as a separate service is
intentional. Voice model cards remain the source of truth for dataset licensing.

- Engine and source: <https://github.com/OHF-Voice/piper1-gpl>
- Voice catalog/model cards: <https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/VOICES.md>
