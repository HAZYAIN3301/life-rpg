# START HERE — холодный старт для нового чата/LLM

> Вход для агента — [AGENTS.md](./AGENTS.md). Здесь состояние и карта контекста;
> действующий процесс — AGENTS-PROTOCOL.md. Читай профильные документы по задаче.

**Текущий запрос 08–09.09: первый срез мультиплеера v249 + критический продуктовый аудит.**
[PARTY-DUO-V249.md](./PARTY-DUO-V249.md) — локально построенные совместные сессии
двух участников существующей пати: свой task, отдельно раскрытая подпись, согласие,
готовность, общий интервал, личный сохранённый итог. UI в Племени/Сегодня, no new nav.
Новая сессия не начисляет валюту. Старые raid target/claim ещё НЕ исправлены.
[PRODUCT-CRITICAL-PATH-2026-09.md](./PRODUCT-CRITICAL-PATH-2026-09.md) — приоритеты,
реальные основания/пробелы по Тени, привычкам, Вдохновению, дереву, расширению,
гайду, экономике и канону. [CLAUDE-OPUS5-NEXT-WORK.md](./CLAUDE-OPUS5-NEXT-WORK.md) —
4 самостоятельных handoff-пакета Opus 5; они подготовлены, но агентам ещё не отправлены.
UI receipt: art-factory/party-duo-v249/receipt.json. Release/полные tests — верх DEVLOG.
Master push/Railway не выполнены: в этом ходе задан вопрос о точном разрешении,
ответ пока не получен. Не обходить прежний permission gate.

**Исследовательская основа 08.09:**
[MULTIPLAYER-RESEARCH-2026-09.md](./MULTIPLAYER-RESEARCH-2026-09.md) — рынок,
исходные идеи/CD5, проверка текущего party runtime, конкретный поток дуо/экспедиции,
порядок разработки и пять исходных решений. Владелец затем разрешил начать; реализованный
первый scope уточнён в PARTY-DUO-V249.md. Остальные предложения не стали автоматически
утверждённым rollout. Эксперимент не запускался. Не возобновлять аватар автоматически. Риски:
цель рейда растёт с каждым членом, включая неактивного/неразрешившего вклад;
серверный claim и клиентская запись награды разделены; XP-буст рейда не найден в itemXp.
Сбои старой выдачи в реальном аккаунте не воспроизводились. Fault tests нового дуо — отдельно.

Отложенный аватарный трек: [AVATAR-HYBRID-V5.md](./AVATAR-HYBRID-V5.md).
Текущий checkpoint v6: `traveller.html` — цельная объёмная реконструкция рядом
с исходным Traveller в том же логове; 19 костей, общая анимация/два кроя пальто,
front-projected исходная фактура. 26 unit / 8 browser scenario groups.
Владелец оценил v5 «лучше», но стиль и анатомию НЕ принял. V6 тоже ждёт просмотра.
Профиль/затылок/складки/кисть ещё условны; это не готовый production-персонаж.
V6 [опубликован в закрытом стенде](https://satoru-avatar-wardrobe-lab-sept8.albertprokopets3301.chatgpt.site/traveller),
Site version 5, 08.09 19:45 UTC, live IAB проверен; receipt в `qa-traveller-v6`. Main push в master всё ещё
требует точного согласия по прежнему отказу среды. Обходить этот отказ нельзя.
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
- Новый runtime — **структурный v247 + продуктовая полировка v248**, PWA cache `satoru-v248`,
  app/style pin `20260908-design-v248-1`, `public/design-next-v1.css`.
  v248 опубликован: runtime `588fec8`, Railway success; 11 production SHA-256,
  guest/auth и неизменный архив проверены. Свидетельство — production-receipt.json
  в `art-factory/product-polish-20260908/`; последующий docs-only commit не меняет runtime.
  Контракт и границы QA — `PRODUCT-UX-AUDIT-V248.md`.
  Прежний runtime v244 сохранён из `74a97dd` в `/compare.html` (synthetic, read-only).
  Actionable Foundations UI и Commitment v2 не заменены новой моделью хранения.
- Полная проверка v248: **1935/1935 PASS**; UI/edge/composition/save receipts отдельно в аудите.
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
