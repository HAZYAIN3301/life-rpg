# Secretary OS — карта болей, решений и честных границ

Дата: 2026-08-29
Статус: v197 и локальный Browser Companion v199 реализованы; контракт задаёт следующие S2–S4/R3b–R5 релизы
Назначение: не добавлять ещё один набор экранов, а превратить существующие механики Satoru в один проактивный контур Тени.

## 0. Решение в одном абзаце

Проблема не в том, что в Satoru мало функций. Проблема в том, что человек должен помнить их названия, сам замечать нужный момент, сам открыть правильный экран, сам внести данные и сам решить, что делать дальше. Это калькулятор, а не секретарь. Следующий слой должен состоять из трёх частей:

1. **Тень сама выбирает один уместный ход** из данных Satoru и сигналов устройства.
2. **Ход заканчивается действием**, а не советом: подготовить день, поставить границу, перенести дела, начать ограниченный отдых или открыть возврат.
3. **Системные границы исполняют платформенные адаптеры**: browser extension на ноутбуке, позже Android companion и iOS Family Controls. PWA сама не умеет читать или блокировать другие приложения.

Новая постоянная вкладка не создаётся. `Today / Plan / Habits / Hero / More` остаются пятью destinations. После сборки внутреннего контура текущий слот **Habits** предлагается переименовать в **«Ритм»** и использовать как единственный дом для повторяемых практик, границ внимания и восстановления. До появления всех трёх потребителей один только label не менять.

## 1. Приватность этого документа

Основание включает текущую личную саморефлексию владельца, но её интимные детали, имена близких и дословные формулировки здесь намеренно не копируются. Они не должны случайно попасть в публичный Git, Assistant prompt, социальный профиль или аналитику. Ниже используются только обобщённые потребности: компульсивное цифровое потребление, слишком позднее завершение отдыха, проблемы сна, неопределённый конец рабочего дня и будущая высокая нагрузка.

## 2. Что уже есть — и почему этого пока недостаточно

| Контур | Фактическое состояние | Честный вывод |
|---|---|---|
| Очистка Today | v197 перестал рендерить отдельные Founder Pass, Fights, Day Load, progress trio, anti-habits и Notes peek. Founder Pass ушёл в Settings; streak и earned reward — в карточку Тени. | Визуальный шум уменьшен, данные не потеряны. Это правильная первая уборка, но не автоматизация. |
| Центр Тени | `attentionTodayControlHTML()` показывает Attention, возврат, отдых и вечер. При отсутствии активной сессии одновременно видны до четырёх действий. | Пользователь всё ещё должен знать, какое действие выбрать. Это компактный каталог, а не секретарь. |
| Attention R1 | Есть policy/session/episode, экран входа, одна граница, продление, `Меня унесло`, emergency exit, recovery и return. | Механика реальна, но без внешнего триггера её легко никогда не увидеть. PWA не знает, что TikTok/YouTube уже открыт. |
| Тихий возврат | Сервер умеет задать один нейтральный вопрос после двух тихих дней и держит cooldown. `unknown` не считается срывом. | Хорошая страховка, но она реагирует спустя дни, а не в момент начала компульсивного эпизода. |
| Вечер | Есть заданное время, Web Push, голос Тени в открытой вкладке, три вечерние границы и durable close-day. | Закрытая PWA не может надёжно заговорить; Web Push best-effort. Текущий текст напоминает открыть ещё один экран, но не исполняет выключение устройств. |
| Assistant | Видит Today, цели, задачи, привычки, неделю, профиль и Attention; умеет создавать и обратимо менять ограниченный набор объектов; опасные глаголы отсутствуют. | Он в основном реактивен. Машиночитаемый реестр возможностей и единый proactive event router всё ещё существуют только в плане `JARVIS-3-PLAN.md`. |
| Память | Есть редактируемый bounded `profile.json` и свежий структурированный контекст. | Профиль обновляется не как непрерывная секретарская работа; onboarding questionnaire, который должен сразу дать цель и первый шаг, ещё не построен. |
| Anti-habits/Fights | Stores и UI существуют; v197 убрал их с Today. | Они всё ещё требуют ручного ведения и не исполняют границу. Поэтому ощущаются как ещё два счётчика. |
| Нагрузка дня | `dayLoadNow()` сравнивает количество закрытого с личной историей; значение всё ещё используется внутренними детекторами и Assistant context. | Это не энергия, не сон и не состояние нервной системы. На Today отдельный экран ей не нужен; как внутренний слабый сигнал она допустима. |

