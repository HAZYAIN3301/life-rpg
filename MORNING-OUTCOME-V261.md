# Утренний ответ: повтор после потерянного ответа сервера

2026-09-13. Узкий transport-срез для существующего `morning-recovery`.
Владелец: `secretary-ledger.json`; заявка остаётся в `secretary-claims.json`.
Нового ledger, AI-вызова, push-канала, награды или маршрута нет.
После after-lapse-return/planned-start/evening-close по-прежнему работает прежняя
арбитрация [next-moves](SECRETARY-NEXT-MOVES-TRANSPORT-V1.md).

## Исправленный путь

Раньше `reportSecretaryOutcome()` убирал карточку до fetch, не проверял HTTP/body,
а обычный CTA открывал поверхность параллельно запросу. Повтор `POST /offer`
перезаписывал время исхода. Потеря ответа означала неопределённый результат.

Теперь один выбор accepted/dismissed сначала фиксируется в `sessionStorage`
этой вкладки. POST отправляет точный `bodyJSON`; повторный клик, rerender,
другая дата и reload не собирают новое намерение. На показе остаётся existing
secretary error/retry surface; открытие существующего диалога разрешено только
после проверки квитанции и её локального сохранения. Вопрос с пустым `domAction`
сохраняет accepted без выдуманной поверхности.

## Additive HTTP protocol

`POST /api/secretary/offer`, authenticated session:

```js
{
  version: 1,
  accountId: 'account-id',
  offerId: 'morning-recovery|2026-09-13|attention.escaped|2026-09-12|opaque-ref',
  cooldownKey: 'morning-recovery|2026-09-13',
  token: 'the-received-card-claim-token',
  state: 'accepted' // or dismissed
}
```

День календарно валиден; offerId начинается с cooldownKey + `|`. Unknown fields,
version/state и слишком длинные строки отвергаются. accountId обязан совпадать
с текущей cookie-сессией. После чтения request body сервер повторно проверяет
действительность сессии, затем выполняет синхронный read/validate/atomic write.
Для первой записи требуется собственный сохранённый card claim с тем же токеном.
Истечение lease само по себе не отменяет выбор уже показанной карточки; замена
или отсутствие claim без сохранённого receipt даёт определённый отказ.

Ответ 200 — все поля исходного body плюс:

```js
{ ok: true, persistedAt: '2026-09-13T08:00:00.000Z', repeat: false }
```

В одной строке существующего ledger сохраняются вместе факт и квитанция:

```js
delivered[cooldownKey] = { at: persistedAt, state, receipt }
```

Receipt содержит ровно нормализованный body и поля подтверждения. Один терминальный
исход на cooldownKey — естественный ключ повторяемости; отдельного request ledger
или requestId нет. Повтор идентичного body возвращает тот же persistedAt и
`repeat:true` **без записи файла**, даже если claim уже подрезан/заменён. Изменённый
token/offerId/state не переписывает подтверждённый исход. Другие строки ledger,
claim и v2 envelope не затрагиваются.

`SecretaryRouterV1.sanitizeLedger()` сохраняет и строго проверяет optional receipt.
`mark()` сохраняет подтверждённую строку при позднем push/старом вызове. Legacy body
`{cooldownKey,state}` остаётся совместимым: одинаковый terminal ответ возвращает
`{ok:true}`, попытка перезаписать v261 receipt даёт 409. Старые строки без receipt
не мигрируют автоматически; v261 может дополнить одинаковый старый исход квитанцией
при наличии своего claim. Не заявляется исправление всех исторических legacy writes.

## Ошибки и восстановление

| Ситуация | Результат |
|---|---|
| 401 | Текущая сессия закрывается; поздний 401 другого account/epoch игнорируется |
| 403 account_changed | Нет записи/открытия, frozen pending сохраняется |
| 400 bad_outcome | Нет записи/открытия, ошибка вместо молчаливого успеха |
| 409 terminal_outcome / offer_not_found | Определённый отказ; pending снимается, видна причина и refresh |
| 422 invalid_secretary_state | Повреждённые данные не заменяются пустыми; pending и retry остаются |
| 500 secretary_read_failed / save_failed | Предыдущий ledger сохраняется; повторяется то же намерение |
| Offline, malformed/mismatched receipt, timeout | Нет успеха, остаётся тот же body |
| Ошибка записи pending в sessionStorage | HTTP не начинается; выбор остаётся в памяти для retry |
| Ошибка локального сохранения receipt | Нет UI-успеха; повтор получает уже сохранённый server receipt |

