# Den v5 — coherent scene master

The base room and its permanent furniture are one perspective-consistent image.
No furniture PNG is positioned over the room at runtime.

- `masters/den-night-unlit.png`: unlit night master, empty central floor.
- `masters/den-day-unlit.png`: geometry-matched daylight master.
- `masters/den-night-fire-keyframe.png`: natural-fire keyframe and Kling
  reference; not a fake pulsing PNG overlay.
- Fireplace logs/grate, wall map, bonsai, side table and weapon stand are baked
  into the room geometry.
- The exterior tree is behind the window glass and is the future bird perch.
- Fire, rain and birds must be scene variants or video layers clipped to the
  exterior/window/fireplace planes; they are never generic CSS shapes.
- Headphones are an avatar wearable and do not belong to the den background.

All three masters are normalized to 1536×864. Runtime integration remains
blocked until the rain and bird references pass the visual gate.