## 3. Целевая информационная архитектура

### Today — только «что сейчас»

Допускаются:

- один hero с настоящим следующим действием;
- единый quest board и сегодняшние привычки;
- компактный глобальный capture;
- одна поверхность Тени с **одним** выбранным ходом;
- завершение дня после основного контура.

Не допускаются отдельные панели Founder Pass, Fights, Day Load, progress trio, список заметок, anti-habits, второй переход в Rewards или четыре равноправных secretary actions.

### Ритм — один дом для повторяющегося поведения

Текущий слот `Habits` после готовности переименовывается в `Ритм` без добавления новой destination. Внутри три purpose-группы:

- **Практики** — нынешние положительные привычки;
- **Границы** — Attention policies и приватные риск-сценарии; старые «Схватки» и anti-habits становятся источниками/историей, а не двумя конкурирующими трекерами;
- **Восстановление** — сон, окончание работы, ограниченный цифровой отдых и персональное меню отдыха.

На Today из этого выходит только применимый сегодня результат. Настройка и история живут в `Ритме`.

### Тень — не вкладка, а маршрутизатор

Чат/FAB остаётся глобальным. Тень читает доменные данные и очередь событий, выбирает один следующий ход и приводит к существующему владельцу данных. Она не создаёт второй store целей, сна или привычек.

## 4. Матрица болей: перегруз и бесполезные поверхности

