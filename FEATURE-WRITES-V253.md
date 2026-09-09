# v253 — гайд, привычки, покупки, Логово одним пакетом

09.09.2026. Продолжение v251/v252 по запросу владельца работать более крупными
законченными пакетами. Новых панелей, цен, моделей/API и арта нет.
Проверки и фактическая публикация — верх DEVLOG.

## Результат

| Действие | Гарантия |
|---|---|
| Заметка в обучении | inbox + Guide одним WAL; повтор сохраняет ID, текст и даты |
| Расписание в обучении | tasks + Guide вместе; потеря ответа не требует второго переноса |
| Создание привычки в обучении | habits + Guide одним WAL; замороженный кандидат живой формы |
| Отметка / две минуты / отмена / правки привычки | точная база; повтор отметки не создаёт новую дату/XP |
| Свет / ambient / питомцы / очистка слота / сброс Логова | внешний вид и звук успеха после подтверждения |
| Звание коллекции | подтверждённый транспорт экипировки, а не молчаливое сохранение |
| Покупки | сервер сверяет цену, баланс и историю; предмет и списание — одна запись |

Pure GuideV3 остаётся единственным владельцем перехода шага. Guide Rewards использует
v252 economy transport. Содержание и порядок глав не переписывались.

## Протокол

EconomyWriteV1 сохраняет прежний default allowlist и предоставляет два отдельных
snapshot-policy: guide(settings/tasks/inbox/purchases) и habits(settings/habits/
habitlog/antihabits). Один алгоритм invalid/replay/conflict/commit; allowlists не смешиваются.

POST /api/guide/commit и /api/habits/commit современного клиента:

```js
{ version: 3, featureBase: { /* ровно изменяемые slots: {exists,value} */ },
  base: { settings: previousSettingsSnapshot, tasks: previousTasksSnapshot },
  data: { /* прежний разрешённый набор endpoint */ } }
// {ok:true, files, replay, snapshots}
```

Совпадение after-state — replay; другая база — 409 без перезаписи. Клиент проверяет
snapshots и account/writeEpoch перед Store/UI. Timeout 15 секунд, идентичное тело на
повторе. Guide timestamp замораживается вместе с feature. Mutex включает settings/tasks,
вложенных locks нет. Черновики очищаются при logout.

Общий .commitment-journal-v1.json расширен inbox/habits/habitlog/antihabits.
Required settings/tasks, schema/checksum и старые журналы сохранены. Prepared recovery
откатывает всё; committed recovery доводит всё. GET/generic writes новых slots сначала
восстанавливают журнал. Старые клиенты без version получают WAL, но не новый exact-CAS.
Гарантия относится к однопроцессному file-backed runtime, не к распределённой БД.

## Серверные покупки и честные ограничения

ShopCatalogV1 — единственный источник GEAR/FRAMES/BACKGROUNDS/DEN_THEMES/DEN_ITEMS
и COSMETIC_PRICES. Browser и сервер используют те же данные. Массивы/записи заморожены;
равенство прежним каталогам проверено, цены/названия/редкости/арт не изменились.

PurchasePolicyV1 на economy и Guide purchase endpoints, включая legacy без version:

- не позволяет менять/сокращать префикс истории, повторять ID или выдавать purchase
  за освобождённый от списания legacy oath/reckon;
- требует ровно один известный target и конечную неотрицательную цену из каталога;
- личную награду сверяет с уже сохранённой rewards, не с новой ценой из payload;
- требует соответствующего ownership в том же settings candidate для gear/cosmetic/
  платного предмета комнаты; отклоняет покупку уже имеющегося;
- сверяет трату с балансом из сохранённых tasks/habitlog/goals/lootbox и server-owned
  admin credit/party receipts; присланные вместе с покупкой начисления не учитывает;
- при отказе не сохраняет ни предмет, ни списание. Старые записи не исправляет задним числом.

**Это не полная античит-экономика.** Начисления и import/generic writes ещё клиентские.
Не обещать неподделываемый кошелёк, защиту всех ownership/Pro/level gates или immutable
mint/spend ledger. Нельзя использовать уровень лидерборда вместо личного — у него
намеренно другая формула. Следующий этап: единый контракт личного баланса/entitlement
и миграция всех источников/импорта без списания прежних прав.

## Проверки и остаток

scripts/feature-writes-v253.test.js: 16 новых behavioral/integration tests. Реальный
SIGKILL после каждого feature slot и committed marker (Notes/Calendar/Habits/log),
replay, параллельный conflict, auth, corrupt WAL. Pure purchase negatives и реальное
API отклонение подменённой цены/overspend/history. Старые assertions о вероятностях,
ценах, mutex и сохранении адаптированы к общим модулям, не ослаблены.

FEATURE_QA_V253=1 node scripts/qa-economy-v251.mjs: реальный Chrome, временный DATA_DIR,
синтетический аккаунт. Формы Notes/Calendar/Habits, lost-after-write/retry/reload,
отметка+Undo, Den light/reset, затем весь v251/v252 economy QA.
art-factory/feature-writes-v253/receipt.json: 15 групп, screenshots RU/EN/DE,
light/dark, mobile/desktop, reduced motion, errors. Полный suite/release — DEVLOG.

Нет долговечной браузерной очереди повторов. После закрытия формы/reload читается
серверный результат; после чужой записи будет conflict. Не каждый composer сохраняет
gesture ID через уничтожение DOM. Остальные Guide механизмы (первое выполнение,
view-only события, voice) сохраняют прежних владельцев, не объявлены новым WAL.

QA также показал прежнюю узкую композицию capture в Notes и стопку toast-ов после
ошибок/массовых достижений: это отдельный UX-долг, не «полный редизайн».
/compare.html и production-аватар не менялись. Пакеты другого агента №2/№3/№4 не трогались.
