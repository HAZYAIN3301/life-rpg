# Secretary Router v212 — замороженный контракт интеграции

Дата: 2026-09-01
Статус: **FROZEN для v212**
Основание: `SECRETARY-OS-PAIN-MAP.md`, `DISCIPLINE-ESCAPE-PLAN.md`, решения владельца от 01.09 и аудит черновых `secretary-events-v1` / `secretary-router-v1`.

Этот документ фиксирует границу между чистым движком, серверной доставкой и UI. Менять имена полей, enum, семантику результата или владельца данных после начала интеграции можно только синхронной правкой движка, UI и тестов. Он не разрешает добавлять ещё одну вкладку, ещё один ручной трекер или вторую историю задач.

## 1. Результат v212

v212 строит узкий, но настоящий секретарский цикл:

```text
подтверждённые доменные факты
          ↓
SecretaryEventsV1 — нормализация и идемпотентность
          ↓
SecretaryRouterV1 — один winner или осознанное молчание
          ↓
атомарный claim одного канала
          ↓
одна поверхность Тени
          ↓
RecoveryDayV1 — 1 главное действие, до 2 поддержек, финиш и отдых
          ↓
обязательная минимальная обратная связь
          ↓
SecretaryExperimentV1 — честный 30-дневный dogfood-эксперимент
```

Первая capability называется `morning-recovery`. Она ловит не «плохого человека» и не «срыв», а достижимый момент утром после известного вчерашнего нарушения границы, позднего вечера либо **явно подтверждённого** тихого дня.

### Не входит в v212

- новая primary route или шестая вкладка;
- Honey Lottery, недельные тиры и награда за «хорошую» неделю;
- автоматический диагноз сна, усталости, зависимости или настроения;
- чтение URL, поисковых запросов, содержимого страницы или экрана;
- XP, золото, серия, штраф, долг за пропуск или социальная публикация;
- автоматическое изменение целей, Attention policy или расписания без подтверждения;
- замена существующих `Goals`, `Quests`, `Attention`, `Commitment`, `Notes` собственными копиями.

## 2. Неподвижные продуктовые инварианты

1. На одно основание существует не больше одного активного `offerId`.
2. Один offer доставляется только через **один** канал. Массив `channels` в UI запрещён.
3. На Today одновременно видна одна support surface Тени либо ни одной.
4. Низкая уверенность даёт один вопрос, а не вывод.
5. Отсутствие данных — `unknown`, а не `escaped`, «провал» или успех.
6. `day.silent` создаётся только из явного подтверждения, никогда из отсутствия событий.
7. Отклонение — валидный исход и запускает реальный cooldown.
8. Движок не читает DOM, `State`, сеть, системные часы или locale.
9. UI не пересчитывает приоритеты и не меняет action, выбранный движком.
10. Action не считается выполненным до durable write владельца данных.
11. AI может переформулировать разрешённый текст, но не выбирает trigger, action, channel или safety tier.
12. Пропуск дня эксперимента не рвёт серию, не создаёт задолженность и не требует компенсации.

## 3. Владельцы истины

| Данные | Единственный владелец | Что Router получает |
|---|---|---|
| цели и иерархия | Goals | только ссылки `goalId`, если нужны |
| сегодняшние действия | Quests / Days | проекцию подходящих task refs |
| уговоры | `CommitmentV1` | результат `CommitmentV1.dueOn(...)`, не raw state |
| границы и эпизоды | Attention policy/session/episode | нормализованные события и refs |
| закрытие дня | Days / Settings | `dayClosed: boolean` |
| личное меню отдыха | recovery profile | bounded refs на варианты отдыха |
| событие для маршрутизации | `SecretaryEventsV1` | canonical trigger event |
| выдача и исход offer | server secretary ledger | claimed/offered/outcome |
| 30-дневный протокол | `SecretaryExperimentV1` | refs, check-ins и агрегаты, но не копии доменных объектов |

Router не знает, как архивируется цель, как закрывается квест или как устроен `State`. Адаптер обязан подготовить проекции до вызова чистого модуля.