| ID и боль | Текущее доказательство | Почему недостаточно | Точное продуктовое поведение | Где живёт | Зависимость | Фаза | Acceptance |
|---|---|---|---|---|---|---|---|
| UI-01. Today снова превращается в панель функций | v197 убрал ряд карточек, но `attentionTodayControlHTML()` по умолчанию предлагает отдых, вечер, Attention и setup одновременно; отдельный `activeNudge` может стоять рядом. | Человек всё ещё выбирает инструмент в момент низкого ресурса. | Secretary arbiter возвращает ровно `one primary recommendation` либо молчит. Вторичные варианты скрыты под `Другая поддержка`, без собственной card. | Одна компактная часть карточки Тени. | PWA достаточно. | S2 Secretary Router. | В first viewport `<=2` крупные work surfaces; на всём Today ровно `1` support surface и `1` support CTA; четыре равноправные secretary-кнопки — `0`. |
| UI-02. «Схватки» ничего не делают | `fightsCardHTML()` — ручные `Выиграл/Проиграл`, счёт и секунды; v197 перестал показывать карточку на Today, но store/module остались. | Отметка постфактум не предотвращает действие, не напоминает в момент риска и создаёт работу по учёту. | Не показывать Fights как ежедневный продукт. Мигрировать активную схватку в приватный risk pattern: `trigger → intervention → outcome`. Если есть исполняемый механизм, Тень предлагает его; если нет — не просит вести счёт ради счёта. Старую историю оставить read-only/exportable. | `Ритм → Границы`; Today только при реальном trigger. | Для web-границы PWA; для автоматического web trigger — extension; для app trigger — native. | S2/S3. | Нормальный день требует `0` ручных отметок схваток. Каждый новый risk pattern имеет хотя бы одно действие; «diagnosis-only» entries — `0`. |
| UI-03. «Нагрузка дня» непонятна и ни на что не влияет | `dayLoadNow()` считает done против typical; комментарий к коду прямо называет это зеркалом, не состоянием. | Число похоже на энергию и провоцирует ложный физиологический вывод. | Оставить как внутренний confidence-limited signal. Показывать человеку только в Progress/weekly review по запросу или когда из него следует конкретное предложение снизить объём. Никогда не называть усталостью/ресурсом. | Внутри Secretary context; подробность — Progress. | PWA достаточно; точный сон/восстановление требует sensors/native. | S2. | На Today отдельной Day Load card нет. При `known:false` выводов нет. Любой видимый сигнал содержит действие или ссылку «почему так». |
| UI-04. Founder Pass засоряет ежедневный экран | v197 перенёс его в `Settings → Account`; store/API сохранены. | Здесь проблема уже устранена. Риск — регрессия при следующем маркетинговом релизе. | Founder Pass остаётся только в Account/paywall/явной кампании. Не возвращается в daily cockpit и не получает ежедневный nudge. | Settings → Account. | Сервер. | Shipped + regression gate. | Поиск DOM Today по founder-pass даёт `0`; данные и admin report работают. |
| UI-05. Notes peek и счётчик заметок требуют внимания | v197 оставил компактный `captureBar()` и убрал peek; Notes остаются отдельным экраном. | Правильное направление, но capture всё ещё занимает полноценный блок, если визуально раскрыт заранее. | На mobile — одна строка/FAB `Записать мысль`; дополнительные media controls раскрываются после фокуса. Счётчик заметок не является долгом и не показывается на Today. AI triage предлагается только по явному запросу или когда заметка превращается в действие. | Глобальный capture + Notes. | PWA достаточно; microphone permission в точке записи. | S2 UI gate. | Capture доступен за `1` tap, но занимает `<=44px` до раскрытия; `N заметок открыть` на Today — `0`. |
| UI-06. Стрик, награда и два перехода в Rewards | v197 свёл streak/reward badge в Тень, но в legacy Today остаются переменные `nudgeCard` и `deeperPath`; фактический return их не рендерит. | Кодовая дубликация облегчает случайное возвращение двух CTA. | Один earned-reward badge в summary Тени. Он становится заметным коротким authored motion один раз при появлении награды; после acknowledge статичен. Полный Rewards доступен через одну nav/More destination. Streak раскрывается по тапу и не тянет хвост по экрану. | Тень summary; Rewards. | PWA; sound respects app sound mode/reduced motion. | S2 regression cleanup. | Одновременно видимых Rewards entrypoints на Today `<=1`; motion source `<=1`; без autoplay sound в silent/off. |
| UI-07. Anti-habits — ещё один приватный калькулятор | `habitsBreakHTML()` просит вручную `Записать событие сегодня`, показывает clean days и best streak. v197 лишь убрал это с Today. | В самый тяжёлый момент человек не будет открывать tracker; clean-days легко превращаются в стыд и не исполняют защиту. | Перенести активные записи в `Ритм → Границы`. Основной объект — policy, не серия чистоты. Событие фиксируется платформой или одним необязательным вопросом после границы. Clean-days не использовать как главный KPI; прошлые данные сохраняются. | Ритм → Границы; private history. | Extension/native для пассивного сигнала; manual fallback в PWA. | S3. | В normal day `0` обязательных anti-habit taps; privacy export/delete покрывает историю; данные никогда не входят в social/leaderboard. |
| UI-08. «Привычки» не вмещают восстановление и границы | Сейчас это три под-вкладки привычек, срывов и метода; Attention живёт отдельно в Тени/Settings. | Функции одной сути разбросаны, а слово «привычки» не объясняет сон, окончание работы и screen boundaries. | Сначала собрать consumers, затем переименовать destination в `Ритм`. Не добавлять шестую вкладку. Legacy deep links `habits` продолжают работать и открывают нужную purpose-группу. | Существующий nav slot. | PWA. | S3 после S2. | Ровно пять mobile destinations; старые URL/deep links не ломаются; RU/EN/DE/UK/ES имеют понятные labels. |

## 5. Матрица болей: поведение, восстановление и личный секретарь

