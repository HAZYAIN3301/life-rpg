# Satoru — Design Craft Rules

> Ремесленный контракт реализации, 8 августа 2026. Он проверяет исполнение принятого направления, а не выводит новую эстетику из книг.

`DESIGN-DIRECTION.md` остаётся North Star, `STYLE-DECISION.md` — авторитетом для cut-paper/paper-doll языка и runtime. Основание синтеза — `DESIGN-BOOK-NOTES.md`: 252 конкретные проверки семи книг (74 PASS / 75 GAP / 103 FAIL), собранные только после последовательного чтения. Книжная рекомендация, которая конфликтует с направлением, не применяется молча: конфликт записан в соответствующем разделе, направление побеждает.

Правила сверены с `:root` и selectors `public/styles.css` на `f0c7cee`. Книжный аудит был заморожен на предшествующих committed snapshots; изменение `a2bd64a..f0c7cee` добавило профиль-память и 11 строк её локального CSS, но не изменило корневые design tokens. Текущий `b87bde1` после него меняет только `DEVLOG.md` и service-worker key `v107→v108`, поэтому selector-check остаётся актуальным, source-card evidence — воспроизводимым, а contracts относятся к текущему `HEAD`.

**Как читать правило.** «Контракт» — число или однозначный usage gate; «Правка `:root`» — подтверждение либо конкретное изменение единственной существующей token-system; «Проверка» — быстрый acceptance test. Идентификаторы вроде `RU-23`, `MF-F09` и `SG-F20` ведут к карточкам в `DESIGN-BOOK-NOTES.md`.

**Неподвижные границы продукта.** Serious life OS in RPG skin; на mobile ровно 4 primary destinations + More = 5 total; Plan сохраняет 7 дней и 3 инструмента; в touch posture targets не меньше 42px; читаемый system UI + Podkova display/numeric; characterful cut-paper scenes; сильное свечение и ceremony редки и заработаны; casino/grind/shame mechanics не получают визуального оправдания.

**Общий QA-gate.** Каждое визуальное изменение проверяется на 375×812 и 1280×900, в затронутых empty/dense states. Цвет — также dark/light и contrast measurement; движение — normal/`prefers-reduced-motion`; локализация — RU/EN/DE при длинной строке. «200% text-only zoom» означает OS/browser text scaling при неизменном layout viewport 360/375 CSS px; full-page browser zoom проверяется отдельным reflow fixture с явно измеренной effective CSS width и не смешивается с фиксированным Calendar gate 360/375. Скриншот не заменяет DOM/keyboard/touch, contrast и computed-style проверки.

Поведенческие находки — Undo, autosave, network error vs empty, Goals→Today, privacy, fairness и reward mechanics — остаются в `DESIGN-BOOK-NOTES.md` и переходят в screen-by-screen QA. Здесь они появляются только там, где задают типографический, цветовой, плотностный или motion contract; документ не маскирует IA/behavior problem косметикой.

## Типографика

Статус доказательств: книжный и CSS-срез заморожен на `a2bd64a`; значения ниже относятся к `git show a2bd64a:public/styles.css` и `git show a2bd64a:public/index.html`, а не к незакоммиченному worktree. Selector-check сделан на `f0c7cee`: базовый `:root` и три family-токена не изменились; добавились только новые потребители профиля — inline-пояснение `12.5px` (`public/app.js@f0c7cee:6796–6799`), `.profile-text` `12.5px/1.55` и `.profile-meta` `11.5px` (`public/styles.css@f0c7cee:2330–2338`). Текущий product HEAD `b87bde1` после него меняет только SW/DEVLOG, поэтому selector-check `f0c7cee` остаётся валиден. Новые consumers входят в миграцию ниже, но не пересчитывают задним числом книжный inventory `56 font-size / 25 letter-spacing`.

Это не новая эстетика. Канон остаётся прежним: system UI для работы, self-hosted Podkova для authored display/number, спокойная utility-оболочка и редкие cut-paper/RPG-акценты (`DESIGN-DIRECTION.md:260–269`, `STYLE-DECISION.md:21–25,49–57`, `DESIGN-REFERENCE-NOTES.md:169–183,313–330`). Ровно пять постоянных mobile destinations — `Today / Plan / Habits / Hero / More`; семь дней и три Calendar tools не сокращаются (`DESIGN-DIRECTION.md:516–526`).

### Единый token contract

Новые числовые значения добавляются **в тот же базовый `:root`** `public/styles.css@a2bd64a:9–57`, рядом с существующими `--font-ui`, `--font-display`, `--font-number` (`:50–52`). После миграции selector обязан ссылаться на эти роли; raw-значение удаляется. Второй набор `--fs-*`, локальный `:root` экрана или aliases с тем же смыслом запрещены.

```css
:root {
  /* Existing canonical voices stay unchanged. */
  --font-ui: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-display: "Satoru Display", Georgia, serif;
  --font-number: "Satoru Display", Georgia, serif;
  --font-data: var(--font-ui);

  /* Guard only; not a ninth assignable role. */
  --type-floor: 11px;

  /* Exactly eight assignable usage roles. */
  --type-meta: 12px;
  --type-control: 14px;
  --type-body: 15px;
  --type-heading: 16px;
  --type-brand: clamp(18px, 1.4vw, 22px);
  --type-title: clamp(20px, 3vw, 34px);
  --type-hero: clamp(21px, 4vw, 42px);
  --type-ceremony: clamp(48px, 10vw, 96px);

  --leading-tight: 1;
  --leading-display: 1.12;
  --leading-label: 1.2;
  --leading-ui: 1.35;
  --leading-prose: 1.5;

  --tracking-natural: 0em;
  --tracking-caps: .08em;
  --tracking-ceremony: .12em;

  --measure-prose: 68ch;
  --measure-compact: 55ch;
  --measure-dialog: 34ch;

  --number-slot-timer: 5.5ch;
  --number-slot-level: 3ch;
  --number-slot-kpi: 7ch;
  --number-slot-data: 8ch;
}
```

Art glyph geometry, paper-doll parts and decorative particles are not text roles. Intentional System-narrator/code/PIN monospace remains a scoped functional exception, but it consumes the same size/leading roles and cannot become a third general UI voice.

### TY-01 — Два authored-голоса, один функциональный mono allowlist

- **Правило:** общая UI-система использует ровно `2` authored family-роли: `--font-ui` для body, controls, task rows, navigation and metadata; `--font-display`/его alias `--font-number` для brand, screen/hero titles, level, XP, timers, event/boss. Третьих декоративных гарнитур — `0`. Monospace разрешён только в `2` функциональных классах контекста: System narrator/diagnostic и structured input/code/PIN (`.profile-text` входит во второй); он не назначается обычным headings или task copy. Podkova используется только в фактическом диапазоне `400–800`; на её consumers ставится `font-synthesis:none`, поэтому declarations `900/950` не создают faux bold. Обязательный glyph-smoke-test: `Альберт · Їжак · Über · Mañana · 10–20 · «…»` без missing glyph/fallback внутри слова.
- **Источники:** `FT-01`, `FT-03`, `FT-05`, `RU-02`, `RU-17`, `Design Systems §16–17`.
- **Текущий якорь:** `@font-face` уже ограничен `400 800` и WOFF2 Podkova (`public/styles.css@a2bd64a:1–7`); family-токены находятся в `:root` (`:50–52`), body переключён на `--font-ui` (`:2813–2824`), `.card h2,.card h3` — на `--font-display` (`:3087–3096`), numeric group — на `--font-number` (`:2958–2964`). Current-check: `.profile-text` напрямую задаёт mono stack (`public/styles.css@f0c7cee:2330–2335`) и остаётся только functional exception.
- **Token map:** сохранить текущие `--font-ui`, `--font-display`, `--font-number`; новых family-токенов, кроме purpose-specific `--font-data:var(--font-ui)`, не добавлять. Functional mono не получает отдельной параллельной scale.
- **Acceptance 375:** Today, первый quest, пять nav labels и profile card читаются system UI; Podkova остаётся на wordmark/hero/level/timer; все шесть smoke-test fragments видимы, faux-bold и случайной Georgia внутри кириллицы нет.
- **Acceptance 1280:** Settings остаётся utility sans, а Today/Calendar/Event сохраняют authored Podkova и cut-paper/RPG характер; computed family inventory содержит только `2` authored voices плюс allowlisted mono contexts, Podkova computed weight не выше `800`.

### TY-02 — Восемь usage-ролей вместо 56 локальных размеров

- **Правило:** assignable type scale содержит ровно `8` ролей из общего `:root`: meta `12`, control `14`, body `15`, group heading `16`, brand `18→22`, screen title `20→34`, hero `21→42`, ceremony `48→96px`. `--type-floor:11px` — lint-граница, не роль для штатного текста. На одном rendered screen допустимо не более `6` computed semantic size-levels; icon/art geometry не считается. Роль назначается purpose-классом, не тегом `h2/h3` и не конкретным экраном. Все semantic `font-size` declarations после миграции должны быть `var(--type-*)` — raw `10.5/11.5/12.5/13.5px` consumers остаются в количестве `0`.
- **Источники:** `FT-09`, `FT-25`, `RU-09`, `RU-16`, `Design Systems §11`, `Design Systems §29`.
- **Текущий якорь:** frozen inventory — `56` raw sizes; глобальное `.card h2,.card h3` смешивает semantic и visual levels (`public/styles.css@a2bd64a:3087–3096`), Calendar title меняет роль вместе с tag (`:4615–4620`). После snapshot появились ещё три consumers: profile explanation `12.5px`, `.profile-text` `12.5px`, `.profile-meta` `11.5px` (`public/app.js@f0c7cee:6796–6799`; `public/styles.css@f0c7cee:2330–2338`).
- **Token map:** добавить показанные `--type-floor` и ровно `8` `--type-*` roles в существующий `:root`. Profile explanation → `--type-body`; `.profile-text` → `--type-control` (с mobile minimum из TY-03); `.profile-meta` → `--type-meta`. Не вводить `--profile-font-size` или новый `12.5px` tier.
- **Acceptance 375:** computed-style inventory Today + nav + Calendar содержит не более `6` semantic sizes, ни один meaning-bearing consumer не использует raw size; profile explanation/text/meta попадают соответственно в `15/16/12px` на phone.
- **Acceptance 1280:** Settings, включая profile card, содержит не более `6` semantic sizes; screen, group and control roles различимы при одинаковом HTML-теге, profile mapping равен `15/14/12px`, а Podkova не превращает все peer `h3` в screen titles.