## 4. `SecretaryEventsV1`: замороженный API

### 4.1. Событие

```js
{
  version: 1,
  key: 'attention.escaped|2026-09-01|policy_abc',
  type: 'attention.escaped',
  day: '2026-09-01',             // локальный календарный день пользователя
  at: '2026-09-01T21:43:00.000Z',
  source: 'client' | 'server' | 'extension' | 'native',
  ref: 'policy_abc',              // bounded opaque/account-owned id
  data: { /* только разрешённые поля типа */ }
}
```

Закрытый список trigger types v212:

- `attention.overran` → `{ plannedMinutes, actualMinutes }`;
- `attention.escaped` → `{}`; это только собственная отметка пользователя;
- `evening.late` → `{ minutesPast }`;
- `day.silent` → `{ silentDays }`; только после явного подтверждения.

`morning.open`, `day.closed`, `offer.accepted` и `offer.dismissed` не хранятся в event log v212: момент вызова и `dayClosed` являются входом Router, а доставка/исход принадлежат ledger. Неиспользуемые типы нельзя оставлять «на будущее».

### 4.2. Экспорт модуля

```js
SecretaryEventsV1 = {
  VERSION,
  TYPES,
  SOURCES,
  emptyLog,
  normalizeIngress,
  sanitizeEvent,
  sanitizeLog,
  append,
  prune,
  onDay,
  hasOnDay,
  fromAttentionEpisode,
  fromEveningActivity,
  fromConfirmedSilent
}
```

Семантика:

- `normalizeIngress(raw)` читает плоский producer payload и возвращает canonical event или `null`;
- `sanitizeEvent(stored)` читает **canonical stored shape**, включая `stored.data.*`;
- `sanitizeLog(raw)` возвращает sanitized log или `null`; повреждённый файл не становится пустым;
- `append(log, raw)` сначала строго проверяет base log и возвращает:

```js
{ ok: true, log, added: true | false, event }
// либо
{ ok: false, error: 'invalid_log' | 'invalid_event' }
```

- повтор одного `key` возвращает `added:false` и не меняет первое `at`;
- projectors возвращают `null` или raw ingress object; они не записывают в log сами;
- `prune(log, today)` сохраняет максимум 200 событий и 14 календарных дней.

### 4.3. Обязательные правила даты и времени

- `YYYY-MM-DD` проверяется не только regex, но и календарным round-trip; `2026-99-99`, `2026-02-30` и невозможные годы отклоняются;
- point event обязан иметь валидный `at`; модуль не изобретает `12:00Z`;
- `today` и `day` вычисляет adapter в локальной зоне пользователя;
- чистый модуль никогда не вызывает `Date.now()` и `new Date()` без числового/строкового входа;
- `utcOffsetMinutes` означает `local = UTC + offset` и относится к текущему `now`.

### 4.4. Ключ и приватность

`key = type|day|ref` намеренно схлопывает несколько одинаковых сигналов одной policy за день в один **повод вмешаться**. Это trigger log, не полная история Attention. История сессий остаётся у `AttentionEpisodeV1`.

`ref` — opaque id policy/episode category. В нём запрещены hostname, URL, поисковый запрос, название просмотренного материала и свободный пользовательский текст.

## 5. `SecretaryRouterV1`: замороженный API

### 5.1. Вход

```js
const result = SecretaryRouterV1.next({
  now: '2026-09-02T06:30:00.000Z',
  today: '2026-09-02',
  utcOffsetMinutes: 120,
  invocation: 'client_open' | 'server_tick',
  events: canonicalEventLog,
  ledger: canonicalLedgerProjection,
  commitmentItems: projectedDueCommitments,
  dayClosed: false,
  availableChannels: ['card', 'push'],
  preferredChannel: 'card'
});
```

`commitmentItems` — уже результат `CommitmentV1.dueOn(state, today, mode)`. Router не проверяет `archived`, `archivedAt`, mode или `decidedOn` сам.

