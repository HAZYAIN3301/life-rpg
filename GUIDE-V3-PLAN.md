# Satoru Guide v3 — «Тень ведёт»

Статус на 2026-08-28: First Journey, account-owned state, Guide Library, replay/Piper и пятиъязычный runtime RU/EN/DE/UK/ES выпущены до C2 v191. После Habits v192 в локальный **v193 contextual pack** собраны ещё десять глав: Calendar, Notes, Voice, Jarvis, Rewards, Hero, Den, Pets, Tree и Progress. Все они используют общий `intro → engage → complete` контракт, но pacing по-прежнему показывает не более одной новой главы за сессию. Полный автоматический gate — **1112/1112 PASS**; browser smoke библиотеки на `360×800`, `375×812`, `1280×900` проходит без overflow, малых кнопок и console errors. Production release/hash verification v192–v193 и seeded end-to-end browser-проход каждой главы ещё не выполнялись. Goals остаётся закрытой до questionnaire/data logic, Tribe — до отдельного privacy/consent релиза. Исторический RU-сценарий лежит в `GUIDE-V3-FIRST-SCRIPT-RU.md`; guide-specific концепт Искры по-прежнему не является утверждённым production-art.

## 0. Решение

Satoru не нужен один длинный «полный гайд». Ему нужна система сопровождения из трёх слоёв:

1. **Первый путь** — Тень помогает совершить один настоящий core loop: увидеть свой шаг → начать → честно завершить → увидеть рост.
2. **Капельница** — новые механики объясняются по одной, только когда доступны и полезны конкретному человеку.
3. **Справочник и реплей** — пользователь сам выбирает короткую главу, если хочет вернуться позже.

Главный критерий: после каждого эпизода пользователь не просто «знает о функции», а уже применил её к своей жизни.

## 1. Фактическая точка проекта

### Уже есть

- `renderOnboardingScreen()` с AI-onboarding из свободного текста: 4–6 сфер и 3–5 первых дел.
- ручной onboarding: программы, сферы, custom sphere.
- `TUTORIAL_DAY1`: 5 шагов, spotlight, skip/resume/replay.
- `DRIPS`: один contextual prompt за загрузку, `seenDrips`, deep-link во view.
- уровневые gates: Today/Plan/Habits/Rewards сразу; Hero и Tribe с уровня 3.
- `settings.discovered` и NEW-markers.
- четыре формы Тени: Искра, Дух, Страж, Хранитель.
- Piper voice, transcript и ручные speaker controls.
- статический справочник `GUIDE_SECTIONS`.

### Главный дефект прежнего tutorial — закрыт в C1

Старый `TUTORIAL_DAY1` говорил о capture и уровне, но не проводил через создание/выбор и честное завершение реального дела. Единственным обязательным action был `comp-pet`: пользователь знакомился с Тенью, но не доказывал себе основной цикл продукта. C1 заменил этот маршрут настоящим select/create → optional focus → persisted completion → reward/mastery → контакт с Тенью; старые поля используются только для account-owned migration без повторной награды.

### Что не считать «новым опросником»

Текущий свободный AI-текст уже полезен, но это не структурированный questionnaire, который сохраняет цели, хобби, ритм, ограничения и стиль поддержки как долговременную память. Guide v3 должен работать сейчас и получить richer questionnaire без переписывания маршрута.

## 2. Что показал конкурентный разбор

### Duolingo

- Duo задаёт вопросы о мотивации и цели до основной работы.
- существующий уровень не обнуляется: предлагается placement test.
- пользователь сразу взаимодействует с материалом, а не читает теорию.
- path заранее решает «что дальше», снижая число решений.
- персонажи живут внутри главного действия, говорят контент и празднуют успех отдельными анимациями.

**Берём:** узнавание собственных ответов, калибровку, один следующий шаг, персонажа внутри действия, celebration после доказанной победы.

**Не берём:** guilt-напоминания, lives, наказание за ошибку, принудительный streak pressure.

### Finch

- новому человеку уже выданы starter goals.
- выполнение цели одновременно помогает человеку и даёт энергию питомцу.
- дополнительные функции раскрываются через quests, а не через энциклопедию.
- часть магазинов и возможностей открывается по мере роста питомца.

