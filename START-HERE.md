# START HERE — холодный старт для нового чата/LLM

> Читай этот файл первым. Он даёт весь контекст, чтобы продолжить работу с нуля (для экономии токенов — начинай новый чат и кидай сюда). Детали — в связанных доках ниже.

## Актуальный handoff — 2026-09-06

- Production HEAD: `301299d` (`Commitment v2 UI`), PWA cache `satoru-v244`, app/style pin
  `20260906-attention-commitment-v244-1`. Actionable Foundations UI вошёл предыдущим
  runtime-коммитом `8f2c510`; его модули сохраняют собственный immutable v216 pin.
- Полная проверка после сведения обоих слоёв: **1920/1920 PASS**. Перед следующей правкой начать с
  `git fetch`, `git status --short --branch` и `git log -5 --oneline`; точный процесс —
  [`AGENTS-PROTOCOL.md`](./AGENTS-PROTOCOL.md).
- Последние продуктовые швы: Attention теперь сохраняет одно локальное правило и связанную
  проекцию Commitment v2; перед ним выпущены первая доказанная ценность, видимая память
  Тени, telemetry consent и внутренний governance. Точный Actionable API, владельцы данных,
  event-hooks, ограничения и следующие шаги —
  [`ACTIONABLE-FOUNDATIONS-UI-V216.md`](./ACTIONABLE-FOUNDATIONS-UI-V216.md).
- Источник факта «сделано» — верх `DEVLOG.md`; источник факта «осталось» — верх
  `BACKLOG.md`. `ROADMAP.md` задаёт принципы и долгий горизонт. `STATUS-AND-PLAN.md` и
  `WORKFLOW.md` — исторические снимки июля, не текущая очередь.
- Старый `ACTIONABLE-GAMIFICATION-CLAUDE-HANDOFF.md` закрыт и оставлен только как история
  распределения. Нельзя строить по его API: четыре модуля уже интегрированы.

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
- **Рендер:** один объект `State`; `render()` → `VIEWS[State.view]()` в `#main`. Делегирование событий на `document`: `onClick`/`onSubmit`/`onChange`/`onSettingsInput`. `Store.save(name,obj)` → PUT `/api/data/<name>` (дебаунс 250мс; `Store._put` — немедленно). В `render()` есть **error-boundary** (сбой раздела не белит экран + авто-репорт).
- **Навигация:** реестр `SECTIONS` + `renderNav()` + `sectionOf()` + `navUnlockLevel()` (2 уровня: разделы + саб-табы). На телефоне (`<=600px`) — пять первичных пунктов **Сегодня / План / Привычки / Герой / Ещё**; вторичные функции собраны в bottom sheet. Гейт-уровни (Герой/Племя с ур.3). `NEW_VIEWS` + `settings.discovered` = glow-подсветка новых разделов.
- **Авторизация:** email+пароль (scrypt) ИЛИ legacy профиль+PIN; код восстановления; сессия = HMAC-cookie. `DATA_DIR=/app/data` на **персистентном томе Railway** (подтверждён — данные не теряются).
- **Деплой:** по умолчанию законченная задача включает scoped commit → push в
  `origin/master` → проверку Railway/production. Не добавлять вымышленное co-authoring.

## ⚠️ Критичные грабли (проверено на практике)
1. **Nav/FAB дублированы** в `index.html` И в `APP_SHELL`-const внутри app.js — править ОБА.
2. **Кириллический `\b`** в JS-regex работает только для ASCII → молча не матчит русские слова. **Никогда `\b` перед кириллицей** (укусило дважды: энергия, трейты питомцев). См. память `project_satoru-cyrillic-wordboundary`.
3. **Превью:** после правок `app.js` — перезагрузить страницу (свежий app.js); после `server.js` — `preview_stop`→`preview_start`. Скриншот-тул иногда отдаёт узкую чёрную полосу — верифицируй через DOM/eval.
4. **Чистить тестовых юзеров** после тестов в превью: фильтровать `data/users.json` до `albert` + удалять `data/users/<test>` (иначе засоряют пикер/данные).
5. **`Store.save` дебаунсится** → в тестах гонки (читаешь с сервера раньше, чем долетел PUT). Жди или используй `_put`.
6. `git index.lock` иногда залипает — `rm -f .git/index.lock` и повтор.
7. **Codex (ChatGPT desktop-app, тот же Mac) часто работает параллельно и автономно** над этим же репо — арт/аватар/Логово/иконки, коммитит напрямую под git-именем Альберта. Он НЕ читает DEVLOG/BACKLOG после себя (проверено 30.07 — два его коммита там не задокументированы). Перед правкой `app.js`/`styles.css`: `git log --oneline -5` (не тот HEAD, что ты помнишь?) и `git status --short`; если Codex прямо сейчас пишет в эти же файлы (свежий mtime `~/.codex/sessions/*/*/*.jsonl` от `find ~/.codex/sessions -name "*.jsonl" -mmin -2`) — либо подожди, либо будь готов сверять через `git diff` перед коммитом, а не слепо перезаписывать. **Никогда `git add -A`** — только явные пути своих файлов, иначе в коммит улетит его незавершённая работа.
8. **`public/sw.js` → `const CACHE = 'satoru-vNN'`** бампать при каждой правке `app.js`/`index.html`/`styles.css`, которая должна дойти до уже открытых вкладок — иначе старый service worker отдаёт закэшированную версию.

## Карта документации (что где)
| Док | Назначение |
|---|---|
| **START-HERE.md** | этот файл — холодный старт |
| **AGENTS-PROTOCOL.md** | обязательный процесс для любого агента: sync, ownership, тесты, docs, push/deploy |
| **WORKFLOW.md** | историческая памятка Claude июля; не задаёт текущую модель или очередь |
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
| **STYLE-DECISION.md** | финал арт-стиля + выбор рантайма (SVG vs Rive) |
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

## Недоделанные варианты существующих фич (vX готово → vX+1 ждёт)
- Компаньон v3 ✅ → **режим траура/восстановления** (чувствительно, с Альбертом).
- Питомцы v2 ✅ → v3: морф-формы по доминантной подсфере, имена-эволюция.
- Снаряжение v2 ✅ → **гир видимо НА аватаре** (сейчас абстрактные %).
- Рескин Системы v2 ✅ → голос-войс, циан-скин модалок/рулетки.
- Логово v1 ✅ → **декор комнаты из сундуков, поза аватара по энергии, КБЖУ→телосложение, эмбиент-звук**.
- Авто-пуши v1 ✅ → триггеры «пати ждёт вклад» / «тебя обогнали».
- Виджеты — частично (пуши есть; нативный виджет отложен).

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
> «Контекст в START-HERE.md (+ BACKLOG/DEVLOG). За этот заход: 1) … 2) … 3) … Тестируй в превью, чисти тест-юзеров, обновляй DEVLOG/BACKLOG, коммить+пуш.»
