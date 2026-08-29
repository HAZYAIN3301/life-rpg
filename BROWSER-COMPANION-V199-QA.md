# Browser Companion v199 — release и QA

Дата: 2026-08-29
Статус: опубликовано и byte-for-byte проверено на production.

## Что выпущено

Browser Companion — локальное Manifest V3-расширение для Brave и других Chromium-браузеров. Оно закрывает разрыв между уже существующим Attention в Satoru и реальным открытием выбранного сайта:

- человек заранее выбирает точный сайт, цель входа, длительность, режим и ожидаемый результат;
- расширение показывает gate до входа, ведёт локальное окно и возвращает boundary по завершении;
- `Control` не имеет обычного продления; аварийный выход ограничен, требует причины и 90 секунд ожидания;
- состояние переживает закрытие service worker/браузера и сверяется по абсолютному времени;
- один и тот же сайт может иметь несколько рабочих целей, не стирающих друг друга;
- Satoru получает только bounded status: наличие расширения, версию, количество настроенных сайтов и текущие `app/phase/remainingSeconds/mode`;
- цель, домен, история, причины и outcomes остаются в `chrome.storage.local` и в v199 не синхронизируются на сервер.

Новой вкладки или карточки на Today нет. В Settings добавлена одна сворачиваемая строка, а текущая активная граница показывается внутри уже существующей поверхности Тени.

## Установка в Brave

1. В Satoru открыть `Настройки → Контроль сайтов в Brave` и скачать `satoru-attention-v199.zip`.
2. Распаковать ZIP в постоянную папку.
3. Открыть `brave://extensions`.
4. Включить «Режим разработчика».
5. Нажать «Загрузить распакованное» и выбрать распакованную папку.
6. Открыть настройки расширения, выбрать один сайт и одно правило. Первый setup рассчитан максимум на две минуты.

Расширение можно отключить или удалить средствами браузера. Поэтому это настоящая граница внутри выбранного Chromium-профиля, но не обещание неотключаемого OS-lock.

## Контракт безопасности

- Постоянный host access есть только к точному production origin Satoru: `https://life-rpg-production-416a.up.railway.app/*`.
- Доступ к контролируемому сайту запрашивается отдельно после явного выбора и только для точного hostname.
- Нет `<all_urls>` в постоянных host permissions.
- Нет сетевой отправки истории, удалённого кода, аналитики, рекламы, аккаунта расширения или чтения содержимого страницы.
- Hostname сравнивается точно; строка вроде `tiktok.com.evil` не является TikTok.
- Page bridge принимает сообщения только с точного production origin, из того же окна и с совпадающим request id.
- Deep links Satoru имеют закрытый словарь `gate|return` и allowlist приложений; опасные/лишние query-поля удаляются.
- Расширение не получает права ассистента и не создаёт квесты, цели, XP, золото или social data.

## Честные ограничения v199

- Контролируются только выбранные сайты в том Chromium-профиле, где установлено расширение.
- Нативные приложения TikTok/YouTube, другой браузер, другой профиль и приставка не видны.
- Incognito работает только если человек отдельно разрешит расширение в incognito.
- Расширение всегда можно отключить или удалить в `brave://extensions`.
- v199 не синхронизирует policies/episodes между устройствами. Это отдельный protocol/security release, а не скрытая часть bridge.
- Background wake word «Сатору» остаётся невозможным для PWA/обычного расширения; сейчас голос работает только в активной вкладке после согласия.
- Android требует Usage Access/Accessibility-reviewed companion; iOS — Family Controls entitlement; desktop native apps/console требуют отдельных adapters.

## Автоматический QA

- `node --check` для app/server/SW и каждого extension JS: **PASS**.
- Extension core, enforcement, crash recovery, security, privacy, locales и package: **31/31 PASS**.
- Satoru bridge/integration + install package: **10/10 PASS**; общий focused browser-companion gate: **41/41 PASS**.
- Релевантные Attention/Assistant/Secretary suites: **93/93 PASS**; version/Guide integration после v199 pin: **85/85 PASS**.
- `git diff --check`, manifest/locale JSON и ZIP root/package checks: **PASS**.
- Полный suite после объединения с опубликованным Inspiration Import v198: **1145/1162 PASS**. Все 17 падений относятся только к не материализованным в sparse worktree art/font/audio/Piper-ассетам (`body-toad`, Den/Shadow/Traveller, reward atlas, Ouroboros, Piper); server/integration и изменённая runtime-логика проходят. Art-деревья не изменялись и не подменялись заглушками ради зелёного отчёта.
- ZIP локально отдаётся с `application/zip`, раскрывается с `manifest.json` в корне и содержит только 19 runtime/locale files — без тестов, исходной документации и package metadata.

## Browser QA

- `360×800`, dark: disclosure, install CTA и privacy copy доступны; оба действия `284×42`; горизонтальный scroll `360/360`.
- `375×812`, light: действия `299×42`; горизонтальный scroll `375/375`.
- `1280×900`, dark: companion остаётся одной progressive Settings-строкой; горизонтальный scroll `1280/1280`.
- Keyboard раскрывает секцию, видимый focus ring сохраняется, reduced-motion путь отключает необязательное движение.
- Console errors/warnings: **0**.
- Status heartbeat обновляет только companion-поверхность, не перерисовывает Settings целиком и не стирает незаписанный draft/focus.

## Production verification

- Release commit: `b4456ed03b689c6892ba2d4ae044d08c7f41efad`
- SW cache: `satoru-v199`
- Asset pin: `20260829-browser-companion-v199-1`
- Local/expected ZIP SHA-256: `23bf540369da28b329ed31bd6ae3c8c3e9d84e8bc5aeceab84d680ceb769f33f`
- Production ZIP SHA-256: `23bf540369da28b329ed31bd6ae3c8c3e9d84e8bc5aeceab84d680ceb769f33f`
- Railway status: `success` для `life-rpg` и `piper-tts`.
- Production byte equality: `index.html`, `app.js`, `styles.css`, `sw.js`, `satoru-attention-v199.zip` — **PASS**.
- ZIP response: HTTP `200`, `Content-Type: application/zip`, `Cache-Control: no-cache`.

## Что дальше

Полная связь с остальными названными болями зафиксирована в [`SECRETARY-OS-PAIN-MAP.md`](./SECRETARY-OS-PAIN-MAP.md). Следующие продуктовые слои — не новые россыпи карточек:

1. Secretary Event Router выбирает один уместный ход Тени и убирает обязанность помнить функции.
2. `Привычки` после готовности потребителей становятся `Ритмом`: практики, границы и восстановление в одном месте.
3. Planning Copilot сводит утро/вечер к 1–3 результатам, реальному финишу и переносу, а не к часу ручного планирования.
4. Native companions закрывают приложения, устройства, сон/Health signals и более надёжные системные напоминания.