**Берём:** непустой первый экран, эмоциональную связь «позаботился о себе → связь с Тенью», contextual feature quests.

### MainQuest / Level Up life-RPG

- понятная обучающая последовательность: герой → первый квест → первая привычка → прогресс.
- onboarding привязывает RPG к реальным целям пользователя.

**Берём:** явный core-loop и идентичность героя.

**Не берём:** объяснение всей RPG-системы до первого результата и наказания/XP decay.

### Habitica

- поздние системы действительно открываются позже: класс — после накопленного опыта.
- но три типа задач, HP, экипировка и наказания создают большую начальную когнитивную цену.

**Берём:** реальный unlock как повод для отдельного tutorial.

**Не берём:** taxonomy dump и ущерб за пропуск.

### Игровой onboarding

- core loop учится действием;
- одна инструкция за раз;
- несколько коротких tutorials в релевантные моменты;
- поздние tutorials требуют всё больше самостоятельности;
- push, рейтинг, магазин и social не мешают первой победе;
- skip и replay обязательны.

## 3. Неподвижные принципы Satoru Guide

1. **Один эпизод = одна новая мысль.**
2. **Сначала действие, потом объяснение результата.** XP объясняется после XP, а не до.
3. **Только настоящее действие.** Guide никогда не просит отметить невыполненное ради демонстрации.
4. **Разрешена пауза на часы или дни.** Тень может сказать «я подожду» и продолжить после реального completion.
5. **Никакой стены функций.** В первом эпизоде нет Пати, Дерева, магазинов, статистики и настроек.
6. **Тень сопровождает, не управляет.** Всегда есть «Позже», skip главы и полный отказ от подсказок.
7. **Без вины.** Пропуск tutorial, дня или дела не меняет тон и не отнимает прогресс.
8. **Личное узнавание.** Где есть onboarding data, Тень называет выбранную цель/сферу/дело.
9. **Не обещать planned как готовое.** Нереализованное может быть только явно помеченным teaser после первой победы.
10. **Guide — не реклама.** Pro, push, rating и social consent не входят в core tutorial.
11. **Текст всегда видим.** Голос дополняет, но никогда не заменяет transcript.
12. **Новая функция не появляется молча.** Каждый новый крупный механизм получает registry-entry и contextual intro.

## 4. Архитектура опыта

### Слой A — Seed / настройка старта

Не tutorial, а подготовка личного материала:

- текущий AI free text или manual program;
- будущий questionnaire;
- подтверждение предложенных сфер, целей, дел и привычек;
- минимум один маленький шаг на Today;
- всё пользователь может изменить до сохранения.

### Слой B — First Journey

Короткая глава начинается после применения seed. Она не закрывается по таймеру: может ждать настоящего completion.

Результат главы:

- пользователь узнаёт свой шаг на Today;
- выбирает один следующий шаг;
- при желании запускает focus;
- честно завершает действие;
- видит XP/gold/level;
- понимает, что уровень не сгорает;
- знакомится со связью с Тенью;
- выходит в самостоятельный Today.

### Слой C — Contextual Chapters

Микрогайды на 1–3 действия. Появляются не чаще одного за сессию и только при выполненном trigger.

### Слой D — Guide Library

В «Как играть» вместо одной длинной стены:

- «Продолжить знакомство»;
- главы по доступным функциям;
- locked chapters с условием, но без преждевременного объяснения;
- «Что делает Satoru особенным» как отдельный optional overview;
- статический поиск/справочник для деталей;
- restart без повторной награды и без изменения данных.

## 5. Таймлайн раскрытия

### Сразу после onboarding

Только:

- Тень;
- Today;
- один личный шаг;
- start/focus как необязательная помощь;
- completion → XP/gold/level;
- связь с Тенью.

### После первого настоящего completion

- объяснить видимую награду;
- объяснить «уровень не сгорает»;
- завершить First Journey;
- сообщить, что остальное будет приходить постепенно.

### После 2 completed tasks или на втором активном дне