### TY-03 — Базовая reading-метрика и controls

- **Правило:** body и многострочный explanatory text — `15px/1.5`; buttons/selects/compact controls — `14px/1.35`; desktop text-entry — `14px/1.5`; при viewport `<=600px` `input/select/textarea` — `max(16px,var(--type-control))/1.5`. Значения не уменьшаются при `<=370px`. Editable text длиннее `2` строк считается reading text: у него leading `1.5`, даже если family functional mono. Inline help длиннее `80` знаков использует body, а не meta.
- **Источники:** `FT-14`, `RU-05`, `RU-20`, `MF-F28`, `MF-F33`.
- **Текущий якорь:** body уже фактически `15px/1.5` (`public/styles.css@a2bd64a:89–95,2813–2824`); controls `14px` без общего leading (`:180–183`); mobile entry `16px` (`:7143–7148`). Current profile нарушает роли: 12.5px inline explanation и textarea (`public/app.js@f0c7cee:6797`; `public/styles.css@f0c7cee:2330–2335`).
- **Token map:** `body {font-size:var(--type-body);line-height:var(--leading-prose)}`; controls use `--type-control/--leading-ui`; text-entry uses `--type-control/--leading-prose`, а mobile minimum — `max(16px,var(--type-control))`. Profile explanation uses `--type-body/--leading-prose`, `.profile-text` — control/mobile minimum plus `--leading-prose`.
- **Acceptance 375:** body computed `15/22.5px`, every text input/select/textarea including `.profile-text` computed at least `16/24px`; opening the virtual keyboard at `200% text-only zoom` with the layout viewport still 375 CSS px creates `0` horizontal page scroll and does not hide the active line or Save action.
- **Acceptance 1280:** body remains `15/22.5px`, ordinary controls `14/18.9px`, profile textarea `14/21px`; text density of Today/Calendar is not inflated by a blanket `16px` body change.

### TY-04 — Persistent labels для multi-field forms

- **Правило:** в workflow с `2+` editable fields `100%` полей имеют persistent visible label минимум `12px/1.35`; placeholder сообщает пример/формат, но не единственный вопрос. Исключение — ровно `1` field в canonical quick Capture, где action и context видимы рядом. Native `select` также получает label; label не исчезает после ввода, autofill или validation error.
- **Источники:** `MF-F29`, `MF-F30`, `RU-08`, `FT-22`, `Norman §5–6`.
- **Текущий якорь:** Today add form возвращает input + skill/duration/difficulty selects без persistent questions (`public/app.js@a2bd64a:9904–9912`); глобальные form controls наследуют `14px` (`public/styles.css@a2bd64a:180–183`). Settings/profile добавляет ещё один long-form textarea (`public/app.js@f0c7cee:6796–6803`).
- **Token map:** form labels use `--font-ui`, `--type-meta`, `--leading-ui`; entered value uses `--type-control` and TY-03 mobile minimum. Отдельный `--form-label-size` запрещён.
- **Acceptance 375:** заполнить add-quest и profile card, затем вернуться к каждому полю: вопрос всё ещё видим, все labels ≥12px, ни один label не зависит от hover/title; Capture остаётся единственным single-field exception.
- **Acceptance 1280:** пройти keyboard-only все Settings forms; visible label и accessible name совпадают для `100%` multi-field controls, label/value hierarchy сохраняет `12/14px`, а form не выглядит колонкой одинаковых headings.

### TY-05 — Meaning-bearing floor, пять nav labels и Calendar labels

- **Правило:** абсолютный floor для любого meaning-bearing текста — `11px`; persistent navigation, interactive labels, weekdays, quest metadata и KPI labels используют стандартную meta-role `12px`, а не сам floor. Ровно `5` bottom-nav labels (`4 sections + More`) всегда показаны полностью, допускают максимум `2` строки, не используют ellipsis/icon-only и имеют leading `1.2`. Calendar сохраняет `7` подписанных дней и `3` подписанных tools; уменьшение до `<11px` и скрытие подписи — `0` случаев. Decorative pseudo-label без действия может быть меньше только с `aria-hidden=true` и без уникального смысла.
- **Источники:** `FT-15`, `FT-22`, `FT-23`, `RU-05`, `RU-08`, `MF-F02`, `MF-F38`.
- **Текущий якорь:** mobile Today stat label `8.5px` (`public/styles.css@a2bd64a:7240–7246`), Calendar weekday `8px` (`:7408–7414`), quest metadata `10px` (`:7336–7347`), nav `10.5px` и `9.5px` at `<=370` with ellipsis (`:7061–7073,7515–7524`), Calendar tools `10.5px` (`:7424–7429`). Current `.profile-meta` adds `11.5px` (`public/styles.css@f0c7cee:2338`).
- **Token map:** meaningful compact copy uses `--type-meta`; lint uses `--type-floor`; nav/weekday/tool labels use `--leading-label`. `.profile-meta` migrates to `--type-meta`; no `--nav-font`, `--calendar-micro` or `--profile-meta-size`.
- **Acceptance 375:** at layout widths `375` and `360px`, including `200% text-only zoom` without shrinking that CSS viewport, all `5` nav labels, `7` weekdays and `3` tools are complete; computed size ≥12px for those roles, max `2` lines, ellipsis count `0`, page horizontal overflow `0`. Full-page browser zoom uses the separate reflow fixture from the common QA-gate and is not combined with this 318px Calendar geometry test.
- **Acceptance 1280:** metadata stays secondary by color/weight while remaining ≥12px; Today’s four KPI meanings, Calendar labels and profile meta are readable in grayscale and do not become equal to values/headings.

### TY-06 — Пять line-height ролей по типу строки

- **Правило:** single-line numeric/ceremonial values use `1`; any display title that wraps uses at least `1.12`; compact labels use `1.2`; multiline UI uses `1.35`; prose/editable narrative uses `1.5`. A selector may use `--leading-tight` only when `white-space:nowrap` is localization-safe and overflow test passes in all `5` locales. There are `0` local `.9/1.02/1.04/1.05/1.55` semantic line-heights after migration.
- **Источники:** `FT-14`, `FT-16`, `FT-17`, `RU-20`, `Design Systems §29`.
- **Текущий якорь:** Today desktop hero uses `1.04`, mobile `1.12` (`public/styles.css@a2bd64a:3259–3265,7197–7203`); Calendar title uses `1` (`:4615–4620`); other event/tree heroes use `1.02–1.05`; controls lack normalized leading (`:180–183`); profile textarea adds `1.55` on current `f0c7cee` (`public/styles.css@f0c7cee:2334–2335`).
- **Token map:** only `--leading-tight/display/label/ui/prose` from the common root. Profile textarea uses `--leading-prose`; all multi-line Podkova titles use `--leading-display`.
- **Acceptance 375:** stress-test `3`-line RU/DE/UK titles on Today, Calendar, Tree and Event: line boxes do not collide, descenders remain visible, computed leading is ≥1.12; single-line timers stay exactly 1.
- **Acceptance 1280:** title leading may tighten only while the title is one line; force a `120`-character title and verify automatic switch/assigned role remains 1.12, while paragraphs remain 1.5 and controls 1.35.

### TY-07 — Character-based measure и управляемый rag

- **Правило:** continuous prose uses max `68ch`; hero/supporting copy max `55ch`; centered modal/auth/ceremony copy max `34ch`. On desktop a representative prose line contains `45–75` visible characters including spaces; on phone content uses available width and is not artificially narrowed below `24ch`. Centered dynamic copy is limited to `34ch`, uses balanced wrapping, and may not end in a one-word final line; operational UI stays left-aligned.
- **Источники:** `FT-18`, `FT-19`, `FT-20`, `RU-14`, `RU-18`, `Design Systems §8`.
- **Текущий якорь:** Today copy is constrained in pixels at `660px` (`public/styles.css@a2bd64a:3259–3272`), Event at `620/650px` (`:6071–6085`), while ordinary Settings prose has no text-specific measure inside `#app` max `1080px` (`:2826–2829`). Existing intimate dialogue at `34ch` proves the compact role (`:1670–1685`).
- **Token map:** use only `--measure-prose`, `--measure-compact`, `--measure-dialog` from the common root; replace 620/650/660px text limits, not art/container geometry.
- **Acceptance 375:** Today, Trust/Control modal, profile explanation and Settings help occupy ≥24ch where the viewport permits; no one-word final line in five locale fixtures, no text is hidden to manufacture a clean rag.
- **Acceptance 1280:** Settings prose never exceeds 68ch, hero copy never exceeds 55ch, centered dialogue never exceeds 34ch; sampled normal line length is 45–75 characters and the quest board/art grid keeps its independent width.

### TY-08 — Tracking следует форме текста, не breakpoint