| ID и боль | Текущее доказательство | Почему недостаточно | Точное продуктовое поведение | Где живёт | Зависимость | Фаза | Acceptance |
|---|---|---|---|---|---|---|---|
| BH-01. Рабочий день заканчивается «когда выдохнусь» | Есть manual close-day и evening setup, но предел объёма пользователь определяет сам. | Отсутствие заранее известного финиша превращает и работу, и отдых в бесконечные процессы. | Утренний/первый brief предлагает: фиксированный конец, `1–3` результата ядра и защищённый отдых. После конца дня Тень не предлагает новые рабочие квесты; несделанное переносится/остаётся только после grouped confirmation. | Today hero + evening boundary; настройка — Ритм → Восстановление. | PWA для плана/push; extension/native для реального закрытия отвлекающих/рабочих экранов. | S2/S4. | У каждого активного дня есть понятный finish либо явный `без расписания`; median time от открытия brief до подтверждения `<=3 мин`; после close-day proactive work suggestions `0`. |
| BH-02. Неизвестно, как именно отдыхать; слишком много вариантов | Есть generic recovery launcher с minutes, label и device mode. | Он просит человека самому придумать отдых именно тогда, когда выбор уже труден. | Один раз собрать личное finite rest menu: 6–12 допустимых вариантов, время, нужен ли экран, уровень энергии и противопоказанные контексты. В момент отдыха Тень предлагает максимум три: `самый лёгкий / телесный / интересный`; выбор сразу запускает границу. | Ритм → Восстановление; Today показывает один выбранный вариант. | PWA. | S3 Rest Protocol. | От запроса «мне нужен отдых» до начатого bounded session `<=2 taps`; вариантов на одном экране `<=3`; пустой профиль имеет безопасные neutral defaults, не выдуманные предпочтения. |
| BH-03. Отдых с устройством превращается в многочасовое потребление | Attention rest session существует, но пользователь должен сам запустить её; PWA не закрывает игру/app. | Таймер без внешнего enforcement легко игнорируется. | Для browser media: extension открывает только заранее объявленный target/purpose на заданное окно, затем ставит shield. Для device-free rest — timer/push/voice. Для standalone game честно используется OS focus/desktop companion; PWA не обещает блокировку. Одно продление, emergency exit по заранее выбранной политике. | Тень запускает; исполнение — platform adapter. | Chromium extension сейчас; desktop companion позже для приложений. | S1 + R3 companion. | Browser session после boundary не продолжает выбранный site без extend/emergency; refresh/restart не сбрасывает budget; перенос потребления в другой target не объявляется успехом. |
| BH-04. После выпадения вход назад слишком дорог | Есть pending `escaped`, return flow, quiet push и один маленький action. Legacy код использует внутреннее слово `amnesty`. | Пользователь не видел контур; слово «амнистия» предполагает вину/прощение; PWA замечает эпизод поздно. | Пользовательская copy: `Вернуться`, `Освободить сегодняшний экран`, `Начать с одного`. Никогда `амнистия`. Extension/native создаёт pending return после нарушенной границы; quiet push остаётся fallback. Тень показывает один выбранный шаг и отдельное `выбрать другой`, не стену просроченного. | Тень/Today, затем владелец task. | PWA fallback; extension/native для раннего сигнала. | S1/S2. | `amnesty` в user-visible locale keys/DOM `0`; `unknown` не становится lapse; dogfood median `returnLatency` для сопоставимого эпизода стремится от ~24 ч к `<=3 ч`; Retry не дублирует episode. |
| BH-05. Компульсивное поведение отслеживается только вручную | Anti-habit требует ручной slip; Attention может записать outcome, но без внешнего события. | Человек с низким контролем должен помнить tracker — модель ломается по построению. | Пассивно фиксировать только минимальные факты, на которые дано согласие: target category, start/end, boundary crossed, outcome. Не хранить URL history/text screen. Когда данных не хватает — один нейтральный вопрос после события, `не знаю` допустимо. | Ритм → Границы; Assistant получает агрегат, не сырые сайты. | Extension/Android/iOS; PWA manual. | S1/R4/R5. | Доля автоматически закрытых web episodes `>=80%` после включения extension; manual fields на один эпизод `<=1`; сырая browsing history на сервере `0`. |
| BH-06. Сон и позднее завершение дня не исполняются | v197 умеет Web Push и `speakEveningCoach()` в видимой вкладке; server push открывает `?do=finish`. | Закрытая PWA не говорит голосом и не выключает устройства. Push может прийти с задержкой или не прийти. | Один персональный bedtime contract: время начала shutdown, предел экранов, три действия вечера. В открытом Satoru/extension Тень произносит короткое персональное обращение один раз; в фоне — push. Extension ставит web shield в quiet hours. Голос, silent mode, DND и reduced motion уважаются. | Ритм → Восстановление; active state — Тень. | PWA push best-effort; extension для browser shield/desktop TTS; native для надёжного phone layer. | S1/S3/R4/R5. | В один вечер один tag/один голос; day already closed → `0` prompt; desktop enforcement после target time; PWA не обещает точность лучше server tick/delivery. |
| BH-07. Планирование и выводы занимают до часа | Есть Today/Week/Calendar и Assistant actions, но нет day-plan transaction; действия чата ограничены и требуют ручного запуска. | Много функций увеличивает стоимость обслуживания системы. | Secretary Daily Brief строит draft из календаря, дедлайнов, незакрытых действий, привычек, planned finish и recovery: максимум три commitments + один protected recovery block. Человек одним review подтверждает, правит или отклоняет. Evening review задаёт максимум два вопроса и готовит завтра, но не коммитит без подтверждения. | Today при первом входе; Plan для деталей. | PWA + AI optional; deterministic fallback обязателен. | S4 Planning Copilot. | Median active planning `<=5 мин`, dogfood target `<=3 мин`; draft commit atomic/idempotent; `500/offline` сохраняет edits; auto-created tasks без preview `0`. |
| BH-08. AI выглядит чатом, а не личным секретарём | `GOJO_MANUAL` знает функции и safe actions; чат открывается пользователем. Реестр возможностей из `JARVIS-3-PLAN` в runtime не найден. | ИИ не получает события сам и не применяет инструменты в нужный момент. | Ввести deterministic **Secretary Event Router**: локальные/server/platform events → candidate interventions → priority/cooldown/confidence → одна карточка/notification. AI только формулирует или разбирает неоднозначность. Каждая capability объявляет trigger, required data, cost, action, safety tier и cooldown. | Headless core; одна проекция в Тень. | PWA/server/extension, AI необязателен для detection. | S2 P0. | На одно событие `<=1` предложение; отказ ставит cooldown; без AI доступен тот же action с static copy; capability без исполняемого action не регистрируется. |
| BH-09. Секретарь должен действовать, но не стать администратором | Safe whitelist уже запрещает delete/account/permissions/publication и требует точные owned IDs. | Текущий словарь покрывает не весь план дня/ритм; соблазн расширить его небезопасно. | Сохранить три tier: `observe` без записи; `draft/open`; `reversible modify` с grouped confirmation. Навсегда вне Assistant: delete account/data, чужие объекты, spend, publication/visibility, permissions, subscription, security credentials. Предварительно подтверждённая attention policy исполняется extension автоматически, потому что решение уже принято человеком. | Shared action contract + server authorization. | Все платформы. | Каждый релиз. | Prompt injection не расширяет словарь; ownership на сервере; dangerous kinds `0`; false-success `0`; grouped retry не повторяет уже применённое. |
| BH-10. Ассистент знает не всю реальную жизнь | Есть bounded profile, week context и explicit file attachment; Questionnaire runtime не построен. | Без расписания сна, допустимого отдыха, жёстких обязательств и личного стиля советы остаются частичными. | Построить Questionnaire v1 как один вопрос → одна цель → один шаг. Остальные данные собирать progressively только у готового consumer: support style, ограничения, rest menu, shutdown time. Профиль видим и редактируем; transient state не превращается в черту личности. | Onboarding + Settings/Profile + context adapters. | PWA; AI имеет manual fallback. | S3/S4, отдельный release. | До Today `<=2` personalization screens; одна confirmed goal и task записываются атомарно; неподтверждённый AI inference в профиль `0`. |
| BH-11. Будущая высокая нагрузка пугает; жизнь откладывается «на потом» | Goals/Calendar/ten-domain balance существуют, но сами не защищают время и не ограничивают объём. | Список амбиций не решает конфликт учёбы, работы, отношений, спорта и восстановления. | В weekly brief использовать **capacity covenant**, не новую dashboard: обязательные fixed commitments, максимум 2 growth fronts недели, защищённые life/recovery blocks и stop-rule. AI объясняет trade-off и просит один confirm; не оптимизирует каждую свободную минуту. | Plan → Week; Today получает только сегодняшний результат. | PWA. | S4. | Неделя не превышает подтверждённый capacity budget; protected blocks не вытесняются авто-планом; AI явно показывает, что исключено, а не молча откладывает жизнь. |
| BH-12. Месячный эксперимент по отдыху и контенту хочется провести без новой системы | Goals, groups, habits, Notes/media и reflection уже есть. | Отдельный «30-day challenge screen» снова создаст tracker, который надо обслуживать. | Материализовать как существующий project/goal group: одна цель, один repeating rhythm, один daily rest experiment, optional media capture после опыта и weekly synthesis. Тень выбирает эксперимент из rest menu; съёмка не вторгается в сам отдых. | Goals + Ритм + Notes/Media; управление через Тень. | PWA. | После S3, dogfood. | Новых primary routes/stores `0`; daily manual decisions `<=1`; пропуск не ломает streak и не создаёт долг; weekly review выводит проверенное изменение, а не число отметок. |

