# Life-RPG — DEVLOG (журнал сборки)

> Технический журнал. Каждая запись = что построено, где, как устроено, как продолжить. Цель: любой следующий разработчик (или LLM без памяти) может продолжить с нуля. План/гейты — в [`ROADMAP.md`](./ROADMAP.md). Продуктовый разбор — `wiki/topics/Life-RPG как продукт` в Obsidian.

## Стек и где что лежит
- **Бэкенд:** `server.js` — Node stdlib HTTP, без зависимостей. Порт 4317. Запуск: `npm start` (или preview-конфиг `.claude/launch.json` имя `life-rpg`).
- **Фронт:** `public/app.js` (вся логика, ~1300 строк), `public/styles.css`, `public/index.html` (только `#app` + подключение).
- **Данные:** `data/users.json` (реестр) + `data/users/<id>/*.json` (по файлу на тип) + `data/secret.json` (HMAC-ключ) + `data/users/<id>/lootbox.json` (новый).
- **Архитектура фронта:** единый `State`, `render()` диспатчит по `State.view`; делегирование событий через `onClick`/`onSubmit` на `document`; данные грузятся в `initApp()`, сохраняются дебаунсом через `Store.save(name, obj)` → `PUT /api/data/<name>`.

---

## Сессия 2026-06-05 → 06 — допил шаблона + фундамент монетизации

Построено и **протестировано в превью** (без ошибок в консоли). Модель: Opus.

### 1. Ранги и мастерство (`app.js`)
- `RANKS[]` — 7 рангов (Новичок→Ученик→Адепт→Эксперт→Мастер→Грандмастер→Легенда), у каждого `min` (уровень), `color`, `icon`.
- `rankFor(level)`, `rankProgress(level)` (прогресс внутри ранга + сколько до следующего), `skillRank(id)`, `charRank()`.
- Показ: ранг персонажа в шапке (`renderHeader`, `.up-rank`), ранги по сферам в Статистике (`.rank-row` с мастер-баром), тултипы навыков.

### 2. Индекс баланса (философия десятиборья)
- `balanceIndex()` → `{ index 0..100, active, total, weakest, strongest }`. Формула: `evenness*70 + coverage*30`, где evenness = 1−коэф.вариации XP активных сфер, coverage = доля активных сфер. Возвращает самую отстающую сферу для подсказки.
- Показ: KPI + большая карточка `.balance-card` в Статистике с объяснением и советом куда направить внимание.

### 3. Лутбоксы / сундуки (`app.js` + `lootbox.json`)
- Данные: `State.lootbox = { day, opened, goldWon, boost:{pct,until}|null, titles:[], equipped, history:[] }`. Грузится в initApp, `ensureLootbox()` сбрасывает `opened` при смене дня.
- Заработок: `todayActivityCount()` (выполненные квесты+привычки сегодня). Пороги `LOOT_THRESHOLDS=[1,3,5]`. `lootChestsAvailable()` = min(заслужено, `lootTierCap()`) − opened. **Free cap=1/день, Pro cap=3/день.**
- Дроп: `LOOT_POOL` (взвешенный) → `rollLoot()` → `lootResolve()` (материализует gold/boost/title) → `applyLoot()` (gold→`goldWon`, boost→активный множитель, title→коллекция). Титулы из `TITLES[]`, экипируются (`equipped`), показываются в шапке.
- Экономика: `goldEarned()` теперь добавляет `lootbox.goldWon`; `itemXp()` множит на `(1 + lootBoostPct()/100)` если активен буст.
- UI: `lootboxCard()` (в начале вида «Награды»), `openChest()` — рулетка-модалка (42 элемента, CSS transition 3.6s, центр-поинтер, результат+«Забрать»). Стили `.lootbox-card`, `.loot-window/track/item`, `.modal-overlay`.

### 4. Pro-подписка + 7-дневный триал
- **Сервер (`server.js`):** на user-объекте `plan:'free'|'pro'`, `trialStartedAt`, `proUntil`. `entitlement(user)` → `{ tier:'free'|'trial'|'pro', ... }` (триал = 7 дней от trialStartedAt; pro с proUntil=null = бессрочно). `publicUser(user)` отдаёт `{id,name,avatar,isAdmin,entitlement}` — теперь во всех ответах `/me`, `/login`, `/register`.
- **Эндпоинты:** `POST /api/auth/start-trial` (1 раз/аккаунт), `POST /api/auth/grant-pro` (admin, body `{userId,days?}`), `POST /api/auth/revoke-pro` (admin), `POST /api/auth/upgrade` (заглушка — реальная оплата позже).
- **Клиент:** `ent()`, `isPro()`, `trialDaysLeft()`. Бейдж в шапке `.plan-badge` (pro/trial/free-кнопка-апселл). В Настройках: `subscriptionCard()` (тариф+фичи+CTA), `securityCard()` (смена PIN), `adminCard()` (выдать Pro, только admin). `showPaywall(feature)` — модалка `#paywall`. Pro-гейт в Статистике: «Время по сферам» показывается заблюренным с веером `.locked-card`/`.lock-veil` для free.
- **Что Pro гейтит сейчас:** расширенная аналитика, 3 сундука/день. Готово к расширению (живой персонаж, ИИ, темы — когда построим).

### Фикс по пути
- Auth POST с пустым телом отдавал `400 bad json` → ломал `start-trial`/`logout`/`upgrade`. Исправлено: пустое тело → `body={}` (см. `if (raw) { ... }`). Побочно починён logout (теперь реально чистит cookie, был 400).

### Очистка тестовых данных
Тестировал на реальном профиле `albert`. После тестов: убран тестовый квест из `tasks.json`, обнулён `lootbox.json`, в `users.json` albert выставлен **постоянный Pro** (`plan:'pro', proUntil:null`) как владельцу, `trialStartedAt:null` (триал сохранён неиспользованным). PIN albert по-прежнему `1234` — **сменить**.

---

## Сессия 2026-06-06 (продолжение той же ночи) — живой персонаж + гайд + фидбек

