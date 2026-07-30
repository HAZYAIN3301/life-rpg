# Satoru Shadow Rig v3 — canonical forms and Kling handoff

Shadow Rig v3 replaces the three legacy evolution references with one coherent
four-form family in the established Satoru style. This directory is an art and
motion handoff package. It does not modify application runtime code.

## Canonical forms

| Bond | Form | Canonical image | SHA-256 |
|---:|---|---|---|
| 0 | Искра / Spark | `runtime/shadow-spark-calm.png` | `88394e10830d02f50c610754dc2f517bf29b6683a239738ed7702c6d3a2d7123` |
| 6 | Дух / Spirit | `runtime/shadow-spirit-calm.png` | `b0ee5cd0cabc95cdbe76c572202aea2fb8ad75f60bf7cfd6dd0d1d9cbe172549` |
| 20 | Страж / Guardian | `runtime/shadow-guardian-calm.png` | `0166ec3ffaa0cf5499128d05ad092bd81914b6fb690e362720e77ff8a0b840bc` |
| 50 | Хранитель / Keeper | `runtime/shadow-keeper-calm.png` | `444592ab00e796b399ac0eb671c720f0ba0e834dcdb6452ccbe61cc3b515830a` |

Every image is a transparent RGBA PNG on a shared `1024×1024` canvas.
`normalize-shadow-forms.py` deterministically places the approved sources at
their progression scale, and `shadow-evolution-v3-contact-sheet.jpg` shows the
complete family on the Satoru dark surface.

## Kling handoff

- `build-kling-pack.mjs` validates the canonical dimensions and exact hashes,
  then creates the motion package.
- `kling-jobs.json` is the machine-readable 4×10 job matrix.
- `KLING-PROMPTS.md` is the copy/paste handoff for Kling.
- `IMAGEGEN-PROMPTS.md` records the canonical still-image production prompts
  and their provenance.
- `qa-report.md` records the verified package contract and remaining external
  Kling gate.

Rebuild:

```bash
node shadow-rig-v3/build-kling-pack.mjs
```

## Recommended production order

Generate only the eight `PILOT` jobs first:

- Spark: `calm`, `speaking`;
- Spirit: `calm`, `speaking`;
- Guardian: `calm`, `speaking`;
- Keeper: `calm`, `speaking`.

This is the cheapest useful identity and speech test. Continue with the other
32 jobs only after all eight preserve the canonical silhouette, face, limb
count, paper material and seamless loop.

Returned Kling sources remain intermediate files. They still require chroma
removal, true alpha, loop/crop processing and runtime visual QA before they may
replace the DOM/CSS rig on any surface.
