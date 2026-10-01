## Claude 01.10 — секреты аккаунта закрыты в общем /api/data (без PWA-номера)

Исключение из полос по решению владельца 01.10: правка `server.js` (полоса Codex) — одна
константа `SERVER_SECRET_DATA_NAMES` и три проверки. Общий `GET/PUT/POST /api/data/<name>`
отдавал и принимал любой файл своей папки: ключи ИИ (`ai-keys`), токены Strava (`strava`),
расход ИИ-квоты (`ai-usage` — PUT обнулял лимит дом.ключа) и сессии устройств (`devices` —
PUT возвращал отозванное устройство). На прежнем коде подтверждено: квота 999999 → 0,
отозванный refresh 401 → 200. Теперь эти четыре имени → `403 server_owned_data`,
так же в админском чтении бэкапа и откате. Свои маршруты (`/api/ai/keys`, `/api/strava/*`,
`/api/auth/devices/*`, учёт квоты) не менялись; клиент эти имена через `/api/data` не читает.

Проверено: новый `scripts/server-secret-data-v1.test.js` (настоящий server.js, отдельный
DATA_DIR, синтетические ключи; ключи ИИ/Strava/квота/отзыв устройства/экспорт/админ-откат,
контроль обычного файла) — на прежнем server.js падает, на новом проходит; полный suite
3246/3246 (`--test-concurrency=2`). Публичные файлы не менялись → кеш остаётся `satoru-v314`,
пины не трогались; следующий свободный PWA-номер по-прежнему v315.
Остаток: 403 на проде видно только с входом в аккаунт (без сессии маршрут, как и раньше, 401).
Старые бэкапы `.backups/<эти имена>` на проде, если их успели создать через дыру, не удалялись —
по API они теперь недоступны.

**Опубликовано 01.10:** runtime `2278cd93`, Railway `95bfb8a3-871e-4f3d-8f01-a7a1ed6b7c3b` SUCCESS;
оба домена отдают `2278cd93` и `satoru-v314` с 08:27 UTC; SHA-256 shell **8/8** (app.js,
index.html, sw.js, styles.css × 2 домена — не менялись, как и ожидалось). Без входа
`/api/data/{ai-keys,strava,devices,ai-usage}`, `/api/ai/keys`, `/api/strava/status` → 401,
главная 200. 403 с сессией на проде не проверялся (аккаунты агент не создаёт) — подтверждён
тестом локально. До публикации v314 Codex уже была на проде: `02d99aef` SUCCESS, оба домена
отдавали `51fa0ad2` / `satoru-v314` в 08:22 UTC.

## Codex 29.09 — v314: фокус и использование личных наград

Продолжен большой проход: сохранённые сессии фокуса с очередью/повтором и привязкой к
аккаунту; вклад открытого дела через таймер без повторного зачёта при завершении;
полученные личные награды с датой/использованием/откладыванием и возвратом из «Сегодня».
Покупки неизменны, статусы сохраняются через settings + economy CAS/WAL. Золото не меняется.
Контракт: [FOCUS-REWARDS-V314.md](./FOCUS-REWARDS-V314.md).
Реальная приёмка: [RELEASE-OWNER-REVIEW-V314.md](./RELEASE-OWNER-REVIEW-V314.md).
Новый код проверяется полным suite и 280 UI-состояниями; production receipt отдельно во
внешнем CHECKPOINT. v313 уже SUCCESS, оба домена c188e7a1/v313, hashes 18/18,
Chrome/WebKit production smoke PASS.

Граница дальнейшего расширения: реальный проход пары и желанность оформления/мебели.
Модель scripts/qa-gold-runway.mjs показывает 1940 золота на весь текущий платный золотом
ассортимент: новые способы вклада не решают конечность коллекции. Цены/Pro/монетизацию
не меняли. Остались финансовая доступность личных наград, пилот 10 пар, новый ассортимент
после приёмки и отдельное решение об аватаре; физический Safari gate открыт.

## Codex 29.09 — v313: привычки продвигают совместные проекты

Сохранённые полные и двухминутные отметки доступны рядом с делами. Одна привычка за
один день — один вклад: отмена/повтор не удваивают прогресс, дополнительных наград нет.
Названия остаются личными; старые task-вклады совместимы без миграции.
Контракт и приёмка: [MULTIPLAYER-HABITS-V313.md](./MULTIPLAYER-HABITS-V313.md).
Браузер: 120 состояний Chrome/WebKit, оба проекта через задачи и привычки, без ошибок.
Production receipt после публикации — во внешнем CHECKPOINT.
Фокус пока не подключён: таймер хранит сумму минут, нужна отдельная запись завершения.
Новые главы, пилот, баланс золота, G03 и отдельный аватар остаются в очереди.

## Codex 28.09 — v312: совместные проекты меняют общее Логово

Владелец выбрал проекты. В Племени доступны «Вечерний очаг» (6 сохранённых дел) и
«Зелёное окно» (8): промежуточные изменения, огонь/вечер и растения остаются в общей сцене.
Два участника для завершения; без срока/штрафов/новых начислений. Названия дел приватны.
Повтор, CAS, выход/rejoin и удаление аккаунта сохраняют общий результат корректно.

Контракт: [MULTIPLAYER-PROJECTS-V312.md](./MULTIPLAYER-PROJECTS-V312.md);
[QA](./MULTIPLAYER-PROJECTS-V312-QA.md): 3241/3241 tests, 120 UI-состояний Chrome/WebKit,
два сквозных прохождения обоих проектов, контраст ≥6.40:1. Публикация ещё не подтверждена;
квитанция будет во внешнем CHECKPOINT. Остались привычки/фокус как источники, новые главы,
пилот, баланс золота, G03, монетизация и отдельный аватар. Это первый цикл, не бесконечная игра.

## Codex 28.09 — v311, M04A: общее Логово в приложении

После отрицательной приёмки M01 сделан live-маршрут: цель мебели в «Сегодня» → обычное
выполнение дела → покупка существующим владельцем экономики → размещение в общей комнате
Племени. Оба участника видят свои вещи; права, CAS, повтор после потери ответа и выход из
группы проверяются отдельно от личного кошелька. Нового заработка/цены/Pro нет.

Контракт и границы: [MULTIPLAYER-M04-SHARED-DEN.md](./MULTIPLAYER-M04-SHARED-DEN.md).
QA: [MULTIPLAYER-M04-QA.md](./MULTIPLAYER-M04-QA.md). Публикация ещё не подтверждена;
финальная квитанция — во внешнем CHECKPOINT. Это **часть M04**, не завершение multiplayer.
Далее: продуктовая приёмка этой связки; личные зоны/общие проекты и памятный предмет,
M05, проверка баланса, G03 и пилот. Старый M01 отвергнут; не возвращать его как готовый продукт.

**Codex 28.09 — M03B + M01, кандидат:** серверное ядро подключено к API;
выход/распад компании восстанавливаются через журнал, удаление аккаунта обезличивает вклад.
Игровой прототип для телефона: `/experiments/lighthouse-m01.html` — две роли, два маршрута,
три пары инструментов, совместный финал. **Это отдельный прототип, не live-маршрут Племени**;
золото/инвентарь не меняются. Контракт: [MULTIPLAYER-M03B-M01.md](./MULTIPLAYER-M03B-M01.md),
[приёмка](./MULTIPLAYER-M03B-M01-QA.md). Полный suite 3233/3233; M01 — 48 прохождений,
292 состояния Chrome/WebKit. Следующий gate: реакция владельца на игровую механику M01,
затем versioned события/награда/inventory/сквозной UI. Shell v310 сохранён (SHELL не менялся).
Deployment пока не подтверждён; итоговая квитанция — сверху внешнего CHECKPOINT.