### 5.2. Результат

```js
{
  ok: true,
  offer: null
}
```

либо:

```js
{
  ok: true,
  offer: {
    version: 1,
    offerId: 'morning-recovery|2026-09-02|attention.escaped|2026-09-01|policy_abc',
    capabilityId: 'morning-recovery',
    action: {
      type: 'recovery_day_open' | 'ask_one_question',
      args: {
        day: '2026-09-02',
        reasonEventKey: 'attention.escaped|2026-09-01|policy_abc'
      }
    },
    channel: 'card',
    mode: 'offer' | 'ask',
    confidence: 0.9,
    reasonCode: 'escaped' | 'overran' | 'late' | 'silent_confirmed',
    about: {
      day: '2026-09-01',
      eventKey: 'attention.escaped|2026-09-01|policy_abc'
    },
    quote: null | { id, title, win },
    cooldownKey: 'morning-recovery|2026-09-02',
    expiresAt: '2026-09-02T11:00:00.000Z'
  }
}
```

Ошибка данных возвращается явно:

```js
{
  ok: false,
  error: 'invalid_time' |
         'invalid_day' |
         'invalid_events' |
         'invalid_ledger' |
         'invalid_channels'
}
```

Повреждённый log/ledger никогда не подменяется `emptyLog()`/`emptyLedger()`: это повторно открыло бы уже отклонённый offer.

### 5.3. Выбор capability

`CAPABILITIES` — закрытый машиночитаемый registry:

```js
{
  id: 'morning-recovery',
  priority: 100,
  requiredSignals: ['yesterday_trouble', 'morning_window'],
  action: 'recovery_day_open',
  allowedChannels: ['card', 'push'],
  safetyTier: 'reversible_open',
  entryCost: 'one_tap',
  cooldown: 'once_per_local_day'
}
```

Для v212 зарегистрирована только `morning-recovery`. Условия:

1. локальное время `05:00 <= hour < 13:00`;
2. текущий день ещё не закрыт;
3. вчера есть один известный повод;
4. cooldown ещё не занят;
5. доступен хотя бы один разрешённый канал.

Приоритет вчерашнего повода: `escaped` → `overran` → `late` → `silent_confirmed`. Первые три возвращают `mode:'offer'`; подтверждённая тишина имеет confidence ниже `ASK_BELOW` и возвращает `mode:'ask'` с `ask_one_question`.

Если кандидатов станет больше, Router сортирует по `priority desc`, затем по стабильному `capabilityId asc`, и возвращает только первого. Остальные не проецируются в UI «заодно».

### 5.4. Канал

Router возвращает строку `channel`, а не `channels`:

1. пересечение `allowedChannels` и `availableChannels`;
2. `preferredChannel`, если он входит в пересечение;
3. иначе стабильный порядок `card → push → extension → voice`;
4. пустое пересечение → `{ok:false,error:'invalid_channels'}` и никаких side effects.

Registry определяет, какие каналы допустимы; окончательную уникальность обеспечивает server claim из §7.

### 5.5. Ledger API чистого модуля

```js
emptyLedger()
sanitizeLedger(raw) // canonical ledger либо null
mark(ledger, offer, state, now)
// -> { ok:true, ledger } | { ok:false, error }
```

Допустимые terminal outcomes движка: `accepted`, `dismissed`, `expired`. `now` обязателен и валиден. Fallback на системные часы запрещён.

## 6. Замороженный view-model между engine/controller и UI

UI получает готовую модель и не читает event log, Attention или Commitment самостоятельно:

