# Weapon grip contract v1

## Geometry gate

`w1` доказал, что предмет можно точно нормализовать на оба холста, но
текущие approved-нейтрали не имеют позы хвата:

- Traveller: перчатка и открытые пальцы принадлежат объединённому outfit;
- Scholar: перчатка принадлежит outfit, открытая кожа кисти — `body-visible`;
- в обоих контрактах отсутствует `slot-weapon`, `gripPivot` и сменный
  forearm/hand bundle.

Если просто провести рукоять под существующей кистью, координаты и
окклюзия будут правильными, но силуэт руки останется расслабленным. Это
зафиксировано в `previews/w1-contact-sheet.png`; такие PNG лежат только в
`prototypes/` и не являются production art.

## Required per-character assets

Для каждого персонажа нужен следующий bundle на холсте 1024×1536:

1. `weapon-back.png` — клинок/гарда за фигурой;
2. `forearm-grip-reveal.png` — скрытая геометрия рукава после удаления
   нейтральной кисти;
3. `hand-grip-front.png` — закрытая кисть/перчатка, совпадающая с исходной
   рукой выше запястья;
4. `weapon-front.png` — видимая нижняя часть рукояти/поммель;
5. `hand-replacement-mask.png` — область, которую neutral outfit/body не
   должны рисовать в action pose.

Порядок композита:

`weapon-back → avatar-with-hand-mask → forearm-grip-reveal → hand-grip-front → weapon-front`

## Approved coordinate candidates

| Avatar | Character hand | Grip pivot | Blade tip | Rotation | Scale |
|---|---|---:|---:|---:|---:|
| Traveller | right / screen-left | `(319, 825)` | `(253, 416)` | `-9.167°` | `0.431553` |
| Scholar | right / screen-left | `(317, 861)` | `(257, 452)` | `-8.346°` | `0.430602` |

Это не «подогнанные на глаз» offsets: они записаны в общей системе
координат, проверяются по непрозрачности точки хвата и воспроизводятся
`build_w1_pilot.py`.

## Hand generation gate

Для material pass модели передаётся approved avatar reference и
изолированный `w1`. Выход сначала генерируется на chroma key, затем:

- детерминированная replacement-mask оставляет только предплечье/кисть;
- seam выше манжеты должен совпасть с approved master;
- старые пальцы не могут оставаться видимыми;
- новый grip должен перекрывать рукоять минимум с двух сторон;
- ни один пиксель вне replacement-mask не меняется;
- Traveller и Scholar проходят отдельный QA — один результат не
  масштабируется на второго.

До выполнения этого контракта оружие может показываться в inventory, но не
должно отображаться как «надетое в руку» в runtime.
