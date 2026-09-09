# Economy writes v251 — сохранение раньше результата

09.09.2026. Продолжение разрешённой стройки после v250. Это надёжность существующих
действий, не новый магазин, новый баланс или решение художественного аватара.
Публикация и точные проверки фиксируются в DEVLOG и release receipt.

## Дополнение v252 — покупка внутри Guide Rewards

Опубликован runtime `5dc4096`, Railway success и точные live hashes проверены
09.09 15:37 UTC; полный suite 1955/1955 PASS. Release receipt —
art-factory/guide-purchase-v252/release-receipt.json.

09.09: v251 опубликован (release 8fd19ec, проверен 15:23 UTC). Новый современный
Guide Rewards путь вызывает тот же `economyCommit`, а не `/api/guide/commit`.
Результат GuideV3.reduce — settings с завершённым шагом — замораживается вместе с
покупкой. Первоначальный persistedAt/itemId/targetId сохраняется на retry.
Переход главы не показывается до ответа; после reload оба результата уже на сервере.
Проверяются account и Guide/Store epochs; смена аккаунта не применяет старый эффект.
Чужой rewardId не завершает выбранную главу. Общий economy mutex не вкладывается в
legacy Guide mutex по тем же Store slots. Отдельного кошелька/решения о переходах нет.

Старый guide endpoint по-прежнему поддерживается, с границами ниже. **Только текущая
покупка внутри главы** получила exact-CAS/replay; Calendar/Notes и прочие главы не
объявлены переведёнными. Проверки: scripts/guide-purchase-v252.test.js (4 сценария),
`ECONOMY_QA_GUIDE=1 node scripts/qa-economy-v251.mjs` (реальный Chrome+server,
lost-after-write/retry/reload + все прежние economy cases; отдельная папка v252).

## Что изменено

| Жест | Одна запись | Когда меняется интерфейс |
|---|---|---|
| Купить gear/косметику | settings + purchases | После подтверждённого ответа |
| Купить предмет/тему Логова | ownership + placement в settings и purchases | После подтверждения цены и записи |
| Надеть/снять gear/relic/косметику, поставить имеющийся предмет | settings | После записи; при ошибке прежний вид/эффект |
| Открыть игровой perk | skilltree | После записи; до неё нет unlocked, расхода очка и toast успеха |
| Получить сундук | lootbox + settings, если косметика | После записи запускается прежняя церемония |
| Обменять ваучер | lootbox + rewards | Вместе списание и добавление награды |
| Купить личную награду / удалить её из каталога | purchases / rewards | После записи, история покупок сохраняется |
| Покупка во время главы гайда | settings guide-progress + purchases | Прежний guide owner, теперь общий durable journal |

Пользовательские цены, редкости, лимиты, награды, вероятности и XP-формулы не менялись.
В Логове используется существующее окно цены, а не новая постоянная панель.
В подтверждении/reveal/каталоге/ваучере исправлен отсутствовавший непрозрачный фон:
текст остаётся читаемым в светлой и тёмной теме. Не изменён /compare.html.

## Контракт транспорта

`POST /api/economy/commit`, actor только из серверной сессии.

```js
{
  version: 2,
  economyBase: { // ровно затронутые слоты, snapshot последней подтверждённой загрузки
    purchases: { exists: true, value: [] },
    settings: { exists: true, value: previousSettings }
  },
  base: { settings: settingsSnapshot, tasks: tasksSnapshot }, // прежняя protected pair
  data: { settings: nextSettings, purchases: nextPurchases }
}
// 200 { ok: true, files, replay, snapshots }
// 409 economy_revision_conflict: не перезаписывать, предложить обновление.
```

Allowlist: settings/object, purchases/array, rewards/array, lootbox/object,
skilltree/object. `public/economy-write-v1.js` содержит только валидацию snapshots
и решение invalid/replay/conflict/commit; одинаково используется сервером и клиентом.
Сравнение JSON каноническое: порядок object keys не создаёт ложный конфликт.
Ровно совпавший after-state — replay без записи, даже с первоначальным base.
Иной текущий snapshot против base — 409. Более поздняя покупка не стирается ради replay.
Неизвестные файлы/невалидные types/base отклоняются. Payload data ограничен 2 МиБ.