```js
{
  version: 1,
  kind: 'secretary_offer',
  surface: 'shadow_support',
  offerId,
  capabilityId: 'morning-recovery',
  channel: 'card',
  mode: 'offer' | 'ask',
  tone: 'neutral',
  copy: {
    eyebrowKey: 'secretary.morning.eyebrow',
    titleKey: 'secretary.morning.title.escaped',
    bodyKey: 'secretary.morning.body.escaped',
    questionKey: null | 'secretary.morning.question.silent',
    reasonKey: 'secretary.morning.reason.escaped'
  },
  quote: null | {
    labelKey: 'secretary.morning.your_words',
    text: 'Подъём в 7:10',
    win: 'утро начинается легче'
  },
  primary: {
    id: 'primary',
    labelKey: 'secretary.morning.open_recovery',
    action: { type: 'recovery_day_open', args: { day, reasonEventKey } }
  },
  secondary: {
    id: 'dismiss',
    labelKey: 'common.not_now',
    action: { type: 'secretary_offer_dismiss', args: { offerId } }
  },
  disclosure: {
    labelKey: 'secretary.other_support',
    items: []
  },
  meta: {
    reasonCode,
    confidenceBand: 'low' | 'medium' | 'high',
    expiresAt
  }
}
```

Правила view-model:

- только locale keys; HTML/Markdown/неэкранированный AI text запрещены;
- `reasonCode` и точная confidence не показываются как диагноз или оценка человека;
- при `mode:'ask'` primary action — ответ на один вопрос; план не показывается до ответа;
- quote появляется только из явного действующего уговора; UI ничего не дописывает;
- `disclosure.items` содержит только пассивные ссылки на существующие инструменты, не дополнительные proactive offers; по умолчанию блок свёрнут;
- кнопки не используют «амнистия», «провал», «срыв», «наказание», «ты опять»;
- без AI отображается тот же action и полноценная static copy;
- AI wording, если когда-либо включён, не может менять `offerId`, action, аргументы, channel, labels кнопок или safety tier.

## 7. Атомарный channel claim

### 7.1. Зачем

Pure ledger не защищает гонку между открытой вкладкой, server push, extension и вторым устройством. До любого видимого эффекта один доставщик обязан получить авторитетный claim.

### 7.2. Серверная запись

```js
{
  offerId,
  capabilityId,
  cooldownKey,
  channel: 'card' | 'push' | 'extension' | 'voice',
  claimToken,                    // случайный id конкретной попытки
  state: 'claimed' | 'offered' | 'accepted' | 'dismissed' | 'expired',
  claimedAt,
  leaseUntil,
  offeredAt: null | ISO,
  outcomeAt: null | ISO,
  revision: 1
}
```

### 7.3. Операции

```text
POST /api/secretary/offer/claim
{ offerId, capabilityId, cooldownKey, channel, claimToken, now }

POST /api/secretary/offer/delivered
{ offerId, claimToken, now }

POST /api/secretary/offer/outcome
{ offerId, outcome: accepted|dismissed|expired, now }
```

Все операции требуют сессию пользователя, проверяют ownership и являются идемпотентными.

Claim semantics:

1. Первый валидный claim создаёт `claimed` и получает `201`.
2. Повтор с тем же `offerId + claimToken + channel` получает `200` и ту же запись.
3. Другой token/channel получает `409 already_claimed`; он ничего не показывает.
4. Доставщик показывает card/notification/voice только после `200/201`.
5. После фактического commit видимой поверхности вызывается `/delivered`; channel становится неизменяемым.
6. `accepted`, `dismissed` и `expired` terminal и не перезаписывают друг друга.
7. Один `cooldownKey` нельзя занять вторым `offerId` в тот же день.

### 7.4. Ошибки доставки

- Card: claim → DOM commit → `delivered`. Если DOM commit **доказанно** не произошёл, claim можно освободить до `offered`; при неизвестном состоянии он остаётся claimed до lease expiry.
- Push: claim → отправка → `delivered` только после 2xx. `404/410` означает доказанную недоставляемость подписки: claim можно освободить и выбрать fallback. `429/5xx/exception` неоднозначны: повторяется тот же channel/token, card параллельно не появляется.
- Voice допустим только при явном consent, открытом приложении и разрешённом sound mode. Silent/DND/reduced-motion не обходятся.
- После `offered` fallback на другой канал запрещён: последовательный второй канал тоже был бы дублем.
- Lease не является cooldown. Она только восстанавливает попытку, которая точно не стала видимой.

