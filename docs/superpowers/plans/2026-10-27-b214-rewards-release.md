# B2.14 — Rewards integration and B2.5 release

**Goal:** Проверить полный раздел Наград в основном B2.5 и выпустить его вместе с
утверждённой структурой/Сегодня/Планом на сайт и в текущую TestFlight-оболочку.
**Architecture:** Один canonical app.js и source economy/CAS/WAL; LiveRewards —
только интерфейс. Чистая release-ветка от origin/master; rejected d203502b не предок.
**Spec:** Запрос владельца 27.10; B211-QA.md, B213-INTEGRATION.md,
ECONOMY-WRITES-V251.md, PURCHASE-ENTITLEMENTS-V258.md и более новые source contracts.
**Execution:** Выполняю сам; подагенты запрещены. B2.5 уже утверждён; повторной
приёмки дизайна не требуется. Публикация для всех явно разрешена ответом владельца.

## Constraints and review focus

- Сохранить личные награды/картинки/цены, каталог, историю, сундуки, инвентарь,
  достижения, накопления, жизненный цикл и связанные квесты. Не менять экономику.
- Один жест → одна durable покупка; отмена не списывает, retry не создаёт дубль.
- Старые receipts неизменны после rename/delete; used/deferred не меняет золото.
- Source ошибки/actor/epoch/load/conflict guards не обходить; no direct JSON/PUT.
- QA записи только в изолированном localhost Тестовом герое; production без входа.
- Light/dark,375/1280, locale и keyboard; найденные дефекты исправить одним проходом.
- Без native remote/first push и новой Apple upload: текущий WKWebView получает web root.

## Tasks

- [x] Inventory: сравнить LiveRewards/bridge с renderRewards и source contracts;
  проверка всех reachable исходных владельцев без новой реализации кошелька.
- [x] Root QA: создать свою награду, cancel/buy/double tap/reload, rename/delete,
  history, insufficient funds, lifecycle и rest→Plan→complete/undo; readback API.
  Файлы: src/live/LiveRewards.tsx, rewards-bridge.js, rewards-model.ts,
  rewards-live.css. При дефекте — точный failing regression до минимальной правки.
- [x] Проверки: оба build, live/model/baseline, профильные HTTP/CAS/economy tests,
  полный suite concurrency2 на чистом release-кандидате, byte contracts.
- [x] Release: свежий fetch, FF чистого кандидата в master, Railway success нужного
  SHA; root/app/UI/runtime/SW hash-check обоих доменов, published no-login UI.
  Не считать git push равным deploy. Не трогать пользовательские production записи.
- [x] QA/release receipt, DEVLOG/BACKLOG и native CHECKPOINT; ясно отличить web
  проверку от физического iPhone и фактической доступности Apple build.
