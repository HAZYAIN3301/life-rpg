# Goals v169 — final live review

Дата: 2026-08-25

Baseline after safe rebase: `origin/master` / `8978cd5`

Verdict: **READY — known blockers: 0**

## Что проверено

- Спокойный first-work contour: `Сейчас` показывает не больше трёх активных инициатив и ровно одну ближайшую цель/следующее действие внутри каждой.
- Миссия, видение и путь отсутствуют в immediate-action contour и остаются в `Карта целей`; фильтр `Краткосрочные` не подмешивает миссию.
- `Все цели` группирует работу по инициативам; waiting/paused цели не попадают в `Сейчас`.
- Две первичные вкладки (`Сейчас`, `Все цели`) и purpose-меню `Ещё` (`Карта`, `Архив`, `+ Инициатива`, `Разобрать с Тенью`). Отдельный FAB Тени на Goals скрыт, поэтому помощник не дублируется.
- Деталь цели: один labelled `aria-modal`, initial focus на H2, `#app[inert]`, body scroll lock, Tab trap, Escape/backdrop close и возврат фокуса. Изначально открыты 0/3 disclosure-разделов; на поверхности остаются статус и один следующий шаг.
- Инициатива: create → pause → destructive archive confirmation → restore. Состояния сохраняются сервером, фокус возвращается в актуальный UI.
- Data recovery: повреждённый `goal-groups.json` даёт `role=alert`, не показывает ложное empty state и не разрешает запись; failed Retry оставляет фокус на Retry; после восстановления файла successful Retry фокусирует `#goals-title`.
- Атомарный graph commit: goals + goal-groups + linked tasks, ownership, idempotency, orphan/cycle rejection и совместимость с открытой v168-вкладкой.

## Live matrix

| Fixture | Результат |
|---|---|
| 360×800 RU dark/light | PASS: `scrollWidth=clientWidth=360`, первая цель заканчивается минимум за 96 px до nav, видимых целей `<42px` нет |
| 375×812 RU dark | PASS: `scrollWidth=clientWidth=375`, первая цель полностью до nav с запасом 119 px |
| 360×800 DE light/dark | PASS: long chrome/copy без overflow или clipping; 42px touch floor |
| 1280×900 RU/EN dark | PASS: 900px calm work column; первая цель и две полные инициативы выше fold, третья начинается в viewport |
| Light theme | PASS: meaning-bearing text uses resolved dark foregrounds; no washed-out accent copy |
| Keyboard/dialogs | PASS: visible focus, trap, Escape, return focus; mobile next-action link 45px high |
| Reduced motion | PASS by scoped CSS contract: Goals/detail/group animations disabled and transitions set to 0ms |
| Empty/error/retry | PASS: honest recovery and no write before valid reload |
| Locale catalog | PASS: RU/EN/DE live; all new authored rows complete for EN/DE/UK/ES |

## Tests

- `node --check public/app.js server.js public/goals-initiatives-v1.js public/sw.js` — PASS.
- `node --test scripts/goals-initiatives-v1.test.js scripts/goals-hierarchy-v1.test.js` — **14/14 PASS**.
- Full isolated post-rebase `npm test` with read-only production art/Piper fixtures — **716/716 PASS**.
- CSS braces: balanced; `git diff --check`: PASS on final post-rebase bytes.

## Publishable evidence

- `docs/design-qa/2026-08-25-goals-v169/goals-360-light.jpg` — 360×800, SHA-256 `e65f9369f2be6c143addc7ed0c263800431a387175a39a09cde22e9c477e4b11`
- `docs/design-qa/2026-08-25-goals-v169/goals-375-dark.jpg` — 375×812, SHA-256 `661fd44179f154d2b88196d748861e29a9d428ac74eda2915df88b2bb880b850`
- `docs/design-qa/2026-08-25-goals-v169/goals-1280-dark.jpg` — 1280×900, SHA-256 `a91261c0d9f1798c86d08cad01c8b0f96cbaf60b8b20a395a6c9b5923184e124`

Файлы действительно JPEG/JFIF и поэтому имеют расширение `.jpg`; MIME/extension mismatch отсутствует.

## Frozen code hashes after Board v2 rebase

- `public/app.js` — `94db8c57297073ce62cb65082feecf15f990f69ad26de7edcb6057f5fe1ecc66`
- `public/styles.css` — `cb22c528e09a7f734b44e5a63b9b907c4a5c5ae4a0fe1f43d6931e27bc06e187`
- `public/goals-initiatives-v1.js` — `beb7b901dcc9489dee7ad7cf8af0ca7c3815291e524bd5b4fc3d14f2e2c8c410`
- `server.js` — `851cc62f229ec7de800109f8084391e71a2d348a596e6d32d3763a99480d411f`
- `public/sw.js` — `c88b3bd47f4ca369fa894f725ec08c3b1a143389bad25a6da15490fed4c45b27`

Board v2 runtime remains in the shell; Goals owns the subsequent cache bump to `satoru-v170`.
