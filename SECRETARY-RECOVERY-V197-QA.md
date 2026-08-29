# Secretary & Recovery v197 — release/QA handoff

Дата: 2026-08-29

Shell: `satoru-v197`

Asset pin: `20260829-secretary-recovery-v197-1`

Application release commit: `61da7e554ea7aa336c9ad843b9cb29d421bf4596`

Production: `https://life-rpg-production-416a.up.railway.app/`

## Результат

«Сегодня» больше не требует помнить набор разрозненных калькуляторов. Основная колонка содержит день, быстрый захват мысли, квесты и привычки. В поддерживающей колонке остаётся один компактный центр Тени, который показывает только актуальное состояние: Attention, возврат, восстановление, вечер либо первый setup.

Удаления данных нет. С экрана Today только убрана конкурирующая презентация:

- Founder Pass → Settings → Account;
- Notes → компактная строка захвата и счётчик;
- streak и earned reward → Тень;
- day close → сворачиваемая граница;
- Fights, Day Load, progress trio, anti-habits и deeper-path cards → не рендерятся на Today, но их stores/modules не удалены.

## Безопасный контракт ассистента

Разрешены только open-only маршруты:

- draft/open Attention policy;
- открыть возврат;
- открыть bounded recovery;
- открыть вечер;
- открыть настройки push.

У ассистента нет глаголов delete, permission grant, close session или подмены outcome. Успешный переход получает статус `opened`, не `done`; он не считается применённым и прямо сообщает, что сохранение произойдёт лишь после подтверждения пользователя.

## Data integrity

- Recovery сначала сохраняет один account-owned Attention envelope и только затем меняет живое состояние.
- Ошибка сети/500/malformed не выглядит как успех; Retry не теряет введённое состояние.
- Завершение дня ждёт write guard и durable write.
- Evening reminder marker не создаёт повторный звук/push при временной ошибке записи.
- Push delivery markers меняются только после 2xx. 404/410 удаляют мёртвую подписку; 0/429/5xx/exception остаются retryable.
- Все push несут нормализованный `ru|en|de|uk|es`; SW отвергает произвольную locale.

## Проверки

Автоматические:

- syntax: `app.js`, `server.js`, `sw.js`, `sound-engine-v1.js`, `assistant-actions-v1.js`;
- assistant/attention/recovery/push/PWA/sound/Today focused gate: **106/106**;
- full project suite с localhost integration tests: **1175/1175**;
- после объединения с опубликованным loader commit: **27/27** focused tests, включая две PNG-части, offline-cache, bite/chase animation и reduced motion;
- старые server integration failures из перегруженного параллельного прогона повторены последовательно и прошли; Account отдельно: **3/3**;
- `git diff --check`;
- release pins: `PWA_CACHE_VERSION === sw CACHE === satoru-v197`.

Browser:

- `360×800`, `375×812`, `1280×900`;
- light/dark;
- disclosure focus return;
- recovery open/start;
- evening validation, exactly three steps, close-day persistence;
- no horizontal overflow;
- visible controls ≥42 px на mobile;
- console errors/warnings: 0;
- reduced motion закреплён статическим regression gate.

## Файлы релиза

- `public/app.js`
- `public/styles.css`
- `public/attention-ui-v1.js`
- `public/assistant-actions-v1.js`
- `public/sound-engine-v1.js`
- `public/index.html`
- `public/sw.js`
- `server.js`
- `scripts/secretary-recovery-v197.test.js`
- `scripts/secretary-push-v197.test.js`
- связанные version/locale regressions

Secretary/Recovery не переписывал существующие art-деревья. Итоговая история сохраняет опубликованный родительский commit `b5578ec` и его две части загрузчика без изменений: Git blob `87254d8` (`ouroboros-body.png`) и `772aee6` (`ouroboros-jaw.png`).

## Production verification

- Railway `life-rpg` и `piper-tts`: `success` для application commit `61da7e5`;
- production `index.html`, `sw.js`, `app.js`, `styles.css`, assistant actions, Attention UI, sound engine и обе PNG побайтово совпали с локальным релизом;
- production contract: asset pins `20260829-secretary-recovery-v197-1`, `CACHE = satoru-v197`, `PWA_CACHE_VERSION = satoru-v197`;
- горизонтальный контур и browser QA выполнены до публикации на `360×800`, `375×812` и `1280×900`.

## Честная граница PWA

PWA не видит системное экранное время и не может физически остановить TikTok/YouTube/другой браузер. Она может исполнить заранее выбранный контракт, вернуть человека, дать visible-tab cue и отправить push только после уже выданного разрешения.

Реальный Control:

- R3 — browser extension/desktop companion;
- R4 — Android Usage Access companion;
- R5 — iOS Family Controls после entitlement.

Не обещать OS-level блокировку как функцию v197.
