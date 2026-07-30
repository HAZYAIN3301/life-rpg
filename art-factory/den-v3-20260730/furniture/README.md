# Den v3 — starter furniture

Четыре стартовых предмета мебели для канонического фона Den v3. Каждый предмет сгенерирован отдельным промптом и сохранён отдельным прозрачным runtime-слоем.

## Runtime-файлы

| Slot | ID | Файл | Canvas |
|---|---|---|---:|
| wall | `wall-map` | `layers/wall-map.png` | 1024×688 |
| seat | `seat-cushion` | `layers/seat-cushion.png` | 1024×199 |
| light | `light-lantern` | `layers/light-lantern.png` | 369×1024 |
| floor | `floor-traveller` | `layers/floor-traveller.png` | 1024×445 |

Точные позиции, z-index, pivot фонаря и motion hints находятся в `manifest.json`.

## Производственный контракт

1. Один предмет = один built-in imagegen prompt.
2. Генерация выполняется на плоском green-key фоне.
3. Исходники сохраняются неизменными в `sources-green/`.
4. `build-furniture-pack.py` семплирует реальный цвет рамки, строит soft alpha по расстоянию до key color, выполняет despill, tight-crop с 24 px padding и ограничивает длинную сторону 1024 px.
5. Скрипт пересобирает `layers/`, `qa-metrics.json`, contact sheet и scene preview.

Стандартный helper imagegen также был прогнан и его результаты оставлены в `intermediate-alpha/`. Для финальных файлов используется пакетный normalizer: обычная dominance-matte делает большие muted-teal поверхности частично прозрачными, а color-distance matte сохраняет их полностью непрозрачными и очищает только антиалиасинг края.

## Композиция

- `wall-map` висит на открытой центральной стене и остаётся позади Traveller.
- `seat-cushion` точно ложится поверх встроенной лавки под правым окном.
- `light-lantern` подвешен между камином и центральной стеной; верхнее кольцо является pivot.
- `floor-traveller` уже содержит корректное перспективное сжатие и не требует старого `scaleY(.42)`.
- Временная проверка с Traveller, Fortune и Shadow подтверждает, что предметы не ломают contact plane и не перекрывают окно или топку.

## Пересборка

Из папки проекта:

```bash
python3 den-v3-20260730/furniture/build-furniture-pack.py
```

Скрипт не меняет `app.js`, `styles.css` или deploy-файлы.
