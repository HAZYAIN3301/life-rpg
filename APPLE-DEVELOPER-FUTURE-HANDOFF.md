# Apple Developer: ограничения и handoff для нативного Satoru

> Зафиксировано 2026-08-26. Это единый список платформенных ограничений, в которые Satoru уже упёрся как web/PWA, и план продолжения после оплаты Apple Developer Program.
>
> Связанные документы: `NATIVE.md`, `APPLE-ENTITLEMENT-REQUEST.md`, `DISCIPLINE-ESCAPE-PLAN.md`, `ASSISTANT-V181.md`, `BACKLOG.md`, `LAUNCH-READINESS-2026-08.md`.

## 1. Главное различие

Оплата Apple Developer Program не является «ключом от iPhone». Она даёт нормальную подпись, TestFlight, App Store, App IDs, production-профили и доступ к запросу некоторых capabilities. Но:

- часть API всё равно требует отдельного согласия человека;
- Family Controls для публикации требует отдельного одобрения Apple;
- некоторые данные Screen Time недоступны в регионе украинского Apple Account;
- iOS может приостанавливать фоновые процессы и задерживать события;
- системные разрешения можно отозвать;
- App Store review может отклонить конкретную реализацию;
- Android, Mac, Windows и приставка от оплаты Apple не меняются.

Поэтому правильная формулировка: **подписка открывает нативный контур разработки и распространения, но каждую чувствительную возможность всё равно надо проектировать с отказом, отзывом разрешения и деградацией до PWA.**

## 2. Что именно откроет платная подписка

- App Store Connect, TestFlight и распространение нативного iOS/iPadOS-приложения.
- Стабильные distribution-профили вместо бесплатной временной подписи Personal Team.
- Explicit App ID, сертификаты, provisioning profiles и App Groups для общего состояния приложения и extensions.
- Запрос managed capabilities, прежде всего Family Controls для distribution.
- Production APNs, native notifications, Associated Domains и Universal Links.
- App Intents / App Shortcuts для Siri, Shortcuts, Spotlight, Action Button и системных сценариев.
- WidgetKit, Live Activities и Share Extension.
- HealthKit при обоснованном health/fitness-сценарии и отдельном согласии на каждый тип данных.
- StoreKit/In-App Purchase, TestFlight sandbox и нормальная проверка restore/refund/grace-period.
- Developer ID и notarization для будущего отдельного macOS companion — это другой target, но та же membership.

Официально бесплатный Apple Account уже позволяет собирать приложение в Xcode и тестировать на собственном устройстве. Платная membership нужна прежде всего для стабильного распространения, TestFlight/App Store и production capabilities.

## 3. Полная карта уже найденных ограничений

### 3.1. Screen Time и настоящая блокировка приложений

**Сейчас в PWA**

- Нельзя прочитать, сколько времени человек провёл в TikTok, YouTube или другом приложении.
- Нельзя узнать напрямую, что чужое приложение открылось.
- Нельзя закрыть или заслонить чужое приложение после лимита.
- Control в PWA остаётся интервенцией: экран намерения, таймер, граница, эпизод и возврат, но не системный замок.
- iOS Shortcut «приложение открыто → открыть deep link Satoru» является обходным мостом, а не защитой: его легко удалить/пропустить, и поведение надо проверять на реальном устройстве.

**Что строить нативно**

- `FamilyControls` — индивидуальная авторизация владельца устройства и системный `FamilyActivityPicker`.
- `DeviceActivity` — расписания и threshold callbacks через extension.
- `ManagedSettings` — shield выбранных человеком приложений/категорий/доменов.
- `ManagedSettingsUI`, Shield Configuration и Shield Action extensions — свой, но системно ограниченный экран блокировки и действия на нём.
- App Group — минимальное общее состояние между основным приложением и extensions.

**Ограничения, которые останутся**

- Для App Store нужен не только paid account, но и отдельное одобрение Family Controls distribution entitlement. Оно не гарантировано.
- Человек сам выбирает приложения через системный picker. Приложение не должно тайно сканировать установленные приложения.
- В обычном режиме используются непрозрачные tokens. Нельзя строить серверную аналитику, требующую реальных bundle IDs.
- На устройстве вне ЕС или с Apple Account не-ЕС, включая текущий регион **Украина**, `approvedWithDataAccess` недоступен: реальные bundle identifiers, домены и детальная `FamilyActivityData` не должны быть обязательны для продукта.
- Даже в ЕС расширенный data access может принадлежать только одному приложению на устройстве и может быть отозван.
- Авторизация может быть denied/revoked, приложение может быть удалено, расписание может пережить crash/reboot неточно. Нужен fail-open recovery, чтобы ошибочный shield не остался навсегда.
- Нельзя честно обещать «невозможно отключить». Можно обещать заранее выбранный системный shield с ограниченным аварийным выходом и прозрачными границами.
- Политика никогда не ужесточается автоматически. Satoru только исполняет решение, которое человек принял заранее.