## 6. Матрица болей: реальный контроль устройств

| ID и боль | Что можно сделать | Чего нельзя обещать | Где/когда | Acceptance |
|---|---|---|---|---|
| CT-01. TikTok/YouTube в Brave/Chrome уводят от рабочей цели | Chromium extension перехватывает выбранные domains, читает заранее сохранённую локальную purpose policy, открывает ограниченное окно и после boundary показывает shield. В открытой вкладке Satoru доступна только read-only сводка: extension online, число сайтов, текущая граница. | Не видит native app, другой browser profile, Incognito без отдельного разрешения, историю до установки или экранное содержимое. В v199 нет серверной/cross-device синхронизации: она требует отдельного scoped pairing-token протокола. | **S1 — текущий browser-control release.** | Configured domain действительно закрывается после boundary; безопасное восстановление при повреждении state; no permanent lock; cross-tab race/idempotency tests; raw URL/server writes `0`. |
| CT-02. Игры и standalone desktop apps продолжаются до ночи | Сейчас: вечерний push/TTS и внешний OS focus tool. Потом: отдельный signed desktop companion с process/app allowlist и тем же policy/session contract. | Browser extension не управляет Steam/game executable и не должна притворяться, что управляет. | R3 desktop companion, отдельно от extension. | Перезапуск/краш не оставляет вечный block; emergency path; app names local by default; exact OS matrix. |
| CT-03. Android phone | Native companion с Usage Access читает разрешённые агрегаты; реальный app shield требует честно выбранного механизма и отдельного permission UX. | PWA/TWA сама не получает UsageStats. Accessibility scraping нельзя включать скрыто или маскировать как обычное разрешение. | R4 Android. | Permission denied/revoked оставляет manual mode; reboot recovery; no чужие данные; data deletion cascade. |
| CT-04. iPhone/iPad | После Apple Developer enrollment запросить Family Controls distribution entitlement; использовать FamilyActivityPicker opaque tokens, Device Activity и Managed Settings shield. Shortcuts остаётся R0 fallback. | Оплата membership не гарантирует entitlement. Apple Account региона Украина не получает detailed `approvedWithDataAccess`; нельзя обещать названия apps/полную Screen Time аналитику. | R5 iOS после entitlement. | Ukraine path работает с opaque tokens без fake analytics; deny/revoke fail-open; shield снимается после expiry/emergency; TestFlight/device matrix. |
| CT-05. Console/TV/tablet вне поддержанного companion | Использовать ограниченный отдых в Satoru плюс штатные parental/focus/router schedules, настроенные человеком. Возможна будущая интеграция только с официальным API платформы. | Satoru не видит использование приставки через PWA и не должен просить ручной поминутный лог как замену телеметрии. | R0 external setup; интеграция не P0. | UI маркирует источник как manual/external; отсутствие данных = `unknown`, не успех и не срыв. |
| CT-06. Приватные high-risk сайты | Extension может локально блокировать только явно выбранные domains. В v199 никакие target/category/episode данные на сервер не отправляются; Satoru получает лишь read-only public status без hostname, purpose и outcome. | Satoru не диагностирует зависимость, не сканирует содержимое страницы и не публикует эту историю. Category packs и будущий aggregate sync требуют отдельного consent и правового/privacy review. | S1 explicit-domain; category packs позже; phone через R4/R5. | Sensitive targets скрыты в notification text/app switcher насколько позволяет ОС; raw URL/server writes `0`; локальный wipe; social consumers `0`. |