Клиент замораживает тело одного жеста, id покупки, timestamp, выбранный исход сундука
и candidate состояния. Повтор отправляет те же байты. Подтверждение содержит actual
snapshots; только после проверки ответа/account/writeEpoch обновляется локальная база
Store и затем видимое состояние. Settings не теряется из списка из-за того, что
AccountDataV1.SLOTS предназначен для другого набора файлов.
Локальный exclusive lock включает settings/tasks и затронутые слоты.

Кнопки блокируются на время запроса (timeout 15 секунд). Escape/backdrop не закрывают
неподтверждённую покупку в полёте; после ответа закрытие снова доступно. После ошибки
есть повтор/фокус; текст не утверждает «ничего не списано», если ответ мог потеряться
уже после серверного commit. Совпавший replay не создаёт второй purchase/opening.

## Durable storage и совместимость

Использован **один существующий** `.commitment-journal-v1.json`, а не второй журнал
с независимым rollback settings. Обязательные settings/tasks сохраняются; optional
allowlist расширен purchases/rewards/lootbox рядом с goals/goal-groups/skilltree.
Старые journal schemas/checksums поддерживаются. Prepare сохраняет before/after,
prepared recovery откатывает весь набор; committed recovery доводит весь after-state.
Строгое чтение, существующие fsync/rename и corruption fences не обходятся.
Остановка процесса до завершения и после committed marker проверена настоящим SIGKILL.

Это гарантия текущего **однопроцессного** file-backed runtime. Для нескольких writers
или replicas нужна транзакционная БД/координация; этот релиз её не обещает.

Старый клиент без version/economyBase принимается ради совместимости и тоже получает
WAL, **но не новый exact-CAS для economy slots**. Старый protected-pair контракт остаётся.
Guide purchase использует этот legacy-compatible путь и общий WAL; task/inbox chapters
не переписаны. Лимит guide purchase теперь тот же 2 МиБ, остальные guide writes 4 МиБ.

## Честные границы: что ещё НЕ готово

- Это не серверный каталог с проверкой каждой цены/entitlement и не immutable ledger
  всех расходов. Generic account PUT/import ещё существуют. Клиентский snapshot нельзя
  считать защитой экономики от намеренной подделки. v250 raid receipts — отдельный
  server-owned авторитет; данный релиз их не ослабляет и не заменяет.
- Нет вечного общего operation ledger. Если после потерянного ответа уже произошла
  другая запись, первоначальный retry получает conflict, а не откат/двойное применение.
  Reload показывает реально сохранённые покупки. Закрытый диалог не хранит отдельную
  очередь операций на диске браузера.
- v252 переводит современную Guide Rewards покупку на общий completion transaction;
  полный exact-CAS/replay остальных guide действий/старых клиентов остаётся задачей.
- Переведён unlock игровых perks, не весь редактор дерева/reset/capability pipeline.
  Старые управления светом/reset/clear в Логове и titles не объявлены переведёнными.
- Не изменены полезность личных наград, наполнение магазина и вид экипировки Traveller.
  Универсальный аватар отложен владельцем; производственный стиль не заменён.
- P1 Тени, Вдохновение, канон и весь мультиплеер не закрыты этим исправлением.
  Владелец сообщил о запуске выданного пакета в другом Codex; его результат пока не получен.

## Воспроизводимая проверка

- `node --test --test-concurrency=2 scripts/*.test.js`: 1951/1951 PASS на runtime-кандидате;
  `/private/tmp/satoru-v251-verified.log` (09.09). Повторять после новых runtime edits.
- `scripts/economy-write-v251.test.js`: pure CAS/replay, старый+расширенный WAL,
  реальный API с двумя synthetic accounts, SIGKILL rollback/roll-forward, concurrent
  divergent writes, stale retry, guide crash/retry, auth и повреждённый журнал.
- `node scripts/qa-economy-v251.mjs`: настоящий Chrome + временный DATA_DIR; покупка
  с потерянным ответом после записи, экипировка/perk при 503, Логово, reload, сундук,
  ваучер, RU/EN/DE, 375/1280, light/dark, reduced motion и отсутствие overflow.
  Итог browser run — `art-factory/economy-v251/receipt.json` (complete должен быть true).
- Скриншоты и release hash/status receipt — в той же папке. Реальные аккаунты/ключи,
  платные модели и личные данные для проверок не использовались.
