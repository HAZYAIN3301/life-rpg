# Chest rewards v260

## Интегрированная выдача и её границы

`POST /api/rewards/chest` принимает только version, requestId, IANA timeZone и
точные snapshots пяти сохранённых коллекций. Приз и произвольная дата в запросе
не допускаются. Сервер использует текущие часы и crypto entropy. Lootbox, новое
cosmetic право в settings и private `chest-receipts.json` входят в один существующий
CommitmentJournalV1 WAL с обязательной парой settings/tasks. Второго журнала нет.
Generic GET/PUT/POST, portable import и admin backup restore не могут записать ledger.

Private cursor хранит day/opened/carry. Первый server claim использует legacy
состояние; последующие открытия и перенос дня опираются на уже выданные попытки.
Импорт сохраняет личный gold/XP/items/history, но не сбрасывает cursor. Auth/me
отдаёт только cursor (без private receipt rows), поэтому UI после reload/импорта
показывает действительное число попыток. Повреждение ledger отключает сундуки,
сохраняя доступ к личному аккаунту. Все обычные generic wallet writes этим не закрыты.

128 последних небольших receipts содержат request fingerprint, prize, прежний
cursor и hash фактического after-state. Точный повтор после потери ответа не
выбирает второй приз и не пишет файлы. Если после выдачи состояние изменилось,
повтор даёт `chest_receipt_state_changed`; более старые request IDs не дают права
обойти cursor/CAS. Сервер не возвращает старый снимок поверх новых данных.

Browser freezes body/account/epoch, сериализует пять затронутых slots через Store,
проверяет точную квитанцию и только затем применяет значения/показывает результат.
Chest-specific 409 не ставит весь аккаунт в commitment-conflict. Кнопка получения
и необязательная церемония доступны только после подтверждения. Ответ старой сессии не меняет новый аккаунт. Legacy числовые vouchers мигрируются только в
разумных конечных границах; invalid/absurd значения не запускают огромный Array.from.

Полный suite: **2621/2621 PASS**, включая настоящий HTTP и SIGKILL после каждого
из settings/tasks/lootbox/chest-receipts и после committed journal. Browser QA:
реальный потерянный ответ/retry, reload, malformed/500, RU/EN/DE/UK/ES на 375px,
1280px dark/light (20 сочетаний); controls 42–44px, отсутствие horizontal overflow и focus trap.
Опубликовано `b4b4150`: Railway app/TTS success, 41/41 production bytes совпали
12.09 21:41:57 UTC. Receipt — art-factory/critical-path-v260/release-receipt.json;
production mutation не выполнялась, функциональные сценарии проверены на synthetic account.

## Чистая политика и каталог

`public/chest-reward-policy-v1.js` — общий browser/Node расчёт из **сохранённых**
`settings`, `tasks`, `habitlog`, `skilltree`, `lootbox`. Модуль не читает `State`,
часы или entropy самостоятельно и не сохраняет файлы. Durable receipt, повтор,
сессия и единый account WAL принадлежат транспорту/серверу.

- `normalize(context, { now, timeZone })` возвращает `{ ok, lootbox, day,
  activity, earned, available, bonusPct }`. Время — epoch milliseconds или
  timestamp ISO с часовым поясом; `timeZone` — проверенный IANA zone.
- `odds(context, options)` возвращает `{ ok, rows }` с прежними раскрытыми
  процентами и фактическими размерами пулов.
- `grant(context, { now, timeZone, requestId, entropy: [u0,u1,u2] })`
  возвращает `{ ok, prize, historyEntry, data, day, available, remaining }`.
  Три числа — конечные `[0,1)`, полученные сервером. При ошибке —
  `{ ok:false, reason }`, без частично изменённого владельца.
- Для проверки квитанции `grant` принимает **вместо entropy** `prize` и
  заново вычисляет весь переход. `grantValid(context, options, candidate)`
  сравнивает полный результат либо точную проекцию
  `{ prize, at, day, remaining, data }`. Внешний transport проверяет остальные
  поля квитанции, аккаунт, запрос и snapshots. Переданный в HTTP запрос prize
  не является допуском: серверный endpoint получает entropy сам.

Нейтральные призы имеют ровно один из трёх форматов:

```js
{ type: 'gold', rarity: 'common', amount: 40 }
{ type: 'cosmetic_capsule', rarity: 'rare', cosmeticId: 'fr_silver' }
{ type: 'reward_voucher', rarity: 'legendary', rewardName: 'Поездка на выходные' }
```

`prizeValid` проверяет точный shape, настоящий каталог и соответствие редкости;
`grant` дополнительно проверяет фактическую сумму с перком и отсутствие
косметики у владельца. Data содержит только lootbox и, при новом образе, settings
с добавлением ровно одного token. Ваучер добавляет прежнюю rarity в vouchers;
имя выпавшего предмета хранится в prize/history и не меняет действующее правило
обмена ваучера на награду своего или более низкого тира.