**Принятое продуктовое правило**

У рабочего захода есть цель и ожидаемый артефакт. `unknown` не считается срывом. Результат не влияет на XP, золото, уровень или стрик. Детальная активность остаётся на устройстве; синхронизация агрегатов — отдельный opt-in.

### 3.2. Голосовой вызов «Сатору…»

**Сейчас в Assistant v181**

- Wake word работает только в активной видимой вкладке после явного включения.
- При скрытии вкладки микрофон останавливается.
- Распознанная команда только заполняет черновик: ничего не отправляет и не применяет сама.
- Поддержка и качество Web Speech зависят от браузера, ОС, языка и разрешения на микрофон.

**Что строить нативно**

- `AppIntents` + `AppShortcutsProvider`: безопасные действия Satoru становятся доступными Siri, Shortcuts, Spotlight и Action Button.
- Фразы вида «Сатору, открой возврат», «Сатору, запиши мысль», «Сатору, покажи следующий шаг».
- Deep link/App Intent открывает нужное состояние, но мутации продолжают идти через существующий allowlist и human confirmation.
- Для диктовки внутри открытого приложения — Speech framework; для озвучивания — `AVSpeechSynthesizer` или серверный TTS.

**Что подписка не решит**

- Нормальному приложению нельзя обещать собственное постоянно слушающее фоновое слово как у Siri. Background Audio нельзя использовать как лазейку для скрытого always-on микрофона.
- Запись требует явного согласия и заметной индикации. App Review запрещает скрыто записывать действия/звук пользователя.
- Правильный системный вход — Siri/App Shortcuts, а не бесконечная фоновая запись.
- Голос не расширяет полномочия ассистента: удаление аккаунта, чужих данных и прочие отсутствующие глаголы не появляются.

### 3.3. Локальные файлы и планы с компьютера

**Сейчас**

- Web/PWA не может произвольно читать файлы на Mac или iPhone.
- Assistant v181 получает только явно выбранный `TXT/MD/JSON/CSV` до 20 КБ и держит его в памяти вкладки.
- Если файл не выбран, ассистент обязан честно сказать, что плана не видит.

**После native**

- `UIDocumentPickerViewController`/SwiftUI file importer может дать доступ к выбранному файлу или каталогу в Files/iCloud/стороннем File Provider.
- Для повторного доступа используются security-scoped bookmarks с корректным start/stop access.
- Share Extension позволит явно отправлять ссылку, текст, фото или файл в Полку/Заметки/ассистента.

**Останется**

- iOS sandbox не даёт тайно читать весь компьютер или произвольные каталоги.
- Даже выбранный каталог — делегированный человеком scope, а не полный диск.
- Для реального чтения локальных планов на Mac нужен отдельный macOS companion или явный импорт/sync. iOS-приложение само этого не исправит.
- Недоверенный файл остаётся данными, а не инструкцией: prompt injection из вложения не получает права выполнять действия.

### 3.4. HealthKit, тело, сон и активность

**Сейчас**

- У браузера нет HealthKit API.
- Возможен только ручной импорт Apple Health export/XML или ручной ввод.
- Поэтому пассивные источники нагрузки, сна, шагов и восстановления нельзя достоверно строить в PWA.

**После native**

- Добавить HealthKit capability и запросить только необходимые sample types в момент, когда человек включает конкретную функцию.
- Раздельно просить read/write; purpose strings должны точно объяснять пользу.
- Синхронизировать на сервер только явно выбранные агрегаты, если человек отдельно согласился.

**Останется**

- Отказ от чтения может выглядеть для приложения как отсутствие данных; нельзя превращать «нет записей» в диагноз или нулевую активность.
- Доступ ограничивается по типам и может быть отозван в любой момент.
- На заблокированном устройстве encrypted Health store может быть недоступен для фонового чтения.
- HealthKit-данные нельзя использовать для рекламы, продавать или раскрывать третьим сторонам вне допустимого health/fitness-сценария.
- Нужна отдельная privacy policy и строгая минимизация данных.
- HealthKit не является частью первой нативной версии внимания: его лучше выпускать отдельным релизом после Family Controls foundation.

