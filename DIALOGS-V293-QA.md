# R11 — dialogs and real content (goals, habits, notes, rewards, programs), v293

The synthetic «dense» accounts used since R04 had only tasks: no goals, habits,
notes or rewards, and sphere names were stored already localized. R11 adds full
accounts seeded through the app's own flows (dungeon program merge → habits and
quests, proposal cards → goals, capture form → notes, reward catalog → rewards) in
EN/RU/DE, audits ~30 application dialogs (role, label, close button, Escape, focus,
emoji, translation, text size, targets) and re-audits the content routes.

## Before → after

| Finding | Before | After |
|---|---|---|
| Dungeon programs (onboarding and Settings) | starter habits and quests were created with Russian titles in every language («Разобрать сложную тему», «Учить материал / карточки») — a new EN/DE/ES user started with Russian content | 33 titles translated; created in the interface language (verified on a fresh DE account) |
| Sphere names in labels | standard spheres are stored in Russian and translated on display, but labels built from raw names stayed Russian («Haustier streicheln: Учёба», «Nach oben: Учёба», paths «Здоровье › Спорт») | pet names, sphere editor, sphere field chips, radar label, rename placeholder and « › » paths use the interface language |
| Category picker, «The Entry», sphere guide | not dialogs: focus stayed behind, Escape did nothing | labelled dialogs; focus moves in, Escape uses the same close action, focus returns to the opener (also after the picker re-renders on each toggle) |
| Untranslated copy | «Это нельзя отменить.» (goal delete), sign-out-everywhere dialog, «Открыть связанную цель», one reward catalog item, voucher heading, import level hints and tiers | translated (import ladders use the existing authored copy) |
| Emoji in dialog headings/buttons | 🕯 📲 🎯 🔑 📋 🤖 🪪 📍 ⏳ 📅 | registry icons or plain text |
| Goal status chips, reward cost | status text in the status colour 2.2:1, gold cost 1.7:1 in light | text colour; status colour on the frame |
| Habit sphere chip (light) | white text on a light chip 1.08:1 | text colour |
| Targets | close buttons 18–24 px, category role buttons 26 px, Entry chips 38 px, goal chip on Today 26 px, goal step toggle 22 px | close buttons 44 px everywhere; touch 44 px; desktop ≥24 px |
| Text <12px | Entry labels, desire notes, evening «(optional)», mobile nav sheet, goal map counters, caret | 12 px |

Intentionally unchanged: the recovery-code and chest-reveal windows are not
dismissible by design (the code must be acknowledged, the reward is being saved);
the avatar editor's close lives inside its own page (iframe) — the overlay now gets
a translated label, focus and focus return; desire scale faces and path glyphs are
content marks; the paywall fine print (monetisation is on hold by the owner's
decision); inline links; the dchart value false positive (R10).

## Verification

- Unit: `scripts/dialogs-r11.test.js` (4) — program titles in four languages and
  created through `t()`, sphere names/paths in labels, legacy dialog helper and its
  three users, translated dialog copy and status/cost colour rules.
- Full suite 3150/3150 PASS, 0 skipped (non-root); syntax and `git diff --check` PASS.
- Dialog audit on full accounts (EN 375 dark, EN 1280 light, RU 375 light, DE 375
  light): remaining items are the intentional ones above plus test-harness artefacts
  (the synthetic opener button is removed by the re-render, so «focus returned» cannot
  be measured for the category picker and habit editor; the real opener is found by
  its data attributes). Route audit on full accounts (EN/RU/DE): 0 untranslated text
  or labels, 0 page errors. Regression: Shadow (DE light) and AI dialogs (EN dark)
  clean.
- Screenshots: DE category picker 375, EN Entry dialog 375.

**Not verified here:** WebKit, real devices, screen readers.

## Publication

`e1d4989` on master 25.09; both domains report it with `satoru-v293` at 13:36 UTC;
10/10 SHA256 matches against the commit (app.js, design-next-v1.css, index.html,
sw.js, styles.css × 2 domains); login page loads the v293 shell without errors.