**Codex 28.09 — M03A, кандидат серверного фундамента multiplayer:** отдельный журнал
главы/использованных действий, согласие, постоянная цель, replay/conflict, отзыв и
обезличивание. 21 целевая проверка; полный suite **3224/3224**. Контракт:
[MULTIPLAYER-FOUNDATION-M03A.md](./MULTIPLAYER-FOUNDATION-M03A.md),
[QA](./MULTIPLAYER-FOUNDATION-M03A-QA.md). **Пока не подключено к server.js/UI**:
следующий пакет — authenticated API + lifecycle + один доступный маршрут Маяка.
Золото/рейды/Pro/Senku не менялись. PWA v310 сохранён: кешируемые файлы не менялись.
Публикация ещё не подтверждена; квитанция будет во внешнем CHECKPOINT.

**Claude 28.09 — мост Senku, фаза 1 опубликована / v310:** runtime `305f386d`; оба домена
отдают commit `305f386d` и `satoru-v310` с 14:04 UTC; SHA-256 **8/8** (app.js, index.html, sw.js,
styles.css × 2 домена); production без входа — Chromium и WebKit iPhone без ошибок страницы;
`/api/bridge/senku/*` без сессии → 401. С настоящим ключом Senku не проверялось: ключ вводит
владелец (Настройки → Тень и подключения → Senku). Фаза 2 (награда) ждёт решения владельца —
[SENKU-BRIDGE-V310.md](./SENKU-BRIDGE-V310.md).

**Claude 28.09 — мост Senku, фаза 1 / v310 candidate** (исключение из полос по решению
владельца: задача Claude, хотя `server.js`/`public` обычно ведёт Codex). Настройки → «Тень и
подключения» → Senku: адрес + ключ, проверка первым запросом, «Отключить». Сервер забирает
`/api/bridge/facts?since=` по Bearer-ключу, складывает по id, курсор в той же атомарной записи,
401 → «переподключи», сбои → пауза 3…60 мин. «Сегодня»: «Senku: N карточек, M минут, голосом K»,
по нажатию — сессии дня. **Без XP, золота, сундуков и привычек.** Ключ только в серверном файле
(`/api/data` → 403, не в экспорте и журнале). 3203/3203 tests; Chromium/WebKit, 5 языков, светлая/
тёмная, 375/1280. [SENKU-BRIDGE-V310.md](./SENKU-BRIDGE-V310.md). Фаза 2 ждёт решения владельца.
Deployment ещё не подтверждён; квитанция будет сверху.

**Codex 28.09 — G02 опубликован / v309:** runtime `9a9a940e`, Railway
`5ae65f18-8e30-4bfb-8576-15e44936e4a2` SUCCESS. Оба домена, SHA-256 **22/22**;
Chromium/WebKit production без page errors; существующий PWA v308→v309.
Goal module и все 4 WebP в новом кеше, мебель декодируется при отключённой сети.
3189/3189 tests, 320 UI states, durable flows и CAS двух вкладок.
Приёмка: [GOLD-G02-V309-QA.md](./GOLD-G02-V309-QA.md). Остаток — G03 и далее;
оплата/Pro, общий гардероб, device/Apple gates не закрыты этим выпуском.

**Codex 28.09 — G02 / v309 candidate:** «Тихий вечер» — три рисованных предмета
с прежними правами/ценами, дневная чистая сцена, примерка до накопления и одна
сохраняемая цель без резервирования золота. 3189/3189 tests; 320 UI states,
Chromium/WebKit durable flows и две вкладки. [GOLD-G02-V309-QA.md](./GOLD-G02-V309-QA.md).
Следующее: G03 — применение/планирование личных наград. Pro/платежи не менялись.
Deployment ещё не подтверждён; публикационная квитанция будет сверху.

**Codex 28.09 — G01 опубликован / v308:** runtime `84adecd2`, Railway
`0b0ea068-73cb-4405-b504-08585f294d57` SUCCESS. Оба домена подтверждены,
SHA-256 10/10; production Chromium/WebKit без page errors; существующий PWA
v307→v308 с активным worker. 3186/3186 tests. Подробности: [GOLD-G01-V308-QA.md](./GOLD-G01-V308-QA.md).
Дальше: авторская мебель 3–5 предметов + цель накопления, затем остальные пакеты
G02–G08. Общий гардероб Traveller, новая мебель и монетизация ещё не реализованы.

**Codex 28.09 — G01 / v308 candidate:** видимая рамка/фон портрета, подтверждённое
сохранение старого гардероба, предпросмотр покупки мебели/темы и world-space размещение
семи платных предметов. 3186/3186 tests; 200 modal + 120 screen states Chrome/WebKit,
реальные synthetic purchase/refusal/lost-response/retry/reload. Детали и границы:
[GOLD-G01-V308-QA.md](./GOLD-G01-V308-QA.md). Новая авторская мебель — следующий приоритет
перед сложным аватаром; цены/Pro/платежи не изменены. Deployment пока не подтверждён.


**Codex 28.09, 09:02 UTC — v307 опубликован.** Runtime `dd3c903`, Railway
`bdffc55b-4f21-406f-a9b1-dde5cf719c51` SUCCESS. Оба домена отдают этот commit и
`satoru-v307`; SHA-256 пяти shell-файлов **10/10**. Вход Chromium/WebKit на двух
доменах: 0 ошибок страницы. Уже открытый синтетический клиент обновился v306→v307
с активным service worker. Финальный suite: **3179/3179**, без пропусков.
Что изменилось и что ещё блокирует первый выпуск: [WEB-FINAL-V307-QA.md](./WEB-FINAL-V307-QA.md).
До решения владельца каталог Вдохновения не заменён; native/store gates не закрыты.

**Codex 28.09 — v307 candidate, единая web-приёмка:**
Подтверждённые достижения/повтор с той же датой, локализованный PiP, мгновенный
выход из помощника, контраст/типографика/цели нажатия. Матрица маршрутов и точные
границы: [WEB-FINAL-V307-QA.md](./WEB-FINAL-V307-QA.md).
R05/R06/04/06/07/09/10 — синтетическая web-приёмка сведена; 08 остаётся PARTIAL:
вкусы сохраняются, но каталог пуст для интерьеров/спортивных эдитов, TikTok playback
не подтверждён. Решение владельца по составу первого выпуска ожидается.
Native/device/App Store и полоса Claude — отдельные gates. Senku исключён владельцем.
Публикация ещё не подтверждена; актуальная квитанция будет добавлена сверху.

**Codex 28.09 — v306 опубликован:** `e8d73d1`, Railway
`19cb7802-07c3-480e-b72b-db6d9896860a` SUCCESS. Оба домена в 07:58 UTC
отдают `e8d73d1` / `satoru-v306`; SHA-256 app/index/sw — 6/6.
Вход Chromium на обоих адресах: 0 ошибок JS. 3175/3175 тестов;
WEB-RECEIPTS-V306-QA.md описывает изменения и границы приёмки.
Новые запуски эксперимента отложены по решению владельца; история сохранена.

**Codex 28.09 — v306 candidate:** owner approved deferring new experiment runs;
history/stop/export preserved. Entry completion and bond now share the durable owner
transaction; undo/replay cannot award bond again. Rename waits for persistence;
duplicate toasts suppressed. 3175/3175 tests, 40 Chromium/WebKit form layouts.
Details and remaining scope: WEB-RECEIPTS-V306-QA.md. Publication receipt pending.

# START HERE — холодный старт для нового чата/LLM

**Последний подтверждённый runtime: v303 `b04258c` (27.09).** Railway SUCCESS,
оба домена: 6/6 SHA-256, suite 3166/3166. Верх DEVLOG содержит квитанцию.
Решение по дальнейшему запуску эксперимента ожидает ответа владельца; полная
следующая очередь — внешний CODEX-PROGRESS-20260927.md, короткий остаток — BACKLOG.

**Codex 27.09, latest:** v302 `611cec0` published; v303 candidate corrects the active
experiment hint after finding its legacy event integration disconnected. Owner choice
pending (defer vs integrate); see top BACKLOG and ROUTES-R05-V301-QA.md follow-up.

**Codex 27.09:** v301 `4eeb435` published and verified on both domains. Next candidate
v302 fixes unconfirmed companion care; COMPANION-CARE-V302-QA.md lists evidence and
remaining R06 gates. The original R05/R06 scopes remain distinct from earlier visual audits.