Локальный режим без sync использует тот же state machine в локальном atomic storage и честно не обещает cross-device uniqueness.

## 8. `RecoveryDayV1`: план без второго списка дел

### 8.1. API

```js
buildDraft({
  day,
  sourceOfferId,
  reasonEventKey,
  coreCandidates,       // refs на существующие quests/goals
  supportCandidates,    // refs на существующие объекты
  recoveryProfile,      // finite personal rest menu
  dueCommitments,
  schedule,
  sleepContract
})
// -> {ok:true,draft} | {ok:false,error}

activate(state, draft, now, seq)
progress(plan, { tasks, attentionEpisodes, days, commitments })
close(state, planId, outcome, now, seq)
```

### 8.2. Draft/view-model

```js
{
  version: 1,
  planId: 'recovery:2026-09-02:<event-key>',
  day: '2026-09-02',
  sourceOfferId,
  reasonEventKey,
  status: 'draft' | 'active' | 'closed',
  primary: null | {
    owner: 'quest' | 'goal',
    targetId,
    title,
    action: 'open' | 'start'
  },
  supports: [ /* 0..2, та же ref shape */ ],
  finish: {
    kind: 'time' | 'unscheduled',
    at: null | 'HH:MM',
    labelKey: 'recovery.finish'
  },
  rest: null | {
    activityId,
    label,
    minutes,
    screenMode: 'screen' | 'no_screen' | 'either',
    attentionPolicyId: null | 'policy-id'
  }
}
```

Правила:

- ровно одно primary, если существует конкретный доступный шаг;
- до двух supports, скрытых под `Другая поддержка`;
- если конкретного primary нет, Router задаёт один вопрос — не создаёт «поработать над проектом»;
- plan хранит refs, а completion читает у владельцев; свои checkbox/log запрещены;
- отдых берётся из подтверждённого finite menu; при пустом профиле показываются безопасные neutral defaults как варианты, но они не записываются в предпочтения без выбора;
- закрытие не начисляет наград и не оценивает день;
- save-first: UI показывает active/closed только после успешной durable операции; 500/offline/malformed оставляет draft и Retry.

UI остаётся внутри Today/Тени либо существующего modal flow. Нового пункта навигации нет.

## 9. `SecretaryExperimentV1`: 30-дневный dogfood-контракт

### 9.1. Назначение

Это личный эксперимент владельца, а не публичный challenge и не новая «система, за которой надо следить». Он проверяет, помогает ли утренний recovery flow быстрее вернуться, удерживать границу и выбирать восстанавливающий отдых.

### 9.2. Состояние

```js
{
  version: 1,
  id,
  status: 'draft' | 'active' | 'completed' | 'stopped',
  protocolVersion: 'morning-recovery-v1',
  startedOn: '2026-09-02',
  endsOn: '2026-10-01',          // startedOn + 29 дней, обе границы включены
  baselineWindowDays: 14,
  profileSnapshot: {
    sleepTarget: '22:00',
    wakeTarget: '07:10',
    lateReturnSleepTarget: '23:00',
    coreMax: 1,
    supportMax: 2,
    restMenuRevision
  },
  refs: {
    goalId: null | id,
    rhythmId: null | id,
    notesCollectionId: null | id
  },
  checkIns: {
    '2026-09-02': {
      seq: 1,
      sourceOfferId: null | id,
      recoveryPlanId: null | id,
      offerOutcome: 'accepted' | 'dismissed' | 'unknown',
      boundaryHeld: 'yes' | 'no' | 'unknown',
      enjoyment: 'yes' | 'no' | 'unknown',
      afterEffect: 'better' | 'same' | 'worse' | 'unknown',
      regret: 'none' | 'some' | 'unknown',
      note: ''
    }
  }
}
```

`note` optional, account-private, максимум 280 символов. URL, content title и просмотренный материал в experiment state не записываются.

### 9.3. API