- **Правило:** lowercase/dynamic Podkova, including wordmark and user titles, uses `0em`; uppercase labels use `.08em`; one-line earned ceremony may use up to `.12em`. Fixed-pixel tracking, negative tracking and horizontal glyph scaling occur `0` times on semantic text. Breakpoint delta for the same role is exactly `0em`. All Podkova consumers keep `font-kerning:normal`; kerning is not disabled to solve width.
- **Источники:** `FT-05`, `FT-11`, `FT-12`, `FT-13`, `RU-21`.
- **Текущий якорь:** lowercase wordmark is `.16em` desktop and `0` mobile (`public/styles.css@a2bd64a:2886–2893,6902–6906`); generic card headings get `.02em` (`:3087–3096`); mobile blanket-reset removes tracking from uppercase roles (`:7119–7125`); today kicker currently `.13em` desktop then `0` mobile (`:3248–3257,7192–7195`).
- **Token map:** `--tracking-natural`, `--tracking-caps`, `--tracking-ceremony` only; no per-screen tracking token. Apply `font-kerning:normal` to `--font-display/--font-number` consumers.
- **Acceptance 375:** wordmark, Today hero and long user quest title compute to `0em`; KPI/kicker caps compute to `.08em`; five nav labels are not compressed; no clipped Cyrillic at `200% text-only zoom` with the CSS viewport unchanged.
- **Acceptance 1280:** the same roles have the same tracking values as 375; `БОСС ПОВЕРЖЕН` may reach `.12em` only if it remains one line, and mixed Cyrillic/Latin pairs show kerning without faux condensed text.

### TY-09 — Podkova numbers are authored; aligned data uses real tabular figures

- **Правило:** `--font-number` remains Podkova for expressive level/XP/timer/hero/ceremony numbers, but `font-variant-numeric:tabular-nums` is not claimed on it because the shipped face has no `tnum`. Comparison-heavy dates, table columns, formula inputs and leaderboard values use `--font-data` plus real system `tabular-nums`. Expressive Podkova values receive fixed outer slots: timer `5.5ch`, level `3ch`, KPI `7ch`; aligned data slot `8ch`. Across `1111 / 0000 / 8888` and `00:59→01:00`, neighbour displacement is `≤1px` and container width delta is `0px`.
- **Источники:** `FT-06`, `FT-07`, `FT-08`, `RU-07`, `FT-30`.
- **Текущий якорь:** `.char-level b,.timer-clock,.kpi .v,.rw-title` all receive Podkova plus nominal `tabular-nums` (`public/styles.css@a2bd64a:2958–2964`); `.th-stat b` repeats it (`:3302–3309`), while `.lvlup-num` and `.tree-hero-stats b` are inconsistent. Frozen font inspection in `FT-06` found unequal advances (`1=494`, `0=595`) and no `tnum`; leaderboard `.lb-xp` remains system UI (`:5927–5930`).
- **Token map:** preserve `--font-number`; add `--font-data:var(--font-ui)` and four `--number-slot-*` values in the same root. Do not add another numeral font. Number size still follows one of the eight semantic type roles.
- **Acceptance 375:** Today KPIs/timer keep Podkova character but their surrounding grid moves ≤1px under all test strings; Calendar/leaderboard columns use `--font-data` with stable tabular alignment, and every number retains a visible meaning label.
- **Acceptance 1280:** compare Today, Tree, Calendar, balance and leaderboard: expressive numbers are visibly authored, data columns align digit-for-digit, `rw-title` verbal text is no longer in a numeric selector list, and no sibling layout shifts on minute/XP changes.

### TY-10 — Self-hosted swap без FOUT-перекомпоновки

- **Правило:** ship exactly `1` self-hosted Podkova WOFF2 face, exactly `1` matching preload, `font-display:swap`, and `0ms` deliberate text blocking. In a cold-cache throttled run, font-attributable CLS from fallback→Podkova is `≤0.02`, line-count delta for wordmark/Today hero/Calendar title is `0`, and no control moves more than `2px`. If either threshold fails, add a metric-adjusted fallback face (`size-adjust` plus ascent/descent/line-gap overrides) and reference it inside the existing `--font-display/--font-number`; do not change to a third authored font.
- **Источники:** `FT-02`, `FT-04`, `FT-03`.
- **Текущий якорь:** one variable face with `font-display:swap` (`public/styles.css@a2bd64a:1–7`) and one preload (`public/index.html@a2bd64a:17`) are already correct; `--font-display` falls directly to Georgia without metric normalization (`public/styles.css@a2bd64a:51–52`).
- **Token map:** retain `--font-display` and `--font-number`; only if QA fails, change those same root values to include the metric fallback alias. No `--font-display-v2` and no duplicate preload.
- **Acceptance 375:** cold-load login, Today and Calendar at network throttle; first paint stays readable, final line count is unchanged, CLS attributable to font ≤0.02 and bottom-nav/primary action movement ≤2px.
- **Acceptance 1280:** repeat with wordmark, 42px hero and Event; request log contains one Podkova file, font does not block UI, and Georgia→Podkova swap does not change title wrapping or move the first quest >2px.

### TY-11 — Пять locale, корректный `lang`, числа и punctuation

- **Правило:** supported locale set is exactly `ru/en/de/uk/es`; after boot and every language switch, `document.documentElement.lang === lang()` within the same render. Visible number/date formatting uses one locale map and `Intl.NumberFormat/DateTimeFormat`; hardcoded `.toLocaleString('ru')` outside the locale formatter occurs `0` times. Number + unit uses a nonbreaking space. Quote pairs are exact codepoints: RU/UK `«…»`, EN `“…”`, DE `„…“`, ES `«…»`; visible straight U+0022 quote pairs occur `0` times.
- **Источники:** `FT-03`, `FT-08`, `FT-27`, `FT-32`.
- **Текущий якорь:** document is fixed to `<html lang="ru">` (`public/index.html@a2bd64a:2`), `set-lang` changes state but not DOM lang (`public/app.js@a2bd64a:13189`), and public metrics hardcode Russian grouping (`:11989,11996,12017`). `FT-32` found English straight quotes and German mixed `„..."` strings.
- **Token map:** punctuation and language services apply to every consumer of current `--font-ui`, `--font-display`, `--font-number`, `--font-data`; no locale-specific font token. Use existing type/measure roles so longer punctuation does not create local sizes.
- **Acceptance 375:** switch all `5` locales without reload; DOM `lang` matches each, VoiceOver pronunciation follows it, nav/Today/profile strings show correct quote codepoints, number+unit never separates, and no fallback glyph appears.
- **Acceptance 1280:** same `5`-locale fixture across Goals, Settings, Calendar, leaderboard and Event; source/runtime check finds `0` visible straight quote pairs and `0` hardcoded Russian numeric formatting outside formatter, while columns remain aligned.

### TY-12 — Semantic heading tree и visual/source order совпадают

- **Правило:** the app shell has exactly `1` persistent document `h1` (brand), every rendered route has exactly `1` visible main `h2`, direct semantic groups use `h3`, skipped heading levels count `0`. Visual role is assigned by explicit purpose class and shared token, never by the tag alone. On Today the linear order is `hero/route title → overdue/core quests → supporting modules`; CSS `order` must not invert any heading-bearing or interactive block. Keyboard and screen-reader order have `0` upward jumps relative to visual reading order at both widths.
- **Источники:** `RU-09`, `FT-09`, `FT-26`, `MF-F06`, `Design Systems §9`, `Design Systems §11`.
- **Текущий якорь:** generic `.card h2,.card h3` gives both tags one display treatment (`public/styles.css@a2bd64a:3087–3096`); Calendar title role depends on whether markup is `h2` or `b` (`:4615–4620`). `renderToday()` source puts companion/install/supporting content around/earlier than quest list (`public/app.js@a2bd64a:9904–9920`), while phone CSS reorders visually (`public/styles.css@a2bd64a:7150–7175`).
- **Token map:** persistent h1 uses `--type-brand`; route h2 uses `--type-title` or `--type-hero` by canonical hero role; group h3 uses `--type-heading`; all use existing family roles. Delete tag-only size/tracking assignment rather than adding screen-specific tokens.
- **Acceptance 375:** headings rotor reports exactly one shell h1, one route h2 and ordered h3 groups; visual, Tab and VoiceOver sequence reaches hero then first core quest before profile/companion/install/supporting modules, with `0` CSS-order inversions.
- **Acceptance 1280:** grid placement may change, but DOM/rotor/Tab order is identical in meaning; Settings yields 4–6 recognizable groups without 20+ equal visual peers, and Calendar Day/Week/Month keeps one visual title role despite different markup.

### TY-13 — Primary meaning is never truncated to fit typography

- **Правило:** authored route titles, CTA and localized labels use the longest real RU/EN/DE/UK/ES fixture, show the full text, and use `0` JavaScript substring cuts, ellipses or hidden clamps; route title/CTA may wrap to at most `3` lines, the five persistent nav labels to at most `2`. A user-generated quest title is stress-tested at `160` characters: a row may show a `3`-line preview only with visible one-tap disclosure and the full accessible name, while quest detail and next-action path show the complete title without JS substring. Dynamic supporting prose follows the same visible-disclosure/full-accessible-name contract. Secondary row metadata may ellipsize only when the complete value is available by one tap/focus and in the accessibility tree.
- **Источники:** `FT-21`, `FT-22`, `FT-23`, `Design Systems §8`, `RU-08`.
- **Текущий якорь:** next quest is cut at `64` JS characters (`public/app.js@a2bd64a:9866–9871`); mobile Today subtitle is hidden after `3` lines without disclosure (`public/styles.css@a2bd64a:7205–7212`); `.navsec-l` uses one-line ellipsis (`:7061–7073`).
- **Token map:** wrapping content uses `--type-body/heading/title`, matching leading tokens and `--measure-compact`; no smaller `--type-truncated` escape hatch. Full-string disclosure reuses control/meta roles.
- **Acceptance 375:** longest real RU/EN/DE/UK/ES authored route/CTA fixtures are complete within `≤3` lines and all five nav labels within `≤2`, with `0` horizontal overflow. A `160`-character user quest uses at most a `3`-line row preview with visible one-tap disclosure and full accessible name; detail and next-action show the full title. Supporting clamps expose the same visible disclosure.
- **Acceptance 1280:** the same authored fixtures remain complete and keyboard-readable; the `160`-character quest may retain the disclosed row preview, but detail/next-action and accessible name remain full. Wider layout never restores a different JS-truncated string, and hero-to-first-quest hierarchy remains intact.