### 3.5. Фоновая геолокация и пассивный контекст

**Сейчас**

- `navigator.geolocation` полезен только при активной странице; PWA не может надёжно понять «человека не было дома шесть дней».
- Таймзона ловит перелёт между зонами, но не поездку внутри одной зоны.

**После native**

- Core Location может дать разрешённые фоновые события, significant-change/region monitoring или активную background session, если функция реально требует геолокации.

**Останется**

- iOS приостанавливает большинство приложений вскоре после ухода в фон; доставка и точность не гарантированы.
- Always/background location требует сильного обоснования, прозрачной индикации и может быть отклонена App Review, если польза Satoru не требует постоянного местоположения.
- Человек может дать approximate location, разрешить только один раз или отозвать доступ.
- Нельзя строить скрытое наблюдение. Предпочтительны расписание, календарь и ручный контекст; геолокация — отдельный opt-in, не launch dependency.

### 3.6. Уведомления, фоновые задачи и точное время

**Сейчас**

- Web Push на установленной iOS PWA уже подтверждён, но зависит от установки, браузерной подписки, service worker и разрешения.
- Серверный scheduler работает с шагом около 15 минут; это не exact alarm.
- Закрытая/выгруженная PWA не выполняет произвольный JS по расписанию.

**После native**

- Local notifications и APNs дадут более нативный permission flow, categories/actions и интеграцию с приложением.
- Background Tasks могут обновлять данные, когда система выделит время.
- Device Activity extension должен отвечать за Screen Time thresholds, а не обычный background timer.

**Останется**

- Пользователь может запретить уведомления, отправить их в Scheduled Summary или Focus.
- Silent push/background refresh не являются гарантированным cron; система решает, когда дать выполнение.
- Уведомление нельзя считать доставленным/прочитанным без отдельного события.
- Time Sensitive/Critical Alerts нельзя использовать просто ради продуктивности без соответствующего основания/entitlement.
- Любой пропуск события должен приводить к восстановлению состояния при следующем открытии, а не к false-success.

### 3.7. Deep links, Shortcuts и вход при открытии TikTok

**Сейчас**

- `?do=gate&app=tiktok` уже принимает контекст.
- Personal Automation в Shortcuts может попытаться открыть Satoru при открытии выбранного приложения.
- Это ручная настройка, поведение подтверждения зависит от версии iOS и настроек.

**После native**

- Universal Links через Associated Domains и корректный `apple-app-site-association`.
- App Intents для «начать рабочее окно», «открыть возврат», «зафиксировать исход».
- Системные Automation/Shortcut остаются пользовательскими, а Family Controls shield — механизмом принуждения.

**Останется**

- Нельзя молча создать личную automation за пользователя.
- Deep link не доказывает, что TikTok действительно открылся или сколько там прошло времени.
- Universal Link требует рабочий домен, корректный файл association и тест из already-installed, cold-start и logged-out состояний.

### 3.8. Виджеты, Live Activities и системное присутствие

**Сейчас**

- PWA не даёт полноценный iOS WidgetKit widget.
- Присутствие ограничено иконкой, badge и notifications.

**После native**

- WidgetKit: следующий квест, дешёвый вход, энергия/день без перегруженной панели.
- Live Activity только для ограниченного по времени активного процесса, например focus/attention session, а не для постоянной рекламы приложения.
- App Intents дают безопасные интерактивные действия.

**Останется**

- Виджеты обновляются по системному budget, не непрерывно.
- Sensitive content должен скрываться на lock screen по настройкам приватности.
- Widget/Live Activity не должны обходить allowlist действий или показывать частные цели без opt-in.

### 3.9. Установка, обновления и распространение

**Сейчас**

- PWA ставится через Safari → «На экран Домой»; Web Push требует установленную PWA.
- Service worker может оставить уже открытую вкладку на старых байтах, поэтому каждый web release имеет CACHE bump и production hash verification.
- PWA storage/cache может быть очищен системой; сервер остаётся источником пользовательских данных.

**После native**

- TestFlight для реальных устройств и внешних тестеров.
- App Store distribution и staged/phased release.
- Native shell может переиспользовать сервер и web-контент, но чувствительные API должны жить в Swift, а не в WKWebView-имитации.

**Останется**