## 7. Как работает Secretary Event Router

Это недостающий технический центр, который превращает перечисленные части в поведение.

```text
domain events + server time + extension/native aggregates
                         ↓
                deterministic candidates
                         ↓
       ownership / confidence / cooldown / safety gates
                         ↓
           один winner или осознанное молчание
                         ↓
 static copy или AI wording → одна исполняемая action card
                         ↓
 durable result / opened / refused / retryable — без false-success
```

Минимальная запись capability:

```js
{
  id: 'bedtime-browser-boundary',
  trigger: 'secretary.evening_due && browser.target_active',
  needs: ['confirmedEveningTime', 'extensionConnected'],
  action: 'attention_start_confirmed_policy',
  safety: 'preauthorized_control',
  cooldown: 'once_per_local_day',
  fallback: 'push_evening_open'
}
```

Обязательные правила:

- детектор не зависит от AI и не принимает психологических решений;
- AI не получает возможность исполнить action вне whitelist;
- максимум один winner; остальные остаются в очереди только пока актуальны;
- низкая confidence ведёт к одному вопросу, не к выводу;
- тишина, отсутствие телеметрии и permission denied не являются срывом;
- dismiss — это данные о неуместности и реальный cooldown;
- destructive/spend/social/privacy actions никогда не исполняются этим router;
- один и тот же event ID не создаёт два episode/push/action при retry или нескольких устройствах.