Итоговый implementation gate: после миграции проверить `375px` и `1280px` на Today, Settings (включая profile card), Calendar, Tree/Rewards/Event, leaderboard и login/modal; отдельно прогнать five-locale strings, cold font swap, `200% text-only zoom` при неизменном CSS viewport, отдельный full-page reflow fixture, keyboard order and VoiceOver rotor. Правка не проходит, если ради выполнения чисел исчезает Podkova, пять подписей, семь дней/три tools, cut-paper identity или quest-first Today.

## Отступы и плотность

Эта система не делает Satoru «воздушнее» вообще. Она сохраняет плотный и спокойный life OS, но связывает расстояние с отношением элементов: ближе внутри одной задачи, дальше между самостоятельными решениями. Источник истины — `DESIGN-DIRECTION.md`; cut-paper сцены остаются authored-композициями, а не растянутыми SaaS-карточками.

База проверки — frozen `a2bd64a:public/styles.css`. На ней `--sp-1…6` уже равны `4 / 8 / 12 / 16 / 24 / 32px`, но ещё не имеют consumers, тогда как книжный snapshot фиксирует 1 273 raw `margin*`/`padding*`/`gap` declarations. Current-selector check на `f0c7cee` подтверждает неизменный `:root`; после frozen-среза добавлены только `.profile-text` с raw `10px 12px` и `.profile-meta` с raw `6px`. Это новый migration/QA consumer, но не повод пересчитывать snapshot из RU-03 и Design Systems §30.

### Единый числовой контракт

Существующая шкала остаётся единственной:

| Токен | Роль | Не использовать для |
|---|---|---|
| `--sp-1: 4px` | micro-gap, разделитель строк, gap семи дат | самостоятельных карточек и touch-размера |
| `--sp-2: 8px` | compact controls, quest-row, тесно связанные label/value | разрыва самостоятельных секций |
| `--sp-3: 12px` | mobile card padding, nested workhorse surface, control group | драматической церемонии |
| `--sp-4: 16px` | desktop workhorse card, sibling cards, обычный section rhythm | заполнения пустого экрана |
| `--sp-5: 24px` | page gutter, крупный hero, разрыв смысловых групп | каждого соседнего поля формы |
| `--sp-6: 32px` | новый экранный регион, редкая ceremony/art frame | обычных task/settings/calendar rows |

Разрешены четыре не-шкальных ограничения в том же `:root`:

```css
:root {
  --layout-max: 1080px;
  --work-max: 720px;
  --measure-prose: 68ch;
  --touch-min: 42px;
}
```

Это пределы ширины и hit-area, а не параллельная spacing scale. Новые `--space-*`, `--gap-*`, density presets и raw `6/7/9/10/14/18/20px` для workhorse `gap/margin/padding` запрещены. Допустимы safe-area `env()` (`left/right/top/bottom`), `max()` и отрицательное значение существующего токена для единственного Calendar-bleed из SD-09.

#### SD-01. Шкала кодирует отношения, а не размеры компонентов

- **Контракт:** внутри строки — `--sp-1/2`; внутри группы — `--sp-2/3`; между sibling workhorse surfaces — `--sp-4`; между самостоятельными смысловыми группами — `--sp-5`; перед новым экранным регионом или earned ceremony — `--sp-6`.
- **Запрет:** применять один `gap` ко всему экрану, увеличивать все mobile paddings ради «воздуха» или держать одновременно container `gap` и нижний `margin` у его детей. У каждого разрыва один владелец.
- **Selectors:** `#app`, `.today-shell`, `.tasks`, `.card`, `.calv-head`, `.calv-tray`, `.knobs`, `.settings-actions`.
- **Проверка:** computed `gap/margin/padding` каждого нового или мигрированного workhorse selector разрешается в один из шести токенов; raw art coordinates в эту проверку не входят.
- **Основание:** RU-03, RU-12; Design Systems §2 и §30; FT-24.

#### SD-02. Page width ограничена, рабочий Today не растягивается вслед за IA

- **Контракт `#app`:** `max-inline-size: var(--layout-max)`; desktop inline gutter — `var(--sp-5)`; при `<=600px` — `padding-inline: max(var(--sp-3), env(safe-area-inset-left)) max(var(--sp-3), env(safe-area-inset-right))`. Текущие `1080px` и mobile `12px` становятся токенизированными, не меняя продуктовую ширину.
- **Контракт Today:** общий inline-контур `.today-hero` + `.card-quests` не шире `var(--work-max)`. На широком экране companion/status может занять соседний supporting rail с gap `--sp-5`, но не расширяет строки квестов и не ставится вертикально перед ними.
- **Контракт prose:** непрерывный объясняющий текст Settings/Help/intro получает `max-inline-size: min(100%, var(--measure-prose))`. Calendar, week grid, Skill Tree, Lair, inventory, data tables и authored event scene не получают prose measure.
- **Проверка:** при 1280px `#app <=1080px`, рабочий Today-контур `<=720px`, prose `<=68ch`; при 375px каждый из них использует доступную ширину без искусственной узкой колонки и без document overflow.
- **Основание:** RU-14, RU-18, FT-19; Things 3 §4.7 в `DESIGN-REFERENCE-NOTES.md`; `DESIGN-DIRECTION.md` Today composition.

#### SD-03. Workhorse card имеет один padding и одного владельца ритма

- **Обычная `.card`:** desktop `padding: var(--sp-4)`; при `<=600px` `padding: var(--sp-3)`. Внутри layout container у card `margin-block: 0`; sibling distance задаёт container: `--sp-4` desktop и `--sp-3` mobile.
- **Primary/integrated frame:** `.today-hero` использует `--sp-5` desktop и `--sp-4` mobile. `--sp-6` разрешён только для редкой ceremony/art frame, но не для обычной Settings/Today/Plan card.
- **Внутри card:** heading → first content `--sp-3`; control label → control `--sp-2`; связанные controls `--sp-2`; самостоятельные subsections `--sp-5`. Empty card не получает `min-height` ради композиции и не имеет больше `--sp-5` block-padding.
- **Миграция:** текущие `.card { padding: 18px 20px }`, mobile `14px` и `.today-hero { padding: 22px 24px }` / mobile `18px 16px 16px` сходятся к значениям выше; не создавать 18/20/22 как новые aliases.
- **Проверка:** между двумя соседними cards ровно один измеримый gap; nested content не складывает parent padding, child margin и grid gap в тройной разрыв.
- **Основание:** RU-03, RU-12, RU-13; Design Systems §18 и §30.

#### SD-04. Quest board — одна поверхность, квесты — плотные строки

- **Контракт:** `.card-quests` — один material container; `.tasks { gap: 0 }`. Обычная `.task` использует `padding: var(--sp-2)`, grid `row-gap: var(--sp-1)` и `column-gap: var(--sp-2)`, один спокойный divider и не получает отдельные background + border + shadow + outer gap.
- **Исключение:** только next/selected/focus/urgent row может получить локальную raised surface; одновременно в board видна максимум одна такая строка. Её padding не меняется, поэтому список не прыгает.
- **Action budget:** в строке видны максимум два прямых действия: dominant complete/start и одно contextual action; остальное уходит в contextual menu/detail. В touch posture каждый видимый control проходит `--touch-min`, но glyph остаётся 18–24px.
- **Dense state:** 10 и более квестов остаются одним board, а не десятью cards; title — первый ряд, metadata — один вторичный ряд, отсутствующие metadata не резервируют пустые колонки.
- **Selectors:** `.card-quests`, `.tasks`, `.task`, `.task .check`, `.task .focus`, `.task .del`, `.t-cats`, `.t-time`, `.t-xp`.
- **Проверка:** ordinary task surface count = 0, selected surface count `<=1`, visible row actions `<=2`; длинный title в 375px переносится, не создавая horizontal scroll.
- **Основание:** RU-04, RU-34; Design Systems §11 и §18; SG-F08; Linear §1.3–1.4 и Things 3 §4.1 в `DESIGN-REFERENCE-NOTES.md`.

#### SD-05. Nested surface budget ограничивает card-in-card

- **Глубина:** workhorse screen допускает `screen → outer card → one stateful/interactive nested surface`; третий visually boxed уровень запрещён. Wrapper без собственного tone/border/shadow не считается уровнем.
- **Количество до action:** внутри first contour обычной card разрешена максимум одна nested raised surface. Четыре `.th-stat` не должны становиться четырьмя равноправными mini-cards; их следует собрать в одну flat status strip или убрать дубли header metrics.
- **Padding:** structural nested surface всегда на один шаг плотнее родителя: `--sp-4 → --sp-3`, `--sp-3 → --sp-2`. Он не повторяет parent padding и elevation. Micro chips могут использовать `--sp-1/2`, но не изображают новый content region.
- **Selectors для аудита:** `.th-stat`, `.daystat span`, `.knob`, `.skill-edit`, `.calv-tray`, `.cal-schedule`, `.wk-col`, `.settings-actions`.
- **Смысловые исключения:** selected, focus, locked, rarity, danger и drop target могут показать state boundary, но не создают ещё один structural wrapper.
- **Проверка:** в DevTools пройти от actionable content к `#main`: workhorse boundary depth `<=2`; если nested block убрать, grouping всё ещё читается по `--sp-3/5` и heading hierarchy.
- **Основание:** RU-04, RU-30, RU-34; Design Systems §11, §18 и §25; FT-29.

