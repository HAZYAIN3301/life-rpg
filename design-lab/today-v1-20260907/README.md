# Satoru — Today: desktop + mobile character comparison

Two directions on the same locally saved synthetic day:
`?variant=impulse` (A, Unbounded / graphic violet) and
`?variant=companion` (B, Russo One / rounded olive-brass).
The top switch changes presentation only, preserving tasks, drafts and running focus.
Neither direction has been approved for the production app.

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
Use `node qa-character.mjs` for the A/B responsive, font, contrast and touch checks.
