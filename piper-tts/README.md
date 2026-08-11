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

| Locale | Female | License | Male | License |
|---|---|---|---|---|
| RU | `ru_RU-irina-medium` | Unknown | `ru_RU-denis-medium` | CC0 |
| UK | `uk_UA-lada-x_low` | Apache-2.0 | `uk_UA-oleksa-high` | Apache-2.0 |
| EN | `en_US-ljspeech-high` | Public domain | `en_US-john-medium` | Public domain |
| DE | `de_DE-kerstin-low` | CC0 | `de_DE-thorsten-high` | CC0 |
| ES | `es_AR-daniela-high` | CC BY-SA 4.0 | `es_ES-davefx-medium` | CC0 |

Piper itself is installed from the Open Home Foundation `piper-tts` package.
The current upstream engine is GPL-3.0; keeping it as a separate service is
intentional. Voice model cards remain the source of truth for dataset licensing.

- Engine and source: <https://github.com/OHF-Voice/piper1-gpl>
- Voice catalog/model cards: <https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/VOICES.md>

All selected voices run at their audition tempo (`length_scale=1`). The HTTP
server loads additional voices on first use and keeps them in memory, so the
ten-model image needs a real load/memory test before production sizing.

`ru_RU-irina-medium` is the approved female product direction, but remains a
release blocker: its official model card lists the source dataset license as
`Unknown`. `es_AR-daniela-high` additionally requires CC BY-SA attribution and
share-alike review. Do not represent either gate as cleared by this runtime
selection.