Построено и протестировано (8 видов рендерятся, 0 ошибок консоли).

### 5. Живой персонаж — новый вид «Персонаж» (идея 3, киллер-фича)
- **Атрибуты:** `ATTRIBUTES[]` (Сила/Выносливость/Интеллект/Дух/Харизма/Дисциплина). Каждая сфера имеет поле `attr`; если нет — `guessAttr(name)` угадывает по ключевым словам. `ensureSkillAttrs()` мигрирует в initApp. `attrScore(id)` = сумма уровней сфер этого атрибута. В Настройках у каждой сферы появился селект атрибута (сохраняется в `saveSettingsFromForm`).
- **Архетип:** `archetype()` — класс по топ-2 атрибутам (напр. dis+int = «Стратег»), таблица MAP + одиночные.
- **Радар:** `radarSVG(scores)` — гексагональный чарт билда (3 кольца сетки, оси, иконки, полигон данных).
- **Телосложение:** `figureSVG()` — схематичный человечек, плечи растут от Силы, талия от ИМТ, «подсушивает» Выносливость; аура цвета ранга, размер от уровня. `bodyBMI()` из `settings.body{height,weight,bodyfat}`. Форма `#body-form` (bodyfat — Pro-гейт). Аватар в шапке-герое с conic-ring прогресса XP (`--p`).
- `renderCharacter()`, добавлен в nav (**и в `index.html`, и в APP_SHELL** — nav продублирован, не забыть оба места!) + VIEWS. `State.settings.body` дефолт в initApp.

### 6. Гайд «Как играть» + первый запуск
- `GUIDE_SECTIONS[]` (8 разделов), `showGuide()` — модалка с разделами + форма фидбека. Кнопка «?» в шапке (`.help-btn`, `data-action=show-guide`). Первый запуск: `localStorage 'liferpg_seen_guide'` → авто-показ один раз.

### 7. Обратная связь (баги/идеи от друзей)
- Сервер: `POST /api/feedback` (нужна сессия) → аппендит `{at,userId,kind,text}` в `data/feedback.json`. Читать фидбек: просто открыть этот файл.
- Клиент: форма `#feedback-form` внутри гайда (тип: баг/идея/другое + текст).

### Очистка после тестов (сессия 2)
Сброшены: `data/feedback.json`→`[]`, albert `settings.body`→`{}` (плейсхолдер 180/75/15 убран). Сохранены авто-назначенные `attr` у сфер albert (Учёба=int, Здоровье=spr и т.д. — он может поправить в Настройках).

### 8. Полировка + важный фикс дат
- **Рекорд серии** `longestStreak()` (чистая функция из xpEvents, никогда не сбрасывается — безопасный срез анти-Duolingo идеи 28). Показан в шапке (тултип) и KPI Статистики «Серия · рекорд N».
- **Нудж на «Сегодня»**: если есть сундук или активен XP-буст — карточка-подсказка (`.nudge-card`, action `goto-rewards`).
- **🐞 ФИКС TIMEZONE (важно):** `dayOf()` брал дату из UTC-среза `completedAt.slice(0,10)`, а `todayStr()` — локальная. У пользователей не на UTC (и около полуночи) выполненные задачи датировались не тем днём → ломались серии, статистика и счётчик активности для сундуков. Исправлено: `dayOf()` и дата целей в `xpEvents()` теперь через `fmtDate(new Date(completedAt))` (локальная дата). Консистентно с `todayStr()` и `habitlog`.

### ⚠️ Грабли этой сессии
- Nav продублирован: в `public/index.html` (основной) И в `APP_SHELL` (фолбэк после auth-экранов). **При добавлении вкладки править оба.**
- После правок `server.js` (фидбек-эндпоинт) нужен рестарт превью (stop→start).

---

## Сессия 2026-06-06 (день) — мобайл + Хайп + программы + лидерборд + фикс логина

Модель: Sonnet/Opus. Всё построено и **протестировано в живом браузере** (preview MCP, desktop+mobile, 0 ошибок консоли). Деплой одним финальным push.

### 0. 🐞 Критфикс: вход был сломан в проде
- PIN-форма `#pin-form` лежит внутри `.profile-card[data-action="select-profile"]`. Любой клик в форме всплывал к карточке → `renderLoginScreen()` → форма пересоздавалась и схлопывалась. Войти было физически невозможно.
- Фикс: `if (e.target.closest('#pin-form')) return;` в обработчике `select-profile`. Одна строка. (commit 01a3768)
- **Урок:** «протестировано в превью» в прошлой сессии не покрыло auth-флоу в живом DOM. Теперь весь auth-флоу прогнан кликами.

