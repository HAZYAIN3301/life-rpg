# Secretary next moves: первый runtime-срез

2026-09-11. Контракт сервера и UI для **after-lapse-return + planned-start**, канал `card`.
Policy: `secretary-next-moves-v2.js`; owner projection:
`secretary-next-moves-producer-v1.js`; транспорт: `server-secretary-next-moves-v1.js`.
Это дополнение к [контракту движка](SECRETARY-ENGINE-CONTRACT.md) и
[policy v2](SECRETARY-NEXT-MOVES-V2.md). `evening-close` и v2 push
пока не включаются. `enabledCapabilities` — явный ограничитель policy;
вечерняя проекция продолжает защищать сон внутри возврата.

## Владелец данных

В текущем master **нет** прежнего общего `secretary.json`. Legacy владеет файлами
`secretary-events.json`, `secretary-ledger.json`, `secretary-claims.json`,
`secretary-experiment.json`. Они не копируются и не мигрируют в новый envelope.
Новый единственный владелец v2: `users/<uid>/secretary.json`:

```js
{
  version: 1,
  nextMoves: { version: 2, offers: {}, capabilities: {} },
  delivery: { offers: {}, requests: {} }
}
```

`delivery.offers[offerId]` содержит замороженный offer, clientId, случайный token,
claimedAt, persistedAt и state. `requests` содержит SHA-256 ключ clientId/requestId,
fingerprint запроса и durable response. Сам входной контекст не сохраняется;
свободный текст, URL, экран и заголовки задач не копируются в envelope.
Нормализованный ledger обязан соответствовать delivery rows; повреждение — 422.

Запись синхронная: read → проверить текущее состояние → fsync temporary file →
rename → fsync directory. Предыдущая исправная версия сохраняется в
`.backups/secretary/previous.json`; отказ backup/write даёт 500. Между чтением и
записью нет `await`: cross-device арбитраж атомарен в существующем одном Node
процессе. Несколько независимых серверных процессов на одном DATA_DIR требуют
отдельного межпроцессного transaction store и не являются поддержанным deployment.

Generic `/api/data/secretary*` и admin backup restore не пишут эти файлы. Импорт
не принимает secretary в `data`; `serverOwned` при импорте — только свидетельство,
он не восстанавливает авторитет. Экспорт включает envelope в `serverOwned.secretary`.
Полное удаление аккаунта удаляет envelope и его backup вместе с user directory.
Терминальные строки/receipts старше 30 дней подрезаются; capability suppression
остаётся. Предел 2048 receipts за окно возвращает 429, не стирает ранние receipts.

## HTTP

Все операции: `POST /api/secretary/next-moves`, authenticated cookie,
`X-Local-Day: YYYY-MM-DD`, `X-Tz-Offset: <целые минуты UTC→local>`.
`now` берётся на сервере; день обязан совпасть с серверным временем и offset.
Запрос не более 12 KiB. `clientId` и `requestId` — строки `[A-Za-z0-9_-]{1,100}`.
clientId хранится на время жизни вкладки (sessionStorage); requestId обозначает
одно намерение. Повтор отправляет исходное тело без изменения.

V255 decide/claim передают `supportedCapabilities:['after-lapse-return','planned-start']`.
Без поля сервер обслуживает только after-lapse-return для совместимости с v254;
неизвестные, повторённые или неверно заданные capability дают 400. Даже resume
не возвращает planned offer старому клиенту. Outcome работает с уже сохранённым
offer и повторяет исходный body независимо от версии клиента.

Общий `context` для decide/claim/accepted:

```js
{
  activeSession: { active: false },
  guide: { active: false },
  firstValue: { pending: false },
  lapse: null // либо ниже
}
```

Флаги обязательны, строго boolean. Сервер дополнительно читает актуальные tasks,
habits, habitlog, settings, days и first-value после account WAL recovery. Клиент
не может погасить сохранённый Guide/First Value/закрытый день. Активная локальная
Attention session остаётся локальным фактом.

Минимальная lapse-проекция: `confirmed:true`, `source:user_confirmed|boundary_measured`,
`eventKey:attention:<opaque episode id>`, day, endedAt, observedAt, необязательные
`originalRef:quest:<id>|habit:<id>` и boolean screenEpisode. Для boundary_measured
обязательны числовые actualMinutes > plannedMinutes. `originalStillActionable`
от клиента не используется: владелец и актуальность заново разрешаются по своим
сохранённым данным. Эпизоды local Attention не переносятся в серверную историю.
Отсутствие/просрочка lapse — молчание; неправильная проекция — 400.

### decide

```js
{ op: 'decide', clientId, requestId, invocation: 'app_open', context }
// 200 { ok:true, offer, silence:null, resume:null }
// 200 { ok:true, offer:null, silence:{reason}, resume:null }
// 200 { ok:true, offer:null, silence:{reason:'held'},
//       resume:{offer,token,persistedAt} }
```

invocation: app_open или manual; scheduler зарезервирован тем же policy API.
Рендер не повод заново выбирать. Decide не считается показом и не выдаёт права
показать. `resume` получает только вкладка с clientId текущего claim, только без
активных блокировок. Чужая вкладка получает quiet held.

### claim

```js
{ op:'claim', clientId, requestId, offerId, invocation:'app_open', context }
// 200 {ok:true,offer,token,persistedAt,repeat:false}
```

Сервер заново выбирает из актуального контекста, проверяет offerId и один общий
account surface. Только после durable receipt UI показывает карточку. Claim
атомарно пишет `offered` в ledger и delivery. Второе устройство/канал → 409 held.
Legacy card/push claims и v2 взаимно проверяют активную заявку до записи; legacy
чтение перенесено после async body read, чтобы не записать устаревший snapshot.
Историческое ограничение legacy same-channel identity этим не переписано.

