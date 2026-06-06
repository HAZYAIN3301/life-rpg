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
- ✅ Живой 2D-персонаж (идея 3) — СДЕЛАН (вид «Персонаж»). Дальше по ROADMAP: **анти-Duolingo стрик с заморозками** (28, ценно+дёшево, но трогает core-стрик — делать аккуратно) + **режим траура** (29, подпись продукта) + статус «Хайп» (26) + готовые программы-данжи (25).
- Серверу нужен рестарт после правок `server.js` (node не watch). Превью: stop→start.

## Карта ключевых функций (app.js)
`Store` · `DEFAULT_SETTINGS` · `State` · уровни: `levelInfo/charLevel/skillLevelOf` · ранги: `RANKS/rankFor/rankProgress/charRank` · баланс: `balanceIndex` · Pro: `ent/isPro/trialDaysLeft` · атрибуты/аватар: `ATTRIBUTES/guessAttr/ensureSkillAttrs/attrScore/attrScores/archetype/bodyBMI/radarSVG/figureSVG` · экономика: `itemXp(+boost)/goldEarned(+loot)/lootBoostPct` · лут: `ensureLootbox/lootChestsAvailable/rollLoot/lootResolve/applyLoot/lootboxCard/openChest` · Pro-UI: `subscriptionCard/securityCard/adminCard/showPaywall` · гайд/фидбек: `GUIDE_SECTIONS/showGuide` (+ server `/api/feedback`) · виды: `renderHeader/renderToday/renderCharacter/renderGoals/renderTree/renderRewards/renderWeekly/renderStats/renderSettings` · `render()` диспатчер · `onClick/onSubmit` · `initApp/init`. **Nav дублирован в index.html + APP_SHELL.**
