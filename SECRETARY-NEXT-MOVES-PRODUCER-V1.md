# Проекции первого возврата после выпадения

Локальный bounded adapter к `SecretaryNextMovesV2`, без доставки и записи данных.
Основание: ветка `secretary-next-moves-v2`, `SECRETARY-NEXT-MOVES-V2.md`;
актуальная база этой работы — `origin/master` `6da8376` (v253).

## API

`SecretaryNextMovesProducerV1.build(snapshot)` возвращает
`{ok:true, context}` либо `{ok:false,error}`. В браузере нужны
`AttentionSessionV1`, `HabitTwoMinuteV1`; `RestProfileV1` нужен только при переданном
профиле. В Node зависимости загружаются через `require`.

```js
const projected = SecretaryNextMovesProducerV1.build({
  now: '2026-09-10T12:00:00.000Z',
  today: '2026-09-10',
  utcOffsetMinutes: 120, // local = UTC + offset
  episodes: { version: 1, episodes: [] },
  tasks: [], habits: [], habitlog: {},
  settings: {},
  guideActive: false,
  firstValueStatus: null, // отсутствие загруженной записи; не ошибка загрузки
  activeSession: false,
});
```

Сервер передаёт `lapse` вместо `episodes`; наличие ключа `lapse` выбирает этот путь.
`lapse:null` означает известное отсутствие сигнала. Испорченная проекция даёт ошибку.
`now`, `today`, offset и флаги проверяются строго; календарный round-trip отвергает
несуществующие даты. Вызывающий обязан передавать свежий snapshot настоящего владельца,
различать ошибки загрузки и отсутствие файла. Adapter не получает пользовательский id
и сам не устанавливает права доступа.

`context` содержит `lapse`, `habitMinimum`, `restMenu`, `eveningContract`,
`commitmentItems:[]`, `guide:{active}`, `firstValue:{pending}`, `activeSession:{active}`.
`observedAt` берётся из переданного `now`, часы внутри не читаются. Snapshot считается
прочитанным прямо перед вызовом. Модуль не создаёт planned-start/tonightSchedule и не
решает, доставлять ли evening-close: вечерняя проекция нужна для запрета приглашения
вернуться в работу после собственной границы.

## Что считается основанием

Выбирается последний закрытый эпизод с явным `outcome:'escaped'` либо числовым
`actualMinutes > plannedMinutes`. `unknown` с неизвестным замером не является основанием;
длительность не вычисляется из времени закрытия. Начало и конец должны быть валидными,
конец — не в будущем, в текущем локальном дне и не старше 180 минут. После `returnedAt`
эпизод повторно не предлагается. При одинаковом времени выбор стабилен по event key.

Сигнал содержит только `confirmed`, `source`, `eventKey:'attention:<episodeId>'`,
`day`, `endedAt`, `observedAt`, optional `originalRef`; измеренный сигнал сохраняет
`plannedMinutes` и `actualMinutes` для повторной серверной проверки. Источник
`user_confirmed` обозначает запись самим пользователем. Названия источников, тексты
целей, темы и заметки не попадают в проекцию. Тип носителя из этих текстов не угадывается;
`screenEpisode` допустим только как явно переданный булев сигнал в bounded ingress.

Клиент отправляет только `lapse` и три флага. Сервер заново строит owner projections
из собственных файлов и не доверяет присланному `originalStillActionable`.

## Явная связь с исходным делом

`originalRef` — additive optional поле AttentionSessionV1 и AttentionEpisodeV1:
`/^(quest|habit):[A-Za-z0-9_-]{1,74}$/`. Полный ref укладывается в 80 символов policy;
длинный id отклоняется, не обрезается. `null` снимает optional связь при amendment.
Старые записи без поля сохраняются. Невалидный optional ref при чтении удаляется,
сам эпизод сохраняется; новые start/record/amend с невалидным ref возвращают
`invalid_original_ref`. Не связанное с ref amendment и старый повторный record без
этого ключа сохраняют существующую связь.

