# Shadow Rig v3 handoff QA

Date: 2026-07-30

## Canonical image contract

- four canonical form files are present;
- every canonical form is an RGBA PNG on a `1024×1024` canvas;
- form hashes are pinned in `build-kling-pack.mjs`;
- progression targets match `normalize-shadow-forms.py`;
- the four-form contact sheet is present;
- runtime application files are outside the scope of this package.

## Kling pack contract

- expected forms: 4;
- expected states: 10;
- expected jobs: 40;
- expected pilot jobs: 8 (`calm + speaking` for every form);
- every job must contain one canonical primary image, prompt, negative prompt,
  output name, duration and loop flag;
- no legacy evolution image or optional style image is allowed;
- builder output must be deterministic for unchanged canonical inputs.

## Verification

Executed:

```bash
node --check shadow-rig-v3/build-kling-pack.mjs
node shadow-rig-v3/build-kling-pack.mjs
```

Result:

- JavaScript syntax: PASS;
- canonical references validated: `4/4`;
- canonical dimensions validated: `4/4` at `1024×1024`;
- pinned canonical SHA-256 values validated: `4/4`;
- generated jobs: `40/40`;
- pilot jobs: `8/8`;
- unique job ids: `40/40`;
- unique output names: `40/40`;
- jobs missing required fields: `0`;
- legacy primary references: `0`;
- non-null optional style references: `0`;
- Markdown job blocks: `40/40`;
- second build produced the same output hashes: PASS;
- trailing whitespace scan: PASS.

Generated handoff hashes:

- `KLING-PROMPTS.md`: `71809bdf9f73c4baea879a86906380be8635fc5baec103762e7dc9eaedfdd6dc`;
- `kling-jobs.json`: `1301871935ec64d9d915fc6ff1d2a52029080ea0c4c6bdc8bfa55e1b2a0b1f84`.

Application runtime files, including `app.js` and `styles.css`, were not edited
by this handoff task.

## External gate

No Kling video has passed visual QA yet. Generate the eight pilot jobs first.
Each pilot must preserve silhouette, facial identity, limb count, paper
material, palette, clean chroma background and a seamless first/last-frame
connection. Only then should the remaining 32 jobs be produced.