```js
create(config)
recordCheckIn(state, experimentId, day, checkIn, seq)
metrics(state, experimentId, projections)
reviewDue(state, experimentId, today) // 7, 14, 21, 30
complete(state, experimentId, now, seq)
stop(state, experimentId, now, seq)
```

- stale `seq` отклоняется;
- повтор того же payload/seq идемпотентен;
- день вне inclusive window 1..30 отклоняется;
- `unknown` не входит в positive/negative denominator, но `known/unknown/eligible` всегда показываются;
- Attention episodes, offers, recovery plans и day completion передаются как projections и не копируются;
- `returnLatency` считается только при известных timestamps; иначе `not_measured`;
- эксперимент можно остановить без штрафа, подтверждения «провала» или удаления исходных данных.

### 9.4. UI contract

Новых primary routes и отдельного challenge dashboard нет. Состояния проецируются так:

| Состояние | Поверхность | Что видно | Действие |
|---|---|---|---|
| `draft` | один setup sheet по явному запуску | срок, приватность, что будет измерено | `Начать 30 дней` / `Не сейчас` |
| active + morning offer | текущая карточка Тени | только сегодняшний recovery move | primary / dismiss |
| active + завершённый отдых | один compact feedback sheet | обязательный `afterEffect`; остальные поля optional/unknown | `Сохранить` |
| review due 7/14/21 | карточка Тени вместо другого support offer | один проверенный вывод + denominator | `Посмотреть подробнее` |
| day 30 | итоговый sheet | baseline/current с `n`, unknown и честными ограничениями | `Завершить` / `Экспортировать` |
| `stopped` | нигде proactively | история доступна из владельцев данных | none |

Обязательная обратная связь означает: если человек решил закрыть recovery episode, UI просит один ответ `лучше / так же / хуже`. `enjoyment`, `regret` и ручной `boundaryHeld` раскрываются как optional detail; когда boundary известна из Attention, поле заполняется проекцией. Закрытие sheet без ответа остаётся `unknown`, а не превращается в негативный исход.

Показываемые метрики:

```js
{
  elapsedDays,
  eligibleDays,
  knownDays,
  unknownDays,
  offers: { offered, accepted, dismissed },
  returnLatency: { n, medianMin, baselineN, baselineMedianMin, status },
  boundaryHeld: { yes, no, known },
  afterEffect: { better, same, worse, known },
  regret: { none, some, known }
}
```

При `known < 5` UI пишет `Пока калибруемся`, а не «работает/не работает». Главная цель — не ноль выпадений, а более быстрый возврат и меньше сожаления при сопоставимых эпизодах. Прогресс-огонь, streak, rarity tier, confetti и награда за заполнение запрещены.

До подключения атомарного delivery-ledger Router локальный owner-dogfood не имеет права
выдумывать число фактических показов. В текущей проекции `offers.offered = null`, отдельно
считаются только явные решения `decided = accepted + dismissed`, а UI подписывает их как
«Ответы на предложение». После безопасной интеграции Router поле `offered` приходит только из
server-owned delivery/claim projection; один рендер клиента не считается показом сам по себе.

Подробная композиция живёт у существующих владельцев: цель — в Goals, повторяемый ритм — в `Ритме`, заметка/медиа после опыта — в Notes/Media. Съёмка не вторгается в сам отдых.

## 10. Приватность и безопасность

### Никогда не сохраняется и не отправляется Router-ом

- raw URL, hostname для sensitive targets, query string;
- поисковые запросы, сообщения, текст страницы, accessibility tree;
- список просмотренных роликов/подкастов и содержимое экрана;
- полный список приложений устройства;
- поминутная история устройства;
- диагнозы, inferred traits и неподтверждённые психологические выводы;
- данные другого пользователя, Tribe, leaderboard или community.

### Разрешённый минимум

- тип события, время, локальный день, opaque policy/category ref;
- planned/actual aggregate minutes, если платформа их действительно знает;
- explicit outcome пользователя;
- offer delivery state;
- bounded experiment check-in и ссылки на account-owned domain objects.

