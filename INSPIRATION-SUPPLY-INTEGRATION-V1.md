# Supply Вдохновения — передача интегратору, 10.09.2026

Запись ниже сохраняет состояние пакета на 10.09. Runtime-подключение выполнено
в отдельном worktree 11.09: актуальные изменения, проверки и оставшиеся шаги —
`INSPIRATION-SUPPLY-RUNTIME-INTEGRATION-V1.md`.

База `bbc86d3` поверх `6da8376`. Это готовый к подключению локальный пакет,
не опубликованный runtime. `app.js`, профиль, Полка, locales, index/SW и общие
DEVLOG/BACKLOG не менялись. Все 11 старых id сохранены. Девять собственных текстов
проходят admission (3 прежних + 6 новых); 8 внешних записей остаются в очереди проверки.
Это небольшой текстовый fallback, не достаточный видео/аудио-каталог.

## Что проверено в источниках

Проверка 10.09 через web; доступность страницы не выдаётся за воспроизведение.

| ID | Установлено / сохранено | Что ещё нужно до admission |
|---|---|---|
| `nps-yosemite` | NPS: конкретная работа public domain, официальный embed, 196 секунд | Язык/отсутствие речи и playback в Satoru |
| `dvids-run` | Старая запись/URL сохранены; прямую страницу получить не удалось | Конкретные права, атрибуция/disclaimer, язык, длительность, playback |
| `blender-spring` | Старые id, CC BY 4.0, 464 секунд, «без диалогов» сохранены как исходные метаданные | Подтвердить права/источник/embed и playback |
| `blender-bunny` | Старый id и CC BY 3.0 сохранены | Подтвердить права/источник, длительность, embed и playback |
| `nasa-hum-sun` | Страница NASA доступна, англоязычный транскрипт | Длительность и проигрывание аудио через пользовательский путь Satoru |
| `nasa-pale-blue-dot` | Старые source/image URL и attribution сохранены | Просмотр фактического изображения, соответствие источнику/правам |
| `spiderverse-official-trailer` | URL отдаёт заголовок Spider-Verse trailer; старая attribution сохранена | Подтвердить канал Sony, embed разрешение и playback; заголовок не доказывает канал |
| `rezero-official-pv` | Старый URL и KADOKAWA attribution сохранены, язык помечен ja | Первичный источник/канал, длительность, embed разрешение и playback |
| 3 исходные цитаты | Оригинальные строки Satoru хранятся в репозитории, 5 переводов | Дополнительного внешнего разрешения/сети не требуется |

