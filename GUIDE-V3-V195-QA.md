# Guide Library v195 — QA и release report

Дата: 2026-08-29  
Статус: **production release**, кодовый commit `ac0f86c66812d5fe035c3be57bcc1d144709d110`.

## Причина исправления

Контекстные главы v192–v194 были собраны и опубликованы, но ручной каталог вычислял доступность через `entryEligible()`. Эта функция предназначена для автоматической подсказки в подходящий момент: количество выполненных задач, дни данных, баланс, новая сессия и другие pacing gates. В результате готовый материал существовал, но пользователь видел почти сплошное «Появится позже».

## Контракт v195

- Автоматические подсказки не изменены: `entryEligible()` + `nextContextual()`, cooldown и максимум одна новая глава за сессию.
- Ручной каталог открывается после resolved First Journey и проверяет только release manifest, готовность данных и возможность выполнить настоящее действие.
- Calendar доступен только при наличии точной незапланированной задачи.
- Rewards доступен только при наличии точной доступной личной награды и organic balance.
- Tree доступен только при наличии точного unlockable node.
- Jarvis доступен только при готовом AI provider.
- Goals остаётся deferred до questionnaire/data release.
- Tribe остаётся закрыта до отдельного privacy/consent release.
- Replay и Skip не начисляют награды и не повторяют feature writes.

## Browser QA

Локальный isolated server, demo X7, Guide enabled, First Journey resolved через видимый Skip:

| Глава | Library | Проверка |
|---|---|---|
| First Journey | replay | видимая кнопка повторения |
| Habits | available | Start видим |
| Notes | available | Start видим |
| Shadow Voice | available | Start видим при provider readiness |
| System Theme | available | Start → Show → Settings/System target |
| Hero | available | Start видим |
| Den | available | Start видим |
| Pets | available | Start видим |
| Skill Tree | available | Start видим при точном node |
| Progress | available | Start видим |
| Goals | deferred | намеренно без действия |
| Tribe | locked | намеренно без действия |

- document horizontal overflow: `0`;
- System Theme дошла до шага 2/3 и нашла `[data-guide-target="system-theme-choice"]`;
- уже открытая production-вкладка v193/v194 корректно получила и применила SW update prompt до начала v195 работы.

## Автоматические проверки

- `node --check public/app.js`: PASS.
- Focused v195 + presenter/runtime/context suite: PASS; единственный sandbox EPERM исчез при разрешённом server run.
- Полный `node --test --test-reporter=dot scripts/*.test.js`: **1125/1125 PASS**.
- `git diff --check`: обязателен перед commit.
- `public/art/` и `art-factory/` не изменялись.

## Production verification

- Exact fast-forward: `04a492a → ac0f86c`; remote `master` и code commit совпали.
- Railway deployment `6149872899`: `success`.
- Публичный `index.html`: pin `20260829-guide-library-v195-1`.
- Публичные `app.js` и `sw.js`: `PWA_CACHE_VERSION/CACHE = satoru-v195`; в app присутствует новая ручная граница `firstJourneyResolved`.
- Изменённые production-файлы `index.html`, `app.js`, `sw.js` сверены с локальными release assets.
- Уже открытая production-вкладка получила `Refresh data`; после применения prompt исчез, приложение загрузилось, horizontal overflow `0`.
- На аккаунте со старым shell пользователю достаточно принять «Обновить данные» либо полностью закрыть и заново открыть установленный PWA. Очистка данных не нужна.
