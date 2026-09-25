# R06 — one Shadow: chat, support hints, Den, voice, v288

Scope chosen by the owner on 25.09 («Экраны + Тень»): the Shadow companion reads as
one character with one set of controls, states and tone on every surface — Today
support, chat, voice, Den and the floating Shadow button. Applied rules: registry
icons instead of system emoji in controls and hints, TY-05 (≥12px meaning-bearing
text), SD-08 (≥44px touch targets), C-04 (text ≥4.5:1), five locales.

## Method

A Chromium audit opens Today support (companion expanded), the Shadow chat with one
synthetic exchange (AI endpoints intercepted — no real AI request, no microphone) and
the Den, and reports emoji in text, contrast below 4.5:1, text <12px, touch targets
<42px and untranslated Cyrillic. Matrix: RU/UK/EN/DE/ES at 375 dark, UK 375 light,
EN/RU 1280 light, DE 1280 dark. Separate probes: every registry glyph on 16 routes
(RU 375 dark, EN 1280 light) must be painted in the text colour; fixed elements on
Today at 1280.

## Before → after

| Surface | Before | After |
|---|---|---|
| Today support hints | «🤸 4 год 15 хв сидячих планов —» in UK (and every language): stretch, mobility and «System» teaser were Russian-only; 🌿 🎖 🎒 🌅 📝 🧘 ⚡ led the hints | all texts go through `t()` with EN/DE/UK/ES rows; registry icons (workout, import, calendar, day, notes, yoga, XP); rest/notes dynamic translations accept text with or without the old emoji |
| Shadow's own phrase in a hint | replaced the text only up to the first `</span>` — with an icon in the line the voiced phrase and the old text would both show | the whole line is replaced; a leading registry icon is kept |
| Chat | own messages `#fff` on accent, 📎 «План из файла», send button 40px wide on desktop | on-accent text, registry import icon, 44×44 send button |
| Voice | wake button 🎙/■ as text, TTS buttons ~30px | registry microphone/stop icons, TTS 44×44 |
| Today companion head | rename ✎ and collapse toggle 42×40, 11px kicker | registry edit icon, 44×44 controls, 12px kicker |
| Den | the «tasks today» chip showed an empty gap: `.den-stats span` painted the icon span with the chip background | glyph painted in text colour (probe: 0 invisible glyphs on 16 routes) |
| Shadow button | streak badge «🔥35» at 9.5–10px | registry streak icon + number at 12px |

Intentionally unchanged: the name «Тень»/«Shadow» and its ~50 Russian case forms stay
as written (renaming the companion is a product decision); user and AI message text
in chat is not filtered; mobility, rest, low-energy and «System» teaser hints are
translated but still filtered out on Today by the existing one-action rule
(`secretaryNudgeEligible`) — see BACKLOG.

## Verification

- Unit: `scripts/shadow-r06.test.js` — voiced phrase with nested icon spans, hint
  icons and five-language rows, dynamic rest/notes patterns with and without emoji,
  44px/12px/visible-glyph CSS guards, streak badge and chat/voice icons.
- Full suite 3128/3128 PASS, 0 skipped (non-root); syntax and `git diff --check` PASS.
- Chromium audit after the change: Today, chat and Den clean in all five locales at
  375 (dark), UK 375 light, EN/RU 1280 light, DE 1280 dark — 0 emoji, 0 low contrast,
  0 text <12px, 0 targets <42px, 0 untranslated text, 0 page errors.
- DOM translation of the new hint markup checked in EN/DE/UK/ES (rest, notes, import,
  mobility, «System», stretch with localized duration).
- Screenshots: UK Today support (stretch hint with workout icon), EN chat 1280, UK
  chat 375, UK Den 375, DE Today 1280 with the Shadow button.

Synthetic accounts carry a cached Shadow phrase «default» from the R04C mock; it is
test data, shown where a real account would show the voiced phrase.

**Not verified here:** WebKit, real devices, screen readers, real microphone and
real AI phrasing.

## Publication

`3a34a13` on master 25.09; both domains report it with `satoru-v288` at 11:52 UTC;
12/12 SHA256 matches (app.js, design-next-v1.css, index.html, sw.js, styles.css,
icon-registry.js × 2 domains); login page loads the v288 shell without console errors.