**Codex web lane, 27.09 — v301 candidate:** R05 saved-status and Board-return repairs;
browser acceptance and remaining scope: ROUTES-R05-V301-QA.md. Full R05 and R06 reward
acceptance are not claimed. Latest publication receipt is in DEVLOG/RELEASE-CHECKPOINT.
Parallel ownership remains governed by external LANES-20260927.md.

**Состояние на 27.09 (прод: v300, master `5091ca8`+, расширение Satoru Attention 0.9.0).**
- Опубликовано 26.09: v295 WebKit-паритет; v296 импорт целей (старые квесты с удалённой
  сферой больше не блокируют импорт) и ZIP в Mac-приложении; v298 скачивания из оболочки
  через второй домен; v297/v299/v300 — расширение 0.7.0 → 0.9.0: список 18+ (535 578 доменов),
  фильтр Reddit NSFW, замок 7/30/90 дней без досрочного снятия, мотивация на странице блокировки.
  Квитанции — RELEASE-CHECKPOINT-R04-R06.md; QA-файлы перечислены ниже.
- Решения владельца 26.09: замок досрочно не снимается никак; список 18+ = OISD+HaGeZi+
  StevenBlack+Satoru внутри расширения (GPL/MIT отдельными файлами); «18+» отмечена по
  умолчанию; Reddit должен работать; думскролл — шахматная задача каждые N минут + экран
  мотивации; iOS Family Controls — отдельной нативной сессией; магазин и политику Brave
  готовим мы, отправляет/ставит владелец. Оплата/Pro — не трогать до документов владельца.
- Открыто (подробно — верх BACKLOG): владелец отправляет 0.9.0 в Chrome Web Store
  (`extensions/satoru-attention/store-kit-v300/SUBMISSION.md`) и присылает ID; расширение
  0.10.0 (шахматы, экран мотивации); ответы владельца по чек-листу устройств; натив:
  blob-экспорт в оболочке и Family Controls (внешний план `tasks/13-family-controls.md`).
- Не проверено: живой reddit.com (фильтр проверен на поддельном), Brave владельца, профиль
  замка браузера (нужен ID из магазина), Mac-приложение после v298, реальные iPhone-проверки.
- Рабочие места: основной клон `~/Projects/life-rpg` (master); worktree
  `~/Projects/life-rpg-webkit-20260926` (ветка = master). Внешний план
  `~/Projects/satoru-release-plan-20260924` (CHECKPOINT/START/NEXT). Не работать в Documents.
- LOCAL-SESSION-PROMPT.md выполнен 26.09 (кроме ответов владельца по устройствам) — не повторять.
- **С 27.09 работают два агента параллельно — разделение обязательно:**
  `~/Projects/satoru-release-plan-20260924/LANES-20260927.md`. Claude — расширение Satoru
  Attention и граница браузера; Codex — web-продукт (R05, R06, 04, 06–10) и native. Номер версии
  и публикация — по очереди (fetch → следующий свободный vNNN → при гонке rebase и новый номер).
- 28.09 (Claude): v305 = расширение 0.10.1 — мост и ссылки работают на satoruapp.com (раньше
  только Railway, поэтому Satoru «не видел» установленное расширение); в магазин отправлять
  `store-kit-v305` (EXTENSION-BRIDGE-V305-QA.md).
- 28.09 (Claude): v304 = расширение 0.10.0 — шахматная задача каждые N минут на сайтах-лентах и
  мотивация перед входом (EXTENSION-CHESS-V304-QA.md); общий формат задач для native —
  `extensions/satoru-attention/PUZZLES-CONTRACT.md`.
- Свежая квитанция прода 27.09 19:37 UTC: оба домена `6a17c55` / `satoru-v300`, SHA-256 14/14
  (включая ZIP v300), вход в WebKit (iPhone) и Chromium без ошибок страницы.

26.09: WebKit matrix done, v295 = R13 WebKit parity (WEBKIT-PARITY-V295-QA.md); real
device checks — owner checklist, results in RELEASE-CHECKPOINT-R04-R06.md.
v296 = owner bugs: extension package in the Mac app, goal import (OWNER-BUGS-V296-QA.md).
v297 = Satoru Attention 0.7.0 with the OISD NSFW adult list (EXTENSION-ADULT-LIST-V297-QA.md).
v298 = app-shell downloads via the other domain; v299 = extension 0.8.0, merged list + Reddit
guard (EXTENSION-REDDIT-V299-QA.md); v300 = extension 0.9.0 lock + motivation + store kit
(EXTENSION-LOCK-V300-QA.md).

**25.09 R04A–R06 queue:** состояние пакетов, коммиты и деплой-квитанции —
[RELEASE-CHECKPOINT-R04-R06.md](./RELEASE-CHECKPOINT-R04-R06.md) (зеркало внешнего
плана). v283 = R04A: честная нагрузка сфер/XP, PROGRESS-MEANING-V283-QA.md;
v284 = R04B: читаемые графики, CHARTS-V284-QA.md;
v285 = R04C: таймаут/отмена/поздний ответ ИИ, AI-LIFECYCLE-V285-QA.md;
v286 = R04D: проверенные экспорты (архив, .ics, картинка недели), EXPORT-V286-QA.md;
v287 = R05: оставшиеся экраны по R03B, SCREENS-V287-QA.md;
v288 = R06: одна Тень (подсказки, чат, голос, Логово), SHADOW-V288-QA.md;
v289 = R07: таймаут/отмена для остальных ИИ-окон, AI-SURFACES-V289-QA.md;
v290 = R08: цели 44px на «Сегодня», TODAY-FLOORS-V290-QA.md;
v291 = R09: у каждой подсказки Тени одно действие, TODAY-HINTS-V291-QA.md;
v292 = R10: свёрнутые разделы и Настройки, светлая тема, HIDDEN-CONTENT-V292-QA.md;
v293 = R11: диалоги и настоящее содержимое (программы, имена сфер), DIALOGS-V293-QA.md;
v294 = R12: вход, регистрация и первый запуск, FIRST-RUN-V294-QA.md.

**24.09 v274:** тест существующей push-подписки доступен в Settings → Приложение
без включения уведомлений в текущем браузере. Одна подписка на аккаунт остаётся
ограничением; native APNs и рассылка на все устройства не реализованы.

> Вход для агента — [AGENTS.md](./AGENTS.md). Здесь состояние и карта контекста;
> действующий процесс — AGENTS-PROTOCOL.md. Читай профильные документы по задаче.

**Checkpoint 24.09, v273:** first-visit card translations EN/DE/UK/ES and
no invented absence on new accounts; 3071/3071 tests PASS. Public ambient audio
credits added at /credits.html via Support. Native build 9 uploaded to Apple
for iOS/Mac; processing and review form state tracked in native release/STATUS.md.
All 60 store screenshots were completed on 23.09; older "localizations in work"
below is historical. Reviewer account verified; no credentials in repository.

**Checkpoint 23.09, v272:** исправлено наложение поля времени на длительность
в форме iPad; до этого v271 исправил заголовок Логова. 3068/3068 tests PASS.
Русские iPhone/iPad/Mac screenshots с Логовом загружены в ASC; локализации в работе.
Native release work: `/Users/al.prokopets/Projects/satoru-ios/CHECKPOINT.md` и
`release/STATUS.md`. Полный store/device QA ещё не завершён.

**Checkpoint 22.09, v269 — extension download и JSON-импорт целей:** приложение
теперь ведёт на актуальный v260 Chromium ZIP для Chrome/Brave, сервер отдаёт ZIP
как attachment. Импорт нормализует числовые метрики с единицей (`10 км`),
показывает ошибки прямо в модальном окне, сохраняет исходный JSON для правки
и не обрезает молча пакет после 120 предложений. Локальный браузерный QA:
сохранение и повторное чтение цели PASS; неверная метрика показывает ошибку и
блокирует применение. Полный suite и production receipt — в верхней записи DEVLOG.

