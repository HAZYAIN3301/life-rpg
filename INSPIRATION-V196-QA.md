# Inspiration v196 — QA и release verification

Дата: 2026-08-29
Статус: source release опубликован; production rollout ожидает Railway backlog.

## Что проверялось

- Новый пользовательский раздел называется **«Вдохновение»**; основной сценарий — **«Подборка»**, вторичный — **«Сохранённое»**.
- Первый вход начинается с импорта кандидатов из account-owned данных Satoru. Человек подтверждает интересы, форматы и исключённые темы; до этого профиль не считается настроенным.
- Дневная подборка фиксируется на дату, содержит не более трёх карточек и не меняется после reload. `Больше такого / Не моё` действует только на будущие дни.
- В интерфейсе нет старых фильтров `Энергия / Практика`, технического выбора типа, постоянного поля связи с делом, экспорта account data, autoplay, load-more, popularity counters и награды за просмотр.
- Внешние материалы имеют attribution и rights metadata. Iframe создаётся только после явного нажатия, ограничен allowlist и не получает autoplay. Произвольный внешний источник проходит через attention boundary.
- `Сохранённое` ограничено 40 активными записями; bounded history — 160. Regression `40 active → archive one → add one → GET` не повреждает данные.

## Автоматический gate

- Полный проектный suite: **1144 / 1144 PASS**, 145 test files.
- Inspiration profile/catalog/UI/domain: конечная тройка, стабильность reload, feedback future-only, explicit-interest matching, blocked topics, formats, rights, no autoplay, no engagement/reward/infinite API, XSS escaping, accessibility, RU/EN/DE/UK/ES, touch и reduced motion.
- Server: ownership, malformed payload, false-empty guard, active/history limits, idempotent add и account lifecycle.
- `node --check`: `app.js`, оба новых Inspiration-модуля, Saved-модуль, UI и `server.js` — PASS.
- `git diff --check` — PASS.

## Живой browser QA

Проверена локальная сборка через настоящий интерфейс приложения:

- `360×800`: `scrollWidth = 360`, horizontal overflow отсутствует; видимые действия — не ниже 42 px.
- `375×812`: `scrollWidth = 375`; двухколоночные действия, bottom navigation и терминальная карточка не обрезаны.
- `1280×900`: `scrollWidth = 1280`; одна крупная hero-карточка и две равные вторичные карточки, без горизонтального canvas.
- Dark и Light: контраст, иерархия, выбранные состояния и терминал читаемы.
- Первый вход → импорт → подтверждение → три разных формата → сохранение → `Сохранённое` → три `Готово` → `На сегодня всё` пройдены реальными кнопками.
- После смены языка EN → RU стабильные imported ids показывают локализованные подписи (`Видео + Творчество`), а digest остаётся тем же.
- Одноразовая visual motion включается только при входе в раздел. Следующая обычная запись состояния снимает `should-enter`; у карточки после сохранения `animation-name: none`, поэтому feedback/save не перезапускает церемонию. Reduced-motion CSS полностью отключает transform/animation.
- Реальные media-actions проверены отдельно: `Spring` создаёт только по нажатию `youtube-nocookie` iframe без `autoplay`; закрытие убирает embed. `Не моё` сохраняет `aria-pressed=true`, но не меняет текущие три карточки.
- Настройка на `375×812` занимает 955 px вместо прежней стены: шесть основных тем видны сразу, ещё семь находятся в закрытом disclosure, исключения — в отдельном закрытом disclosure. Все видимые controls ≥42 px.
- Console warning/error: **0**.
- После навигации фокус возвращается в заголовок `Вдохновение`; semantic controls и `:focus-visible` закреплены source-level gate.

## Известные границы

- Это curated finite catalog, а не скрытый бесконечный crawler. Он может расширяться только материалами с понятным источником и правами.
- PWA не читает системный silent switch iPhone; звук подчиняется настройке Satoru `Выкл / Только важное / Полный`.
- Произвольные TikTok/YouTube-ссылки не запускаются автоматически. Их открытие остаётся отдельным, видимым решением через attention boundary.

## Production

- Кодовый release commit: `f7d789826d7f92887559bd772f0e0e8b989d8432` (`feat: ship personalized Inspiration v196`). Он опубликован fast-forward в `origin/master`.
- Первый Railway deployment `6150687469` остался `in_progress` без обновления timestamp. Через 30 минут создан кодово-пустой retrigger commit `6f037128092c7fc8a01a13c61ca78632b59e3383`; второй deployment `6150928445` также ожидает инициализации.
- На момент проверки `2026-08-29 01:23 UTC` production продолжает безопасно отдавать `satoru-v195`; новые Inspiration-модули отвечают `404`. Поэтому production success и byte/hash equality намеренно **не заявляются**.
- Причина подтверждена публичным Railway incident `Deployments slow to start`: networking issue одного host создал backlog, а deployment workers нестабильны при его разборе — <https://status.railway.com/incident/8GL2R2U5>.
- После выхода из очереди обязательна byte/hash verification `index.html`, `app.js`, `styles.css`, `sw.js`, `inspiration-profile-v1.js`, `inspiration-catalog-v1.js`, `return-shelf-ui-v1.js`, `return-shelf-v1.js` и production smoke вкладки `Вдохновение`.