## 8. Полная последовательность релизов

### S0 — уже опубликовано: Secretary/Recovery v197

- убрать отдельные панели с Today;
- собрать streak/reward/attention/recovery/evening вокруг Тени;
- безопасные open-only Assistant actions;
- честный push delivery и durable writes.

### S1 — реализовано в Browser Companion v199: Browser Control

- Chromium extension для Brave/Chrome/Edge;
- локальные policies и read-only status handshake с Satoru;
- entry contract, bounded window, shield, one extension, emergency;
- disconnect/restart recovery без серверной записи истории;
- deep link в return flow после нарушенной границы.

Это решает выбранные сайты в одном Chromium-профиле на ноутбуке. Это **не** решает native games, другой профиль/браузер, Android apps, iPhone apps, console или cross-device continuity. Синхронизация возможна только отдельным поздним релизом с отзывным token scope `attention:read + episode:append`; session cookie расширению не выдаётся.

### S2 — P0: Secretary Event Router + второй проход Today

- machine-readable capability registry;
- один winner вместо четырёх support buttons + отдельного active nudge;
- убрать user-visible `amnesty` и legacy пути случайной регрессии;
- action/dismiss/cooldown/idempotency;
- один contextual reward badge;
- deterministic fallback без AI.

### S3 — Ритм + Rest Protocol

- собрать Practices / Boundaries / Recovery в существующем Habits slot;
- только после этого переименовать label в `Ритм`;
- finite personal rest menu;
- bedtime contract;
- anti-habit/fight migration без потери истории;
- progressive questions только в момент реальной пользы.

