# Satoru Avatar Lab 01

**Factory-only engineering pilot. Not approved character art; not a production release.**
Решения, история и границы: [AVATAR-3D-PILOT-V1.md](../../AVATAR-3D-PILOT-V1.md).
ТЗ художнику: [ARTIST-BRIEF.md](./ARTIST-BRIEF.md). Проверки: [QA.md](./QA.md).

## Запуск

```sh
cd art-factory/avatar-3d-v1-20260907
npm ci --ignore-scripts
npm start
```

Открыть http://127.0.0.1:4178. Другой порт: `AVATAR_PILOT_PORT=4179 npm start`.
Демонстрация не устанавливает service worker и не обращается к аккаунту.
Внутренняя RU-only поверхность не подключена к навигации Satoru.
Нужен браузер с WebGL2. Библиотека загружается с localhost, не с CDN.

## Как проверить

1. Выбрать причёску/одежду/цвет. Пройти четыре позы и три ракурса.
2. Снять меч: закрытый хват заменяется открытой кистью. Надеть обратно.
3. Перезагрузить: восстанавливается только factory-look из этого браузера.
4. «Проверить сборку»: 256 samples; это geometry smoke test, не artistic approval.
5. «Для производства» → скачать GLB → загрузить обратно. Файл содержит все варианты
   и четыре анимационных клипа. Сохранённый образ не меняется.
6. Включить reduced motion или pause: движение прекращается, выбор остаётся доступен.

```sh
npm test
npm run qa:browser
```

Browser QA использует установленный Google Chrome (Playwright channel `chrome`),
отдельный временный browser context и read-only localhost server. Выход — `qa-output/`
(generated, gitignored): report, screenshots, sample GLB. Публикуемые контрольные кадры
лежат в `previews/`. Реальные пользовательские профили не читаются.

## Что где

- `contract.mjs` — allowlisted look, palettes, preflight GLB, motion gate.
- `rig.mjs` — deterministic mannequin, shared skeleton/weights, IK, animations, metrics.
- `glb.mjs` — export/import, named-part validation, playback imported clips.
- `workbench.mjs` — preview lifecycle, local-only save, controls; no Satoru data adapter.
- `serve.mjs` — localhost only, exact preview files and three/art/font mounts; no data/docs.
- `tests/` — geometry/contract tests and browser interaction/reload/GLB/mobile tests.

Three.js/Playwright pinned in package-lock. Main application's zero-runtime-dependency
setup is unchanged. Do not vendor or globally load the renderer until the production gate.

## Не считать готовым

Final Traveller likeness/materials, hair quality, cloth/weapon collision QA, transitions
into/out of sitting, adaptive contact with other pets, physical mobile performance,
account persistence, inventory/shop receipts, full localization and production integration.
The geometry demo is an input to the paid art test, not a replacement for it.