Подробный device log остаётся local-only по умолчанию. Aggregate sync включается отдельным opt-in. При `sync:false` server endpoint отвергает payload, а не сохраняет «временно».

Push copy не содержит quote, target/app name, причины и приватной заметки: только нейтральное «Тень подготовила лёгкий вход». Полная quote допустима в authenticated card. AI получает лишь минимальный presentation payload и не получает experiment note по умолчанию.

`secretary` включается в account export и cascade delete. Пользователь может удалить отдельный эксперимент/его feedback без удаления Goals или Attention; refs становятся `null`, а не оживляют удалённые объекты. Повреждённый server file не перезаписывается пустым значением.

## 11. Server envelope

Один account-owned store, а не файл на каждую capability:

```js
{
  version: 1,
  revision: 1,
  events: { version: 1, events: [] },
  ledger: { version: 1, offers: {} },
  recovery: { version: 1, plans: [] },
  experiment: { version: 1, experiments: [] }
}
```

Рекомендуемый путь: `data/users/<userId>/secretary.json`. Writes atomic + backup + write guard. Ограничения payload/rows применяются и на сервере; клиентская нормализация не считается защитой.

Кроме claim endpoints нужны:

- `GET /api/secretary`;
- `POST /api/secretary/event` — idempotent по event key;
- `POST /api/secretary/recovery` — revision/seq guard;
- `POST /api/secretary/experiment` — revision/seq guard;
- delete/export операции в общем account lifecycle.

Сервер повторно проверяет closed enum и поля. Произвольный action, capability или channel из клиента отклоняется.

## 12. Найденные дефекты, обязательные до интеграции

| # | Дефект черновика | Обязательное исправление |
|---|---|---|
| 1 | `sanitizeLog()` повторно вызывает ingress `normalize()`: numeric поля уже лежат в `event.data`, поэтому зануляются; `capability` теряется | разделить `normalizeIngress` и `sanitizeEvent`; тест полного round-trip |
| 2 | `isDay()` проверяет только regex; `prevDay()` падает на невозможной дате | календарная round-trip validation; invalid input → explicit error, never throw |
| 3 | `append()` принимает несanitized base log | strict base validation; corrupt → `invalid_log`, не empty |
| 4 | отсутствующий `at` превращается в фиктивный полдень UTC | point event без valid `at` отклоняется |
| 5 | producer adapters отсутствуют | добавить три bounded projector-а; silence только confirmed |
| 6 | daily key выглядит как полная история | документировать trigger-log semantics; canonical history остаётся Attention |
| 7 | `ownWords()` проверяет `archived`, а Commitment использует `archivedAt` | Router получает только `CommitmentV1.dueOn(...)` projection |
| 8 | `mark()` fallback-ит на `new Date()` | invalid `now` → error; ban `Date.now` и bare `new Date()` в source test |
| 9 | `dayClosed` вход не используется | closed day suppresses recovery offer |
| 10 | offer возвращает сразу `['card','push']` | вернуть ровно один `channel` |
| 11 | pure ledger не защищает race нескольких поверхностей | атомарный server claim до показа |
| 12 | четыре event types объявлены, но не потребляются | убрать из v212 closed list; не хранить dead schema |
| 13 | `morning-after-overrun` срабатывает не только на overrun | переименовать в `morning-recovery` |
| 14 | Router срабатывает на render/clock без явного контракта вызова | обязательный `invocation` и deterministic `now/today` |
| 15 | corrupt ledger silently становится empty | fail closed `invalid_ledger` |
| 16 | Commitment module сейчас может быть не подключён к runtime/store | quote optional; интеграция не блокируется и ничего не выдумывает |
| 17 | тест запрещает только `Date.now()` | запретить также bare `new Date()` и любые DOM/network/global state reads |
| 18 | возможен второй offer после ambiguous push failure | держать тот же claim/channel до definite failure или expiry |

## 13. File ownership на время v212