#### SD-06. First contour Today заканчивается реальным next action

- **Определение:** first contour начинается у верхней границы видимого status/header и заканчивается нижней границей первого полностью видимого `.card-quests .task` либо empty-state CTA. Hero без квеста не завершает contour.
- **375×812:** нижняя граница первого task/empty CTA должна быть `<= .navrow.getBoundingClientRect().top - var(--sp-2)`. До неё допускаются максимум две крупные workhorse surfaces (`.today-hero`, `.card-quests`), один filled primary action и ноль повторных XP/gold/streak/energy summary-групп.
- **1280×900:** нижняя граница первого task/empty CTA `<= window.innerHeight - var(--sp-4)`. Side space используется для supporting rail; companion, timer, capture exposition или status cards не могут вытолкнуть quest board ниже первого viewport.
- **Порядок:** current day/main action → quest board → recovery/companion/capture → inactive utilities. Неактивный timer не резервирует постоянную card; future/analytics не занимают Today.
- **Проверка:** normal, overdue и long-copy fixtures; CSS `order` не считается успехом, если focus/screen-reader/DOM sequence остаётся другим.
- **Основание:** Norman §3; AF-03, AF-05, AF-06; MF-F04, MF-F05, MF-F08; SG-F01; `DESIGN-DIRECTION.md` Today/mobile contract.

#### SD-07. Empty, normal и dense — разные состояния одного contour, не три density scales

- **Empty:** `.card-quests` содержит одну фразу, один primary CTA и максимум одну subordinate recovery/import link; пустые `Main / Recovery / Bonus`, нулевые KPI и неактивные utility cards не рендерятся. Block padding не больше `--sp-5`, vertical centering/full-viewport filler запрещены.
- **Normal (1–5 quests):** hero + один quest board; selected/next row может быть единственной поднятой строкой. После board в каждом последующем viewport-height band допускается максимум одна новая decision card; status-only content объединяется в flat strip или contextual sheet.
- **Dense (10+ quests):** ритм строк и touch floor не уменьшаются; сокращаются repeated surfaces, labels и постоянно видимые secondary actions. Group heading появляется только если группа непуста; между группами `--sp-4`, внутри — `--sp-1/2`.
- **Settings dense:** 4–6 content structures разделяются headings и `--sp-5`, а не шестью равновесными `.card`. Перед sticky `.settings-actions` form получает bottom reserve `calc(var(--touch-min) + var(--sp-5))`, чтобы save bar не перекрывал последний control.
- **Проверка:** одинаковый DOM-fixture с 0/1/5/10/25 квестами; при росте данных увеличивается длина списка, но не число самостоятельных surfaces перед первым квестом и не document width.
- **Основание:** RU-12; FT-24; Design Systems §2, §7 и §11; Linear §1.5, Arc §3.6–3.7 и Mobbin §5.6 в `DESIGN-REFERENCE-NOTES.md`.

#### SD-08. В touch posture floor равен 42px и не требует гигантского glyph

- **Контракт:** при `(pointer: coarse)` и на mobile `<=600px` interactive control имеет `min-inline-size` и `min-block-size` не меньше `var(--touch-min)`. Существующие common mobile controls высотой 44px сохраняются; 42px — hard touch floor, не новая preferred height. Compact desktop mouse controls могут оставаться меньше 42×42, если сохраняют явный affordance, keyboard path и `:focus-visible`.
- **Обязательные repairs:** `.task .check`, core control, `.task .focus`, `.task .del`, `.navsubtab`, `.cal-mode`, `.calv-day`, modal close, focus presets, `.wk-task` actions и `.wk-add-btn`. Текущие 24–40px значения не проходят.
- **Плотность:** visual checkbox/icon остаётся 18–24px внутри 42px hit box. Между отдельными частыми controls минимум `--sp-1`; primary и destructive actions разделены минимум `--sp-2` или destructive уходит в overflow. У contiguous segmented control внешний gap может быть 0, если сегменты имеют различимые boundaries.
- **Проверка:** на touch fixtures 360/375 `getBoundingClientRect()` всех visible `button`, form control и элементов с button semantics на touch route: width и height `>=42`, overlap hit boxes = 0. На desktop этот размерный gate не применяется: отдельно проходят keyboard activation и видимый focus. Inline prose links проверяются по line-height и не превращаются в квадратные buttons.
- **Основание:** Norman §8; AF-18; MF-F19, MF-F20; `DESIGN-DIRECTION.md` mobile contract.

#### SD-09. Семь дат и три tools — единственное разрешённое edge-density исключение

- **Неподвижный contract:** на 360 и 375px одновременно видны ровно семь подписанных `.calv-day` и ровно три подписанных `.cal-tools > button`; ни одна дата или tool не скрывается в horizontal scroll и не становится mystery icon.
- **Геометрия дат:** `grid-template-columns: repeat(7, minmax(var(--touch-min), 1fr)); gap: var(--sp-1)`. Минимум сетки: `7 × 42 + 6 × 4 = 318px`. У 360px после page gutters `2 × --sp-3` остаётся 336px — contract физически выполним.
- **Единственный bleed:** если mobile `.card` padding уменьшает inner width ниже 318px, `.calv-strip` может выйти до внутреннего края card через `margin-inline: calc(0px - var(--sp-3))` и вернуть `padding-inline: var(--sp-2)`. Это исключение не копируется на quest/settings/commerce grids.
- **Tools и modes:** `.cal-tools` — три равные колонки с `gap: var(--sp-2)` и height `>=42px`; полные labels могут занять две строки. `.cal-mode` также `>=42px`; текущие 40px не проходят.
- **Работа раньше chrome:** на 375×812 первый actionable row внутри `.cal-schedule` должен полностью закончиться выше `.navrow.getBoundingClientRect().top - var(--sp-2)`; на 1280×900 первая строка timeline/grid — выше `window.innerHeight - var(--sp-4)`. Семь дат и tools остаются, но load badge, hint и secondary modes не вытесняют work.
- **Week mobile:** 900px `.wk-grid` не сжимается и не скроллится как desktop canvas; mobile показывает компактный seven-day overview и detail выбранного дня. Все семь дат остаются видимы, но содержимое семи колонок одновременно не обязано быть видно.
- **Проверка:** 360×800, 375×812 и 1280×900; count `7/3`, каждый target `>=42`, document overflow = 0, labels не обрезаны до неузнаваемости.
- **Основание:** MF-F17, MF-F20, MF-F37, MF-F38; SG-F28; Design Systems §20; `DESIGN-DIRECTION.md` mobile contract.

#### SD-10. Section rhythm сообщает purpose, а не одинаковость компонентов

- **Контракт Settings/forms:** label → field `--sp-2`; fields одной операции `--sp-3`; следующий purpose-group `--sp-5`; screen-section `--sp-6`. `.knobs`, `.skill-edit`, `.habit-edit`, `.import-row`, `.theme-row` используют эти отношения, а не свой уникальный gap.
- **Контракт Today/Plan:** row metadata `--sp-1`; внутри action cluster `--sp-2`; heading → board `--sp-3`; hero → quest board `--sp-4` desktop / `--sp-3` mobile; quest board → recovery/companion `--sp-5`. `--sp-6` не вставляется между каждым модулем.
- **Sound/AI/profile:** отдельные settings purpose-groups получают `--sp-5`, даже если сейчас один raw gap визуально склеивает label одного setting с control другого. `.profile-text` мигрирует `padding: var(--sp-2) var(--sp-3)`; `.profile-meta` — `margin-top: var(--sp-2)`; это current `f0c7cee` consumer, не изменение frozen counts.
- **Проверка:** blurred screenshot и DOM outline: элементы одной операции воспринимаются группой, соседние операции разделяются без дополнительной card. Ни один обычный экран не выглядит как vertical stack одинаковых feature tiles.
- **Основание:** RU-13; Design Systems §11, §18 и §30; MF-F08.

#### SD-11. Prose measure применяется только к чтению

- **Контракт:** `.settings` descriptions, `.help`, `.hint`, `.hb-intro p` и explanatory modal copy получают `max-inline-size: min(100%, var(--measure-prose))`; paragraphs внутри одного блока разделяет `--sp-3`, блоки — `--sp-5`.
- **Не применять:** `.profile-text` (структурированное monospace-досье), Calendar, week, Tree, Lair, inventory, quest rows, charts и таблицы. Им нужна рабочая ширина, а не книжная строка.
- **375px:** measure всегда `100%` доступной ширины; не добавлять декоративные side gutters поверх `#app --sp-3` и card `--sp-3`.
- **1280px:** prose не растягивается почти до 1000px даже внутри широкого Settings screen; соседнее свободное место не заполняется пустой декоративной card.
- **Проверка:** максимальная rendered строка prose `<=68ch`; data surfaces не получают это ограничение; `200% text-only zoom` при неизменном CSS viewport не создаёт horizontal scroll. Full-page zoom проходит отдельный reflow fixture из общего QA-gate.
- **Основание:** RU-14, RU-18; FT-19, FT-21; Thinking with Type §line length/measure в итоговых notes.

#### SD-12. Cut-paper и integrated moments сохраняют оптическую геометрию