- App Review и entitlement review — отдельные гейты.
- App Store update не устанавливается мгновенно всем.
- Регион Украина не является ЕС-дистрибуцией и не открывает EU-only Screen Time data access/alternative distribution.
- Альтернативные магазины/веб-дистрибуция в ЕС не являются планом для украинского Apple Account и не должны фигурировать как основной путь.
- Серверные schema migrations всё равно обязаны быть backward-compatible со старой PWA/native версией.

### 3.10. Подписка Satoru Pro и платежи

**Сейчас**

- Web subscription/Pro state принадлежит серверу Satoru.
- Apple Developer membership и Satoru Pro — совершенно разные подписки.

**После native**

- Для продаваемых внутри iOS цифровых функций/подписок надо проектировать StoreKit 2 и In-App Purchase по применимым правилам App Store.
- Нужны product IDs, sandbox/TestFlight purchase, restore purchases, server verification, refunds, grace period, billing retry и reconciliation с web Pro.

**Останется**

- Нельзя показывать success до подтверждённой транзакции.
- Нельзя выдавать Pro только по локальному флагу.
- Web и StoreKit entitlement должны сходиться в одном server-owned состоянии без двойной подписки и потери доступа.
- Текущие правила внешних ссылок/альтернативных платежей зависят от storefront и могут измениться; перед реализацией их надо сверить заново.

### 3.11. Авторизация, аккаунт и Keychain

**После native можно улучшить**

- Хранить session token/refresh credential в Keychain, а не в web storage.
- Поддержать passkeys/AuthenticationServices и, при продуктовом решении, Sign in with Apple.
- Universal Link для password recovery.

**Ограничения**

- Биометрия подтверждает владельца устройства, но не заменяет серверную authorization/ownership.
- Если позже появится сторонний social login, правила App Store могут потребовать эквивалентный privacy-preserving login option.
- Поскольку Satoru создаёт аккаунты, удаление аккаунта должно оставаться доступным внутри iOS-приложения и каскадно удалять все данные.
- Logout/session expiry/retry обязаны быть честными: Keychain не лечит ошибки сервера.

### 3.12. Камера, фото, видео, Board и маркетинговый контент

**После native**

- Camera/Photos picker и Share Extension улучшат отправку подтверждения заказа, фото/видео и референсов в Полку.
- Background upload можно делать через системный URLSession при явной пользовательской операции.

**Останется**

- Камера/Photos требуют purpose strings и permission; limited Photos library — нормальное состояние.
- Нельзя читать всю медиатеку, экран, историю TikTok или содержимое других приложений.
- UGC требует moderation/report/block flows и privacy по уже принятому social contract.
- Файл/видео не является автоматическим доказательством выполнения и не должен усиливать стыд или публичный рейтинг без отдельного согласия.

### 3.13. Ассистент и системные действия

Native-версия обязана сохранить защиту Assistant v181:

- закрытый allowlist конкретных обратимых действий;
- адресация только собственных объектов по ID;
- preview до применения;
- явное подтверждение человеком;
- revalidation непосредственно перед mutation;
- transactional write/rollback/focus return;
- нет глагола удаления, управления чужим профилем или произвольного server command;
- голос, Shortcut, widget и notification action используют тот же executor, а не отдельный привилегированный путь;
- action из прикреплённого файла/веб-контента остаётся недоверенным текстом.

Apple capabilities не должны превращать ассистента в администратора устройства.

### 3.14. Кросс-девайс

- iOS Screen Time/API управляет iPhone/iPad-контуром; он не закроет Chrome на Mac, Android, Windows или приставку.
- У каждого устройства должен быть свой enforcement adapter и heartbeat/status.
- Сервер может синхронизировать policy и безопасные агрегаты, но не должен считать отсутствие телеметрии доказательством соблюдения/срыва.
- Desktop companion/browser extension — отдельный R3; Android companion — R4; iOS — R5.
- Нельзя запускать только iOS-блокировку и тем самым просто перенести побег на ноутбук.

## 4. Что не ждать от оплаты Apple Developer

После оплаты всё ещё нельзя обещать:

1. Всегда доступные реальные названия всех установленных приложений и сайтов.
2. Невидимую слежку за экраном, сообщениями, поиском, просмотренными видео или текстом других приложений.
3. Абсолютно неотключаемую блокировку без аварийного пути и возможности отозвать системное разрешение.
4. Собственное always-on wake word при закрытом приложении.
5. Произвольное чтение файлов Mac/iPhone без выбора человеком.
6. Точный cron, гарантированную silent push delivery или непрерывный background JS.
7. Мгновенные/гарантированные уведомления при Focus, Summary или denied permission.
8. Доступ к HealthKit без явного разрешения на каждый тип данных.
9. Полноценный Screen Time data export для текущего украинского Apple Account.
10. Автоматическое одобрение Family Controls или App Store review.
11. Решение Android/desktop/console ограничений.
12. Возможность скрыть от Apple назначение API или использовать background modes не по назначению.