Timeout 15 секунд охватывает HTTP headers и response body. Abort не означает
отмену серверной записи: повтор использует те же байты. Позднее завершение
запроса после timeout не исполняет действие.

SessionStorage key: `satoru.secretary.morning.<accountId>`. Envelope содержит
version, bodyJSON, allowlisted domAction и optional receipt; текст цитаты,
названия дел, browsing history и новый контекст туда не копируются. В новом
аккаунте это намерение не читается. Runtime и загрузчик offer проверяют account
и `Store._writeEpoch`; logout/dispose запрещает применение позднего ответа.
Карточка помечена account/epoch, чтобы старый видимый CTA не отправился от нового
контекста. Reload того же аккаунта восстанавливает pending без автоматического POST
или открытия: нужен явный retry.

При нечитаемом/невалидном локальном record retry повторяет чтение. В той же error
surface доступно **«Продолжить без повтора»**: оно касается только неизвестного
legacy pending этой вкладки, пробует убрать этот один local key и приостанавливает
legacy morning transport до reload. Server ledger/claims не меняются, v2 next moves
снова доступны. При недоступном sessionStorage удаление не заявляется успешным:
на следующем reload ошибка может появиться снова. Валидное отправленное намерение
этой кнопкой удалить нельзя. Повреждение одного local record не запирает весь день.

## Открытие после подтверждения

Сохраняется прежний приоритет живого Attention, обучения и First Value. Пока morning
pending/ошибка занимает существующий слот, next-moves wake не заявляет скрытый offer.
В момент открытия повторно проверяются Today, видимость, незакрытый день, отсутствие
живой сессии/Guide/First Value. Если контекст изменился во время RPC, confirmed receipt
остаётся для явного retry; повторного HTTP уже не требуется. Вчерашнее accepted
подтверждается как сохранённое, но не открывает вчерашний шаг сегодня.

Контракт `env.open` **синхронный**: текущие `openAttentionReturn`,
`openRecoveryLauncher`, `openEveningLanding` возвращают созданный overlay.
Adapter не запускает async owner-write и не возвращает Promise; такой будущий
executor потребует отдельного await/account-guard контракта. Null/false/синхронный
throw оставляет receipt для retry. Таймер, выполнение и награды здесь не запускаются.

## Проверки и интеграция

`scripts/morning-outcome-v261.test.js`: pure receipt/ledger roundtrip, async
replay/reload, двойной ответ, malformed/timeout/401, account/epoch/dispose, quota,
deferred/stale opening, corrupt local recovery, реальный app click adapter через VM.
`scripts/morning-outcome-server-v261.test.js`: настоящий server.js с временным
DATA_DIR, lost-response + SIGKILL restart, точные байты повторного запроса и ledger,
ownership/claim proof, отсутствие/подрезка claim, конкурирующие решения, read/write
failure и corruption. Старые secretary/claim/next-moves tests проверяются рядом.

На child-кандидате: `node --test --test-concurrency=2 scripts/morning-outcome*.test.js
scripts/secretary*.test.js` — **445/445 PASS**, 0 skipped. Синтаксис изменённых JS
и `git diff --check` прошли. Это профильный прогон, не полный интегрированный suite.

Интегратор подключает `morning-outcome-v1.js` до app.js, добавляет его в SHELL,
поднимает CACHE/pins нового helper, app и secretary-next-moves-ui; обновляет status docs
и выполняет full suite + browser QA на общем кандидате. Child не меняет index/SW/cache
и не публикует. Для browser QA: accepted/dismissed, потерянный ответ+reload+retry,
смена аккаунта/сессии, повреждённый pending+continue, RU/EN/DE/UK/ES, dark/light,
375/1280, keyboard/touch/reduced motion. VM/HTTP тесты не заменяют эту визуальную проверку.