- **Strict foundation:** outer screen/card gutter использует `--sp-3/4/5`, controls в touch posture проходят `--touch-min`, prose — `--measure-prose`, а переход к самостоятельному UI-region — `--sp-5/6`.
- **Loose interior:** `.den-*`, Lair room, avatar/paper-doll layers, wardrobe preview, Skill Tree geometry, Trust/Control scene, event/raid/boss and level-up compositions могут сохранять authored `top/left/transform/aspect-ratio`, overlap и optical offsets. Эти числа не мигрируются массовой заменой и помечаются комментарием `art geometry — non-token`.
- **Budget:** integrated scene не получает дополнительные nested workhorse cards ради каждого персонажа/слота; controls живут в одном drawer/strip. Cut-paper может пересекать внутренний padding, но не перекрывает action, focus ring, safe area или текст.
- **Не SaaS-maximalism:** пустая площадь допустима, если держит силуэт/отношение персонажей; она не оправдывает `min-height: 100vh`, giant title или одну utility card на экран. Workhorse плотность не копирует ceremony spacing.
- **Проверка:** 375/1280 screenshots Lair, Character, Tree, path choice и earned ceremony после token migration; rig alignment неизменен, UI controls доступны, document overflow = 0.
- **Основание:** RU-30; Design Systems §13, §16 и §17; STYLE-DECISION.md; `DESIGN-DIRECTION.md` Lair/Character/Trust-vs-Control.

#### SD-13. Миграция идёт по паттернам и заканчивается измеримым QA

| Текущий selector/value на `a2bd64a` | Целевой spacing contract |
|---|---|
| `#app` `20px`, mobile `12px` | `--sp-5`, mobile `--sp-3` + safe area; max `--layout-max` |
| `.card` `18px 20px`, mobile `14px` | `--sp-4`, mobile `--sp-3`; spacing владеет container |
| `.today-shell` `gap:2px/0` + card margins | один owner: `--sp-4` desktop, `--sp-3` mobile; semantic group break `--sp-5` |
| `.today-hero` `22px 24px`, mobile `18/16/16` | `--sp-5`, mobile `--sp-4` |
| `.tasks gap:7px` | `0`; board содержит flat rows |
| `.task 9px 10px`, mobile `9px 8px` | `--sp-2`; internal `--sp-1/2` |
| `.daystat gap:10px`, chip `5px 10px` | gap `--sp-2`; chip `--sp-1 --sp-2` |
| `.calv-strip gap:9px`, mobile `4px` | desktop `--sp-2`, mobile `--sp-1` |
| `.cal-tools gap:8px`, mobile `7px` | `--sp-2` |
| `.knobs gap:10px`, `.knob padding:10px` | `--sp-3` для group/nested padding |
| `.settings-actions padding:12px` | `--sp-3`; form reserve `touch-min + --sp-5` |
| `.profile-text 10px 12px`, `.profile-meta 6px` на `f0c7cee` | `--sp-2 --sp-3`; `--sp-2` |

- **Порядок:** foundation/root constraints → `#app/.card` → Today quest-board → Calendar → Settings/profile → остальные workhorse patterns. Art selectors из SD-12 не входят в bulk pass.
- **Проверка:** все 12 строк selector-map закрыты отдельно; после каждой визуальной группы есть 375/1280 screenshots и DOM-измерения, а не только lint. Acceptance matrix ниже проходит целиком до следующей группы.
- **Основание:** RU-03; Design Systems §30; MF-F39; SG-F42; `DESIGN-DIRECTION.md` implementation order.

### Acceptance matrix

| Fixture | 375×812 | 1280×900 |
|---|---|---|
| Today empty | hero + одна empty CTA до nav; нет пустых groups/cards | empty CTA в first viewport; work contour `<=720px` |
| Today normal, 1/5 quests | первый полный task выше nav; `<=2` крупные surfaces и `1` primary до него | нижняя граница первого task `<=884px`; supporting rail не толкает board |
| Today dense, 10/25 quests | один board, flat rows, `<=2` actions/row, targets `>=42` | тот же row rhythm; main work width `<=720px` |
| Plan day | `7` dates + `3` labeled tools, first schedule action выше nav | work grid в first viewport, без лишнего chrome stack |
| Plan week dense | seven-day overview + selected-day detail; document overflow `0` | full week допустим в `--layout-max`, без page overflow |
| Settings dense/profile | purpose rhythm `8/12/24`, sticky actions не закрывают control | prose `<=68ch`; profile spacing токенизирован |
| Lair/Character/Tree | outer rhythm/touch проходят, authored rig не сдвинут | authored scene не превращена в workhorse card grid |

Общие автоматические gates: `document.scrollWidth <= document.clientWidth`; на touch fixtures 360/375 все visible touch controls `>=42×42`; Calendar count `7/3`; workhorse boundary depth `<=2`; `#app <=1080px`; prose `<=68ch`; raw workhorse spacing после миграции не растёт. На desktop compact mouse controls могут быть меньше, но обязаны пройти keyboard/focus QA. Скриншоты 375/1280 проверяют композицию, а physical 360/375 device pass — reachability, safe area и реальные hit boxes; это закрывает ограничение MF-F39 и playtesting-долг SG-F42.

### Явные конфликты: решение направления

| Книжный импульс | Почему буквально не применяем | Решение Satoru |
|---|---|---|
| «Добавить больше whitespace» | Blanket inflation удлиняет Today и превращает плотный life OS в generic SaaS. | Воздух задаётся отношением `4/8/12/16/24/32`: плотные rows, ясные разрывы между decisions. |
| Нормализовать все локальные числа | Art rig, cut-paper overlap и path/event composition потеряют authored силуэт. | Workhorse spacing строгий; art geometry — документированное исключение SD-12. |
| Touch target 42px против семи дат | Уменьшение дат до 38–40px нарушает mobile contract, horizontal scroll скрывает mapping. | Единственный edge-bleed сохраняет `7 × 42px` и gap `4px` даже на 360px. |
| Ограничить line length везде | Calendar/Tree/Lair/data grids станут искусственно узкими. | `68ch` действует только для непрерывной прозы; рабочие и арт-поверхности используют layout width. |
| Убрать cards и borders ради спокойствия | Полная плоскость стирает материальную оболочку и RPG states. | Один quest-board и flat rows внутри; selected/rarity/event сохраняют заслуженную поверхность. |

## Цвет

Цветовая система не вводит новую эстетику: она делает проверяемым уже принятый язык тёмных холодных поверхностей, редкого свечения и тёплой награды. Источник истины — текущий `:root` в `public/styles.css@f0c7cee`; `DESIGN-DIRECTION.md` сильнее любой книжной эвристики.

### C-01. Пять тональных значений обслуживают ровно четыре смысловых уровня

- **Контракт:** на экране остаются четыре роли: background, base panel, raised/interactive panel, event/rarity. `nested`, `selected`, `overlay` и `modal` — варианты этих ролей, а не `surface-5/6`.
- **Правка общего `:root`:** `--bg: var(--surface-1)`; `--panel: var(--surface-2)`; `--panel2: var(--surface-3)`. `--surface-0` остаётся глубоким app-world/underlay внутри background-роли; `--surface-4` — tonal base event/rarity-роли. В light theme переопределяются только `--surface-0…4`; отдельные literal overrides для `--bg/--panel/--panel2` удаляются, чтобы aliases не расходились.
- **Проверка:** computed values трёх aliases совпадают с назначенными `--surface-*` в обеих темах. После временного отключения shadows и accents на 375 и 1280px различимы фон, base, raised и event; смысловых уровней ровно четыре.
- **Основание:** Design Systems §25; RU-24, RU-30; `DESIGN-DIRECTION.md` §Surfaces.

### C-02. Accent обещает интерактивное внимание, а форма уточняет состояние

- **Контракт:** `--accent` — один канал interactive attention/current state. Filled primary action, keyboard focus, selection и active state различаются формой: fill + `--on-accent`, `--focus-ring`, border/check и positional/active marker соответственно. Статичные цифры, headings и hints не получают `--accent` ради декора.
- **Бюджет:** в одном рабочем contour — максимум один accent-filled primary action и одно малое semantic/rarity исключение. Contour — bounded work region из SD-05/SD-06, а не каждая nested card. Одна активная mobile destination среди `Today / Plan / Habits / Hero + More` сохраняется.
- **Роли токенов:** `--accent` — default interactive attention; `--accent-2` мигрирует к Flint/control/forge и authored integrated scenes; `--accent-warm` — earned reward/legendary; `--good`, `--warn`, `--bad` — только outcome/risk states. Текущие off-role consumers `--accent-2` считаются migration debt, а не расширением обещания.
- **Проверка:** на touch-снимке без hover кликабельные accent-элементы отличимы от статичных; focus не спутан с selection; на 1280px hover не впервые сообщает clickability.
- **Основание:** Design Systems §26; RU-06, RU-11; `DESIGN-DIRECTION.md` §Color.

### C-03. Filled accent и focus получают отдельные измеримые роли

- **Контраст:** large text — `>=24 CSS px` regular или `>=18.66 CSS px` bold — проходит `>=3:1`; весь остальной текст — `>=4.5:1`. Focus indicator и существенная control boundary проходят `>=3:1` к соседнему цвету. Disabled labels также держатся `>=4.5:1` как более строгий контракт Satoru, а не как формулировка WCAG exemption.
- **Правка `:root`:** `--on-accent: #090d17`; `--on-bad: #090d17`; `--focus-ring: 0 0 0 2px var(--surface-0), 0 0 0 4px var(--text-strong)`. В light override `--on-bad: #fff`. Filled accent/good/warn controls используют `--on-accent`, destructive `--bad` fill — `--on-bad`; keyboard focus использует `box-shadow: var(--focus-ring)` на `:focus-visible`, а не меняет только border hue.
- **Доказательство значения:** для шести selectable `ACCENTS` из `public/app.js` `#090d17` даёт `5.16:1–8.70:1`, тогда как универсальный `#fff` — лишь `2.23:1–3.76:1`. Dark `--bad:#e0526a` с dark `--on-bad` даёт около `5.16:1`; light `--bad:#d23a55` с white `--on-bad` — около `4.69:1`. Каждый gradient endpoint измеряется отдельно и не наследует доказательство solid swatch.
- **Запрет:** одинаковая белая примесь для всех hues, `brightness()` как contrast-fix и `--muted` поверх accent fill.
- **Проверка:** матрица `6 selectable accents × 2 themes × 5 states = 60` состояний для 14px buttons, capture и chat плюс named semantic fills `good/warn/bad`; normal label `>=4.5:1`. Computed QA внешней 2px focus-band даёт `>=3:1` к окружающей поверхности на buttons, inputs и новой `.profile-text`; ни один accent choice не делает focus невидимым в light theme.
- **Основание:** RU-23, RU-25; Design Systems §28.