- **Habits D1 v192:** `intro → compose → complete` учит только повторяемости, реалистичному schedule, 2-minute version и отсутствию долга;
- до questionnaire interim-adapter предлагает недавнее реально выполненное дело; можно выбрать другой шаг, создать новую привычку или обновить существующую;
- schedule и `atomic.twoMin` всегда подтверждаются человеком. Новая привычка получает stable ID, а habit + Guide state сохраняются одним atomic commit;
- ошибка записи не двигает Guide, сохраняет черновик для Retry и не создаёт дубль; replay presentation-only и feature data не меняет.

### После первого возвращения и при наличии goal seed

- **Plan / Goals:** «помнишь `{goal}`?»;
- показать связь goal → next step → Today;
- не объяснять всю иерархию целей за один раз.

### Когда появляется дата/дедлайн или 3+ future tasks

- **Calendar v193:** куда уходит ещё не запланированное дело не на сегодня;
- Guide закрепляет точный кандидат по stable ID и завершается только после реального назначения валидного времени (`task-date-persisted`); снятие с расписания и no-op не считаются обучением;
- новая дата/время, список задач и Guide receipt сохраняются одним commit; ошибка оставляет задачу и главу на прежнем шаге, а исчезнувший либо уже запланированный кандидат переизбирается.

### Когда появляется мысль вне расписания

- **Notes / Capture v193:** сохранить мысль без решения;
- trigger — 4 completed tasks и пустой inbox: глава не притворяется полезной, когда заметки уже освоены;
- только текстовая заметка завершает короткую главу после общей записи inbox + Guide state: голос/видео на этом шаге скрыты, потому что их upload не входит в ту же транзакцию. Обычный Notes по-прежнему поддерживает media, а превращение заметки в task не требуется Guide.

### Уровень 2 / после освоенного core loop

- **Voice v193:** speaker button и отдельное согласие; глава fail-closed ждёт подтверждённый voice provider, а недоступный/остановленный playback не закрывает её и не записывает consent заранее;
- **Jarvis v193:** один новый вопрос о текущем состоянии; завершение требует нового успешного, непустого и уже показанного ответа именно текущего request ID, а не открытия окна, старого ответа или сетевой ошибки;
- **System theme:** только teaser из Settings, не onboarding requirement.

### Когда накоплено достаточно золота

- **Rewards v193:** earned gold → одна осознанная покупка конкретной доступной личной награды;
- admin-gold не делает главу eligible, а exact reward ID, покупка и Guide receipt проходят одной account-owned транзакцией без списания при ошибке;
- chest/cosmetics объясняются после прямой покупки, не раньше.

### Уровень 3 — не одной пачкой

1. **Hero overview v193** — персонаж отражает доказанный прогресс; глава закрывается явной CTA на смонтированном экране, а не самим render.
2. В следующую сессию **Den v193** — обживаемое место; отдельный session boundary после completion либо Skip Hero не даёт Hero и Den слиться в один dump.
3. Затем **Pets v193** — связь питомцев со сферами, только если минимум две ведущие сферы имеют свежие реальные события в своей ветке, включая подсферы; требуется настоящий клик по подсказке питомца.
4. **Tree v193** — только когда есть реальное очко и конкретный доступный unlockable node; просмотр именно закреплённого узла не тратит очко и только он завершает главу.
5. **Progress v193** — после 7 разных дней данных; явная CTA появляется только на смонтированном meaningful surface.
6. **Tribe / Party** — отдельный social-consent chapter после Hero, не в тот же заход и не автоматически при достижении уровня.

### Поздние/редкие главы

- party raid — после вступления;
- leaderboard — только при отдельном consent;
- path discipline — после уровня 3 и нескольких самостоятельных действий;
- weekly review — после полной недели;
- recovery/failure guidance — только в релевантном состоянии;
- advanced data/import/settings — по запросу, не drip.

## 6. Feature registry

Каждая крупная функция получает одну запись:

```js
{
  id,
  version,
  chapter,
  prerequisites,
  eligibility(state),
  trigger(event, state),
  target,
  action,
  completion,
  copyKey,
  pose,
  voiceContext,
  rewardPolicy,
  cooldown,
  once,
  replayPolicy,
  fallback
}
```