| Владелец | Файлы | Запрет пересечения |
|---|---|---|
| Events/Router engine | `public/secretary-events-v1.js`, `public/secretary-router-v1.js`, `scripts/secretary-router-v1.test.js` | не правит UI/server/shared shell |
| Recovery/Experiment engine | `public/recovery-day-v1.js`, `public/secretary-experiment-v1.js`, их unit tests | не использовать имя `recovery-slug-v1.js`: оно занято pet art/animation |
| Presentation/UI | `public/secretary-ui-v1.js`, `scripts/secretary-ui-v212.test.js` | получает только frozen VM; не читает raw stores |
| Server | `server-secretary-v1.js`, `scripts/secretary-server-v212.test.js` | `server.js` wiring делает только integration owner |
| Integration/release — один агент | `public/app.js`, `public/styles.css`, `public/index.html`, `public/sw.js`, `server.js`, `DEVLOG.md`, `BACKLOG.md` | никто другой не держит эти файлы dirty |
| Existing domain owners | `commitment-v1.js`, `attention-*-v1.js`, Goals/Quests/Days | Router читает projections; не меняет домены ради удобства своей схемы |

Этот документ принадлежит интеграционному контракту и после freeze правится только согласованно. Автор документа не редактирует runtime и журналы.

## 14. Обязательные тесты и release gate

### Pure unit

- `sanitizeLog(append(emptyLog(), raw).log)` сохраняет событие byte-equivalent по semantic fields;
- impossible calendar dates не бросают exception;
- corrupt event log/ledger fail closed;
- retry даёт тот же event key и offerId;
- один winner и один channel;
- `dayClosed:true` → no offer;
- low confidence → one question;
- archived/not-due Commitment не попадает в quote;
- Router/Events не содержат DOM, `State`, `fetch`, `/api/`, `Date.now()` и bare `new Date()`;
- output не содержит XP/gold/streak/diagnosis/destructive verbs;
- Recovery draft содержит максимум 1 primary + 2 supports и не дублирует completion;
- experiment window включает ровно дни 1..30; stale seq reject; retry idempotent;
- `unknown` исключён из outcome denominator, но count виден;
- `returnLatency` без двух известных timestamps = `not_measured`.

### Server integration

- два параллельных claim разных channels → ровно один success;
- тот же token retry idempotent;
- другой пользователь не читает/не меняет offer;
- 404/410 push допускает definite fallback, 429/5xx/exception — нет;
- malformed/oversized payload отвергается без overwrite;
- account export включает secretary; delete удаляет его каскадно;
- local-only sync payload отвергается;
- recovery/experiment revision и seq guards;
- offline/500/malformed не выглядит как accepted/closed.

### UI/source contract

- Today имеет `0..1` support surface и ровно один primary support CTA;
- другие support links свёрнуты;
- no user-visible `amnesty`, diagnosis, shame, rarity, streak;
- static copy работает без AI;
- push copy не содержит target/quote/reason;
- locale `ru|en|de|uk|es`, keyboard/focus return, 42px controls, reduced motion;
- first viewport не получает новый dashboard или primary route.

### Публикация

После unit/integration/UI gates: `node --check` изменённых JS, `git diff --check`, полный `npm test`, browser QA. Integration owner подключает новые public modules в `index.html`/SW shell, поднимает `CACHE = satoru-v212`, синхронизирует pins, обновляет журналы, fast-forward push в `master`, ждёт Railway success и сверяет production bytes/status.

## 15. Definition of done

v212 готов только когда:

1. известный вчерашний повод утром приводит к одному нейтральному offer;
2. card/push race не может показать два offer;
3. принятие открывает конкретный Recovery Day с одним главным действием;
4. low-confidence silence задаёт один вопрос;
5. dismiss действительно молчит до следующего допустимого дня;
6. первый личный 30-дневный эксперимент можно начать, остановить и завершить без новой вкладки;
7. feedback и метрики честно показывают unknown и sample size;
8. raw browsing/content/private data не попадают на сервер или в push;
9. export/delete, retry, corruption и ownership проверены тестами;
10. production содержит точный опубликованный v212, а не только локальный код.
