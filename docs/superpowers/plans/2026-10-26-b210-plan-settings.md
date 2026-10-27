# B2.10 — План и настройки на данных аккаунта

> **For agentic workers:** Use superpowers:executing-plans. Подагенты запрещены владельцем.

**Goal:** Закрыть подключение Плана и вернуть полный набор настроек, сохранив утверждённую оболочку B2.5.

**Architecture:** Новые цели и расписание используют B2.5 markup и существующие goalDataCommit / commitmentDataCommit / Store. Полные формы настроек, привычек и Вдохновения сохраняют исходные DOM-контракты и владельцев записи, но живут в новой оболочке и получают её surfaces/type/controls. Они не используют prototype data или localStorage B2.

**Tech Stack:** React 19, TypeScript, esbuild, существующие browser/Node domain modules.

**Spec:** Текущее поручение владельца; B2.5, GOALS-ACTIONABLE-V185.md, ROUTINE-V338.md, WEEK-PLANNING-V319.md, OWNERSHIP-WRITES-V261.md.

## Global Constraints

- Не возвращать shell B2.6. Default entry/native/auth/B3/attention/3D и production не менять.
- Все изменения через apply_patch, staging только явных своих путей, без push/deploy.
- Цели/шаги/проекты/связи — единая goals/tasks/groups транзакция; ошибки и stale не показывают успех.
- Расписание — weeklyRoutineV1 с RoutineV2; никакой автоматической материализации квестов.
- Полные настройки сохраняют скрытые поля и служебные данные. Пароль/ключи обрабатываются исходными формами и не входят в React snapshot, URL или логи.
- Язык, light/dark/system, accent действуют в новой оболочке; текст пользователя не переводится.

## Review Focus

- Потеря ответа и повтор создания не создают дубликат/вторую награду.
- Изменение цели/аккаунта между открытием и сохранением блокирует старую форму.
- Циклы родителей целей/сфер, чужие IDs и неверное время отвергаются до записи.
- Выход из настроек ждёт autosave receipt; не теряет последние буквы/настройки скрытых секций.
- На 375px сложные формы, вложенность и security/connectivity controls остаются доступны.

## Tasks

- [x] 1. `plan-model.ts` + `plan-live.test.cjs`: builders для goal CRUD/status/step/metric/project/link; stale/retry и поля истории. RED → GREEN. Bridge использует оригинальный goalDataCommit/refreshGoalCompletion/GoalStepQuestV1.
- [x] 2. `LiveGoals.tsx`: Сейчас/Все/Карта, фильтры, detail, формы, метрика, шаг в день, проекты, массовое управление; дизайн accepted pl-* и GoalMap.
- [x] 3. `LiveRoutine.tsx` + bridge: editor с днями, timed/untimed/fixed/outdoor/rotation, сохранение и исключения; layer в Сегодня/дне/неделе/месяце; исходный AI/photo/week workshop доступен как дополнительный workflow. Проверки RoutineV2/WeekPlanner и real readback.
- [x] 4. `OwnedSurface.tsx` / `LiveSettings.tsx`: полные оригинальные settings groups с B2.5 navigation и стилями, scopes/skills и все advanced controls. Habits/Inspiration — live owner-rendered surfaces вместо demo preview. Сохранить формы, handlers и initialization/focus hooks, а не только HTML.
- [x] 5. `Today.tsx` / build bridge: routes/deep links/back, flush перед переходом, тема/accent/lang, отсутствие prototype paths в Плане. Мобильная и desktop проверка одной batched round + одна confirm round.
- [x] 6. Targeted model/domain tests, build/syntax, isolated QA аккаунт с GET readback после reload, failure/retry/stale. B210-QA, DEVLOG/BACKLOG/checkpoint и scoped local commit. Без физического iPhone/production claims.

## Evidence / rulings

- origin/master свежий: 3eca22b1, HEAD 9b6b895f, входной web-worktree чистый.
- Mobbin iOS settings: Todoist 605504fc-14e5-4e76-8a68-e4578ef0c952; Forest f6f316ae-1e7f-4360-83f1-4dc89697ee39; bunq b75e5826-dd63-45b3-ad6d-ee654adc4d6c (последний только структура поиска/групп). Сохраняем B2.5, используем группировку/раскрытие по задаче.
- Ruling: полный settings DOM необходим: captureSettingsForm читает поля из нескольких скрытых групп. Извлечение одной секции может обнулить коэффициенты и сломать focus controls. Полный DOM остаётся в одном owner host, видна только выбранная группа.
- Ruling: самостоятельная проверка вместо подагентов по прямому правилу владельца.