Требования:

- eligibility и completion проверяются по данным, а не только по view;
- UI-target может отсутствовать: fallback ставит bubble в безопасную позицию;
- action завершает шаг только после успешной persistence;
- tutorial не пишет feature data напрямую;
- одна глава не владеет чужим dialog/modal;
- новые registry entries покрываются RU/EN/DE/UK/ES до runtime release.

## 7. Связь с будущим questionnaire

### Что questionnaire должен вернуть

Не «психологический профиль», а подтверждённый seed:

- `goals[]`: чего человек хочет и почему;
- `hobbies[]`: что уже любит;
- `spheres[]`: что уже является частью жизни;
- `experience[]`: стартовый доказанный уровень;
- `rhythm[]`: примерная желаемая частота с допуском ±1;
- `constraints[]`: время, доступность, ограничения — только добровольно;
- `supportStyle`: коротко/подробнее, мягко/прямо;
- `firstSteps[]`: 1–3 конкретных действия;
- `consents`: что можно сохранять и использовать в персонализации.

### Как guide использует ответы

- не пересказывает анкету;
- выбирает один наиболее узнаваемый объект;
- говорит «ты называл `{goal}` — вот его первый шаг `{quest}`»;
- goal появляется в Goals, step — на Today, frequency — как черновик Habit;
- человек видит причинную связь между своим ответом и интерфейсом;
- при отсутствии/отказе работает neutral deterministic copy.

### Переходный контракт до questionnaire

Текущий AI-onboarding уже отдаёт spheres + quests. Guide v3 использует их через адаптер `guideSeedFromCurrentState()`; позже questionnaire заменяет источник, а не tutorial schema.

## 8. Тень: guide-specific арт и motion

### Почему старые кадры нельзя использовать

Runtime calm/speaking рассчитаны на карточку и Логово. Guide требует другой дистанции: Тень ближе, смотрит на пользователя, входит в пространство разговора и реагирует на действие. Простое масштабирование idle выглядит как увеличенная иконка, а не ведущий.

### Матрица production

Минимальный набор на форму:

1. `guide-arrive` — мягко входит и устанавливает контакт;
2. `guide-close-speak` — крупный разговорный кадр;
3. `guide-listen` — ждёт действия пользователя;
4. `guide-direct` — направляет внимание к spotlight;
5. `guide-recognize` — узнаёт личную цель/ответ;
6. `guide-celebrate` — коротко радуется реальной победе;
7. `guide-wait` — спокойно остаётся рядом при паузе;
8. `guide-return` — встречает при replay/возврате.

Полная матрица: **4 формы × 8 состояний = 32 guide-specific keyframes**. Motion-пилот после утверждения стиля: `close-speak + listen + celebrate` для каждой формы.

### Различия форм

- **Искра:** направляет взглядом, наклоном и flame-wisps; limbs не добавлять.
- **Дух:** wisps образуют мягкий directional gesture, не руку.
- **Страж:** одна спокойная открытая ладонь, без командной позы.
- **Хранитель:** широкая принимающая поза; halo остаётся вторичным.

### Replay и эволюция

- v1 допустимо: первый guide использует guide-Искру; replay временно тоже Искру.
- это фиксируется как известный долг, не как канон.
- production target: replay использует текущий tier и соответствующий guide-set.
- если tier-set не загружен, показать текстовый bubble без подмены формой другого tier.
- награды за replay не выдаются.

### Арт-контракт

- один общий canvas `1024×1024` для production;
- cut-paper vector, matte indigo/purple, restrained internal texture;
- та же геометрия глаз, рта и flame language;
- без generic game mascot, 3D, glossy anime, horror и нового lore;
- background alpha после deterministic chroma removal;
- readability: 64, 96, 160 и mobile guide size;
- identity QA относительно canonical calm каждой формы.

## 9. Голос и речь

- Piper озвучивает guide copy тем же постоянным голосом Тени.
- первый автозвук — только после явного пользовательского действия/согласия.
- speaker button доступен на каждом bubble.
- transcript остаётся всегда.
- stop/replay работает на каждом шаге и при смене view.
- `prefers-reduced-motion` не отключает речь, но отключает decorative motion.
- тексты сначала утверждаются по-русски Альбертом, затем локализуются RU/EN/DE/UK/ES.