## 5. Рекомендуемая архитектура первой нативной версии

Не переносить весь SPA в Swift сразу. Минимальный безопасный контур:

1. **Satoru iOS app (SwiftUI)** — login/session, native settings/permissions, attention gate, return screen и bridge к существующему серверу.
2. **Shared native core** — attention policy/session/episode schemas, idempotency keys, permission state, recovery/write guard.
3. **Device Activity Monitor extension** — schedules/threshold events.
4. **Shield Configuration extension** — локализованный экран ограничения.
5. **Shield Action extension** — только заранее разрешённые действия; никакого скрытого обхода.
6. **App Group** — минимальное versioned состояние с expiry/fail-open.
7. **App Intents/App Shortcuts** — capture, next action, start gate, return; destructive intents отсутствуют.
8. **Share Extension** — добавить ссылку/фото/текст в Полку или черновик.
9. **Widget extension** — только после стабильного core; не блокирует R5.
10. **StoreKit adapter** — отдельным релизом после TestFlight attention dogfood.

WKWebView/Capacitor допустимы как переходный UI shell, но не заменяют Swift targets/extensions для Family Controls, WidgetKit, App Intents, HealthKit и background execution.

## 6. Порядок действий после оплаты

### День 0 — аккаунт и идентичность

- Решить enrollment: Individual или Organization. Individual покажет в App Store личное имя; Organization требует юридическое лицо и D‑U‑N‑S.
- Зафиксировать Team ID и постоянный Bundle ID, например `app.satoru.life` — не менять после entitlement request.
- Создать App ID и App Group.
- Включить Associated Domains, Push Notifications, App Groups, Siri/App Intents capabilities.
- Создать App Store Connect app record и внутреннюю TestFlight группу.

### День 1 — сразу подать внешний запрос

- Открыть `APPLE-ENTITLEMENT-REQUEST.md`.
- Обновить текст фактическим Bundle ID, privacy URL и ссылкой/видео работающего R1/R2.
- Запросить **Family Controls distribution** для основного app target и необходимых extensions.
- Не запрашивать EU-only app-and-website usage как зависимость продукта.
- Записать дату, request ID, ответ и условия в `APPLE-ENTITLEMENT-REQUEST.md`.

### Пока Apple рассматривает

- Собрать SwiftUI shell и server auth.
- Подключить Universal Links/App Intents/Shortcuts.
- Вынести схемы attention в shared native core и прогнать fixtures против web-модулей.
- Сделать denied/revoked/manual режим полноценным.
- Настроить APNs/local notifications без обещания exact delivery.
- Сделать Share Extension и explicit file import.
- Выпустить внутренний TestFlight без Family Controls, если entitlement ещё не одобрен.

### После одобрения

- Подключить picker → opaque token storage → DeviceActivity → shield.
- Реализовать bounded emergency exit и автоматический fail-open expiry.
- Провести минимум 14 дней dogfood на реальном iPhone параллельно с desktop blocker.
- Только после этого формулировать маркетинговое обещание Control.

## 7. Обязательные проверки на реальном устройстве

Матрица не закрывается симулятором:

- актуальная iOS и минимум одна предыдущая поддерживаемая версия;
- iPhone с Apple Account региона Украина;
- first install, update, reinstall, logout/login, session expiry;
- Family Controls notDetermined/approved/denied/revoked;
- разрешение Screen Time отозвано во время активной сессии;
- app/extension killed, device reboot, clock/timezone/DST change;
- shield включился, истёк и гарантированно снялся;
- emergency exit offline и при 500;
- приложение удалено/обновлено во время schedule;
- PWA и native открыты одновременно;
- Siri/App Shortcut cold start, locked device и ambiguous speech;
- микрофон denied/revoked/interrupted звонком;
- notification denied, provisional, Summary, Focus и тап из cold start;
- Universal Link logged-in/logged-out/expired session;
- selected file revoked/moved/deleted;
- HealthKit partial/denied/limited-window, если этот релиз уже включает HealthKit;
- StoreKit purchase/pending/cancel/refund/restore/grace/offline, если включена продажа;
- RU/EN/DE/UK/ES, VoiceOver, Dynamic Type, keyboard/switch control, reduced motion;
- серверная ownership/idempotency/no-false-success матрица;
- удаление аккаунта каскадно удаляет native attention sync, device token, push token, policies, sessions, episodes, aggregates и Shelf.