**Checkpoint 21.09, v268 — local secretary:** SECRETARY-OLLAMA-V268.md.
Optional allowlisted server-local Ollama, no cloud fallback; selected-file search
beyond the old 20k prefix, up to five files, actual source excerpts in chat.
Synthetic local Qwen: 20/20 facts/refusals, 9/20 strict citation format; no Gemini
comparison. Railway→owner Mac bridge and persistent library are not implemented.
Navigation v267 changes preserved. Publication verification recorded separately.

**Checkpoint 20.09, v266:** DEVICE-WEB-SESSIONS-V266.md. B2 devices UI/notices
и отзываемый dws1 cookie для WKWebView. Native capability gate заменяет постоянное
выключение регистрации ниже; 18 real Keychain/WK сценариев PASS в симуляторе.
Физический iPhone подключён; Developer Mode/подпись и device QA остаются.
Релизные факты — art-factory/device-sessions-v266/release-receipt.json.

**Apple / iOS, 19.09:** членство активно по подтверждению владельца; Team ID
`8Y9TR9L674`. Первый локальный SwiftUI-проект собирается для iPhone 14 simulator,
обычный вход остаётся в WKWebView. Постоянная регистрация native-токена пока
выключена до B2 web notices и проверки гибридной сессии. Это начало C1, не готовый
TestFlight. Проверки, локальный путь и остаток — IOS-FOUNDATION-2026-09.md.
Заявки Family Controls ещё не поданы; AASA на обоих доменах 404.

**Checkpoint 19.09, v265 — Вдохновение:** INSPIRATION-VISUAL-V265.md.
Личный визуальный вкус и до десяти референсов, настоящие Pinterest-превью,
явный просмотр фото/эдитов, feedback, 45-дневная история и фиксированный день.
Пять примеров владельца не задают вкус остальных аккаунтов. Добавлены server-owned
profile/discovery и metadata endpoints; успех только после durable typed receipt.
Полный suite после интеграции `92f09f6` — 3023/3023 PASS; браузерные факты и границы —
art-factory/inspiration-v265/qa-receipt.json. CACHE satoru-v265.
Живой поиск требует BRAVE_SEARCH_API_KEY и production-проверки доступа к Brave;
без него честно доступен каталог. Внешнее воспроизведение TikTok не подтверждено:
официальный плеер в QA вернул network error. Не выдавать metadata за playback.
Опубликован runtime `f27a6f5`: оба Railway services success, 129/129 bytes
на каждом из двух доменов совпали 19.09 19:36 UTC; точный SHA и CACHE подтверждены.
Receipt: art-factory/inspiration-v265/release-receipt.json. Production login без console errors.
Сессии v264 и оба адреса приложения сохранены, старый Railway URL не перенаправлять.

**Checkpoint 17.09, v264 — сессии устройства, сервер:** DEVICE-SESSIONS-V264.md.
`Authorization: Bearer` рядом с кукой для нативного приложения, виджета и Screen Time;
регистрация только по куке, вращение ключа обновления с отзывом при повторе, привязка к
версии сессии. Экрана в Настройках ещё нет, CACHE не менялся. Оплата Apple Developer отправлена 16.09, 17.09 членство ещё «Pending» (Apple: до 48 часов) — App ID и заявки на Family Controls ждут его. Домен `satoruapp.com` куплен и подключён 17.09, Bundle ID `com.satoruapp.satoru` предложен. Вход для нового чата по-прежнему AGENTS.md.

**Checkpoint 13.09, v261:** ordinary inventory writes и generic purchase
history защищены; legacy morning choice повторяется по точной durable receipt;
явная связь CommitmentV2→task подключена к карточке Тени и проверяется перед
открытием. Исправлена мобильная форма границы. Готова публичная privacy-страница
расширения на пяти языках; отправка в store ждёт входа владельца в кабинет.
Контракты OWNERSHIP-WRITES-V261.md, MORNING-OUTCOME-V261.md,
COMMITMENT-TASK-LINKS-V261.md, STORE-PUBLICATION-V261.md. CACHE satoru-v261.
Опубликован `1175476`: оба Railway services success, 47/47 production bytes
13.09 10:42:34 UTC; **2733/2733 tests PASS**. Подробности — верх DEVLOG; browser receipt —
art-factory/critical-path-v261/qa-receipt.json. Следующая очередь — верх критического
плана: общий wallet/credit provenance, полный First Value, остальные push.
Личный XP/gold/import и title owners не изменены; avatar/Rest Profile на паузе.

**Предыдущий checkpoint 12.09, v260:** три завершённых технических среза:
серверные сундуки (CHEST-REWARDS-V260.md), установка/самопроверка Chrome и Brave
(extensions/satoru-attention/store-kit-v260/SUBMISSION.md), принятая текстовая
основа Тени (SHADOW-CHARACTER-V260.md). **2621/2621 tests PASS**, 96/96 профильных
extension checks; browser/QA receipts — верх DEVLOG. CACHE satoru-v260.
Опубликовано `b4b4150`: Railway app/TTS success, 41/41 production bytes совпали
12.09 21:41:57 UTC. Первая TTS-сборка упала в кэше Railway BuildKit; повтор того же
коммита завершился успешно. Receipt и browser QA — верх DEVLOG.

Ответы владельца получены: Chrome и Brave; характер Тени принят. Вопрос о переносе
прогресса объяснён, новая ограничительная политика НЕ утверждена. Личный архив
XP/gold/предметов работает по-прежнему; выданные сервером сундуки не выдаются второй
раз после импорта старого архива. Для следующих срезов остаются generic/settings-only
mint и единый wallet; обычный ZIP/самопроверка не равны публикации в store.
Паузы аватара/Rest Profile и отдельный художественный gate сохраняются.
Решения/единственный текущий вопрос: OWNER-DECISIONS-2026-09.md.

**Предыдущий checkpoint 12.09, v259:** ACCOUNT-IMPORT-V259.md — общий WAL всех
portable files, подписанный preview с revisions, надёжный повтор импорта/сброса,
account guards и честные ошибки. 2510/2510 tests PASS. Опубликовано `e1fc38f`:
Railway app/TTS success, 28/28 live bytes, production login без console errors.
Публикация/QA — верх DEVLOG; вопросы — OWNER-DECISIONS-2026-09.md.
CACHE satoru-v259. Экономические права переноса не изменены; generic/settings-only/
mint/chest и provenance наград остаются P0. Вопросы владельцу отделены от этого
технического среза; аватар/Rest Profile не возобновлены.

**Предыдущий checkpoint 12.09, v258:** продолжать по PRODUCT-CRITICAL-PATH-2026-09.md;
разделение с Claude — CLAUDE-OPUS5-NEXT-WORK.md. Эти файлы обновлены по фактическим
v254–v257, выполненные пакеты №2/№3 не выдавать повторно. Следующий P0-срез
PURCHASE-ENTITLEMENTS-V258.md: серверный личный уровень и точные права новых
покупок, строгая квитанция и account guards. Опубликовано `8979522`:
Railway app/TTS success, 26/26 live bytes, 2449/2449 tests PASS. Конкретные
receipts и browser QA — верх DEVLOG. CACHE satoru-v258.
Это не закрытие generic/import/settings-only/mint/chest и всего wallet P0.

**Предыдущий checkpoint 12.09:** supply Вдохновения v257 опубликован `1b3f52b`;
Railway app/TTS success, 21/21 live bytes совпали 16:41 UTC, 2341/2341 tests PASS.
Receipt: art-factory/inspiration-v257/release-receipt.json; профильный browser QA —
art-factory/inspiration-v257/qa-receipt.json. Evening-close v256 опубликован `e269cf7`
(15/15 live bytes), planned-start v255 — `b21ef90` (13/13),
after-lapse-return v254 — `52a124f`.
Контракты EVENING-CLOSE-V256.md, EVENING-WRITES-V256.md и
SECRETARY-NEXT-MOVES-TRANSPORT-V1.md. Не повторять эти публикации.
Срез v257 — supply Вдохновения в действующей подборке и подтверждённых
owner-записях: девять собственных текстов, восемь внешних материалов на проверке.
Проверки/публикация конкретного SHA — верх DEVLOG;
контракт INSPIRATION-SUPPLY-RUNTIME-INTEGRATION-V1.md.
Rest Profile остаётся на паузе владельца; канон ожидает художественной приёмки.

