# Den v3 starter furniture — QA

Дата: 2026-07-30
Итог: **4/4 PASS**

## Автоматический QA

| ID | Canvas | Alpha | Углы | Green fringe | SHA-256 |
|---|---:|---|---|---:|---|
| `wall-map` | 1024×688 | 0…255 | 0 / 0 / 0 / 0 | 0 px | `ef579523de9a3776e2a2db85a7d8ea2d55ad2f0746958744865beac7cb6dbfe7` |
| `seat-cushion` | 1024×199 | 0…255 | 0 / 0 / 0 / 0 | 0 px | `2aea301e6918ff7575918a8ae4dfdddd8b71a32da56f1dbbfa7b3ddd3d56df03` |
| `light-lantern` | 369×1024 | 0…255 | 0 / 0 / 0 / 0 | 0 px | `ce8e5df67d42f084d6af909fe8b6aafe45bafbb6401d2b8c349688e970c7fb5d` |
| `floor-traveller` | 1024×445 | 0…255 | 0 / 0 / 0 / 0 | 0 px | `dd7eb016419ee8a16b2e11cb0745e494ca098d510ea974211badc3841a0e15a3` |

Проверки:

- Все четыре runtime-файла декодируются как RGBA PNG.
- Каждый canvas tight-cropped и имеет прозрачный padding.
- Максимальная alpha четырёх углов каждого слоя равна нулю.
- На видимых частично прозрачных краях нет key-green dominance.
- Максимальная alpha равна 255: предметы не стали полупрозрачными после chroma-removal.
- Все четыре слоя имеют собственный source green, собственный prompt и собственный runtime PNG.

Полные числовые метрики находятся в `qa-metrics.json`.

## Визуальный QA

| Критерий | Результат |
|---|---|
| Premium cut-paper/painterly материал соответствует Den/Traveller | PASS |
| Нет персонажей, животных, лиц, текста, логотипов или watermark | PASS |
| Карта читается как карта даже в уменьшенном размере | PASS |
| На карте нет букв, подписей или псевдотекста | PASS |
| Подушка совпадает с перспективой и шириной правой лавки | PASS |
| Верхнее кольцо фонаря образует однозначный animation pivot | PASS |
| Свет фонаря запечён внутрь parchment-панелей, внешнего glow нет | PASS |
| Перспектива ковра уже запечена в геометрию | PASS |
| Ковёр поддерживает ноги Traveller и не ломает contact plane | PASS |
| Окно и топка камина остаются свободны | PASS |

## Preview QA

- `previews/starter-furniture-contact-sheet.png` — 1920×1200, четыре слоя на checkerboard.
- `previews/starter-furniture-scene-preview.png` — 1536×864, все четыре слоя на текущем Den v3 фоне.
- Contact sheet SHA-256: `32795b49a6e8c5e82b3a08ef31db87d21a2ab908f948c2475415ddacf692a526`.
- Scene preview SHA-256: `292cc21deba4f7ccaa2f8cd6f255c493656a180a2cf74eb23a6f14e4777de78a`.

Дополнительно собран временный QA-композит с:

- `traveller-v1-wardrobe-v5/previews/neutral-transparent.png`
- `runtime-staging/life-rpg/public/art/pets/fortune/assembled.png`
- `shadow-rig-v3/runtime/shadow-spirit-calm.png`

Traveller стоит в центре ковра, Fortune помещается справа у ног, Shadow помещается над плечом. Карта работает как задний слой; фонарь не пересекает персонажа; подушка остаётся на лавке. Временный композит не включён в runtime-пакет.

## Integration boundary

В этом арт-проходе не изменялись `app.js`, `styles.css`, deploy-скрипты или production-код.