`avoidedThingId` уже существует в модели эпизода, серверном sanitizer и
`DISCIPLINE-ESCAPE-PLAN.md`; прежнее утверждение, что связей совсем нет, неточно.
Поле не содержит типа, а в текущем app/controller нет writer этого поля. Оно остаётся
на месте и не мигрируется догадкой в quest/habit. Совпадение title/purpose/topic с id
не устанавливает связь.

Controller переносит явно переданный `input.originalRef` в session draft. Затем
нормализация/продление/envelope round-trip/close/toEpisode/amend сохраняют ref.
В интерфейсе открытия Attention нужен необязательный явный выбор исходного дела;
`app.startAttentionEntry` передаёт выбранный ref в `AttentionControllerV1.startSession`.
Пустой выбор передаётся отсутствующим полем либо `null`, а не пустой строкой.
Серверные whitelist session/episode также должны пропускать валидный ref.

Актуальность проверяется по точному id в текущем owner snapshot:

- Задача существует, `done === false`, нет `completedAt`; дата отсутствует либо
  валидна и не позже сегодняшней. Просроченную задачу можно открыть без переноса.
- Привычка существует, не архивна, назначена на текущий weekday, журнал сегодня не
  содержит выполнения, а `HabitTwoMinuteV1.textOf` возвращает сохранённый минимум.
  Без загруженного `habitlog` завершённость неизвестна, предложение не создаётся.
- `habitMinimum` производится только для явно связанной привычки. Случайная другая
  привычка не подменяет потерянный контекст.

Executor повторяет проверку непосредственно перед открытием. Открытие не переносит,
не завершает и не запускает таймер автоматически.

## Реальные границы источников

`settings.secretary.{configured,eveningTime}` уже существуют и дают вечернюю границу,
даже если `dailyReminder:false`: это ограничение работы, а не разрешение нового канала.
FirstValue pending вычисляется из существующего списка статусов; завершёнными для
этого gate считаются `first_value_reached`, `completed`, `deferred`. `null` допустим
только после успешного чтения отсутствующей записи. Guide и activeSession берутся
из существующих проверок runtime, включая browser companion.

`RestProfileV1.pickForLowResource` вызывается только с явно переданным `restProfile`.
`mode` отображается как offline→no_screen, device→screen, mixed→either; минуты берутся
из `defaultMinutes`. Нового места сохранения не вводится: в v253 app/server нет writer
RestProfile, а START-HERE фиксирует паузу его UI от 03.09. Поэтому рабочий runtime пока
передаёт отсутствие профиля и получает `restMenu:null`.

Уговоры в `settings.commitmentsV1` уже имеют `version:2` и владельца `CommitmentV2`.
Прямое применение `CommitmentV1.dueOn` к ним теряет семантику. Кроме того, policy
fallback использует сырой commitment step id как task ref, хотя owner-связи у него нет.
В этом срезе `commitmentItems:[]`; цитаты и commitment fallback ждут согласованного
адаптера V2 и настоящего executor. Неподключённость указана явно, V1-сущности не выдуманы.

## Проверки

`scripts/secretary-next-moves-producer-v1.test.js`: controller→session→extension→envelope→
episode→amend, старые записи/повтор, strict refs, malformed clocks/snapshots/signals,
unknown/измеренный overrun, локальный день/свежесть, удалённые/выполненные/будущие дела,
habits schedule/log/minimum, evening mapping, RestProfile selection, отсутствие утечки
текста и иммутабельность.

Локально: 71/71 профильных тестов вместе с attention/controller/existing producer,
`node --check` четырёх изменённых JS и `git diff --check`. Полный suite, серверное
сохранение, интерфейс 375/1280 и публикацию проверяет интегратор на собранном кандидате.
Здесь нет утверждения о выполненном browser QA или deployment. Fetch этой worktree
был заблокирован DNS; использована локальная remote-tracking база `6da8376`.
