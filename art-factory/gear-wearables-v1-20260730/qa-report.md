# GEAR wearables v1 · w1 QA

- Status: **GEOMETRY_GATE**
- Pilot: `w1` · Тренировочный клинок
- Inventory art: 1024×1024 RGBA — **PASS**
- Avatar candidates: character-specific 1024×1536 RGBA, composite at `(0,0)`
- Render bundle: `back → avatar stack → front`
- Geometry: deterministic mask + fixed source/target landmarks
- Material and lighting: image generation source; production alpha is mask-owned
- Transparent corners / alpha / chroma-fringe: **PASS**
- Visual grip compatibility: **FAIL** — approved neutral hands are relaxed/open
- Production avatar-layer status: **BLOCKED at geometry gate**

## Grip checks

- **traveller**: grip `[319, 825]`, tip `[253, 416]`, rotation `-9.167°`, scale `0.431553`
  - grip alpha: `255`
  - occluded weapon pixels: `6170`
  - visible weapon pixels: `10940`
  - geometry gate: **PASS**
- **scholar**: grip `[317, 861]`, tip `[257, 452]`, rotation `-8.346°`, scale `0.430602`
  - grip alpha: `255`
  - occluded weapon pixels: `8513`
  - visible weapon pixels: `8228`
  - geometry gate: **PASS**

## Visual gate

- `previews/w1-contact-sheet.png`
- Contact sheet includes inventory art, both full composites, grip close-ups and hand masks.
- Candidate avatar layers live under `prototypes/`; they are evidence for the gate, not production files.

No application runtime files were changed.
