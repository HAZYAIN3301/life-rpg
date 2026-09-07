# Satoru — Today desktop design preview

Contract and rollout gates: ../../DESIGN-REBOOT-V1.md. Evidence: QA.md.

`npm run build` copies the existing approved assets; `npm start` serves only `site/`
on 127.0.0.1:4179. Separate localStorage, synthetic data, no network calls to Satoru.
`npm test` tests the preview state model; `node qa.mjs` runs desktop browser fixtures.

All app assets are reused from public/ (font license included). For standalone Sites
publication include generated site/assets in the source snapshot; build tolerates the
missing parent public/ only when the exact copied assets are already present.

This code is not a drop-in replacement for app.js. Do not substitute the fixture model
for live State/Store or silently remove multiple spheres, background, difficulty,
server receipts, real voice processing, reward economy, or other existing capabilities.
