# Actionable Gamification — handoff для Claude Code

## Цель параллельной ветки

Построить четыре независимых, чистых доменных модуля из аудита Actionable Gamification. Эта ветка создаёт проверяемые правила и вычисления, но **не подключает их к пользовательскому runtime**. Подключение к приложению, транзакции `settings + tasks`, WAL, миграции живых данных и релиз остаются у Codex.

## Рабочая зона

- Worktree: `/Users/al.prokopets/Documents/Codex/2026-08-07/satoru-life-rpg-users-al-prokopets/work/actionable-gamification-foundations-v213`
- Ветка: `claude/actionable-foundations-v213`
- Не переключать worktree на другую ветку, не merge/rebase поверх движущегося `master` без отдельного согласования.
- Делать один содержательный коммит на каждый модуль. В конце прислать четыре SHA, список файлов и результаты тестов.

## Владение Claude Code

### 1. AG-02 / AG-05 / AG-07 / AG-56 — governance

Файлы:

- `public/gamification-governance-v1.js`
- `scripts/gamification-governance-v1.test.js`

Назначение: машинно проверяемый гейт для игровых механик. Он должен отличать поддержку автономии от давления, выявлять недоказанные обещания, необратимые наказания, скрытую случайность и метрики без пользовательской пользы.

Публичный API:

```js
const GovernanceV1 = {
  VERSION: 1,
  ISSUE_CODES,
  normalizePolicy(raw),
  normalizeMechanic(raw),
  evaluateMechanic(mechanic, policy),
  auditMechanics(mechanics, policy),
};
```

Контракт результата `evaluateMechanic`:

```js
{
  ok: boolean,
  decision: 'allow' | 'revise' | 'reject',
  mechanic: object,
  issues: Array<{
    code: string,
    severity: 'info' | 'warning' | 'blocking',
    field: string | null,
    message: string,
  }>,
}
```

Обязательные инварианты:

- неизвестная или неполная механика проверяется fail-closed и не получает `allow`;
- ресурсное наказание, необратимая потеря, скрытые шансы и ложное обещание результата дают `blocking`;
- отсутствие XP/золота само по себе не считается дефектом;
- оценка ничего не начисляет, не списывает и не меняет вход;
- массовый аудит детерминирован, сохраняет порядок и не скрывает повторяющиеся нарушения.

### 2. AG-09 / AG-11 / AG-12 / AG-32 — first value

Файлы:

- `public/first-value-v1.js`
- `scripts/first-value-v1.test.js`

Назначение: выбрать один ближайший полезный результат для нового или потерявшегося пользователя, не превращая первый запуск в анкету и не показывая весь функционал сразу.

Публичный API:

```js
const FirstValueV1 = {
  VERSION: 1,
  normalizeContext(raw),
  deriveFirstValue(context),
  nextStep(plan, completedStepIds),
};
```

Контракт `deriveFirstValue`:

```js
{
  state: 'ready' | 'needs_input' | 'blocked',
  promise: string,
  primary: null | {
    id: string,
    kind: 'quest' | 'habit' | 'goal' | 'reflection',
    title: string,
    reason: string,
    sourceId: string | null,
  },
  support: Array<{ id: string, title: string }>,
  questions: Array<{ id: string, prompt: string }>,
}
```

Обязательные инварианты:

- ровно одно `primary` в состоянии `ready`;
- максимум две поддержки и максимум один вопрос за шаг;
- существующая конкретная задача предпочтительнее выдуманной абстракции;
- нет задачи — задаётся один вопрос, а не генерируется ложная конкретика;
- никаких XP, сундуков, серий или наград за сам onboarding;
- одинаковый вход даёт одинаковый план; вход не мутируется.

### 3. AG-35 — AI memory policy

Файлы:

- `public/ai-memory-policy-v1.js`
- `scripts/ai-memory-policy-v1.test.js`

Назначение: до записи памяти ассистента определить, можно ли хранить факт, в каком объёме, на какой срок и что надо удалить из полезной нагрузки.

Публичный API:

```js
const AiMemoryPolicyV1 = {
  VERSION: 1,
  CATEGORIES,
  SENSITIVITY,
  normalizeConsent(raw),
  classify(candidate),
  decide(candidate, consent, now),
  sanitize(candidate, decision),
};
```

Контракт `decide`:

```js
{
  allow: boolean,
  reason: string,
  category: string,
  sensitivity: 'ordinary' | 'sensitive' | 'restricted',
  retention: 'session' | '30d' | 'until_revoked' | 'none',
  expiresAt: string | null,
  fields: string[],
}
```

Обязательные инварианты:

- согласие по умолчанию выключено; неизвестная категория запрещена;
- секреты, пароли, токены, содержимое приватных сообщений и просмотренный контент относятся к `restricted` и не сохраняются;
- сохраняется вывод, полезный будущему действию, а не сырой диалог;
- `sanitize` пропускает только поля из `decision.fields`, не переносит неизвестные ключи;
- время передаётся через аргумент `now`: никаких скрытых `Date.now()` в чистой логике;
- модуль не читает DOM, сеть, `State`, localStorage или файлы.

