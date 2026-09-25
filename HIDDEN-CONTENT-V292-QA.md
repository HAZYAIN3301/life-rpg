# R10 — hidden content sweep (collapsed sections, Settings groups, light theme), v292

Earlier route audits (R05–R08) measured only what was visible on first render.
Collapsed `<details>` sections and non-default Settings groups were never opened —
the 🕯 heading in Settings → Shadow was found that way. R10 opens every disclosure on
all routes plus sub-views (Today board, Goals focus/all/map/archive, all six Settings
groups) and applies the same checks: emoji in controls/headings, untranslated text
and attributes, contrast, text <12px, targets, overflow.

Matrix: EN 375 dark, DE 1280 light, ES 375 light, RU 375 dark, UK 375 light (dense
synthetic data) and new-EN 375 dark, empty-RU 1280 light (empty accounts).

## Before → after

| Finding | Before | After |
|---|---|---|
| Settings → Data: telemetry consent | the purposes the person switches on/off (app operation, harm detection, usefulness, personalisation, engagement optimisation, behavioural experiments), their descriptions and the intro were Russian in EN/DE/ES/UK | 16 strings translated into four languages |
| Settings → Planning: dungeon programs, starting level | program buttons were announced as «Program: Студент — …» in every language; «ИИ оценит уровни…» tooltip Russian | names and taglines in the interface language |
| Settings headings/buttons (Interface, Planning, Shadow & connections) | 🌙 ☀️ 🔊 ▶ 📲 📥 🌿 🎯 ⚖️ 🎖 🤖 📦 🧠 📂 🏃 ⏳ | registry icons or plain translated text (existing translations reused via `emojiFree`) |
| Light theme | Phase 3 console surfaces (calendar, week, goal form, rank rows, tribe/leaderboard rows, Settings knobs and import rows, progress tracks — 30 selectors) used dark translucent fills; text on them 2.3–3.3:1 | neutral light tint; calendar hour lines visible in light |
| Rank badges (Progress) | text in the rank colour 1.2–4.3:1 | text colour, rank colour stays on frame and tint |
| Text <12px | calendar hours, day counts, program meta, profile/telemetry states, kickers, account labels, voice legend, AI key badges (10.5 px) | 12 px |
| Targets | accent swatches 28 px on phones; a desktop floor for pet hints | 44 px on touch; 24 px desktop minimum without shrinking the 42 px touch rule |

Intentionally unchanged: path glyphs (🕊/⚔️) and program icons (🎓🏃🎬💼💻🧘⚖️) are
content identity marks (`aria-hidden`), like the domain icons kept in R05; emoji inside
sentences; admin-only panels; inline links inside sentences («Get a key →») — inline
targets are exempt; desktop-only controls between 24 and 42 px (mouse). The chart value
labels (`dchart-colval`) are reported as low contrast by the script because it takes
the bar as background; they sit above the bar on the panel and read at full contrast
(screenshot).

## Verification

- Unit: `scripts/hidden-content-r10.test.js` (4) — every telemetry purpose translated
  in four languages, no emoji-led Settings headings/buttons, program labels translated,
  light override covers the console surfaces, rank text colour, 12 px list, 44 px
  swatches on touch and the desktop-only pet-hint floor. `push-account-test-v274`
  harness gets the shared helpers (assertions unchanged).
- Full suite 3146/3146 PASS, 0 skipped (non-root); syntax and `git diff --check` PASS.
- Hidden audit after the fix, all seven combinations: 0 untranslated text/attributes,
  0 overflow, 0 page errors; remaining items are the intentional ones above.
  Regression: Shadow audit (RU 375 dark, DE 1280 light) and AI dialog audit (DE 375
  light) clean.
- Screenshots: DE light Settings focus card, DE light Progress ranks and charts.

**Not verified here:** WebKit, real devices.