Lease ограничен 15 минутами и концом исходного трёхчасового окна эпизода.
Перед следующим запросом сервер сохраняет `expired` у просроченных claims,
включая первый запрос после restart. Ушедший без ответа клиент не обязан проснуться
ради expiry. Повтор просроченного claim возвращает 409, а не право на новый показ.
Без новых запросов запись expiry откладывается до следующего обращения.

### outcome

```js
{ op:'outcome',clientId,requestId,offerId,token,
  outcome:'accepted',actionId:'primary',context }
// 200 {ok:true,outcome:'accepted',action,persistedAt,repeat:false}
```

outcome: accepted, dismissed, expired. `actionId` по умолчанию primary. Сервер
берёт action из сохранённого предложения, не из тела. Действие разрешено открыть
только после accepted receipt; оно ничего не завершает, не переносит, не начисляет
и не запускает таймер. Токен другого clientId → 403. Исчезнувшая/завершённая цель
или наступившая собственная вечерняя граница → durable expired + 409 stale_target,
без action. Активная локальная сессия/Guide/First Value/закрытый день → 409
context_blocked без принятия. UI повторяет явное намерение после исправления.

Повтор исходного requestId возвращает прежний token/persistedAt/action. Другое тело
с тем же requestId → 409 request_conflict. Тот же terminal outcome с тем же token,
clientId и actionId тоже возвращает прежний receipt при новом requestId. Другой
terminal outcome не переписывает историю. Для lost-response + reload UI хранит
pending outcome body в sessionStorage до успеха; terminal accepted не выдаётся как
новое предложение при обычном decide. Клиент повторно проверяет ссылку перед UI-open.

## Честные ограничения первого среза

### Browser v254

`client-v1` проверяет форму claim/receipt и совпадение action с выбранным вариантом;
`runtime-v1` координирует snapshot, повтор, срок и смену аккаунта; `ui-v1` содержит
31 locale-key в RU/EN/DE/UK/ES. Вход окна внимания предлагает необязательную явную
связь с существующим делом. Связь сохраняется в session и episode, включая extension.
После accepted UI открывает существующую строку quest/habit и обычный старт фокуса;
при отсутствии связи — один вопрос с живыми делами, отдыхом и планом.

Неподтверждённый outcome сохраняет точное тело в sessionStorage. Потеря ответа,
reload и повтор не создают второе намерение. Если пока шёл accepted RPC началась
сессия/обучение, подтверждённое открытие откладывается в той же вкладке до явного
retry. Просроченный, удалённый либо уже terminal offer сбрасывает pending только
после определённого ответа сервера. Таймер вызывает explicit expired; уже сохранённый
server expiry возвращает тому же владельцу успешный receipt без второго ignored.

Локальный автоматический return-dialog после escaped заменён этим каналом с claim;
ручной возврат остаётся в «Другой поддержке». После отказа он не занимает главный слот.
Legacy GET/claim теперь показывает ошибки чтения/422/malformed и retry через ту же
поверхность; только явный null/409 означает молчание. Legacy morning outcome transport
остаётся прежним и ещё не имеет нового frozen pending replay.

### Browser v255: planned-start

Подробный producer/server контракт — PLANNED-START-V255.md. UI показывает сохранённое
название и время, после accepted открывает ту же owner строку, как return. План
не переносится, задача не завершается и таймер не запускается автоматически.
Добавлены переводы planned copy на все пять языков. Формы клиента согласовывают
capability до показа, а сохранённый pending v254 по-прежнему можно повторить.

Producer сообщает следующую временную границу; runtime ставит один таймер до неё.
Повторный render не создаёт polling. Возвращение фокуса/видимости перепроверяет
контекст; скрытая вкладка и другой раздел не заявляют новый ход. Уход во время
decide проверяется ещё раз непосредственно перед claim. Принятое действие, чей
ответ пришёл после ухода, ждёт явного открытия на Сегодня. На следующий день
такое отложенное действие становится устаревшим; новый день не открывает вчерашний
план. dispose отменяет таймеры/listeners и не применяет поздний ответ старого runtime.

У RestProfileV1 есть чистый модуль, но в текущем runtime нет сохранённого меню и
его writer/UI. Поэтому транспорт не выдумывает restProfile в settings: сейчас
получается минимум того же живого quest/habit либо один вопрос. Отдых из будущего
сохранённого меню требует отдельного подключения owner и executor. Варианты
policy на базе неподключённых commitment.step тоже не подставляются вместо дела.

Неизвестный ledger/повреждённый файл: 422 invalid_secretary_state. Ошибка чтения
или сохранения: 500 secretary_read_failed/secretary_save_failed. UI сохраняет
pending намерение, показывает ошибку и явный retry; 500/422 не равны молчанию.
`SecretaryRouterV1.decide()` добавлен для различения ошибки и молчания. Старый
`next()` остаётся совместимым offer|null, но повреждённый ledger больше не
подменяется пустым; `mark()` при повреждении возвращает null.

Проверки: `secretary-next-moves-server-v1.test.js` запускает настоящий server.js
с отдельным DATA_DIR: ownership, competing devices/legacy, lost response/restart,
accepted/dismissed/expired, stale reference, блокировки, 500/422, export/delete,
Attention originalRef roundtrip. Policy/legacy/router/claim/push tests проверяются
рядом. Общий suite и browser/deployment QA выполняет интеграционный владелец.
