# Satoru — Today: rounded violet, light + dark

User-selected direction: B's Russo One and rounded geometry, violet Shadow identity,
a brighter quiet night palette and a genuine light palette. Not a production rollout.
`?theme=light`, `?theme=dark`, or `?theme=system` on the same synthetic day.
The explicit query takes priority over the saved device preference, then system.
A theme choice persists separately from tasks. Storage refusal is reported without
blocking the current-session choice. System mode follows OS/browser changes.
Old A/B URLs remain reachable but now show the unified design, not separate directions.

Existing production navigation glyphs, coloured by role, and the rewards chest
replace Unicode placeholders. Original day/night room artwork follows the theme.
No new characters or generated illustrations. The avatar mannequin remains rejected.
The Site is currently PUBLIC; the user explicitly approved updating that audience
on 2026-09-07. Only synthetic fixtures and local browser input, never account data.

Contract and rollout gates: ../../DESIGN-REBOOT-V1.md. Evidence: QA.md.

`npm run build` copies the existing approved assets; `npm start` serves only `site/`
on 127.0.0.1:4179. Separate localStorage, synthetic data, no network calls to Satoru.
`npm test` tests the preview state model; `node qa.mjs` runs desktop browser fixtures.

Existing character/room/audio assets are reused from public/. New display fonts and
their original OFL licenses are in site/fonts/; see SOURCES.md. For standalone Sites
publication include generated site/assets in the source snapshot; build tolerates the
missing parent public/ only when the exact copied assets are already present.

This code is not a drop-in replacement for app.js. Do not substitute the fixture model
for live State/Store or silently remove multiple spheres, background, difficulty,
server receipts, real voice processing, reward economy, or other existing capabilities.

Mobile: five named navigation destinations; direct Shadow and voice recap; unfinished
tasks before completed tasks. “＋ Задача” opens the complete editor (time and duration
visible immediately); desktop keeps the editor inline. Closing preserves an unsent draft.
Use `node qa-character.mjs` for the light/dark responsive, font, contrast, touch and theme-lifecycle checks.
