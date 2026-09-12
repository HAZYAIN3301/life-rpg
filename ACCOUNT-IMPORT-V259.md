# Переносимый аккаунт: атомарный импорт и сброс v259

12.09.2026. Следующий технический срез P0 из PRODUCT-CRITICAL-PATH-2026-09.md.
Состояние публикации и QA — верх DEVLOG; результаты тестов относятся к v259.

## Поведение

Импорт всех 21 разрешённых файлов и сброс settings/tasks/days используют один
существующий CommitmentJournalV1. При SIGKILL незавершённый журнал восстанавливает
весь прежний набор, committed-журнал — весь новый. Последовательного импортера
с откатом только в памяти больше нет. Перед записью сохраняются прежние backups;
надёжность общей транзакции обеспечивается durable WAL, не best-effort backups.

В журнал добавлены achievements/days/weeks/episodes/profile/boardmedia/attention/
shelf/questionnaire. Обязательная пара settings/tasks сохранена. Если этих файлов
ещё нет и импортируется другой раздел, создаются пустые defaults {} и [], как у
существующих feature writes. Остальные невыбранные файлы не изменяются.
Секреты, push/Strava/AI keys и серверные reward/claim ledgers не становятся portable.

## Протокол

Архив по-прежнему `{format:"satoru-account",version:1,data:{...}}`. Metadata архива
не даёт дополнительных прав. AccountImportV1 — чистые allowlist, проверка ticket/
receipt и пять локалей; сервер и браузер используют один модуль.

1. POST `/api/account/import/preview`: архив + `writeVersion:2`, стабильный
   `requestId`, текущая protected `base` клиента. Проверяет полный переход,
   questionnaire references и вместимость WAL без записи файлов/backup.
2. Сервер возвращает `ok`, точный `files`, `ticket` с version 1, requestId,
   SHA-256 канонических data, revisions каждого затронутого файла и settings/tasks,
   HMAC signature. Подпись привязана к текущему uid и серверному SECRET.
3. POST `/api/account/import`: тот же замороженный data/requestId, writeVersion 2
   и ticket. Подмена аккаунта/данных/подписи даёт 409 invalid_import_ticket;
   изменение любой revision — 409 import_revision_conflict до записи.
4. Если все выбранные файлы уже в точности равны кандидату, ответ `replay:true`
   без повторных writes/backups. Это подтверждение текущего результата, а не новый
   ledger наград. Если после успешного запроса файлы изменены, старый ticket
   не может перезаписать новые данные; требуется новая проверка.
5. Успех клиента требует `ok:true`, writeVersion 2, точных requestId/requestHash,
   files и boolean replay. HTTP 200 сам по себе не считается сохранением.

Тот же запрос можно повторить после перезапуска сервера, пока SECRET и revisions
актуальны. Отдельного браузерного WebCrypto требования нет: LAN HTTP сохраняется.
Legacy POST без writeVersion принимается тем же WAL и прежней graph/base проверкой;
защита revisions всех файлов относится только к современному ticket-протоколу.

## Клиент

Выбор архива запускает только preview. После ошибки «Повторить проверку» всё ещё
не сохраняет архив: проверенный кандидат ждёт отдельного подтверждения импорта.
Сброс требует RESET на каждом клике, замораживает кандидат и повторяет тот же body.
UI/state меняются после строгой квитанции. Перед reload импорта отменяются pending
Store writers, чтобы старая вкладка не затёрла импорт за декоративную паузу.

`Store.runExclusive` блокирует весь набор выбранных slots и protected pair.
accountId/writeEpoch/isConnected проверяются после file.text, fetch, response.json
и lock. Поздний 401 старого аккаунта не завершает новую сессию. После потери ответа
показывается неопределённый результат с повтором, а не ложное «ничего не изменено».
Конфликт, invalid archive, capacity и неподдерживаемое восстановление имеют отдельный
текст RU/EN/DE/UK/ES. Mobile h2 оставляет место кнопке закрытия >=42×42.

## Пределы и остаток

- Прежние пределы: data <=8 MiB, HTTP body <=9 MiB, journal <=16 MiB, depth <=80,
  bounded nodes. Before+after должны поместиться в журнал; отдельный 8 MiB архив
  поэтому не гарантирует допуска. 422 import_state_not_supported — без записи.
- Повреждённый before-state нельзя молча заменить валидным архивом: сначала
  восстановление текущих данных. Повреждённый WAL закрывает domain API; auth
  остаётся доступным. Проверка повторяется при завершении чтения HTTP body.
- Гарантии относятся к одному серверному процессу/существующему DATA_DIR. Это
  не distributed lock и не сериализация всех долгих async writers. Старую версию
  сервера не запускать поверх нового незавершённого WAL с расширенным allowlist.
- XP/gold/imported/старые предметы и правила их переноса не изменены. Generic,
  settings-only, mint/chest и provenance наград остаются отдельным P0. Нельзя
  называть этот релиз server-authoritative кошельком или закрытием всего P0.

## Проверки

Полный suite: 2510/2510 PASS, 0 skipped, concurrency 2; 61.6 s.
Новые HTTP тесты: preview без writes, чужой аккаунт, подмена ticket/данных,
revision conflict, restart/replay, отказ записи, legacy совместимость, corrupt WAL.
21 реальный SIGKILL checkpoint: после каждого из 20 файлов архива и после
committed-журнала; все 21 portable типа дополнительно покрыты pure WAL-тестом,
questionnaire references — существующими server integration tests.
Клиентские тесты исполняют реальные helpers/Store locks, включая lost reply,
неполную квитанцию, account/epoch/disconnected races и чтение файла.
Browser matrix и её границы — art-factory/account-import-v259/qa-receipt.json.

PWA CACHE satoru-v259; app/styles/account-import pin 20260912-import-v259-1.
Неизменённые Secretary/Вдохновение/экономические модули сохраняют прежние pins.