Источник NPS: [Yosemite Stock Footage (2009)](https://www.nps.gov/media/video/view.htm?id=01964B37-C8B7-8B9D-A2DB28BD3EBDF07E).
Страница подтверждает точечные права и embed, не общий статус всего домена.

Источник DVIDS: [Copyright Information](https://www.dvidshub.net/about/copyright).
Условия предупреждают о возможных правах третьих лиц и об отсутствии endorsement;
поэтому старое название «официальный public-domain архив» нельзя использовать как
полную проверку любой его записи. Слова о коммерческом использовании требуют
сверки именно с конкретной работой и текущими условиями, не отдельного скачивания.

Источник NASA: [Hum of the Sun](https://www.nasa.gov/podcasts/curious-universe/the-hum-of-the-sun/).
Открытие текста не доказывает, что аудио доступно или воспроизводится.

Два трейлера не удалены и не скачаны. Их exclusion имеет причину незаконченной
проверки, а не коммерческий характер. Ни одной записи не выставлено `playback`
по HEAD, HTML страницы, oEmbed или ссылке на права.

## API и порядок загрузки

После существующих `inspiration-profile-v1.js` и `inspiration-catalog-v1.js`,
перед app:

```html
<script src="inspiration-supply-policy-v1.js?v=RELEASE_PIN"></script>
<script src="inspiration-supply-batch-v1.js?v=RELEASE_PIN"></script>
<script src="inspiration-supply-runtime-v1.js?v=RELEASE_PIN"></script>
```

Все три добавить в SHELL `sw.js`, обновить pin изменённого catalog, общий CACHE/app
и изменённого UI вместе с фактическим номером релиза интегратора.
`RELEASE_PIN` здесь явно placeholder, не строка для публикации.

`R.candidates()` собирает 17 исходных кандидатов. `R.prepare()` всегда вызывает
`admit`, учитывает язык и профиль, затем `eligibleToday` → `toCatalogRows`.
`R.ensureDigest()` передаёт этот конечный pool существующему Profile.ensureDigest/
choose. Алгоритм ранжирования не меняется. Время обязательно передаёт вызывающий.

```js
function inspirationSupply(profile = inspirationProfileState()) {
  const R = window.InspirationSupplyRuntimeV1;
  return R ? R.ensureDigest({ profile, day: todayStr(),
    now: new Date().toISOString(), locale: lang() })
    : { ok: false, error: 'supply_not_loaded' };
}
function inspirationCatalog() {
  const result = inspirationSupply();
  return result.ok ? result.catalog : [];
}
```

Идентификатор `catalog` означает все admitted строки, чтобы сохранённый материал
можно было открыть независимо от сегодняшних интересов. `poolRows` уже прошли
язык, профиль, повторы и квоты. Никогда не передавать legacy `C.items()` в choose.

## Точные потребители в app.js (на базе v253)

1. `inspirationCatalog`, около 25148 — helper выше, только admitted rows.
2. `shelfViewModel`, около 25324: вместо
   `P.ensureDigest(profile, catalog, todayStr())` получить `inspirationSupply(profile)`;
   при `!ok` вернуть `{state:'error',error:'load'}`. В vm добавить
   `supplyReport: ensured.report`, `unavailableIds: ensured.unavailableIds`.
3. Настройка около 25578: `inspirationSupply(configured)`, при ошибке не сохранять
   fabricated пустой профиль; показать существующий failure status и завершить handler.
4. `markInspirationDone` и `recordInspirationFeedback`, около 25598/25607:
   получить `inspirationSupply(inspirationProfileState())`; при `!ok` прекратить.
   Существующий persistInspirationProfile и receipt boundary сохраняются.

Поиск после правок: `rg -n 'P.ensureDigest|inspirationCatalog\(|inspirationYoutubeEmbed' public/app.js`.
Здесь только четыре места ensureDigest. Никакого Store/direct PUT этот пакет не добавляет.

## Важный обход admission через сохранённую Полку

В двух местах старый код при отсутствии catalogItem реконструирует YouTube iframe
из saved URL. После исключения недоступной записи это вернуло бы её обратно в плеер.

В `shelfViewModel.enrich`, около 25345, разделить cases:

```js
const catalogMissing = !!item.catalogId && !catalogItem;
const embedUrl = catalogItem ? catalogItem.embedUrl
  : catalogMissing ? '' : inspirationYoutubeEmbed(item.url);
// catalogMissing: сохранить личный note, title, why и возможность удаления/архива,
// но mediaPolicy = 'unavailable', embedUrl = '', supplyUnavailable = true.
```

В `inspirationActionItem`, около 25585, saved.catalogId без admitted catalogItem
вернуть с `mediaPolicy:'unavailable', embedUrl:'', supplyUnavailable:true`.
Далее обработчик открытия обязан показать сообщение о необходимости проверки;
не вызывать openProtectedInspirationSource для такой записи. Самостоятельно добавленные
URL без catalogId остаются в текущем отдельном attention flow.

Renderer saved card должен отображать note/title и сообщение об отсутствии материала,
не кнопку play. Текст не должен обещать удаление: причина может быть временной.
`byId/items` старого Catalog остаются инструментом метаданных, не разрешением воспроизведения.

## Дневной receipt и честная нехватка

При существующей подборке сегодняшние `digest.ids` и `doneIds` сохраняются. Новое
`not_for_me` действует на будущую подборку. Если playback gate, права или язык исключили
материал, `items` короче, `unavailableIds` содержит скрытые исходные ids. Подстановка
других карточек в тот же день не происходит даже после reload/повторного сохранения.
Настройка интересов через существующий configure по-прежнему явно создаёт новый digest.

`report.emptyReason` принимает:

| Код | Предлагаемый RU текст |
|---|---|
| `language_gap` | «По этим темам пока нет материалов на выбранном языке.» |
| `no_matching_material` | «По этим темам пока нет материалов.» |
| `supply_unverified` | «Материалы по этим темам пока ожидают проверки.» |
| `temporarily_exhausted` | «На сегодня новых подходящих материалов пока нет.» |
| `profile_filters` | «С текущими ограничениями подходящих материалов пока нет.» |

В `return-shelf-ui-v1.js:renderDaily` около 231 заменить общий empty heading на
выбор из vm.supplyReport. Дать ровно пять locale-переводов каждой строки; heading
и один объясняющий абзац достаточно. Для `shortage`/`thin_formats` не вставлять filler:
показать реальное число и «Сегодня подборка короче: подходящих материалов пока мало».
Предлагать поменять интересы как обязательное лечение языкового пробела не нужно.

## Новизна и операторская перепроверка

Профиль сегодня хранит один digest и feedback, не полную историю показа. Adapter
учитывает известный прошлый digest и даты feedback; дополнительные подтверждённые
показы могут быть переданы `shown:[{id,day}]`. **Полная гарантия 45 дней по всем
показам сейчас невозможна:** их истории нет. Не писать в релизе, что она появилась.
Новое хранилище вкусов или локальный cache просмотров не создано.

`R.reviewQueue(R.candidates(), {now,limit:3,leadDays:7})` возвращает конечную очередь
за неделю до 30-дневного истечения; unknown сначала. `requiredCheck` указывает playback
в Satoru либо ручной просмотр статичного изображения/источника. Функция не ходит в сеть
и не продлевает receipt. Периодический запуск ещё не подключён: нельзя выдавать чистый
планировщик очереди за действующую автоматическую проверку.

После фактического playback записать в catalog.supply проверенные lang/durationSec,
embedAllowed, точное lastCheckedAt, `available:true`, `checkMethod:'playback'`,
`availabilityReason:''` и приложить browser receipt. При timeout — unknown/temporary_error,
без продления последнего удачного receipt; при доказанном удалении/denied — false
с соответствующей причиной. Не стирать карточку из исходного манифеста ради зелёного теста.

## Проверки и что остаётся интегратору

Исходный пакет `bbc86d3`: полный suite **2032/2032**, concurrency 2, 54.4 s.
После изменений: targeted policy/runtime/profile **95/95**, Node syntax checks.
Финальный полный suite **2053/2053**, `node --test --test-concurrency=2 scripts/*.test.js`,
75.96 s, exit 0 (10.09). Все восемь файлов пакета прошли diff whitespace check.

Нужно подключить runtime/UI, проверить все locale пустоты, пять языков реальных текстов,
desktop/mobile, сохранённый catalogId → unavailable, no-replacement на дату, отсутствие
раннего persist success; обновить release pins, выполнить полный suite интегрированного
кандидата. Playback и внешний batch не объявлять готовыми по unit/browser smoke UI.
Push/deploy этого worktree не выполнялся.