### 1. 📱 Мобильная/адаптивная версия (`styles.css` + `app.js`)
- `@media (max-width:720px)`: nav становится горизонтально-скроллящейся лентой (устойчиво к любому числу вкладок), `margin: 14px -18px 0` (на ≤560 → `-12px` под padding #app), скрыт скроллбар, scroll-snap. Активный таб авто-центрируется (`scrollIntoView` в `render()`).
- `@media (max-width:560px)`: инпуты 16px (фикс iOS zoom-on-focus), крупнее тач-таргеты, компактные hero/модалки, `.rank-row` → 4 колонки (скрыты lvl+next), `.lb-row` без колонки уровня.
- **🐞 grid-blowout:** grid/flex-дети форм имеют `min-width:auto` → не дают колонкам сжиматься → 20px горизонтального скролла. Фикс: `.add-row>*,.goal-form>*,… { min-width:0 }`.
- Проверено: 0 overflow на 375/673/1100px, все 9 видов; десктоп без регрессий.

### 2. 🔥 Хайп — XP-бафф за сложные квесты (идея 26)
- Выполнил «Сложный» квест → `activateHype()`: стак +15% XP (×1→×3, до +45%), таймер 2ч, продлевается каждым hard-квестом. Хранится в `lootbox.hype` (уже персист).
- `hypeState/hypePct/hypeMinLeft/activateHype`; множитель в `itemXp()` рядом с `lootBoostPct`. Триггер в `toggle-task` ПОСЛЕ расчёта xpAwarded (буст для будущих, не самобуст).
- Показ: пульс-чип `.hype-chip` в шапке + строка в нудже «Сегодня» + тост. Раздел в гайде.
- Проверено: активация, эскалация ×2 (+30%), буст XP 50→57.

### 3. 📦 Программы-данжи (идея 25)
- `DUNGEON_PROGRAMS[]` — 6 пресетов (Спортсмен/Студент/Креатор/Дзен/Профи/Кодер): сферы + привычки + стартовые квесты.
- `programSkillMap` (дедуп сфер по имени) + `programHabits` + `programTasks`. Два пути: `applyProgramFresh` (онбординг — пишет файлы напрямую `await Store._put` чтобы initApp загрузил без гонки) и `applyProgramMerge` (в приложении — домерж к существующему).
- Показ: «Быстрый старт» в онбординге + карточка в Настройках (`programCard`, `.prog-grid/.prog-card`).
- Проверено (merge): дедуп Учёба, +Чтение, +3 привычки, +2 квеста.

### 4. 🏆 Лидерборд (`server.js` + клиент)
- **Сервер:** `POST /api/leaderboard/publish` (снапшот `{totalXp,level,rank}` в `user.pub`, + `leaderboardOptOut`) и `GET /api/leaderboard` (сортировка по XP, фильтр opt-out, поле `me`). **Приватные данные не уходят** — на сервере только агрегат.
- **Клиент:** вид `renderLeaderboard()` (медали топ-3, подсветка «ты»), `publishLeaderboard()` в `initApp` + после каждого выполнения, галочка opt-out (`toggle-lb-optout`). Refetch при входе в таб (`State.leaderboard=null` в nav-клике).
- Проверено: публикация, рейтинг, opt-out скрывает/возвращает, мобайл без overflow.

### ⚠️ Грабли этой сессии
- **Nav продублирован** (index.html + APP_SHELL) — «Рейтинг» добавлен в ОБА. Не забывать при новых вкладках.
- После правок `server.js` — **stop→start превью** (node не watch). `preview_start` сам не перезапускает.
- Тестировал на профиле `albert` → XP/квесты/Хайп/Чтение налипли. Очищено фильтром по `createdAt` (всё за 2026-06-06 удалено), `pub`/`leaderboardOptOut` сняты с users.json, lootbox сброшен. Профиль = pristine (level 1, 6 сфер, 3 квеста, 3 привычки), Pro сохранён.

---

## Сессия 2026-06-06 (вечер) — ребренд Gojo + импорт достижений

Модель: Opus/Sonnet. Прогнано в живом браузере (desktop+mobile, 0 ошибок).

### 1. 🏷 Ребренд Life-RPG → Gojo
- `perl -pi -e 's/Life-RPG/Gojo/g'` по index.html, app.js, manifest.webmanifest, server.js. Логотип ⚔️ сохранён (не аниме). Albert settings.appName → Gojo.
- **Юр.:** для публичного бренда — проверка EUIPO/DPMA. Коллизии: **GoJoe** (wellness-приложение, та же ниша!), **GOJO Industries** (Purell, зарег. марка, есть софт). Аниме-имя само по себе низкий риск, но НИКОГДА не использовать облик персонажа JJK. Для альфы — ок.

### 2. 🎖 Импорт достижений (стартовый уровень) — фундаментальная фича онбординга
Полный разбор дизайна — в `ROADMAP.md` → «Дизайн-решение: Импорт достижений». Суть: честная самооценка по коарс-лестницам, не точная математика.
- **Данные:** `IMPORT_LADDERS` (бег, силовые=отн.веса, единоборства=пояса, велосипед, плавание, английский/язык=CEFR, учёба=ступени, программирование=грейды, музыка, чтение) + `GENERIC_LADDER`. `ladderFor(name)` матчит по ключевому слову в имени сферы. `tierLevels(ladder)` → целевой уровень на тир (tier 0 = ур.1).
- **Кривая:** `xpForLevel(L, base, growth)` = Σ needForLevel — инверсия уровня в XP.
- **Интеграция:** `settings.imported{skillId:{tier,xp,label,at}}`. `importedXp(id)` + `totalImportedXp()` входят в `skillXp`/`overallXp`. Новая `earnedXp()` = только заработанное (для будущей честности лидерборда).
- **UI:** `importCard()` в Настройках (select тиров на сферу), `applyImport(skillId,tier)`. Делегированный **`onChange`-хендлер** (новый, для select-ов вне форм; зарегистрирован в init рядом с click/submit) → `data-action="set-import"`. Today-нудж новичку (`goto-import`, условие: нет импорта и `earnedXp()<200`).
- **Философия:** импорт = «доказанное мастерство», НЕ сгорает. Атрофия (слой «Форма») — Фаза 2 (см. ROADMAP).
- Проверено: Учёба→Бакалавриат (ур.11), Здоровье→Продвинутый (ур.12), char-level→12, персист в settings.json, мобайл 0-overflow.

### ⚠️ Грабли
- Для select-ов вне `<form>` нужен **отдельный `change`-листенер** (click/submit не ловят). Добавлен `onChange` + `document.addEventListener('change', onChange)`.
- Тест-импорты Albert (study/health) — почистить в финале (как и раньше, по дате/ключам).

---

## Сессия 2026-06-06 (ночь) — аватар-редактор + слой «Форма»

Модель: Opus. Прогнано в живом браузере со скриншотами (desktop+mobile, 0 ошибок).

### 1. 🪞 Кастомизируемый аватар (замена «палочек»)
- `avatarSVG(cfg)` — послойный flat-vector SVG (viewBox 240×240): причёска(`avHair`, 7 стилей)/цвет волос/лицо(3 эллипса)/кожа(6 тонов)/глаза(4)/брови(3)/рот(4)/борода(3)/очки(3)/одежда(7 цветов). `shade(hex,amt)` для теней. `AV_*` палитры, `AV_PARTS` мета, `defaultAvatar/avCfg`.
- Редактор `avatarEditor()` в виде «Персонаж»: круглое превью + чипы категорий (`av-cat`) + сетка опций с **живыми мини-превью** (`avatarSVG` с переопределением одной части), для цветов — свотчи. `State.aveCat`, хендлер `av-set` → `settings.avatar`.
- Hero `.ch-avatar` теперь рендерит `avatarSVG` (внутри XP-кольца, `overflow:hidden`), эмодзи-аватар убран оттуда (но остался в шапке-пилюле/лидерборде/профилях как быстрый идентификатор).
- **Под арт художника:** каждая часть — отдельный генератор/индекс, новые варианты добавляются без переписывания (Pro-косметика позже).

### 2. 📊 Слой «Форма / Momentum» (импорт v2, часть 1)
- Решает «уровни падают» по-доброму: уровень (Proven) не сгорает; **Форма** — отдельный recency-показатель. `skillForm(id)`: 100% при активности ≤3 дн → линейно до пола 25% за 21 день → легко возвращается. `overallForm`, `formMeta` (в форме/тонусе/расслабленно/подзаржавел). `skillLastActive/daysSinceDate`.
- Показ: бар `.ch-form` в hero «Персонаж» + раздел гайда «Уровень vs Форма».
- Полный дизайн (расщепление Proven/Form, агрегация, честность лидерборда) — в `ROADMAP.md`.

### ⚠️ Грабли / заметки
- Аватар-геометрию проверял скриншотами (вслепую пути рисовать рискованно) — все 7 причёсок + слои ок с первого прохода.
- Тест-данные Albert (avatar.hair, __formtest__ квест) — почищены по `createdAt`/сбросом `avatar`.

---

## Сессия 2026-06-06 (ночь, ч.2) — импорт v2.2: иерархия сфер

Модель: Opus. Прогнано вживую (агрегация, группировка, round-trip, мобайл, 0 ошибок).

- **Модель:** под-навыки через `parentId` (строго 2 уровня: столб → под-навык). Хелперы: `childSkills/isPillar/topSkills/leafSkills/skillLabel/skillOptionsHTML`.
- **XP-агрегация:** `ownSkillXp(id)` (события+импорт ровно по id) и `skillXp(id)` = own + Σ под-навыков. Столб без прямых событий показывает сумму детей.
- **Без двойного счёта:** `attrScore`/`overallForm` — по `leafSkills()`; `balanceIndex` — по `topSkills()` (крупные сферы); шапка — `topSkills()`.
- **UI:** шапка = верхний уровень (столб помечен ▾, ур.= агрегат); Статистика группирует (`.rank-row.sub` с ↳); редактор сфер получил `<select data-field="parentId">` (у столба — «— столб», нельзя дать родителя); импорт-карточка и дропдауны квест/привычка/цель — иерархические через `skillOptionsHTML` («Столб › Под»). Время-по-сферам (Pro) — по листьям.
- **Защита целостности:** при удалении столба дети всплывают (`parentId=null`); нормализация в `saveSettingsFromForm` убирает ссылки на несуществующих родителей и 3-й уровень.
- **CSS:** `.skill-edit` → flex-wrap (вместила доп. select); `.rank-row.sub/.import-row.sub` — отступ.
- Проверено: Здоровье▾ агрегирует Бег(ур.10 из импорта)+Зал; Выносливость=10 (только Бег, столб не задвоился); сохранение parentId round-trip; 0 overflow на всех видах.

---

## Сессия 2026-06-06 (ночь, ч.3) — визуальный редактор дерева навыков + гайд

Модель: Opus. Прогнано вживую (драг, добавл./удал., правка, связи, unlock, мобайл, 0 ошибок).

### 🌳 Редактор дерева навыков
- Позиции узлов: миграция `col/row` → свободные `x/y` (в `ensureTrees`, обратносовместимо). Константы `TREE_SX/SY/NW/NH`.
- Режим редактора: `State.treeEdit` (кнопка «✏️ Редактор»/«✓ Готово»), `State.treeSelNode`.
- **Перетаскивание:** делегированный `onTreePointerDown` на document (pointer events, тач-friendly через `touch-action:none`). Во время драга — прямое обновление `style.left/top` + `updateTreeLines()` (живая перерисовка SVG-связей) без полного render; на pointerup — `Store.save` + render. Различение клик/драг по порогу 3px (клик без движения → выбор узла).
- **Панель узла** `treeNodePanel`: поля `tree-field` (title/desc/cost/perkXpPct, через onChange), чекбоксы `tree-toggle-req` (пререквизиты → рисуют линии), `tree-add-node`, `tree-del-node` (чистит висящие requires).
- Обычный режим без изменений: `unlock-node`. В режиме редактора у узлов нет `data-action` (клики идут в pointer-логику).
- Хелперы: `treeNodeCenter/treeLinesHTML/treeBounds`. CSS: `.tree.edit`, `.tree-node.editing/.sel`, `.tree-panel/.tp-*`.

### 📖 Гайд
- Раздел «Навыки» описывает редактор (перетаскивай/добавляй/настраивай). «Что это» — про кастом-аватар и импорт.

### ⚠️ Заметки
- Драг сделан без библиотек (pointer events). Полный render во время драга НЕ дёргаем (ломал бы перетаскивание) — двигаем DOM напрямую, коммит в State на отпускании.
- Тест-правки дерева Albert сброшены: `skilltree.json` → `{}` (регенерит дефолтные деревья).

---

## Сессия 2026-06-06 (ночь, ч.4) — репорты с фото/видео + админ-вьюер

Цель Альберта: репортить баги самому, без траты токенов LLM; всё в одном месте.
- **Форма фидбека** (в гайде): тип/текст + `<input type=file accept=image/*,video/*  multiple>` + живое превью (`onChange` по `name=files`). Фото ужимаются на клиенте (`downscaleImage` через canvas, ≤1280px, JPEG q0.82) → лёгкие; видео ≤25 МБ как есть (`readAttachment`/`fileToDataURL`). Submit шлёт `attachments:[{name,type,dataUrl}]`, кнопка дизейблится на время.
- **Сервер:** `POST /api/feedback` принимает base64-вложения, декодит → `data/feedback/<id>_<i>.<ext>`, метаданные в `data/feedback.json` (`{id,at,userId,kind,text,attachments:[{file,type,name}]}`). `readBody(req, 30MB)` для этого роута. `FB_EXT` маппинг mime→ext, лимит 26МБ/файл, до 6 вложений.
- `GET /api/feedback` (админ) — список (новые сверху). `GET /api/feedback/file/<name>` (админ) — отдаёт файл (защита от `..`). MIME расширен (jpg/webp/gif/mp4/webm/mov).
- **Вьюер** `showReports()` (кнопка в гайде, только админ): модалка со всеми репортами, фото как `<img>`, видео как `<video controls>`.
- **Безопасность:** `.gitignore` += `data/feedback/` (личные фото/видео НЕ коммитятся).
- Проверено вживую: POST PNG → сохранение → GET файла (content-type image/png) → отрисовка во вьюере; форма имеет file-input + админ-кнопку; 0 ошибок.

---

## Сессия 2026-06-07 — разбор 30 репортов друзей-альфы

Репорты вытащены с прод-Railway через `POST /api/auth/login` (albert) + `GET /api/feedback` (админ). Полный триаж — в `ROADMAP.md` → «Триаж репортов».
- **🔴 Корневой баг (data-loss):** `add-skill/add-habit/delete-*` мутировали State и делали render() БЕЗ чтения текущих правок формы → несохранённые имена/родители стирались. Фикс: вынесен `captureSettingsForm()` (читает форму в State без save/render), вызывается в начале каждого структурного хендлера. `saveSettingsFromForm()` = capture + save + toast + render. Проверено: переименование сферы переживает add-skill и персистится.
- #14 удаление сферы каскадно чистит tasks/habits/goals/habitlog/tree/imported. #11 `skillById` fallback `name:'—'` (+`missing:true`). #10 step 1. #12 free-бейдж «🔓 Pro?». #7 подписи вложенности. #30 скролл+flash к карточке импорта (id `import-card`, `.flash-card`).
- Остальное (концепты: иерархия 3+ уровня, пресет-награды, недельный календарь, drag в расписании, ясность горизонтов/сложности, обоснование XP, ИИ-импорт, маскот-гайд, ачивки за репорты, нейминг) — занесено в триаж ROADMAP по приоритету.

---

## Сессия 2026-06-07 (ч.2) — иерархия сфер: сворачивание + реордер

- **Группировка** в редакторе сфер: `topSkills()` → строка столба + его `childSkills()` с отступом (`.is-sub`).
- **Сворачивание** столба: `skill-collapse` → `State.settingsCollapsed[id]`. Свёрнутые дети получают `.se-hidden` (display:none), но **остаются в DOM** — иначе `captureSettingsForm` их бы потерял при сохранении. (Ключевой нюанс.)
- **Реордер** `skill-move` (▲▼): свап позиций соседей одного уровня в `State.settings.skills` (топ-уровень между собой; под-навыки внутри родителя). `captureSettingsForm()` перед ре-рендером — общий паттерн против data-loss.
- Проверено: пиллар+2 ребёнка → свернуть → переставить топ-уровень → сохранить → все 6 сфер и дети целы; мобайл 0-overflow.
- Остаток (3+ уровня, мульти-родитель, drag-реордер) — в триаже ROADMAP.

## Сессия 2026-06-07 (ч.3) — недельный планировщик + ясность целей/сложности

### Ясность горизонтов целей (#4) + примеры сложности (#19)
- `GOAL_TYPES` расширен: добавлены поля `timeframe` и `hint` к каждому типу. Теперь в select-форме цели отображается `Краткосрочные · до 4 недель` и т.д.
- `renderGoals`: `typeGuide` — коллапсируемый `<details>` «ℹ️ Как выбрать тип цели?» с 4 строками (badge + timeframe + hint). CSS: `.gtype-guide / .gtype-row / .gtype-tf`.
- `renderToday` (форма квеста): опции difficulty теперь с emoji (`🌱/⚔️/🔥`); добавлен `.diff-hint` — однострочная справка с Хайп-напоминанием.

### Недельный планировщик Sunsama (#29) — renderWeekly redesign
- `habitsDueOn(dateStr)` — новый хелпер, возвращает активные привычки на конкретный день.
- `State.wkAddDate` — дата выбранного столбца для inline-формы добавления квеста.
- `renderWeekly` переписан: 7-колоночная сетка (Пн–Вс).
  - Каждый столбец: заголовок (день/дата/прогресс), список квестов с чекбоксами, точки привычек (✅/◌), кнопка «+ Квест».
  - Сегодня: синяя рамка + фон (`.is-today`). Прошедшие: opacity 0.68 (`.is-past`).
  - Прогресс `N/N` — зелёный при 100% (`.wk-prog.all-done`).
  - Квесты чекабельны прямо из недельного вида (`toggle-task`).
  - Точки привычек: цвет сферы, непрозрачные если выполнено.
  - Inline-форма добавления квеста: input+select+btn, `data-date` на форме → создаёт задачу на нужный день.
- CSS: `.wk-grid-wrap` (overflow-x:auto, min-width 900px), `.wk-col*`, `.wk-task*`, `.wk-h-dot`, `.wk-add-btn/.wk-add-form`.

## Сессия 2026-06-07 (ч.4) — GitHub Issues + feedback export

**Проблема:** Railway (ephemeral disk) — feedback живёт там, локально недоступен Claude Code.

### GitHub Issues auto-forward (`server.js`)
- `const https = require('https')` — добавлен в requires.
- `createGithubIssue(entry)` — новая async-функция перед HTTP-сервером. Берёт `GITHUB_TOKEN` и `GITHUB_REPO` (default: `HAZYAIN3301/life-rpg`) из env. Если токен не задан — молча пропускает (graceful degradation). POST на `api.github.com/repos/.../issues` с заголовком `[bug/idea/…] <первые 70 символов>`, меткой (`bug`/`enhancement`/`praise`/`feedback`), телом с userId+timestamp.
- Вызов в обработчике POST `/api/feedback`, после `fs.writeFileSync`: `createGithubIssue(list[list.length - 1]).catch(() => {})` — fire-and-forget.
- **Активация:** добавить в Railway Variables → `GITHUB_TOKEN` = PAT с `issues:write`. Опционально `GITHUB_REPO=owner/repo`.

### Feedback export endpoint (`server.js`)
- `GET /api/feedback/export` (только админ) — отдаёт весь `feedback.json` с заголовком `Content-Disposition: attachment; filename="gojo-feedback.json"`.

### Admin UI (`app.js`, `styles.css`)
- `showReports()`: заголовок перенесён в `.rep-toolbar` (flex, space-between) с двумя кнопками справа.
- **«📋 Скопировать для Claude»** (`data-action="copy-feedback-for-claude"`) — fetchит `/api/feedback`, форматирует все репорты в читаемый markdown (с заголовками, датами, userId, текстом, пометкой вложений), копирует в clipboard через `navigator.clipboard.writeText`. Подходит для вставки прямо в чат.
- **«📥 JSON»** — `<a href="/api/feedback/export" download>` — скачивает весь файл.
- В описании — подсказка про `GITHUB_TOKEN`.
- CSS: `.rep-toolbar`, `.rep-toolbar-btns`.

## Сессия 2026-06-07 (ч.5) — Bug #1: выдача Pro по имени вместо id

**Баг (Issue #1):** Grant Pro ломался для пользователей с кириллическим именем — их id генерируется как `user`, `user1` итд (regex `[^a-z0-9]` убирает всё нелатинское), но ввод был ручным текстовым полем.

**Фикс (app.js):**
- `State.adminUsers: null`, `State._adminUsersLoading: false` добавлены в State.
- `adminCard()`: при первом рендере запускает `fetch('/api/users')` → `State.adminUsers`. После загрузки — `render()`.
- Поле userId заменено на `<input list="admin-users-dl">` + `<datalist>` с опциями вида `⚡ Вася (user1)`. Браузер даёт нативный autocomplete/поиск по имени. Value поля = id пользователя.
- При навигации на Settings → `State.adminUsers = null` (свежий список каждый раз).
- Сервер не менялся — `grant-pro` принимает id как и раньше, datalist просто заполняет правильный id автоматически.
- onClick: `wk-add-task` (открыть форму), `wk-add-cancel` (отмена); week-prev/next сбрасывают `wkAddDate`.
- onSubmit: `wk-add-form` — создаёт task с `date=f.dataset.date`, `difficulty='normal'`, `estimateMin=30`.
- Разделы намерения/итогов/рефлексии сохранены внизу страницы.

## Сессия 2026-06-08 — кластер «планирование дня» (фидбек-разбор)

Разобран весь `gojo-feedback.json` (45 репортов, вкл. внешнего юзера violaphilmahar). Приоритет — планирование дня/недели.

### Время в формате час+минуты (`fb_mq4901w82icl`)
- `fmtDur(min)` — новый хелпер после `fmtClock`: `<60 → "Nм"`, иначе `"Hч Mм"` / `"Hч"`. Пример: 552 → «9ч 12м».
- Применён в `questRow` (план/факт время), `habitRow`, `.daystat` (Время N/N), итоге дня. Раньше показывались сырые минуты.

### Смена сферы у созданной задачи (`fb_mq492qrznopv` + `sk__` `fb_mq3hgzxi4c4n`)
- `questRow`: `.t-skill` span заменён на `<select class="t-skill-sel" data-action="reassign-skill">` со `skillOptionsHTML(t.skillId)`. Меняешь сферу прямо в строке задачи.
- Если сфера задачи отсутствует (удалена) → `sk.missing`, селект подсвечен `--warn` + плейсхолдер «— сфера —». Это закрывает и баг с сырым `sk__id` — теперь видно «нет сферы» и можно переназначить.
- Handler `reassign-skill` в `onChange`: `t.skillId = value; save; render`.
- CSS `.t-skill-sel` (чип-селект), `.missing` вариант. На мобиле скрыт как и `.t-skill`.

### Календарь дня: не удалять по клику + длительность (`fb_mq4yjhecezec` Виола)
- Раньше клик по блоку = `unschedule-quest` (удаление — неинтуитивно). Теперь блок не кликабелен целиком; в углу кнопка `✕ .cal-x` для снятия. Блок показывает `· {fmtDur}` длительности.
- Пикер постановки: добавлено поле `#cal-dur` (мин, step 5). `schedule-quest` пишет `t.estimateMin = dur`.
- `onChange`: смена квеста в `#cal-quest` подставляет его длительность в `#cal-dur`.
- CSS: `.cal-x`, `.cal-dur`, `.cal-b-text`, `.cal-hint`, flex-раскладка блока.

### Не актуально / уже сделано
- «время кратное 5» (`fb_mq3hjuo2l5bj`) — `estimateMin` уже `step="1"`.
- Календарь Sunsama (`fb_mq2v3vm5lwa5`) — недельный grid сделан в ч.3.

## Сессия 2026-06-08 (ч.2) — потеря данных + Хайп-редизайн + недельный DnD

Три крупных куска за присест. **Всё проверено вживую** в превью (чистый инстанс, кириллический юзер) — см. «Верификация» ниже.

### 🔴 Потеря данных в настройках (`fb_mq3g4uz3yxvg`, `fb_mq3gfiewux2s`, `fb_mq3gmyeabsuk`)
**Корень:** правки полей формы (имена сфер, привычки) жили только в DOM. `captureSettingsForm()` дочитывал DOM в `State` лишь на add/delete и по кнопке «Сохранить». F5 без кнопки → правки терялись.
**Фикс — 3 слоя (синхронные пути не зависят от таймеров):**
1. `autosaveSettings()` — дебаунс 500ms; срабатывает на `input`/`change` в `#skills-list / #habits-list / .knob / #set-appName`. Новый листенер `document.addEventListener('input', onSettingsInput)`.
2. `flushSettingsForm()` — синхронный capture+save; вызывается в обработчике навигации `if (navBtn)` при уходе с экрана.
3. `beforeunload` → `captureSettingsForm()` + `fetch(... , { keepalive: true })` напрямую на `/api/data/settings|habits` — переживает закрытие/перезагрузку, НЕ зависит от дебаунса (главная страховка от F5).
- Подпись формы исправлена: «сохраняются автоматически».

### Хайп — редизайн под «выбор желания» (`fb_mq3q6cw8kn4l`)
Раньше: Хайп активировался авто на ЛЮБОЙ сложной задаче. Теперь: при завершении **сложного** квеста — поп-ап `openDesirePicker()` «Насколько ты хотел это сделать?»:
- 😮‍💨 **Через силу** → `completeTask(t,'forced')` — грит-бонус `GRIT_BONUS=10%` к XP этой задачи, без статуса.
- 🙂 **Нормально** → обычный XP.
- ⚔️ **В кураже!** → `activateHype()` (+15%/стак, до ×3, 2ч) — награда за добровольный выбор трудного.
- Лёгкие/обычные квесты завершаются сразу (без трения). `t.desire` пишется в задачу.
- Новая `completeTask(t, desire)` (единая точка завершения), обработчики `desire-pick`/`desire-cancel`. CSS `.desire-box/.desire-btns/.desire-opt` (+ моб. вертикаль).

### Недельный вид — время по дням + перетаскивание (`fb_mq2v3vm5lwa5`, `fb_mq3hr5a3rebd`)
- Под каждым днём `⏱ {fmtDur(plannedMin)}` — сумма запланированного времени (планирование на временном scale).
- `.wk-task` теперь `draggable="true" data-task`; колонки `data-date`. HTML5 DnD: `onWkDragStart/onWkDragOver/onWkDrop/cleanupWkDrag` (document-level). Дроп на день → `t.date = date; save; render`. Подсветка цели `.wk-drop`.
- Подсказка `.wk-hint`. CSS: `cursor:grab`, `.wk-dragging`, `.wk-drop`, `.wk-load`.

### Верификация (Claude Preview, чистый инстанс на 4319)
- Регистрация «Тестовый Виолетта» → id `user` (подтверждает нужность datalist-фикса grant-pro).
- fmtDur: задача «9ч 12м», дейстат «0м / 9ч 12м», неделя «10ч 42м». ✓
- `.t-skill-sel` в строках задач (6 опций, value=skillId). ✓
- Хайп: клик «В кураже!» → чип «🔥 Хайп +15%», нудж «×1 · +15% XP · 120м». ✓
- **Потеря данных:** напечатал имя сферы без «Сохранить» → `window.location.reload()` → значение выжило (и сервер, и форма = «ПЕРЕЗАГРУЗКА-OK»). `beforeunload` сохраняет синхронно. ✓
- Недельный DnD: синтетический drag задачи 09.06 → 10.06 → `t.date` обновился и сохранился. ✓
- Календарь: поле длительности в пикере, блок показывает `fmtDur`, кнопка ✕ снимает (клик по блоку не удаляет). ✓
- Примечание: дебаунс-автосейв в фоновой вкладке throttлится (таймеры тормозят) — поэтому критичные пути сделаны синхронными.

## Сессия 2026-06-09 — катастрофа Виолетты: бэкапы + безопасное удаление + мульти-категории

**Фидбек (violaphilmahar):** удалила одну категорию → стёрлись ВСЕ категории и планы дня → потеряла желание пользоваться. Просьба: бэкапы + восстановление + мульти-категории на квест.

### 🔴🔴 Бэкапы данных (server.js)
- `backupFile(dir, name)` — снимок текущего файла ПЕРЕД каждой перезаписью в PUT `/api/data/<name>`. **Дедуп по содержимому** (не по времени!): пропуск только если контент идентичен последнему снимку. Так гарантированно сохраняется состояние ДО разрушительной записи. Храним 50 снимков/файл в `data/users/<id>/.backups/<name>/<ISO>.json`.
- Раньше думал rate-limit по времени — отказался: удаление через 30с после сохранения скипнуло бы важнейший снимок.
- ✅ Тест: запись [A,B] → запись [A] → бэкап содержит [A,B] (пред-состояние).

### 🔴 Удаление сферы больше НЕ стирает планы (app.js)
- `delete-skill`: убрали каскад `State.tasks/habits/goals = filter(...)`. Теперь удаляется только сама сфера из `settings.skills` (+ её узел дерева, + `imported`). Квесты/привычки/цели **остаются** — просто теряют категорию (orphan `skillId` → чип «— сфера —», переназначается).
- Confirm честно говорит: «N квестов/привычек/целей НЕ удалятся».
- `captureSettingsForm` — guard: НЕ перезаписывать `s.skills`/`State.habits` если в DOM 0 строк (защита от глитч-гонки, стиравшей все категории).
- Orphan-привычки: в форме настроек селект сферы показывает «— нет сферы —» (сохраняет orphan-id, не цепляет молча первую сферу).
- ✅ Тест: 3 задачи под «Учёба» → удалил «Учёба» → все 3 задачи живы, 2 стали orphan.

### Админ: инспекция + восстановление данных юзера (server.js + app.js)
- `GET /api/admin/userdata/<id>` — текущее содержимое всех файлов + список бэкапов.
- `GET /api/admin/userdata/<id>/backup/<name>/<stamp>` — содержимое снимка.
- `POST /api/admin/userdata/<id>/restore` `{name, stamp}` — откат (текущее бэкапится перед откатом).
- UI: в адмін-карточке форма «🗂 Данные и бэкапы юзера» → `showUserData()` модалка с таблицей файлов + select снимков + «↩ Восстановить». Handlers `restore-backup`/`close-userdata`.
- ✅ Тест: restore вернул settings из [A] в [A,B].

### Мульти-категории на квест (app.js)
- `task.skillIds[]` — несколько сфер на квест (иллюстрация = Работа + Творчество). Back-compat: `taskSkills(t)` = `skillIds` или `[skillId]`. Новые задачи пишут и `skillId` (основная = `skillIds[0]`), и `skillIds`.
- **XP делится поровну** между категориями: `shareInt(total, n, i)` (остаток — основной сфере). `xpEvents` эмитит по событию на сферу. Сумма сохраняется (нет инфляции).
- UI: `questRow` — вместо одного селекта чипы категорий `.t-cat` + кнопка `edit-cats` → `openCategoryPicker()` (чекбоксы всех сфер, поп-ап). `toggle-cat` в onChange (нельзя снять последнюю). CSS `.t-cats/.t-cat/.cat-list/.cat-opt`.
- Убран устаревший `reassign-skill` (заменён пикером).
- ✅ Тест: задача [study, work], 95 XP → study 48 + work 47 = 95, без инфляции.

**Важно про Виолетту:** её прошлая потеря произошла ДО появления бэкапов — старые данные не восстановить (на Railway их уже нет). Но: (1) текущее состояние её профиля можно посмотреть админ-эндпоинтом — вдруг задачи уцелели; (2) баг каскадного удаления убит — это больше не повторится; (3) с этого момента каждое сохранение бэкапится.

## Как запустить и протестировать
```
cd life-rpg && npm start          # http://127.0.0.1:4317
```
Smoke-тест: вход albert/1234 → добавить квест → ▶ фокус → выполнить → XP/золото/уровень растут → Статистика (ранг+баланс+ранги по сферам) → Награды (открыть сундук, рулетка) → Настройки (подписка, сменить PIN, админ).
Проверка Pro/free: в Настройках «Активировать 7 дней» → бейдж `PRO 7д`, сундуков 3, аналитика разблокирована. Admin «Выдать Pro» по id профиля.

## Известные ограничения / следующие шаги
- **Платежи не реальны.** `upgrade` — заглушка. Перед публичным запуском: Stripe/Paddle + **серверная защита Pro-эндпоинтов** (сейчас гейтинг честный/клиентский — ок для альфы с друзьями, нельзя для денег).
- Гейтинг данных не enforced на сервере (любой может слать `/api/data/*` своего юзера — это его данные, ок; но Pro-only вычисления только на клиенте).
- Не сделано из шаблона: **визуальный редактор дерева навыков** (draggable-ноды) — крупная задача, отложена.
- ✅ Живой 2D-персонаж (идея 3), ✅ Хайп (26), ✅ программы-данжи (25), ✅ лидерборд, ✅ мобайл. Дальше по ROADMAP: **анти-Duolingo стрик с заморозками** (28, ценно+дёшево, но трогает core-стрик — делать аккуратно) + **режим траура** (29, подпись продукта, чувствительная).
- **Лидерборд = honor-system:** клиент сам публикует свой XP-снапшот. Можно «накрутить» подменой запроса. Для альфы с друзьями ок; для денег/публички — серверная валидация XP (как и Pro-гейтинг).
- Серверу нужен рестарт после правок `server.js` (node не watch). Превью: stop→start.

## Карта ключевых функций (app.js)
`Store` (`_put` = немедленный awaitable PUT, `save` = дебаунс 250мс) · `DEFAULT_SETTINGS` (+`imported`) · `State` (+`leaderboard/_lbLoading`) · уровни: `levelInfo/needForLevel/xpForLevel/charLevel/skillLevelOf` · **импорт: `IMPORT_LADDERS/GENERIC_LADDER/ladderFor/tierLevels/importedXp/totalImportedXp/earnedXp/applyImport/importCard`** · **иерархия: `childSkills/isPillar/topSkills/leafSkills/skillLabel/skillOptionsHTML/ownSkillXp` (parentId на skill, 2 уровня)** · **дерево-редактор: `renderTree/treeNodePanel/treeNodeCenter/treeLinesHTML/treeBounds/updateTreeLines/onTreePointerDown` (`State.treeEdit/treeSelNode`, узлы x/y, хендлеры toggle-tree-edit/tree-add-node/tree-del-node/tree-sel-node/tree-field/tree-toggle-req)** · **Форма: `skillForm/overallForm/formMeta/skillLastActive/daysSinceDate`** · **аватар: `AV_*/avatarSVG/avHair/shade/defaultAvatar/avCfg/avatarEditor` (хендлеры `av-cat`/`av-set`, `State.aveCat`, `settings.avatar`)** · `onChange`-делегат (set-import) · ранги: `RANKS/rankFor/rankProgress/charRank` · баланс: `balanceIndex` · Pro: `ent/isPro/trialDaysLeft` · атрибуты/аватар: `ATTRIBUTES/guessAttr/ensureSkillAttrs/attrScore/attrScores/archetype/bodyBMI/radarSVG/figureSVG` · экономика: `itemXp(+boost+hype)/goldEarned(+loot)/lootBoostPct` · **Хайп: `hypeState/hypePct/hypeMinLeft/activateHype`** · лут: `ensureLootbox/lootChestsAvailable/rollLoot/lootResolve/applyLoot/lootboxCard/openChest` · **программы: `DUNGEON_PROGRAMS/programSkillMap/programHabits/programTasks/applyProgramFresh/applyProgramMerge/programCard`** · **лидерборд: `publishLeaderboard/renderLeaderboard` (+ server `/api/leaderboard[/publish]`)** · Pro-UI: `subscriptionCard/securityCard/adminCard/showPaywall` · гайд/фидбек: `GUIDE_SECTIONS/showGuide` (+ server `/api/feedback`) · виды: `renderHeader/renderToday/renderCharacter/renderGoals/renderTree/renderRewards/renderWeekly/renderStats/renderLeaderboard/renderSettings` · `render()` диспатчер (+авто-центр активного таба) · `onClick/onSubmit` · `initApp/init`. **Nav дублирован в index.html + APP_SHELL — править оба.**