**Крупный пакет 09.09 — v253 опубликован:** [FEATURE-WRITES-V253.md](./FEATURE-WRITES-V253.md).
Notes/Calendar/Habits Guide и обычные habit writes используют общий WAL/exact-CAS;
сервер проверяет покупки по общему каталогу и сохранённому балансу; настройки Логова
и звания показывают результат после записи. Проверки/статус публикации — верх DEVLOG.
Runtime `fb411ae`; оба Railway services success, 9 live-файлов совпали 09.09 18:59 UTC,
1971/1971 tests и 15 browser-групп PASS. Receipt: art-factory/feature-writes-v253/release-receipt.json.
Это НЕ закрытие всего P0/авторитетного кошелька; точный остаток в контракте и BACKLOG.

**Продолжение 09.09 — v251:** [ECONOMY-WRITES-V251.md](./ECONOMY-WRITES-V251.md).
**v251 опубликован:** runtime `5b14150`, release `8fd19ec`. Владелец прямо разрешил
этот destination/payload ответом «Делай дальше. Все разрешаю»; прежний gate закрыт.
Оба Railway services success; 8 live-файлов совпали с release 09.09 15:23 UTC,
API без сессии 401, приложение доступно. 1951/1951 tests и browser QA PASS.
**v252 тоже опубликован:** runtime `5dc4096`, 1955/1955 tests PASS, оба Railway
services success, 8 live-файлов совпали 09.09 15:37 UTC. Покупка внутри главы Rewards
использует тот же exact-CAS/WAL и замороженный Guide result, а не отдельный нестабильный
повтор. Receipt: art-factory/guide-purchase-v252/release-receipt.json; детали — DEVLOG.
Не повторять завершённые публикации v251/v252.
Покупки/Логово/экипировка/игровые perks и повтор сундука: общий account WAL,
точная база economy slots, успех после записи. Это не новый server-authoritative
кошелёк и не готовность всех feature writes. Финальные проверки/релиз — верх DEVLOG.
Владелец сообщил: выданный параллельный пакет запущен в другом Codex. Номер пакета
и SHA ещё не получены; не повторять №2/№3/№4 и не приписывать им готовую интеграцию.

**Текущий запрос 09.09: разрешены master push/Railway, продолжение стройки и документация.**
Дуо v249 опубликовано коммитом `0f4bf82`: оба Railway services success, 7 live-файлов
совпали byte-for-byte, включая нетронутый compare.html. Прежний permission gate снят
явным ответом владельца. Следующий срез тоже опубликован: [PARTY-REWARDS-V1.md](./PARTY-REWARDS-V1.md),
receipt-выдача рейда/действующий XP boost v250, runtime `d412482`. Оба Railway services
success, 8 live-файлов совпали byte-for-byte 09.09 09:53 UTC. Общий suite 1948/1948 PASS.
Проверки и ограничения — верх DEVLOG и art-factory/party-rewards-v250/release-receipt.json.
Пакет Opus №1 взял Codex; для Claude остаются №2/№3/№4. Не дублировать эту работу.

**Предыдущий этап 08–09.09: первый срез мультиплеера v249 + критический продуктовый аудит.**
[PARTY-DUO-V249.md](./PARTY-DUO-V249.md) — опубликованные совместные сессии
двух участников существующей пати: свой task, отдельно раскрытая подпись, согласие,
готовность, общий интервал, личный сохранённый итог. UI в Племени/Сегодня, no new nav.
Новая сессия не начисляет валюту. Raid claim/boost исправлены следующим v250;
старый target members×600 пока НЕ исправлен.
[PRODUCT-CRITICAL-PATH-2026-09.md](./PRODUCT-CRITICAL-PATH-2026-09.md) — приоритеты,
реальные основания/пробелы по Тени, привычкам, Вдохновению, дереву, расширению,
гайду, экономике и канону. [CLAUDE-OPUS5-NEXT-WORK.md](./CLAUDE-OPUS5-NEXT-WORK.md) —
4 исходных handoff-пакета: №1 выполнен Codex; №2/№3/№4 выделены отдельно,
актуальный статус внешней работы указан выше.
UI receipt: art-factory/party-duo-v249/receipt.json. Release/полные tests — верх DEVLOG.
Выпуск v249 подтверждён 09.09 после явного разрешения владельца; прежнее ожидание закрыто.

**Исследовательская основа 08.09:**
[MULTIPLAYER-RESEARCH-2026-09.md](./MULTIPLAYER-RESEARCH-2026-09.md) — рынок,
исходные идеи/CD5, проверка текущего party runtime, конкретный поток дуо/экспедиции,
порядок разработки и пять исходных решений. Владелец затем разрешил начать; реализованный
первый scope уточнён в PARTY-DUO-V249.md. Остальные предложения не стали автоматически
утверждённым rollout. Эксперимент не запускался. Не возобновлять аватар автоматически.
Оставшийся риск рейда: цель растёт с каждым членом, включая неактивного/неразрешившего вклад.
Найденные исследованием split claim/credit и отсутствующий boost закрыты v250.
Сбои старой выдачи в реальном аккаунте не воспроизводились; компенсации не выдавались.