## 8. Данные и privacy contract

До первой TestFlight-сборки письменно определить:

- какие данные остаются только на устройстве;
- какие агрегаты синхронизируются и зачем;
- срок хранения и способ удаления;
- что происходит при отзыве согласия;
- отдельный consent для Screen Time aggregates, HealthKit, location, notifications, camera/photos и AI;
- privacy manifest и App Store privacy labels;
- account deletion/export;
- запрет использования Screen Time/HealthKit/voice/file content для рекламы;
- отсутствие SDK, который получает эти данные косвенно через analytics/crash logs.

Минимальный server payload внимания: policy ID/version, session timestamps, declared purpose, planned boundary, explicitly reported outcome, extension health и агрегированные counters. Не синхронизировать opaque tokens, bundle identifiers, domains, экранный текст или историю контента без отдельного доказанного требования и разрешённого Apple API.

## 9. Решения, которые надо принять перед кодом

- Enrollment: Individual или Organization.
- Постоянный Bundle ID и домен для Universal Links.
- Минимальная поддерживаемая версия iOS.
- SwiftUI-first или переходный Capacitor shell. Рекомендация: SwiftUI для native control surfaces, существующий web/server как backend и временный контентный слой.
- Точная политика emergency exit: число passes, 90-секундная задержка, expiry и safety override.
- Какие 3–5 App Intents нужны в v1; не переносить весь ассистент в Siri.
- Какие агрегаты внимания разрешено синхронизировать.
- Нужен ли HealthKit в первом App Store release. Рекомендация: нет, отдельный релиз.
- Нужен ли StoreKit сразу. Рекомендация: TestFlight attention сначала, платежи после устойчивого server entitlement reconciliation.
- Privacy URL, Support URL, возрастной рейтинг, UGC/moderation disclosure.

## 10. Приоритет после оплаты

1. Enrollment + IDs + Family Controls request — внешний critical path.
2. TestFlight shell + auth + deep links + recovery.
3. App Intents/Shortcuts вместо собственного фонового wake word.
4. Family Controls opaque-token Control с fail-open.
5. Share Extension/Полка.
6. Native notifications.
7. Widget/Live Activity.
8. StoreKit reconciliation.
9. HealthKit.
10. Background location только при отдельно доказанной пользе.

## 11. Актуальные официальные источники

- Apple Developer Program и TestFlight: https://developer.apple.com/programs/
- Сравнение бесплатного и платного аккаунта: https://developer.apple.com/support/compare-memberships/
- Supported capabilities (iOS): https://developer.apple.com/help/account/reference/supported-capabilities-ios/
- Запрос managed capability: https://developer.apple.com/help/account/capabilities/capability-requests
- Family Controls: https://developer.apple.com/documentation/familycontrols
- EU-only `approvedWithDataAccess`: https://developer.apple.com/documentation/familycontrols/authorizationstatus/approvedwithdataaccess
- Managed Settings и Device Activity: https://developer.apple.com/documentation/managedsettings/connectionwithframeworks
- App Intents: https://developer.apple.com/documentation/appintents
- App Shortcuts: https://developer.apple.com/documentation/appintents/app-shortcuts
- Notifications permission: https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications
- Document picker/security-scoped access: https://developer.apple.com/documentation/uikit/providing-access-to-directories
- HealthKit privacy: https://developer.apple.com/documentation/healthkit/protecting-user-privacy
- Background location: https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background
- App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/

Перед фактической реализацией заново проверить документацию и App Review Guidelines: capabilities, региональные условия и правила платежей меняются.

## 12. Короткий итог для следующего чата

Satoru уже закрыл web-часть внимания (R1), Полку (R2), безопасного ассистента и активный-tab wake word. Следующий Apple-этап — не «обернуть сайт в приложение», а построить небольшой нативный системный слой вокруг существующего server/web продукта. Главный внешний риск — Family Controls distribution approval; главный региональный предел — отсутствие detailed Screen Time data для Apple Account Украины; главный архитектурный гейт — fail-open и полноценный manual/PWA fallback. Не начинай с HealthKit, StoreKit или полного SwiftUI-переписывания. Сначала entitlement, TestFlight foundation, App Intents и opaque-token Control.