Тон:

- человек, который рядом, а не help-center;
- конкретно, без подростковой фамильярности;
- одна характерная деталь на эпизод, не шутка в каждой строке;
- никаких «я разочарована», «не подведи», «серия погибнет»;
- Искра короче и осторожнее; формы выше говорят увереннее и глубже.

## 10. Состояние и replay

Предлагаемая схема:

```js
settings.guideV3 = {
  version: 3,
  enabled: true,
  currentChapter: null,
  currentStep: null,
  completedSteps: [],
  completedChapters: [],
  seenPrompts: [],
  snoozedUntil: null,
  lastPromptAt: null,
  firstRunForm: 'spark',
  voiceConsent: null,
  questionnaireVersion: null
}
```

Правила:

- migrate текущие `tutorial.done/skipped/seenDrips`, не повторяя пройденное;
- skip главы не выключает contextual help навсегда;
- «Не показывать подсказки» — отдельный global choice;
- restart выбирает главу и не сбрасывает историю;
- replay не меняет XP, gold, bond или discovered;
- состояния сохраняются только после успешного действия.

## 11. UI-контракт

- на mobile character занимает отдельную visual zone над bubble, не 60px avatar;
- spotlight не закрывает target и нижнюю навигацию;
- bubble не глубже двух surface levels;
- реальные touch targets ≥42px;
- видимый step label: не «2/40», а название короткой главы и локальный прогресс;
- `Esc`/Close, focus trap там, где interaction modal; contextual bubble не должен inert’ить весь app;
- focus возвращается к инициатору;
- screen reader получает `role=status` для реплики и осмысленный alt формы/состояния;
- color не единственный указатель target;
- reduced motion полностью останавливает entrance/bob/confetti.

## 12. Метрики

События:

- `guide:start`, `guide:step_view`, `guide:action`, `guide:snooze`, `guide:skip`, `guide:error`;
- `guide:first_step_selected`, `guide:first_focus_started`, `guide:first_real_completion`;
- `guide:chapter_complete`, `guide:context_open`, `guide:replay`;
- reason/step/chapter/version, без текста цели и других личных данных.

Основные метрики:

- регистрация → seed applied;
- seed applied → выбран первый шаг;
- первый шаг → первое реальное completion в D0/D1;
- First Journey completion;
- D1/D7 return;
- contextual chapter open/completion;
- skip/snooze/error по каждому шагу;
- доля пользователей, которые самостоятельно возвращаются к guide library.

## 13. QA и release gates

### Functional

- fresh AI-onboarding, manual onboarding и program onboarding;
- seed с quest / без quest / без goal;
- action success, persistence failure и retry;
- pause на часы, reload и другое устройство;
- skip/snooze/replay;
- уровень 3 не выдаёт шесть prompts сразу;
- current tier replay и отсутствующий asset fallback;
- Piper ready/unavailable;
- offline shell.

### Visual

- 360×800, 375×812, 1280×900;
- RU/EN/DE/UK/ES, длинный DE;
- dark/light;
- Spark/Spirit/Guardian/Keeper;
- spotlight targets у всех краёв;
- keyboard/focus/screen reader;
- reduced motion;
- no horizontal overflow.

### Art

- 4 canonical identity comparisons;
- 32 keyframes unique and complete;
- alpha corners, no chroma fringe;
- consistent canvas/pivot;
- 64/96/160 readability;
- motion loop first/last-frame QA.

## 14. Порядок реализации

### Commit A — согласование ✅

- этот план;
- RU first script;
- один guide-close concept Искры;
- список правок Альберта.

### Commit B — guide data model без UI ✅

- registry/schema/migration;
- deterministic eligibility and event contracts;
- unit tests.

### Commit C0/C1 — First Journey ✅

- новый guide surface;
- реальный select/start/pause/complete loop;
- accessibility;
- Piper integration;
- RU-runtime и screenshots.

