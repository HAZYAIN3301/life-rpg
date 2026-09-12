# Supply Вдохновения: runtime integration, 11.09.2026

Изолированная ветка `inspiration-integration-v1` от
`f142bb11ebf397e1578f1dc88595d661a72c00dc` (v254). Исходные пакеты сохранены;
сюда перенесены `bbc86d3` → `63565a5` и `3c18d772` → `230bdef`.
Этот commit подключает пакет к реальному пути приложения. Push/deploy выполняет
корневой интегратор после своих secretary slices; здесь публикации не было.

## Что изменено

`inspirationSupply()` передаёт обязательные `day`, `now` и текущую locale в
`InspirationSupplyRuntimeV1.ensureDigest()`. Admission, язык, допустимая частота
и `toCatalogRows()` происходят до существующего `InspirationProfileV1.choose()`.
Ранжирование, taste profile и структура дневного digest не переписаны.

Четыре прежних app-вызова `P.ensureDigest` заменены в `shelfViewModel`,
`saveInspirationSetup`, `markInspirationDone`, `recordInspirationFeedback`.
`inspirationCatalog()` возвращает только admitted строки. Ошибка загрузки модуля
прерывает настройку и запись; она не становится пустым настроенным профилем.

`resolveSaved()` находится в supply runtime. Сохранённый `catalogId`, которого нет
в текущем admission, получает `supplyUnavailable` и пустые resolved media/source
URL. Оригинальный сохранённый объект не изменяется: остаются title, note, why,
архивация/удаление. App не восстанавливает YouTube embed из прежнего URL, а source,
rights и playback handlers повторно проверяют допуск. Разрешённый материал берёт
source URL из текущего манифеста; переход «Источник и права» сохраняет именно
rights URL. Самостоятельные URL без `catalogId` остаются в прежнем attention flow.

Пять locale-версий новых состояний находятся в отдельном
`inspiration-supply-ui-v1.js`. `return-shelf-ui-v1.js` различает языковой пробел,
отсутствующий запас, незавершённую проверку, временную нехватку и ограничения
профиля. Показывает более короткую подборку/нехватку форматов, а при выпадении
зафиксированных ids — факт отсутствия замены. Сохранённая недоступная карточка
показывает личный текст и статус без кнопок проигрывания/открытия источника.

Все 11 прежних IDs остаются в манифесте. Сейчас admitted **9 собственных текстов**
на пяти языках: 3 прежних и 6 новых. **8 внешних материалов ожидают проверки**.
Видео/аудио здесь не выдаются за проверенные; `HEAD`, HTML, oEmbed и права сами
по себе не доказывают playback. Точечные факты и источники сохранены в
`INSPIRATION-SUPPLY-INTEGRATION-V1.md`. Ни одного внешнего media-файла не скачано.

## Сохранение и проверенные отказы

`Store.updateNow('settings', build, applyCommitted)` остался единственным путём
записи профиля. Общий Store, paired settings/tasks commit и его CAS/retry не
изменялись. Supply не добавляет PUT, локальную базу или новый журнал транзакций.

После неподтверждённого сохранения `State.settings` не получает раннюю отметку
успеха, нет success sound/telemetry, введённая причина feedback остаётся в форме.
Ошибка видна в Подборке, редакторе настройки и Сохранённом. Текст ошибки сообщает
о неполученном подтверждении: он не обещает, что сервер ничего не записал при
потере ответа. Повтор того же feedback сходится к одной записи по itemId и одному
doneId. Повтор уже подтверждённого Done и Done вне текущего digest — no-op.
Busy guard не позволяет второму клику отправить конкурирующее действие.

Весь хвост старого сохранения после смены account/writeEpoch прекращается,
включая очистку нового draft и UI. Аналогичная проверка стоит после асинхронного
обогащения video references перед финальным сохранением настройки.