### S4 — Planning Copilot

- daily brief `<=3 commitments + recovery + finish`;
- weekly capacity covenant;
- grouped confirm/undo/retry;
- 30-day rest experiment как композиция существующих доменов;
- onboarding questionnaire materializes one real goal + one first task.

### R3/R4/R5 — системные адаптеры

- R3 signed desktop companion для standalone apps;
- R4 Android Usage Access/control;
- R5 iOS Family Controls после entitlement;
- console остаётся external/manual до официальной интеграции.

## 9. Общие product-wide метрики

Это не KPI удержания любой ценой. Они проверяют, уменьшает ли Satoru работу по обслуживанию самого Satoru.

| Метрика | Цель |
|---|---|
| Видимые support surfaces на Today | ровно `1` или `0`, если помощь не нужна |
| Параллельные proactive предложения | `<=1` |
| Active daily planning time после недели использования | median `<=3 мин`, p90 `<=5 мин` |
| Обязательные ручные записи normal day | `0`, кроме реального completion/явной рефлексии |
| Вопросов при return/recovery | `<=1` до первого действия |
| Повтор отклонённого предложения | `0` внутри capability cooldown |
| False success после offline/500/malformed | `0` |
| Duplicate push/episode/action при retry/multi-device | `0` |
| Unknown, ошибочно названный срывом | `0` |
| User-visible диагноз/стыд/наказание за lapse | `0` |
| Raw browsing URLs/page content на сервере | `0` |
| Dogfood return latency | сопоставимый длинный эпизод: движение от ~24 ч к `<=3 ч` |
| Bounded digital rest | доля сессий, завершённых у границы или после одного extension, растёт; перенос на другой device учитывается как unknown/shift, не fake success |

## 10. Что Satoru всё равно не сможет гарантировать

- Полностью заменить человека, терапию или медицинскую помощь.
- Определить усталость, настроение, сон или причину тишины только по количеству задач.
- Гарантированно разбудить закрытую PWA голосом.
- Заблокировать чужое native приложение силами веб-страницы.
- Увидеть console/TV/другой компьютер без агента на этом устройстве.
- Получить подробные iOS Screen Time данные для Apple Account региона Украина только потому, что оплачена Apple Developer membership.
- Предотвратить любой обход: пользователь владеет устройством и должен иметь безопасный emergency path.
- Сделать нулевое число срывов здоровой универсальной целью.

Реалистичное обещание продукта другое:

> Satoru замечает известный опасный момент раньше, исполняет решение, которое человек принял в более ресурсном состоянии, и делает возвращение дешевле — не заставляя помнить ещё один трекер.

## 11. Источники фактического аудита

- `SECRETARY-RECOVERY-V197-QA.md` — что реально опубликовано в v197;
- `public/app.js` — `renderToday`, `attentionTodayControlHTML`, `habitsBreakHTML`, `fightsCardHTML`, `stateNowContext`, `GOJO_MANUAL`, evening reminder/TTS;
- `public/attention-ui-v1.js` — setup/entry/boundary/recovery/return UI;
- `public/assistant-actions-v1.js` — whitelist и запрещённые классы действий;
- `server-attention-nudge-v1.js`, `server.js` — quiet ask, push scheduler и delivery semantics;
- `DISCIPLINE-ESCAPE-PLAN.md` — Attention, return, privacy и platform boundaries;
- `JARVIS-2-PLAN.md`, `JARVIS-3-PLAN.md` — один голос Тени и незавершённый capability registry;
- `QUESTIONNAIRE-V1-PLAN.md` — progressive profile и one-answer activation;
- `APPLE-DEVELOPER-FUTURE-HANDOFF.md` — iOS/Android/Desktop ограничения;
- `DESIGN-DIRECTION.md`, `DESIGN-CRAFT-RULES.md`, `DESIGN-REFERENCE-NOTES.md` — quest-first Today, five destinations и progressive disclosure.