Отложенный аватарный трек: [AVATAR-HYBRID-V5.md](./AVATAR-HYBRID-V5.md).
Текущий checkpoint v6: `traveller.html` — цельная объёмная реконструкция рядом
с исходным Traveller в том же логове; 19 костей, общая анимация/два кроя пальто,
front-projected исходная фактура. 26 unit / 8 browser scenario groups.
Владелец оценил v5 «лучше», но стиль и анатомию НЕ принял. V6 тоже ждёт просмотра.
Профиль/затылок/складки/кисть ещё условны; это не готовый production-персонаж.
V6 [опубликован в закрытом стенде](https://satoru-avatar-wardrobe-lab-sept8.albertprokopets3301.chatgpt.site/traveller),
Site version 5, 08.09 19:45 UTC, live IAB проверен; receipt в `qa-traveller-v6`. Исходники
проб вошли в разрешённый master push 09.09; production-персонаж ими не заменён.
Предыдущая механическая проба v5:
Владелец отверг плоский v4 и запросил настоящий объём 3D в рисованном стиле.
Новая `/volume.html`: объёмная рука, три рукава на одном скелете, 20 unit / 9 browser
scenarios; это не готовый персонаж. Новый план отменяет массовые корректирующие PNG.
Опубликован [закрытый объёмный стенд](https://satoru-avatar-wardrobe-lab-sept8.albertprokopets3301.chatgpt.site/volume.html),
Site version 4, 08.09 18:50 UTC; receipt в `qa-volume-v5`.
Предыдущий этап (история): [AVATAR-DRAWN-RIG-V3.md](./AVATAR-DRAWN-RIG-V3.md).
v4: пользователь похвалил плавность/плечо, отверг боковое движение v3. Новый forward
тест с ракурсом/перекрытием, прежний для сравнения; 15 contracts / 10 browser scenarios.
Кисть сжималась в ракурсе; план рисованных корректирующих поз теперь отменён владельцем.
Передача source/art в прежний закрытый Site явно разрешена.
v4 опубликован и проверен в IAB: [закрытый стенд](https://satoru-avatar-wardrobe-lab-sept8.albertprokopets3301.chatgpt.site/drawn.html),
Site version 3; receipt в `qa-forward-v4/deployment-receipt.json` рядом с образцом.
Предыдущий этап: [AVATAR-WARDROBE-V2.md](./AVATAR-WARDROBE-V2.md).
Отдельная примерочная: одежда/движения положительно оценены, **стиль KayKit отвергнут**.
Сохранять production Traveller, Тень и логово. 2D mesh rig отвергнут для нужного объёма;
NPR 3D тоже пока не утверждённый pipeline. Production/золото не менялись.
История отказа 07.09: [AVATAR-3D-PILOT-V1.md](./AVATAR-3D-PILOT-V1.md).
Пользователь отверг 3D-манекен и движения (VISUAL FAIL); production-персонажа оставить.
Фабрика сохранена как свидетельство, не готовый кандидат для внедрения.

## Актуальный handoff — 2026-09-06

**Последний запрос 08.09:** владелец отверг поверхностный rollout v245/v246.
Последующий проход по смыслу функций и полировке v248:
[PRODUCT-UX-AUDIT-V248.md](./PRODUCT-UX-AUDIT-V248.md). Читать первым для UI:
назначение всех основных разделов, реальный редактор привычки, честные сигналы,
точные переходы, сохранения и нерешённые продуктовые вопросы.
Структурный v247: [DESIGN-DEEP-REDESIGN-V1.md](./DESIGN-DEEP-REDESIGN-V1.md).
Читать перед следующим UI: новый presentation-only interface-composition-v1,
а не только перекраска. Старый /compare.html не менять; проверки и границы — там же.

Дизайн-трек 2026-09-07: [DESIGN-REBOOT-V1.md](./DESIGN-REBOOT-V1.md).
Продолжение 08.09: [PLAN-DESIGN-V1.md](./PLAN-DESIGN-V1.md) — календарь/цели связаны
с Today в том же preview; общий multi-sphere/background/difficulty editor, перенос,
bulk и локальный ICS. Матрица сравнения с runtime и НЕперенесённых функций — там же.
Изолированное Today-превью desktop/mobile: после A/B выбран Russo One + округлённость,
фиолетовая связь с Тенью, полноценные светлая/тёмная/системная темы и старые значки.
08.09 после просмотра пользователь разрешил полный runtime-перенос при сохранении
прежней версии в облаке. Текущий rollout/checkpoint: [DESIGN-ROLLOUT-V1.md](./DESIGN-ROLLOUT-V1.md).
Нельзя подменять живые данные fixture-моделью. Тематические семьи позже.
Site public, обновление явно разрешено.
Прежнее «минимум кнопок»
не разрешает прятать голосовой итог, время/длительность и другие частые действия.

Это текущий checkpoint. Он важнее старых handoff-промптов и ранних строк ниже по файлу.

- Канонический код — `origin/master`. Перед работой обязательно сверить
  `git rev-parse HEAD` и `git rev-parse origin/master`; checkout с отставшим SHA не считать
  источником истины.
- Новый runtime — **структурный v247 + полировка v248 + дуо/награды v249/v250 +
  подтверждённые записи v251–v253, возврат v254, planned-start v255,
  evening-close v256 и supply Вдохновения v257**.
  PWA cache `satoru-v257`, app/supply pin `20260912-inspiration-v257-1`;
  CSS и изменённые secretary modules сохраняют pin `20260912-secretary-v256-1`.
  Актуальный статус master/Railway и live-проверки — верх DEVLOG; старый receipt v250
  не доказывает публикацию нового кандидата. Контракт — FEATURE-WRITES-V253.md.
  Границы UI-аудита всех вкладок остаются в `PRODUCT-UX-AUDIT-V248.md`; v253 не выдаёт
  профильный browser QA за новый полный визуальный аудит приложения.
  Прежний runtime v244 сохранён из `74a97dd` в `/compare.html` (synthetic, read-only).
  Actionable Foundations UI и Commitment v2 не заменены новой моделью хранения.
- Полная проверка v253: **1971/1971 PASS**; 15 browser-групп и crash/retry — в контракте.
  Перед следующей правкой начать с `git fetch`, `git status --short --branch` и
  `git log -5 --oneline`; обязательный процесс —
  [`AGENTS-PROTOCOL.md`](./AGENTS-PROTOCOL.md).
- Дверь `commitment-v2` закрыта коммитом `301299d`: форма Attention атомарно сохраняет
  локальное правило и уговор Тени, а клиент читает сохранённое состояние только через
  `CommitmentV2.migrate()`. Автотесты пройдены; **ручной visual QA и production-byte/deploy
  gate ещё не закрыты**. Точный чек-лист — запись «2026-09-06 Commitment v2 UI» в `DEVLOG.md`.
- `rest-profile-v1` готов как движок, но его UI **поставлен Альбертом на паузу 03.09**.
  Не начинать без нового явного решения.
- 30-дневный эксперимент уже имеет owner/admin-поверхность внутри «Сегодня»/Тени (v212).
  `secretary-experiment-v1.js` существует как чистый движок/серверный контракт, но не
  загружается отдельным browser-script. Не строить второй экран: сначала решить, переносить
  ли текущую inline-поверхность на модуль или оставить её адаптером.
- Массовые действия уже доступны в Goals v184: ручной multi-select и проверяемые
  assistant-команды по exact IDs. Старый `/api/bulk/*` handoff перекрывается этим продуктом;
  не подключать вторую bulk-поверхность без отдельного решения о миграции.
- `HANDOFF-CODEX-DOORS.md` и `HANDOFF-CODEX-SECRETARY-UI.md` — **superseded history**,
  не текущие инструкции. Актуальные источники: этот checkpoint, `DEVLOG.md`, `BACKLOG.md`
  и `SECRETARY-ENGINE-CONTRACT.md`.
- First Value, объяснимая память Тени, telemetry consent и governance уже выпущены. Точный
  Actionable API, владельцы данных, event-hooks и ограничения —
  [`ACTIONABLE-FOUNDATIONS-UI-V216.md`](./ACTIONABLE-FOUNDATIONS-UI-V216.md).
- Источник факта «сделано» — верх `DEVLOG.md`; источник факта «осталось» — верх
  `BACKLOG.md`. `ROADMAP.md` задаёт принципы и долгий горизонт. `STATUS-AND-PLAN.md`,
  `WORKFLOW.md` и `ACTIONABLE-GAMIFICATION-CLAUDE-HANDOFF.md` — история, не текущая очередь.

## Что это
**Satoru** — персональный геймифицированный планировщик жизни «жизнь как десятиборье». Самохостед, мультиюзер. Владелец: **Альберт Прокопец** (нем. Oberstufe, фанат JJK; бренд-иконка = «**?**»). 
- Прод: **https://life-rpg-production-416a.up.railway.app/** · GitHub `HAZYAIN3301/life-rpg` · Railway **авто-деплоит на каждый push в master**.
- Нейминг: **Satoru** (текущее) ← было Gojo ← было Life-RPG. В старых доках встречаются все три — это один проект.

## Философия (НЕ нарушать — детали в ROADMAP «Принципы продукта»; первоисточник — `ALTERNEYT.md`)
- **Десятиборье:** ценится баланс многих сфер, а не одна вертикаль. Сферы — свои, иерархия N-уровней.
- **Через любовь, не вину:** мотивация теплом и связью, без Duolingo-штрафов/наказаний. Стрик щадящий.
- **Уровень = доказанное мастерство, НЕ сгорает** (как чёрный пояс). Отдельно «Форма» — свежесть, мягко падает/возвращается.
- **Отдых и восстановление = так же важны, как труд** (энергия восстанавливается пассивно).
- Тёплый компаньон + питомцы = удержание через эмоциональную связь.

## Стек и архитектура
- **Zero-dep** (нет runtime npm-зависимостей): Node stdlib HTTP-сервер `server.js` + ванильный JS SPA `public/app.js` + `public/styles.css` + `public/index.html`. Данные — JSON-файлы `data/users/<id>/*.json`, реестр `data/users.json`.
- **Рендер:** один объект `State`; `render()` → `VIEWS[State.view]()` в `#main`. Делегирование событий на `document`: `onClick`/`onSubmit`/`onChange`/`onSettingsInput`. Сохранение зависит от владельца данных: settings/tasks используют защищённый exact-CAS/WAL путь (см. README и актуальный контракт функции). Не обходить его внутренним `_put`; проверять подтверждение записи. В `render()` есть **error-boundary** (сбой раздела не белит экран + авто-репорт).
- **Навигация:** реестр `SECTIONS` + `renderNav()` + `sectionOf()` + `navUnlockLevel()` (2 уровня: разделы + саб-табы). На телефоне (`<=600px`) — пять первичных пунктов **Сегодня / План / Привычки / Герой / Ещё**; вторичные функции собраны в bottom sheet. Гейт-уровни (Герой/Племя с ур.3). `NEW_VIEWS` + `settings.discovered` = glow-подсветка новых разделов.
- **Авторизация:** email+пароль (scrypt) ИЛИ legacy профиль+PIN; код восстановления; сессия = HMAC-cookie. `DATA_DIR=/app/data` на **персистентном томе Railway** (подтверждён — данные не теряются).
- **Деплой:** по умолчанию законченная задача включает scoped commit → push в
  `origin/master` → проверку Railway/production. Не добавлять вымышленное co-authoring.

## ⚠️ Критичные грабли (проверено на практике)
1. **Nav/FAB дублированы** в `index.html` И в `APP_SHELL`-const внутри app.js — править ОБА.
2. **Кириллический `\b`** в JS-regex работает только для ASCII → молча не матчит русские слова. **Никогда `\b` перед кириллицей** (укусило дважды: энергия, трейты питомцев). См. память `project_satoru-cyrillic-wordboundary`.
3. **Превью:** после клиентских правок проверь, что загружены свежие ресурсы; после серверных — перезапусти свой тестовый процесс доступными средствами. Проверяй интерфейс скриншотом и DOM/keyboard/touch по профильному QA.
4. **Тестовые данные:** отдельный временный DATA_DIR и собственные fixtures. Не фильтруй реестр реальных аккаунтов. Убирай только точные артефакты задачи в изолированной среде.
5. **Сохранение:** ожидай durable receipt и проверяй повторным чтением. Пауза сама по себе не доказывает запись; не обходи CAS/WAL через Store._put.
6. **Git lock:** не удаляй автоматически. Проверь активную Git-операцию и владельца; при неопределённости останови Git-операцию и сообщи причину.
7. **Параллельные чаты:** отдельные worktree/ветки, проверка diff/status, явные свои пути при staging. Не читай чужие приватные сессии ради определения занятости; не удаляй чужие worktree.
8. **`public/sw.js` → `const CACHE = 'satoru-vNN'`** бампать при каждой правке `app.js`/`index.html`/`styles.css`, которая должна дойти до уже открытых вкладок — иначе старый service worker отдаёт закэшированную версию.

## Карта документации (что где)
| Док | Назначение |
|---|---|
| **AGENTS.md / CLAUDE.md** | единый вход в обязательные инструкции |
| **START-HERE.md** | состояние и карта контекста |
| **AGENTS-PROTOCOL.md** | обязательный процесс для любого агента: sync, ownership, тесты, docs, push/deploy |
| **WORKFLOW.md** | указатель на действующий процесс; прежние таблицы вынесены в архив |
| **ROADMAP.md** | принципы продукта, фазы, монетизация, гейты запуска, дог-фуддинг (модель жизни Альберта) |
| **ALTERNEYT.md** | 📖 **библия философии** — полный разбор книги «Альтернейт» Хартмана → маппинг на фичи + что строить дальше + guardrails (читать вместе с принципами ROADMAP) |
| **DEVLOG.md** | технический журнал — что построено, как устроено, как продолжить (главный source-of-truth по «сделано») |
| **BACKLOG.md** | нереализованные задумки + фидбек-триаж (главный source-of-truth по «осталось») |
| **ACTIONABLE-FOUNDATIONS-UI-V216.md** | текущий release-handoff: First Value, память Тени, telemetry consent, governance |
| **LAUNCH.md** | чек-лист запуска (Railway-том ✅, что ещё нужно) |
| **MONETIZATION-VALIDATION-BRIEF.md** | деньги, ФОП/эквайринг, валюта и честный тест спроса перед платным запуском |
| **COMPETITORS.md** | разбор Habitica/LifeUp/Solo Leveling/Finch — позиционирование, что стащить |
| **COMPETITORS-2.md** | разбор Skillion/SelfQuest/Spirit City/Gizmo — «Логово»/комната, аватар/гир |
| **DESIGN-DIRECTION.md** | визуальный north star, референсы, IA и зафиксированный мобильный контракт |
| **DESIGN-BOOK-NOTES.md / DESIGN-CRAFT-BRIEF.md / DESIGN-CRAFT-RULES.md** | выводы из дизайн-литературы и проверяемые правила для любого нового redesign |
| **GUIDE-V3-PLAN.md / GUIDE-V3-FIRST-SCRIPT-RU.md** | progressive Guide v3: продуктовый контракт, утверждённый сценарий First Journey и contextual Habits |
| **GUIDE-V3-V194-QA.md / GUIDE-V3-V195-QA.md** | выпущенные contextual-главы, библиотека Guide и seeded E2E |
| **QUESTIONNAIRE-V1-PLAN.md** | новый registration questionnaire: один ответ → подтверждённая цель + первый шаг → Guide/Today/Goals; progressive-вопросы, privacy, atomic data contract и QA |
| **ASSISTANT-V181.md** | контракт безопасных действий ассистента, голосового вызова и явного файлового контекста |
| **ASSISTANT-RESPONSE-INTEGRITY-V186.md** | finish-reason, automatic full rewrite и fail-closed защита от оборванных ответов Тени |
| **ASSISTANT-DECISION-QUALITY-V187.md** | адаптивная глубина, decision brief и отдельный сильный provider для сложных личных разборов |
| **GOALS-BULK-V184.md** | массовое управление целями, bulk-команды Тени и защита чата от UTF-8/contract leakage |
| **GOALS-ACTIONABLE-V185.md** | быстрая галочка достижения, actionable detail, проекты, multi/background spheres и AI-импорт шагов |
| **MOTION-SOUND-V189.md** | оригинальный Sound OS, motion-правила и церемония Rewards; без копирования anime SFX |
| **INSPIRATION-V196-QA.md / INSPIRATION-PERSISTENCE-V207-QA.md** | персональная конечная подборка и сохранение отредактированных интересов |
| **APPLE-DEVELOPER-FUTURE-HANDOFF.md** | единая карта ограничений PWA/iOS и точный handoff после оплаты Apple Developer Program |
| **SECRETARY-OS-PAIN-MAP.md** | полная карта пользовательских болей: что уже закрыто, Secretary/Ритм/Planning и честные платформенные границы |
| **BROWSER-COMPANION-V199-QA.md** | установка, privacy/security contract, QA и production verification браузерной границы |
| **BROWSER-COMPANION-DISCOVERY-V200-QA.md** | заметное объявление на Today, простой guided install, store-ready пакет и QA нового release path |
| **BROWSER-PROTECTION-V210-QA.md** | защита браузера v209: причина stale-runtime сбоя, категории/списки/расписание, SafeSearch/YouTube/bypass, permissions и QA |
| **BROWSER-COMPANION-V215-QA.md** | актуальный пакет расширения: Chrome/Edge/Opera/Firefox/Safari границы и store artifacts |
| **ACCOUNT-PROFILE-V209.md** | профиль, публичная карточка, соцссылки и server-owned visibility/privacy |
| **INTERFACE-HIERARCHY-V203-QA.md** | редизайн редизайна: иерархия Today/Calendar/Inspiration/Board, progressive disclosure, motion/sound и локальный release gate |
| **SKILLTREE-MASTERNAK-RESEARCH.md** | долговечный разбор Masternak (2022): что источник действительно подтверждает, ограничения и правила Tree v4 |
| **TREE-V4-SPEC.md / TREE-V4-QA.md** | честное разделение реального Path и игровых бонусов, Guide v3 adapter, evidence/data contract, design и release gates |
| **ECONOMY-ART-V208-QA.md** | текущий канон 96 отрисованных PNG для достижений, личных наград и арсенала; contact sheets, prompts, offline manifest и QA gates |
| **APPLE-ENTITLEMENT-REQUEST.md** | готовый черновик заявки на Family Controls distribution entitlement |
| **AVATAR-3D-PILOT-V1.md** | актуальное решение 2026-09-07: разрешённый 3D-пилот, рабочий стенд, ТЗ художнику, гейты до замены production-аватара |
| **STYLE-DECISION.md** | история арт-стиля; ограничения аватарного эксперимента переопределены AVATAR-3D-PILOT-V1 |
| **ART-PIPELINE.md** | производственный путь графики от и до: AI-спрайты (боссы/питомцы) → Rive (компаньон/аватар) |
| **ART-BRIEF.md / ART-INTERVIEW.md** | ТЗ художнице + её ответы/профиль |
| `wiki/topics/Life-RPG как продукт.md` (в Obsidian) | большой продуктовый разбор/видение Альберта |

## Текущее состояние (построено)
Полная система задач/квестов/привычек/целей/календаря · сферы N-уровней + импорт-калибровка · XP/уровни/ранги/атрибуты/радар · энергия · награды/сундуки/звуки · PWA+пуши · ИИ-слой · **Assistant v187 + Goals v185 + Secretary/Recovery v197 + Browser Companion v215 + Interface Hierarchy v203 + Tree v4/Guide v205 + Economy Art v208 + Actionable Foundations UI v216** · компаньон/питомцы/Логово · аккаунты, бэкапы и data-integrity fences.

**Actionable Foundations UI v216:** новый аккаунт начинает `FirstValueV1` при регистрации,
а опросник материализует настоящий план и первый шаг внутри того же пути. Старые аккаунты
с отсутствующим `first-value.json` автоматически не enroll-ятся. `GuideV3` остаётся
контекстным обучением функциям и не является источником first-value решения. Память Тени
управляется в `Настройки → Связи`, telemetry consent — в `Настройки → Данные и
приватность`; governance не загружается в браузер. Подробнее:
[`ACTIONABLE-FOUNDATIONS-UI-V216.md`](./ACTIONABLE-FOUNDATIONS-UI-V216.md).

**Secretary/Recovery v197:** «Схватки», «Нагрузка дня», Founder Pass, отдельные anti-habits/progress/notes panels больше не конкурируют на Today. Данные сохранены и доступны в своих владельцах; ассистент выбирает один support flow. PWA всё ещё не является OS blocker: desktop extension/companion — R3, Android/iOS — R4/R5. QA/handoff: [`SECRETARY-RECOVERY-V197-QA.md`](./SECRETARY-RECOVERY-V197-QA.md).

**Browser Companion v199:** первый локальный R3a-контур для Brave/Chromium: точный сайт → цель → ограниченное окно → boundary; adaptive даёт одно продление, Control — только ограниченный emergency flow. История/цели остаются локально; Satoru видит только bounded status. Это не контролирует нативные приложения, другие браузеры или приставку и может быть отключено пользователем. QA/handoff: [`BROWSER-COMPANION-V199-QA.md`](./BROWSER-COMPANION-V199-QA.md); полная последовательность следующих решений: [`SECRETARY-OS-PAIN-MAP.md`](./SECRETARY-OS-PAIN-MAP.md).

**Browser Companion Discovery v200:** опубликован в production внутри `82fcd74`. Существующий пользователь видит временное объявление на Today с `установить / через 3 дня / больше не напоминать`; новый — только после 24 часов и следующего активного входа. Есть отдельная открытая install-page, трёхшаговый modal, dedicated icon/badge и готовый Chrome Web Store upload package. Реальная установка в один клик появится только после публикации владельцем в store. QA/handoff: [`BROWSER-COMPANION-DISCOVERY-V200-QA.md`](./BROWSER-COMPANION-DISCOVERY-V200-QA.md).

**Browser Protection v210:** Satoru Attention v0.4.0 сам восстанавливает stale options tab после reload unpacked MV3 runtime и держит heartbeat. Отдельный opt-in слой даёт категории, deny/allow, Recreation Time, SafeSearch, strict YouTube и локальную защиту от известных browser-visible обходов. Exact-site Attention остаётся exact-host; all-site permission запрашивается только при явном включении защиты. Это browser-level, не системный DNS/VPN. QA/handoff: [`BROWSER-PROTECTION-V210-QA.md`](./BROWSER-PROTECTION-V210-QA.md).

**Interface Hierarchy v203:** опубликован в production коммитом `82fcd74`; оба Railway-сервиса `success`, пять изменённых shell-файлов совпадают с production byte-for-byte. Header больше не занят постоянной полосой сфер; ядро дня, Shadow rail, Today/Calendar forms, Inspiration references и Board Wildcard используют одну понятную иерархию «выбор → параметры». Переключение ядра fail-closed и не показывает успех до durable task write. Движение конечное и optional, звук семантический, touch/keyboard/reduced-motion контракты сохранены. QA/handoff: [`INTERFACE-HIERARCHY-V203-QA.md`](./INTERFACE-HIERARCHY-V203-QA.md).

**Tree v4 / Guide v205:** реальный capability path стал стартовой поверхностью Tree: одна следующая веха с criterion/nextAction, durable self/import evidence и постоянный earned trace. Покупаемые perks вынесены в явно игровой слой и не изображают мастерство. Contextual Guide больше не ждёт очко бонусов: он открывает Path, подсвечивает сферу с ближайшей capability и не просит ложно подтверждать навык. Legacy-деревья получают additive schema migration; confirmed milestones append-only; AI-карта возвращает проверяемые 4–6 ступеней; crash diagnostics не включают личные proof/plan-поля. Research/spec/QA: [`SKILLTREE-MASTERNAK-RESEARCH.md`](./SKILLTREE-MASTERNAK-RESEARCH.md), [`TREE-V4-SPEC.md`](./TREE-V4-SPEC.md), [`TREE-V4-QA.md`](./TREE-V4-QA.md).

**Economy Art v208:** 48 достижений, 33 личные награды и 15 предметов арсенала используют прозрачные отрисованные PNG в стиле существующего сундука/Training Blade: объём, бумажная фактура, brass/navy/teal материалы и разные предметные силуэты. Старые SVG v206 больше не загружаются runtime; stable IDs сохранены, все 96 PNG входят в offline shell. Art/QA: [`ECONOMY-ART-V208-QA.md`](./ECONOMY-ART-V208-QA.md).

**Guide v3:** First Journey и contextual pack доступны на RU/EN/DE/UK/ES. Tree-глава обновлена до registry v3: `intro → выбор точной сферы → receipt на ближайшей реальной вехе`; слой Path обязателен, Game Bonuses не закрывают главу, claim не выполняется ради туториала. Exact copy releases: RU `1.4.0`, EN/DE/UK/ES `0.5.0`. Goals остаётся `deferred-questionnaire`.

Исторические релизы до v216 подробно восстановлены в `DEVLOG.md` и профильных QA-файлах.
Не использовать старые предупреждения о «незадокументированных коммитах» как текущую задачу:
сначала сверять верх журнала и `git log`.

## Исторические варианты

Прежний список сохранён в [архиве](./docs/archive/START-HERE-LEGACY-IDEAS.md).
Это не актуальная очередь и не подтверждение отсутствия функций; текущие статусы — в BACKLOG.

## Что дальше → верх BACKLOG.md + LAUNCH.md

Не поддерживать здесь вторую копию очереди. На 2026-09-06 ближайшие открытые границы
v216: юридическое решение по opt-out в ЕС, engine-event для замены stale primary action и
producer-ы структурной памяти. Остальные приоритеты брать с верха `BACKLOG.md` после
сверки с последними записями `DEVLOG.md`.

## Как работать

Текущий обязательный контракт — [`AGENTS-PROTOCOL.md`](./AGENTS-PROTOCOL.md). В частности:
fetch и проверка дерева до правок; scoped ownership; `apply_patch`; тесты; бамп PWA cache
при shell-изменениях; DEVLOG/BACKLOG; затем commit, push и проверка deploy по умолчанию.

### Шаблон старта пачки (в новом чате)
> «Прочитай AGENTS.md, START-HERE.md и актуальные BACKLOG/DEVLOG. Выполни: … Проверки по риску, тестовые данные изолированно, документация и публикация по протоколу.»