Экономика сохранена: пороги **1/3/5**, carry cap **5**, редкости **60/28/10/2**,
типы **55/30/15**, gold **40/80/150/300**. Только открытые practice-узлы дают
существующий `dailyRewardGoldPct`: сначала cap каждой сферы, затем общий **0..30%**.
Capability/milestone не дают этот игровой бонус. Пустой косметический пул
убирает только тип косметики своей редкости, перераспределяя его вес; повторной
косметики нет. Pro не меняет шансы или число открытий.

`public/reward-catalog-v1.js` переносит все 33 строки прежнего REWARD_CATALOG:
имена, цены, порядок, emoji, iconId. Digest полного JSON совпадает с кодом v259
`3f0da11`: `c48525facb90ba465c95ad945a8fc1e6812e40c151f4de48874771cf014bdc46`.
Редкость по цене использует прежние границы ShopCatalogV1 **450/900/1800**.
Цены, XP, личный импорт и существующие права не перебалансированы.

## Даты и совместимость

Засчитываются прежние completed обычные tasks (без generated Entry) и ключи
habitlog данного дня. completedAt переводится в civil date в **переданном**
часовом поясе; timestamp перекрывает task.date. Старый task.date без completedAt
остаётся civil date. Некорректные/несуществующие даты не дают активности.
Date-only completedAt сохраняет прежнюю интерпретацию UTC; local ISO без offset
означает local civil date переданного пояса, а не системный пояс сервера.

При смене дня carry вычисляется точно по прежнему правилу:
`min(5, max(0, earned(previous recorded day) + carry - opened))`.
Дни отсутствия между сохранённым и сегодняшним днём ничего не создают.
Невалидный/отсутствующий прежний день не даёт активности: сохраняется только
неизрасходованный carry. Валидный будущий день возвращает `chest_future_day`
без сброса opened; перенос часового пояса назад не открывает день повторно.

Прежние boost/titles/equipped, неизвестные imported поля и элементы старых
массивов сохраняются. Числовые legacy vouchers становятся common как раньше,
с округлением длины вниз. Устаревшие customWeights удаляются только при прежней
миграции economyV124. История нового открытия содержит стабильный requestId,
ISO at, нейтральный prize и читаемую старым клиентом label (`+40` или имя
предмета из каталога). История ограничена прежними 40 записями.

Отсутствующие owner slots пусты; явно null/неправильный тип отклоняется.
Безопасные старые числовые строки нормализуются; отрицательные счётчики открытий
не увеличивают допуск. Небезопасная арифметика, циклы/getters/унаследованные поля
и чрезмерные структуры отклоняются. Пределы: 100 000 элементов коллекции,
1 000 000 проверенных JSON значений, глубина 64; чрезмерный legacy voucher count
не приводит к неограниченному выделению памяти. Это технические границы обработки,
не новый источник доверия к личному прогрессу.

## Проверка чистой части

`node --test scripts/chest-reward-policy-v260.test.js`: 28/28 PASS.
Проверены точный каталог, thresholds/carry/absence, DST/несколько системных TZ,
исключение Entry, старые ваучеры и history, границы вероятностей, отсутствие
дубликатов, practice perk cap, все три точных перехода, подмена prize/data,
повтор requestId, capacity и одинаковое исполнение browser/Node.
Эта проверка не утверждает готовность server WAL, браузерного UI или deployment;
результат интегрированного кандидата фиксирует основной агент.

Дополнительная проверка транспорта без файловой системы:
`scripts/chest-claim-v260.test.js` — 18/18 PASS. Настоящие issuer/receipt модули
и in-memory atomic commit проверяют три приза, exact snapshots, lost-response
replay без нового draw, отказ записи, изменённый requestId/base, импорт старого
lootbox при сохранённом частном cursor, повреждение ledger и ограничение 128 receipts.
Ledger с непустой историей не может потерять cursor, сменить его последний день
или содержать невалидный сохранённый часовой пояс.

`scripts/chest-runtime-v260.test.js` — 16/16 PASS. Отложенные fetch/JSON проверяют
тот же настоящий issuer receipt, отсутствие эффекта до квитанции, неизменные bytes
повтора, 401, неполные/подменённые ответы, смену аккаунта/epoch и поздние ошибки.
Инициализация requestId/base/crypto возвращает управляемый отказ; исключение старого
запроса не переписывает feedback новой сессии. Код `chest_unavailable` имеет
отдельный текст на RU/EN/DE/UK/ES. Вместе три узких набора — 62/62 PASS;
syntax/diff checks PASS. Browser layout и настоящие HTTP/SIGKILL checks отдельно.