### C-04. Secondary text остаётся текстом, а не disabled-сигналом

- **Контракт:** `--text`/`--text-strong` — primary; `--text-soft` — secondary; `--muted` — metadata. Все три проходят `>=4.5:1` на разрешённых work surfaces при фактическом размере; размерные floors и heading roles остаются в TY-02/TY-05/TY-12.
- **Accent/event fill:** текст использует `--on-accent`; secondary hierarchy создаётся размером, весом и положением, а не новым `--on-accent-soft`, локальной opacity или глобальным `--muted`.
- **Проверка:** active Calendar day, hero/event metadata, chips, disabled controls и `.profile-meta` сравниваются во всех шести accents и обеих темах; secondary визуально отличается от disabled, но оба остаются читаемыми.
- **Основание:** RU-25; Design Systems §28.

### C-05. Semantic color никогда не работает в одиночку

- **Контракт:** success (`--good`), warning (`--warn`) и danger/destructive (`--bad`) сопровождаются минимум одним независимым каналом: icon, label, line-through, frame shape или state copy.
- **Запрет:** red/ember для обычного emphasis; green для rarity; hue как единственное различие locked/available/unlocked, owned/equipped/new или selected/focus.
- **Проверка:** grayscale, protanopia, deuteranopia и tritanopia сохраняют смысл completion, destructive, active nav, rarity и tree states; keyboard focus не спутан с selection.
- **Основание:** RU-26; `DESIGN-DIRECTION.md` §Color и checklist Character/Skill Tree.

### C-06. Рарность имеет один CSS-источник и валидные consumers

- **Правка `:root`:** `--rarity-common: #8b97b5`; `--rarity-rare: #4f9ff7`; `--rarity-epic: #b06ff0`; `--rarity-legendary: var(--accent-warm)`. Эти четыре CSS roles — canonical color source.
- **JS-контракт:** `RARITY` хранит label и CSS reference, например `color: 'var(--rarity-epic)'`, а не второй literal hex. Inline `--rc` передаёт эту reference в component и остаётся consumption channel. Если JS когда-либо нужен numeric RGB, он читает один computed CSS value через один resolver.
- **Миграция:** 12 текущих `var(--legendary)` заменяются `var(--rarity-legendary)`, один `var(--epic)` — `var(--rarity-epic)`; compatibility aliases не добавляются.
- **Контракт формы:** каждое rarity state имеет frame/icon/label помимо hue; legendary не означает automatic glow.
- **Проверка:** computed style Calendar, Habits, Goals, raid, event, loot, cosmetics и gear содержит 0 invalid declarations; четыре уровня различимы в grayscale на 375 и 1280px.
- **Основание:** Design Systems §24; RU-26; `DESIGN-DIRECTION.md` §Rarity language.

### C-07. Glow — семантический канал с жёстким бюджетом

- **`--glow-active`:** только текущий selected/claimable/active объект; максимум один такой foreground-object на work contour.
- **`--glow-legendary`:** только earned legendary, boss/capstone, level-up или won event; максимум один UI-источник на viewport. Не применять к ordinary progress, Calendar header, open goal, Pro CTA или divider.
- **Запрет:** одновременно `--glow-active` и `--glow-legendary` на одном элементе; glow как elevation; постоянное свечение всех cards.
- **Cut-paper exception:** emissive pixels, lantern/fire light и локальная магия внутри одной authored Lair/Event composition считаются одним integrated scene, а не несколькими workhorse glow-consumers. UI поверх сцены всё равно соблюдает бюджет `1`.
- **Проверка:** normal/won raid, open/completed goal, Calendar, Today и level-up образуют лестницу интенсивности; число UI glow-sources на viewport `<=1` для каждой semantic role.
- **Основание:** Design Systems §27; RU-27; `DESIGN-DIRECTION.md` §§Color, Surfaces и anti-rule “every panel glowing”.

### C-08. Elevation использует contact + ambient, магия — отдельный канал

- **Контракт:** base panel — 0 shadows; raised workhorse — `--shadow-card`; sheet/modal/lifted drag object — `--shadow-raised`; event glow идёт только через `--glow-*`.
- **Dark `:root`:** `--shadow-card: 0 1px 2px rgba(0,0,0,.32), 0 10px 28px rgba(0,0,0,.24)`; `--shadow-raised: 0 2px 6px rgba(0,0,0,.22), 0 22px 56px rgba(0,0,0,.34)`. У raised contact-компонента alpha ниже `.32`, а ambient шире.
- **Light override:** `--shadow-card: 0 1px 2px rgba(40,52,90,.14), 0 10px 28px rgba(40,52,90,.10)`; `--shadow-raised: 0 2px 6px rgba(40,52,90,.09), 0 22px 56px rgba(40,52,90,.15)`. Legacy `--shadow` мигрирует к одной роли и удаляется как третий workhorse token.
- **Исключение:** authored cut-paper layer может иметь local `filter: drop-shadow()` и собственный inset/top-light как часть иллюстрации; это не UI elevation.
- **Проверка:** card → More sheet → modal читаются в правильном z-order в dark/light. При отключённом glow elevation сохраняется; при отключённых shadows rarity не исчезает; light не получает серого halo.
- **Основание:** RU-27–RU-30; STYLE-DECISION.md — cut-paper/paper-doll runtime.

### C-09. Workhorse component использует максимум два boundary cues

- **Контракт:** base grouping использует tone + spacing; raised module — tone и не более одного из `1px var(--line-soft)` или `--shadow-card`; overlay — tone + `--shadow-raised`.
- **Исключения:** input, focus, selected, locked, rarity frame и drop target могут иметь 1px semantic border поверх surface. Border сообщает state, а не дублирует край; focus дополнительно следует C-03.
- **Запрет:** три одновременных boundary cues у ordinary nested card; новая local `box-shadow` signature для workhorse UI.
- **Проверка:** Today card-in-card, Settings rows/`.profile-text`, Calendar tray, More sheet и modal; cue count ordinary component `<=2`, boundary depth остаётся `<=2` по SD-05.
- **Основание:** RU-34; Design Systems §25.

### C-10. Accent gradient — signature field, не workhorse background

- **Бюджет:** ordinary work surface содержит 0 accent gradients; app world — максимум 1 спокойный ambient radial; одна integrated signature scene — максимум 1 composed accent field и 1 semantic glow.
- **Signature exception:** Today hero, Lair, Skill Tree, Trust/Control, Event/Boss и authored cut-paper scenes сохраняют собственную композицию. Исключение относится к одной integrated scene, а не ко всем вложенным utility panels.
- **Проверка:** без signature surfaces Today/Settings/Calendar остаются узнаваемо Satoru за счёт cool tinted neutrals; level-up/raid остаются сильнее shell. Обычные Calendar/Settings/Goals panels имеют 0 accent gradients.
- **Основание:** RU-24; Design Systems §13, §17, §27; `DESIGN-DIRECTION.md` §Color.

### C-11. Dark и light — одна роль, две измеренные реализации

- **Контракт:** каждая изменяемая роль (`surface`, `text`, `line`, `shadow`, `on-accent`, `on-bad`, `focus-ring`, semantic/rarity) имеет явную dark/light пару либо доказанно проходит без override.
- **Проверка:** одна state matrix на 375 и 1280px в обеих темах; thresholds C-03/C-04 проходят, four-level stack C-01 не меняет смысл, shadows C-08 сохраняют z-order. `.profile-text` входит в focus fixture baseline `f0c7cee`.
- **Запрет:** считать dark-theme rgba автоматически корректным на light; чинить light локальными component literals.
- **Основание:** RU-23–RU-29; Design Systems §25, §28.

### Явные конфликты: решение направления

| Книжный импульс | Почему буквально не применяем | Решение Satoru |
|---|---|---|
| “Fewer borders / flatter UI” | Полное удаление границ стирает focus, selected, locked, rarity и drop states. | C-09 убирает только дублирующие границы; semantic boundaries остаются. |
| Унифицировать все cards и shadows | Integrated Lair/Tree/Event/Boss и cut-paper layers потеряют signature moments. | C-08/C-09 строги для workhorse UI; authored art composition — bounded exception. |
| Свести palette к нейтральному SaaS | Это противоречит холодной мистической основе, Flint/Shadow и earned gold. | Cool tinted neutrals и purpose-colors сохраняются; C-02/C-03 задают usage и contrast. |

## Движение

Motion показывает причину, state и редкий earned peak. Workhorse motion нормализуется через существующие `--dur-*`; cut-paper choreography остаётся authored exception. Loading architecture, recovery, queue persistence и route-art delivery остаются в screen QA, а не маскируются под motion tokens.

### M-01. Три duration-токена получают три назначения