### Commit C2 — пятиъязычный runtime ✅ v191

- RU остаётся единственным owner-approved источником текста;
- EN/DE/UK/ES выпускаются только через exact manifest `locale + globalName + version + status`, а не по одному самодекларированному `STATUS`;
- locale-copy загружаются до presenter, используются одинаково библиотекой, First Journey и Piper и входят в offline shell;
- неизвестный, отсутствующий или не совпавший по версии модуль fail-closed уходит в безопасный fallback;
- `?guidePreview=1` разрешён только на localhost или администратору;
- финальный шаг подсвечивает реально видимый путь к «Как играть»: Help на desktop либо More на mobile.

### Commit D — contextual chapters

- [x] **D1 Habits — локально собран и проверен в v192:** real Habits Build, interim recent-task adapter / existing-habit update, явные schedule + twoMin, stable ID, atomic `habits + settings`, shared Store mutex/lazy settings snapshot, retry без дубля и presentation-only replay. Automated suite **1101/1101 PASS**; local browser QA PASS на `360×800` / `375×812` / `1280×900`, пяти языках и обеих темах. Production release/hash verification pending.
- [ ] Goals/Plan — deferred-questionnaire;
- [x] **Calendar v193** — exact unscheduled task ID, реальное назначение времени, atomic `tasks + settings`, stale-candidate reconcile и rollback/no false-success;
- [x] **Notes v193** — реальная text capture, stable note ID, atomic `inbox + settings`, Retry без ложного receipt; media остаётся обычной функцией вне Guide-транзакции и жёстко fenced к исходным account ID/write epoch;
- [x] **Voice/Jarvis v193** — подтверждённый provider и реальный playback перед consent; exact current-request response перед completion;
- [x] **Rewards v193** — organic-gold eligibility, exact personal reward, atomic `purchases + settings`, неизменённая economy confirmation.

### Commit E — level 3 chapters

- [x] **Hero → Den → Pets → Tree → Progress v193** — пять runtime-глав одним кодовым пакетом, но последовательными сессиями и честными data gates;
- [ ] Tribe отдельно — privacy/consent release;
- [x] pacing/cooldowns — не более одной auto-главы за сессию, replay не меняет данные и не открывает следующую главу.

### Commit F — questionnaire bridge

- structured seed schema;
- preview/consent;
- goal/habit materialization;
- guide recognition copy.

### Art track

1. утвердить Искру `guide-close`;
2. утвердить 8-state Spark sheet;
3. перенести позы на Spirit/Guardian/Keeper;
4. motion pilots 4×3;
5. полный export + QA;
6. только затем guide-art runtime integration.

## 15. Границы после contextual pack v193

- Habits и десять глав v193 собраны локально; browser-матрица общей Library оболочки уже проходит, но перед production release остаются seeded end-to-end browser-сценарии действий каждой главы, разрешение на push/deploy и production asset-hash verification;
- Goals не включать до questionnaire/data logic; Tree/Goals import и другие транзакционно сложные функции не расширять скрыто внутри Guide;
- Tribe не включать до отдельного consent/privacy QA, включая отказ «Оставить приватным», ownership и offline/error состояния;
- questionnaire UI;
- 32 production frames;
- автоматическое создание целей/привычек без подтверждения;
- guide для planned-but-unreleased функций;
- reward economy за replay;
- social/push permissions в onboarding;
- изменение существующих canonical Shadow assets.

## 16. Источники

- Duolingo onboarding / placement / learning path: <https://blog.duolingo.com/es/primeros-pasos-con-duolingo/>
- Duolingo character system: <https://blog.duolingo.com/building-character/>
- Finch New User Guide: <https://help.finchcare.com/hc/en-us/articles/42149821015693-New-User-Guide>
- MainQuest Getting Started: <https://www.mainquest.net/guides/getting-started>
- Level Up life-RPG: <https://lvlquest.de/en/>
- Habitica FAQ: <https://habitica.com/static/faq>
- Apple Onboarding for Games: <https://developer.apple.com/app-store/onboarding-for-games/>
- Apple HIG Onboarding: <https://developer.apple.com/design/human-interface-guidelines/onboarding>