`scripts/inspiration-supply-app-v1.test.js` исполняет извлечённые реальные app
functions и реальный Store. Домен supply/profile/shelf, parser ответа сервера и
paired payload validator также настоящие. Подменены только сеть, DOM/UI effects
и широкие gates для минимального аккаунта. Инъекции: HTTP 503, network fail до
записи, commit с потерянным ответом, paired 409 + refresh + retry, confirmed
corruption refusal, pending write + double click, pending write + account switch,
setup failure/retry и смена аккаунта во время reference enrichment. Проверены
конечные server/client snapshots, feedback reason, ids, отсутствие раннего
успеха и дубликатов. Это не browser E2E и не доказательство внешнего playback.

## Релизные шаги интегратора

В index уже добавлены четыре supply scripts в порядке policy → batch → runtime
→ UI после profile/catalog и до ReturnShelf UI/app; в SW все четыре добавлены
в SHELL. **CACHE, app/PWA version и существующие shared pins не менялись**.
Новые entries пока без query pin: интегратор задаёт единый фактический release pin,
обновляет изменённые `inspiration-catalog-v1.js`, `return-shelf-ui-v1.js` и app,
затем CACHE/PWA version в своём выпуске. Старые version-pinned regression gates
должны обновляться только вместе с выбранным номером релиза.

Browser review на итоговой интеграции: 375×812 и 1280×900, dark/light;
1) настройка quote+video и reload сохраняют конечные ids и объяснение thin formats;
2) профиль только anime/video показывает ожидающую проверки supply, без iframe;
3) saved denied catalogId сохраняет личную заметку и доступные archive/delete;
4) 503/lost reply при feedback/Done/setup не создаёт success до подтверждения,
повтор сохраняет тот же ответ; 5) все пять locale empty/error states читаемы;
6) keyboard, reduced motion и граница открытия личной URL остаются рабочими.
Синтетические language-gap fixture допустимы лишь в тестовом browser контексте,
не в production batch. Root выполняет этот browser review после cherry-pick.

Полной истории показов пока нет: cooldown использует известный предыдущий digest
и feedback, но **не гарантирует 45 дней по всем показам**. `reviewQueue` остаётся
чистой ограниченной очередью для оператора; периодический сетевой recheck ещё
не подключён. Ни новая persistence схема, ни scheduled checker не объявляются
готовыми этим изменением.

## Проверки

Исходный пакет ранее: 2032/2032; подготовленный пакет: 2053/2053 (10.09).
Текущие targeted inspiration/shelf/settings проверки: **153/153**, exit 0.
Полный изолированный suite: **2214/2214**, 46.08 s, exit 0 (11.09),
`node --test --test-concurrency=2 scripts/*.test.js`.
Node syntax checks и `git diff --check`: exit 0. Browser review и production
playback остаются явно отделёнными от этих Node-проверок.

## Проверка при интеграции v257, 12.09

Read-only review относительно v256 (`e269cf7`) выявил унаследованную гонку
`saveInspirationCatalogItem`: поздний ответ добавления A присваивал весь
`local.state` уже вошедшему B. Новые guards общего Store не защищают отдельный
ShelfStore. Исправление ограничено `ShelfStore.add/save`,
`saveInspirationCatalogItem` и `commitShelf`; общий Store не меняется.

Аккаунт и writeEpoch фиксируются перед сетью, проверяются после fetch/JSON и
перед применением результата в UI. Поздние 200, 401, 500 и network rejection
не меняют shelf/busy/error/focus нового контекста, не закрывают его сессию и не
выдают чужой success. Это относится также к восстановлению карточки из архива.
Свежий 401 по-прежнему завершает текущую сессию. При lost reply интерфейс сообщает
о неполученном подтверждении; успешный повтор очищает ошибку. POST повторяет
стабильный id, поэтому существующий серверный upsert не создаёт вторую карточку.

`inspiration-shelf-write-guards-v1.test.js`: 34 сценария исполняют фактические
ShelfStore и app handlers; подменена только сеть и UI effects. Проверены отдельно
смена аккаунта и смена writeEpoch, поздние 200/401/500/rejection, смена scope во
время чтения JSON, текущие 401, отказ/повтор и commit с потерянным ответом для
добавления, восстановления и сохранения Полки. Targeted inspiration/shelf/settings
suite после исправления: 187/187. Full suite интегрированного v257 и browser QA
выполняет root; этот follow-up не заявляет повторной проверки всего runtime.