- **`--dur-fast: 140ms`:** press/hover/focus/selected и local state change; визуальный ответ начинается `<=100ms` после input.
- **`--dur-normal: 240ms`:** disclosure, tooltip, accordion, sheet/modal, route-shell visual transition и ordinary completion receipt. Обычное completion полностью входит в `<=240ms`.
- **`--dur-slow: 520ms`:** один earned emphasis beat только для rare level/capstone/event/raid/boss threshold; ordinary completion/navigation/control его не используют.
- **`--ease-out`:** default workhorse enter/state easing; exit не длиннее enter.
- **Проверка:** каждый workhorse transition разрешается в одну из трёх ролей; текущие `normal=0` и `slow=1` consumers мигрируют по purpose, новые raw `140/240/520ms` не появляются.
- **Основание:** Design Systems §31; `DESIGN-DIRECTION.md` §Motion.

### M-02. Workhorse motion меняет максимум две CSS-properties

- **Контракт:** один workhorse transition анимирует максимум 2 properties total; preferred pair — `opacity` + `transform`. `color/background-color` и `box-shadow` считаются repainting properties и входят в тот же лимит; `filter` разрешён только authored art. `transition: all` consumers = 0.
- **Геометрия:** hover lift `<=2px/140ms`; local reveal translate `<=8px/240ms`; full-height sheet визуально входит через `opacity + translateY(<=24px)` за `<=240ms`, а не пересекает весь viewport. Width/height/top/left animation у workhorse UI = 0; progress использует `scaleX` с фиксированным layout box.
- **Исключение:** paper-doll/cutout rig анимирует заранее заданные layer transforms и не задаёт template для buttons/cards.
- **Проверка:** DevTools показывает `<=2` animated properties и 0 layout-triggering geometry у ordinary controls; touch path не зависит от hover.
- **Основание:** Design Systems §31; STYLE-DECISION.md — transform-based cutout rig.

### M-03. В foreground одновременно находится одно визуальное событие

- **Контракт:** одно user action порождает максимум 1 foreground visual и 1 primary audio cue. Secondary earned visuals не рендерятся в foreground одновременно; delivery/persistence этой последовательности остаётся отдельным behavior QA из MF-F09/SG-F20.
- **Обычное completion:** compact causal receipt; entrance `<=240ms`; следующий action визуально не перекрыт.
- **Редкий threshold:** fullscreen разрешён одному заранее понятному event; остальные foreground animations ждут окончания текущего peak.
- **Проверка:** fixture `core + level/rank + boss hit + 2 achievements + hype` на 375/1280 показывает overlap count `0` и одновременно не более 1 foreground visual/1 cue. Reload/losslessness не объявляются свойством этого style-rule.
- **Основание:** MF-F09; SG-F20; Design Systems §14.

### M-04. Ceremony быстро отдаёт результат, но не обрезает authored art

- **Контракт:** один earned beat использует `--dur-slow` (`520ms`). Known result text, Claim и Close доступны `<500ms` после input; Skip/Close появляется `<=100ms`, имеет `min-inline-size/min-block-size: var(--touch-min)` (`42px`, SD-08). Optional rare Continue CTA становится usable `<=1200ms`.
- **Защита сцены:** authored raid/capstone cut-paper art и audio могут продолжаться после появления usable CTA; `1200ms` — interaction-unlock ceiling, не предел всей композиции.
- **Разрешено:** persisted weekly raid victory, rare level/capstone/event win, один authored reward reveal.
- **Motion-veto:** 3.6s reel, near-miss decoys и forced suspense после известного outcome запрещены. Tier policy и reward persistence остаются в SG-F19/SG-F44 product QA, а не в motion rule.
- **Проверка:** reward, level-up и raid won на keyboard/touch; result/Claim/Close `<500ms`, optional CTA `<=1200ms`, target `>=42×42`, Reduce Motion убирает beat без потери result.
- **Основание:** SG-F18, SG-F20, SG-F21, SG-F31; `DESIGN-DIRECTION.md` — game moments special because rare.

### M-05. `prefers-reduced-motion` выключает, а не растягивает

- **Контракт:** внутри `@media (prefers-reduced-motion: reduce)` `--dur-fast`, `--dur-normal`, `--dur-slow` становятся `0ms`; decorative travel, scale, pulse, confetti, glow sweep и все infinite loops получают `animation: none` и `transition-duration: 0ms`.
- **Сохранить:** мгновенный pressed/selected state, final result, progress value, text receipt и focus placement. Sound toggle независим и не заменяет visual feedback.
- **Проверка:** computed styles всех animated elements на каждом QA screen; nonessential duration `=0ms`, infinite animations `=0`, задача остаётся выполнимой.
- **Основание:** Design Systems §31; `DESIGN-CRAFT-BRIEF.md` §4 cross-cutting gate; `DESIGN-DIRECTION.md` mobile contract.

### M-06. Ambient motion живёт только в эмоциональном доме

- **Focal body/rig:** continuous idle допустим только в Today companion, Lair или deliberate Character/wardrobe preview; максимум 1 moving focal rig/group на viewport. Body/pose cycle лежит в `3200–5800ms`, translate amplitude `<=5px`, absolute scale deviation from `1` `<=6%`.
- **Integrated environment exception:** Lair/Event scene может иметь один coordinated environmental director с micro-loops `1200–3200ms`; brightness/opacity excursion каждого prop `<=20` percentage points. Clipped weather/particle field может пройти больше 5px только при individual alpha `<=.20`; весь field считается одной environmental group, а не несколькими focal objects.
- **Runtime:** director и rig pause при `document.hidden`, offscreen и Reduce Motion. Ambient loops в Settings, Calendar, Goals, forms и navigation = 0.
- **Finite reaction:** live-data pose/energy response использует M-01 и заканчивается; он не превращается в infinite dashboard pulse.
- **Проверка:** Performance/Animations panel на 375/1280; одновременно `<=1` focal rig и `<=1` integrated environmental director, после ухода со сцены animation activity прекращается.
- **Основание:** `DESIGN-DIRECTION.md` §Motion; STYLE-DECISION.md — calm idle/data-bound cutout animation.

### M-07. Pulse ограничен числом циклов

- **Контракт:** claimable reward может pulse с period `>=1560ms` (`3 × --dur-slow`), максимум 3 iterations, затем остаётся static claimable. Одновременно pulse только у 1 объекта.
- **Запрет:** infinite pulse для ordinary CTA, progress, nav dot, Pro upsell или reminder; pulse без static icon/label/frame.
- **Проверка:** после `4680ms` UI статичен, но claimability понятна без motion и в Reduce Motion.
- **Основание:** Design Systems §27, §31; `DESIGN-DIRECTION.md` “pulse for claimable rewards” и “avoid constant movement everywhere”.

### M-08. Hover — enhancement только для точного указателя

- **Контракт:** lift/hover помещается в `@media (hover: hover) and (pointer: fine)`; touch получает тот же смысл через static signifier и immediate pressed state. Hover lift `<=2px/140ms`.
- **Проверка:** touch emulation и keyboard path не требуют hover для action name, editability или result; layout не прыгает при pointer enter/leave.
- **Основание:** About Face AF-16–AF-18; Mobile First MF-F23–MF-F25.

### M-09. Audio синхронизирован с причиной, но не является обязательным каналом

- **Контракт:** один primary cue стартует `<=100ms` после confirmed state change. Повтор того же cue подавляется в окне `var(--dur-fast) = 140ms`; `sound off` сохраняет полный visual/text result.
- **Текущая правка:** procedural Web Audio `sfx()` уже реализован, но branch `click` отсутствует. Добавить тихий procedural `click`, сознательно выбрать self-hosted local asset либо удалить callers; не описывать это как отсутствие всей SFX-системы. Cue не использует slot-machine/near-miss grammar.
- **Scope:** SFX mute относится к SFX и не обещает выключить TTS/ambient без отдельной настройки.
- **Проверка:** pointer/keyboard дают 1 result/1 cue; два одинаковых calls внутри 140ms дают максимум 1 cue; procedural/local implementation работает offline; sound-off/Reduce Motion/screen reader paths остаются понятными.
- **Основание:** Design Systems §36; SG-F20, SG-F30.

### M-10. Известный outcome не ждёт декоративного suspense

- **Контракт:** после вычисления deterministic outcome декоративная motion добавляет `0ms` до видимого result text и доступных Claim/Close; optional ceremony идёт параллельно и следует M-04.
- **Запрет:** spinner/reel после выбранного outcome, fake progress, near miss и preselected-result suspense. Реальная network/decode pending-state не считается искусственной задержкой и проверяется как loading/error behavior вне motion-section.
- **Проверка:** instrumented reward fixture отмечает timestamp outcome calculation и first visible result/Claim/Close; добавочная decorative wait `=0ms`. Profile refresh из `f0c7cee` остаётся допустимым real-network pending case.
- **Основание:** SG-F18, SG-F21; `DESIGN-DIRECTION.md` “avoid long transitions before productive actions”.

### Явные конфликты: решение направления

| Книжный импульс | Почему буквально не применяем | Решение Satoru |
|---|---|---|
| Свести все transitions к одной neutral physics | Это уничтожит authored paper-doll character и редкий climax. | M-01/M-02 нормализуют workhorse UI; M-06 сохраняет bounded cutout choreography. |
| Добавить “juice” каждому действию | Постоянный максимум конкурирует с next action и обесценивает reward. | Ordinary action `<=240ms`; rare result доступен `<500ms`, CTA `<=1200ms`, art может продолжаться. |
| Удерживать outcome ради suspense | Это противоречит serious life OS, honest feedback и anti-casino veto. | M-10 даёт result/Claim/Close без decorative wait; ceremony не блокирует их. |
| В reduced mode только замедлить движение | Это не проходит явный QA-критерий brief. | M-05 выключает nonessential motion до `0ms`; смысл остаётся статичным. |