### 4. AG-52 — telemetry consent

Файлы:

- `public/telemetry-consent-v1.js`
- `scripts/telemetry-consent-v1.test.js`

Назначение: единый allowlist событий и полей до отправки продуктовой телеметрии.

Публичный API:

```js
const TelemetryConsentV1 = {
  VERSION: 1,
  CONSENT_LEVELS,
  EVENT_SCHEMAS,
  normalizeConsent(raw),
  decide(event, consent),
  sanitize(event, decision),
};
```

Уровни согласия:

- `off` — никакой продуктовой телеметрии;
- `essential` — только технические события, необходимые для безопасности и целостности;
- `product` — явно разрешённые агрегированные продуктовые события.

Обязательные инварианты:

- default — `off`, повышение уровня только по явному opt-in;
- неизвестное событие или неизвестное поле отбрасывается;
- запрещены свободный текст, URL, содержимое целей/заметок/чата, идентификаторы третьих лиц и просмотренный контент;
- отказ или отзыв согласия действует немедленно и не создаёт событие о самом отказе;
- результат детерминирован, вход не мутируется, модуль не отправляет сеть сам.

## Общие технические требования

- Формат каждого файла: существующий UMD-паттерн проекта — CommonJS через `module.exports` и browser-global `window.<ModuleName>` из одного исходника.
- Только чистые функции. Никаких DOM, `fetch`, localStorage, `State`, таймеров, случайности, чтения файлов или неявного текущего времени.
- Не добавлять зависимостей и не менять `package.json`.
- Входы нормализуются без исключений; неизвестное и повреждённое состояние обрабатывается fail-closed.
- Не мутировать входные объекты. Публичные константы и результаты аудита желательно замораживать.
- Ограничить строки и массивы разумными верхними границами; тестировать мусор, чрезмерный объём и prototype-pollution ключи.
- Каждый модуль автономен: не импортировать один новый модуль из другого. Связь выполнит интеграционный слой Codex.

## Запрещённые зоны

Claude Code **не редактирует**:

- `public/app.js`
- `public/index.html`
- `public/styles.css`
- `public/sw.js`
- `DEVLOG.md`
- `BACKLOG.md`
- `package.json` и lock-файлы
- `server.js` и существующие серверные writers/маршруты
- `master`, release/deploy-скрипты и настройки Railway

Также Claude Code не меняет и не переопределяет механики **Control, Oath, Hype, XP, `lootLuck`**, CommitmentV1, транзакцию `settings + tasks`, CAS, журнал/WAL или recovery. Даже если тест нового governance-модуля использует такие примеры, это только входные fixtures — не правка runtime.

## Acceptance tests

Для каждого модуля обязательны:

1. Happy path по публичному API.
2. Повреждённый и частичный вход.
3. Fail-closed для неизвестных типов/полей.
4. Иммутабельность входа.
5. Детерминизм повторного вызова.
6. Ограничения длины/числа элементов.
7. Проверка чистоты исходника: нет DOM, сети, `State`, localStorage, скрытого времени или случайности.
8. Проверка CommonJS-экспорта и browser-global имени.
9. Негативные тесты для каждого обязательного инварианта, перечисленного выше.

Команды перед передачей:

```bash
node --check public/gamification-governance-v1.js
node --check public/first-value-v1.js
node --check public/ai-memory-policy-v1.js
node --check public/telemetry-consent-v1.js
node --test scripts/gamification-governance-v1.test.js
node --test scripts/first-value-v1.test.js
node --test scripts/ai-memory-policy-v1.test.js
node --test scripts/telemetry-consent-v1.test.js
```

Все восемь команд должны завершиться с кодом `0`. Полный `npm test` полезен как дополнительная проверка, но падение уже существующего несвязанного теста не разрешает Claude Code заходить в запрещённые зоны.

## Порядок передачи и интеграции

1. Claude Code реализует и коммитит `gamification-governance-v1`.
2. Затем отдельно `first-value-v1`.
3. Затем отдельно `ai-memory-policy-v1`.
4. Затем отдельно `telemetry-consent-v1`.
5. Claude Code передаёт четыре SHA, точный вывод узких тестов и отдельно перечисляет любые спорные решения API. Не merge в `master`, не deploy.
6. Codex проверяет контракты и cherry-pick/переносит модули по одному.
7. Codex владеет подключением скриптов, UI, копирайтингом, состоянием пользователя, server wiring, миграциями, CAS, WAL/recovery, cache-bump, полным регрессом, push и deploy.
8. Интеграция идёт в порядке: governance → first value → AI memory policy → telemetry consent. Следующий модуль подключается только после зелёного полного набора тестов предыдущего шага.

## Definition of done для Claude Code

- Созданы ровно восемь разрешённых файлов: четыре модуля и четыре теста.
- Все заявленные API существуют и покрыты тестами.
- Ни один запрещённый файл не изменён.
- Нет изменений runtime, данных пользователя, сервера, WAL, `master` или production.
- Четыре атомарных коммита готовы к независимой проверке и переносу Codex.
