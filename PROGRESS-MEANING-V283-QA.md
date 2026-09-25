# R04A — honest XP, load and insufficient base, v283

Source criteria: the external release plan (`CRITERIA.md`/`EXECUTION.md`) was not
available in the cloud session that built this package. Scope was taken from the
in-repo definitions (v280/v282 QA: "R04A load semantics", "truthful progress/load
semantics") and DESIGN-CRAFT-RULES.md. Applied rules: TY-05 (meaning-bearing text
≥12px), TY-09 (every number keeps a visible meaning), TY-13 (primary meaning never
truncated), SD-07 (empty/normal/dense), SD-08 (touch ≥42px), C-04 (≥4.5:1), C-05
(semantic colour never alone), R03A calm support.

## Before → after

- **Young history.** Sphere load divided the previous-28-day XP by 28 even when the
  person had recorded for 10 days, so a normal week read as «Перегрев ×2.5». The
  base now uses only observed days (from the first recorded XP). Fewer than 14
  observed days before the last week → «Норма ещё не сложилась … Сейчас: N дней».
  A sphere with records on fewer than 3 base days or <3 XP/day has «мало записей
  для нормы». Thresholds 7/28/×1.7 and XP itself are unchanged.
- **Meaning of a row.** «×0.0» became «нет записей за 7 дней»; every ratio has a
  word (больше / как / меньше обычного) and a visible ×1 mark on its bar. The card
  says it compares recorded XP with the person, not fatigue. Names wrap instead of
  «Отношения и се…». Decimal format follows the UI language (×5,5 / ×5.5).
- **Contradicting labels.** One Progress screen said «Без внимания: Творчество» and
  «Без внимания: Работа, Спорт» from different arithmetic. Now: «Меньше всего
  времени за 3 недели» (balance, minutes) and «Нет записей 7+ дней» (load).
- **Balance index.** Red/amber/green colouring of a person-describing number was
  removed; the index is explained («100 — поровну и во всех сферах; описание, а не
  оценка») and hidden until 7 days of records exist (3 days no longer show «30»).
- **Completion.** Today's still-open tasks no longer count as missed; the lead shows
  «Закрыто N из M» next to the percent.
- **XP meaning.** Progress explains XP: planned minutes × difficulty + completion
  bonus; habits/goals/episodes also give XP; a record, not a rating. Hero shows
  «До уровня 14 — 142 / 2330 XP» above the bar (the shared header `.xp-bar` grid-area
  had shifted the Hero bar sideways on mobile; scoped fix). KPI labels: «Уровень ·
  Эксперт», «Серия · рекорд 35».
- **Density.** Seven identical «Восстанавливает: нет» buttons became: inline toggle
  only where it changes something (warning row or already restorative), the rest in
  one disclosure. Focus returns to the moved button; the disclosure opens for it.
- **Today support.** «🌡 … ×5.5 от нормы» in an amber alarm frame → calm R03A style,
  registry icon, «×5,5 от обычного за неделю», «Это по записанному опыту, а не по
  самочувствию…». Progress ⚖️/🎒/✕ replaced with registry icons (this screen only).

New pure module `public/sphere-load-v1.js` (`SphereLoadV1.compute/insight`); `app.js`
keeps thin adapters. Economy, XP/gold formulas, owner/CAS/WAL and storage unchanged.

## Verification

Synthetic isolated accounts only (local server, temp DATA_DIR): dense 35-day
history in RU/EN/DE/UK/ES, 3-day history RU/EN, empty RU. No real accounts, no AI.

- Unit: 11 SphereLoadV1 tests (young history, observed divisor, full 7/28/×1.7
  contract, none/lower states, sparse base, restoring spheres, subtree aggregation,
  malformed input, quiet ranking, wiring + 4-language copy). Stats contract test
  updated for the 7-day balance gate.
- Chromium, 20-case matrix: 5 locales × 375/1280 dark, RU/DE light × 375/1280,
  short and empty history × 375/1280. 0 horizontal overflow, 0 clipped sphere names,
  0 targets <44px in the load card, 0 untranslated Cyrillic in EN/DE/ES Progress
  (found and fixed «Ранги по сферам»), 0 page errors. Reduced motion on.
- Contrast (DE dark/light): load values/intro/legend/insight/meaning/rate text
  ≥5.97:1; warning value 7.37:1 light, 7.68:1 dark, always with a text state.
- Interaction: keyboard toggle on the warning row → durable save, server readback,
  focus kept, warning disappears; grouped-list toggle → moves inline with focus;
  toggle back → disclosure stays open with visible focus; reload readback; WAL
  commit 503 → server/UI unchanged with localized error, retry saves.
- Screenshots of Progress lead/KPI, load card, balance card, Today support and Hero
  progress inspected at 375/1280 in RU/EN/DE/ES, light and dark.

**Not verified here:** WebKit (not installed in the cloud container; installing
browsers is disallowed), real devices, screen readers. Evidence is local to the
session and not committed (synthetic cookies).

## Publication

`65a58bb` pushed to master 25.09. Both production domains report commit `65a58bb`
and `satoru-v283`; 20/20 SHA256 matches (10 files × 2 domains); unauthenticated
login page loads the v283 pin and `SphereLoadV1` without console errors. No
production account was opened.

## Remaining

R04B charts (XP-by-day and time-by-area labels still ~5px at 375), R04C AI
lifecycle, R04D export, R05/R06. Day-load («Нагрузка дня») already reported
«ещё присматриваюсь» without a median and was not changed.
