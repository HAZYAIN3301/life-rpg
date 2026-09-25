# R12 — sign-in, registration and first run, v294

No earlier package audited the screens a new person sees first. R12 audits the
logged-out phases (sign-in, registration language, registration, password reset) and
the first-run questionnaire (start, manual path, review) for freshly registered
synthetic accounts in RU/EN/DE/UK/ES at 375 light and 1280 dark, plus the two
dialogs R11 could not open (tribe exit, voucher) with in-memory synthetic data.

## Before → after

| Finding | Before | After |
|---|---|---|
| Sign-in / registration / reset fields | visible labels were not linked to their inputs (no `for`/`id`); «repeat password» had no label — screen readers announced unnamed fields | `linkAuthFormLabels` links every label to the following field; fields without a label get `aria-label` from their placeholder |
| First-run questionnaire | «ИИ сейчас не подключён — ручной путь работает полностью.», «Проверяю подключение ИИ…», «Предложено как основная сфера / как фон» were Russian in EN/DE/UK/ES | translated |
| Emoji | 🧭 🕯 🛡 in the sign-in pitch, ⚡ CTA, 🎤/■ voice answer button | registry icons / plain text |
| Text <12px | alpha note 11.5 px, privacy note 11 px, step/source badges 11 px, questionnaire hints 10.8 px | 12 px |
| Targets | «Create account» / «Forgot password?» links 24 px | 44 px |
| Desktop goal chip under a quest | 22 px | 24 px (touch already 44 px) |

Tribe-exit and voucher dialogs: clean (EN 375 dark, DE 1280 light).

## Verification

- Unit: `scripts/first-run-r12.test.js` (2) — label linking on a DOM double and its
  call site, no emoji-led pitch/CTA/voice labels, first-run copy in four languages,
  12 px and 44 px rules.
- Full suite 3152/3152 PASS, 0 skipped (non-root); syntax and `git diff --check` PASS.
- Chromium: logged-out phases × 5 languages at 375 light and 1280 dark — 0 emoji,
  0 untranslated text/attributes, 0 text <12 px, 0 targets <42 px, 0 unlabelled
  fields, 0 overflow, 0 page errors. First run (start → manual → review) × 5
  languages × 2 viewports: clean.

**Not verified here:** WebKit, real devices, screen readers (label association was
verified through the DOM `labels` API).
