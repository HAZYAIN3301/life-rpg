# Guide v3 v194 — локальный QA-отчёт

Дата: 2026-08-28
Статус: локальный release candidate; production не заявлен.

## Что проверено

Seeded account прошёл главы через настоящий UI и настоящие feature writes:

| Глава | Фактическое действие | Итог |
|---|---|---|
| Calendar | назначено время точной незапланированной задаче | durable receipt, PASS |
| Notes | сохранена новая текстовая заметка | одна запись, PASS |
| Voice | provider недоступен | fail-closed, consent не записан |
| Jarvis | AI key отсутствует | fail-closed, старый/пустой ответ не засчитан |
| Rewards | куплена точная личная награда за 5 earned gold | баланс и история изменены один раз |
| Hero | открыт реальный Hero overview и нажата явная CTA | PASS |
| Den | открыт реальный Den и нажата явная CTA | PASS |
| Pets | открыта настоящая подсказка закреплённой сферы | PASS |
| Tree | показан точный доступный узел | очко не потрачено, PASS |
| Progress | открыт meaningful Progress surface | PASS |
| System Theme v194 | Settings → Experience → System | durable receipt + reload, PASS |

## Найденные и закрытые ошибки

1. Calendar task editor открывался под Guide surface. Теперь любой blocking modal/mobile sheet временно закрывает Guide; после удаления поверхности Guide восстанавливается.
2. Voice input занимал место Notes Save. Позиционирование микрофона проверяет соседнюю интерактивную геометрию и выбирает outside-right, outside-left либо безопасную внутреннюю позицию.
3. Context replay мог дважды показать одну реплику. Presenter дедуплицирует ключи transcript, сохраняя порядок.
4. Новый System Theme использовал внутренний ID `systemTheme`, а copy — `system_theme`; это давало пустую completion-реплику. Presenter теперь разрешает copy ID через единую карту главы.
5. Кнопка System Theme имела высоту 34 px. Общий `.theme-opt` держит `var(--touch-min)`; браузерный замер после исправления — 42 px.

## System Theme: data-integrity контракт

- глава `manualOnly`: доступна из Library, но не прерывает Today автоматически;
- выбор темы awaited и account-owned;
- Guide advance находится внутри той же settings transaction;
- completion принимает только `system-theme-persisted` с `persisted: true`;
- ошибка или stale account epoch возвращает прежнее состояние без false-success;
- `theme: "system"` следует `prefers-color-scheme`, включая change listener;
- explicit theme choice отключает конфликтующий автоматический control skin override.

## Матрица интерфейса

- Viewports: `360×800`, `375×812`, `1280×900`.
- Locales: RU, EN, DE, UK, ES.
- Horizontal overflow: `0` во всех сделанных замерах.
- Guide actions: минимум 42 px; длинные DE/UK действия переносятся до 56 px.
- System Theme control: 42 px на mobile и desktop.
- Текущая QA-машина сообщает dark system preference; после выбора System UI применил dark и сохранил pressed-state после reload.

## Автоматические проверки

- Focused Guide/voice: `142/142 PASS`.
- Новый System Theme pack: manual-only eligibility, exact completion, five-locale manifests, persisted write/source contract, v194 pins.
- Полный проект: `1122/1122 PASS`.
- `git diff --check`: PASS.
- Изменений в `public/art/` и `art-factory/`: нет.

## Что осталось до production

1. Получить отдельное разрешение на push/deploy.
2. После production deployment проверить commit и asset hashes (`index.html`, `app.js`, `styles.css`, Guide scripts/copy, `sw.js`).
3. Проверить обновление уже открытой вкладки с `satoru-v193` на `satoru-v194` в production.
4. Не включать Goals до questionnaire/data logic; не включать Tribe до отдельного privacy/consent gate.
