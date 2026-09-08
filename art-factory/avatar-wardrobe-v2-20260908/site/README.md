# Satoru avatar wardrobe lab v2

## Current: actual-volume arm study v5

Owner rejected the v4 sheet-thin hand and corrective-image scaling plan. `/volume.html`
tests closed 3D skin/palm, a shared shoulder/elbow/wrist skeleton, three sleeve meshes,
three gestures, actual palm prop socket, camera yaw and clay view. This is an isolated
procedural close-up, NOT a finished hero or accepted art style. No new bitmap generation.
`volume-rig.mjs` owns geometry/rig, `volume.mjs` owns UI; `tests/volume-browser.mjs`
writes `../qa-volume-v5`. 20 unit tests total, 9 browser scenario groups. Previous
routes remain unchanged for comparison. Current production roadmap is the parent
`AVATAR-HYBRID-V5.md`: custom sculpted Traveller, NPR, modular clothes on a common rig.
The old corrective-picture next step below is historical and no longer the plan.

## Historical: rejected forward gesture experiment v4 (08 September 2026)

User liked smoothness/shoulder in v3 but rejected the lateral flexion as unnatural
and not useful. `drawn.html` now defaults to a forward-depth flexion, keeps the old
lateral motion as an explicit comparison, and plays once: lift/hold/return/rest.
It is still a visual experiment. The palm is too compressed edge-on; closed shallow
surface helps but does NOT replace drawn corrective views or an anatomical hand.
Do not say anatomy is solved. No new raster generation in this pass.
`node tests/drawn-browser.mjs` now writes to `../qa-forward-v4`; v3 evidence retained.

## Previous: drawn rig experiment v3

Open `/drawn.html`. This route retains the actual production Traveller PNG and
the den, then uses a dense textured 2D mesh and a bounded two-bone arm blend.
Original pose / animated elbow / manual scrub / side reference / cloth recolour.
It is NOT a complete wardrobe rig. No new coats, hairstyles, grip or walk is claimed.
`drawn-rig.mjs` is deterministic pixel-space deformation; `drawn.mjs` is its Three
renderer and UI. `node tests/drawn-browser.mjs` writes samples to `../qa-drawn`.
One generated grip was rejected for baked checkerboard / missing alpha and is
kept only in the parent repository's `avatar-drawn-rig-v3-20260908/rejected/`.
No generated bitmap is used in this route. No Spine licence or runtime added.

The previous `/index.html` remains as a mechanical reference. The user rejected
its KayKit 3D art direction. Do not promote it to production because its tests pass.

Isolated, local-data-only art/rig experiment. Canonical decisions live in
`AVATAR-WARDROBE-V2.md` in the life-rpg repository; this directory is also mirrored
as a standalone Sites source checkout. Not imported by the production app.

## Run

`npm ci`, then `npm start` (127.0.0.1:4179). `npm test` tests the asset/appearance
contract; `npm run qa` tests the running preview with the installed macOS Google
Chrome and writes evidence to `../qa/`. `npm run build` creates static `dist/`.
Three.js 0.180.0 is pinned; no CDN, account API, telemetry or production inventory.

Before publishing a mirrored checkout, run `npm run build` **in that checkout**.
The packager packages existing dist; it does not replace that build step. Verify
the drawn route and its matching hashes in `dist/build-manifest.json` in the archive
before saving a Site version. Saving again for the same SHA may reuse a prior archive.

## Previous v2 model implementation (does not describe the v5 arm study)

Source GLBs and provenance: `public/models/PROVENANCE.md`. Keep all license files.
The authored 41-bone skeleton drives independently selected upper/lower meshes.
The Rogue face stays the same under all outfits; hats and sword use authored bone
attachments. Colour masks address specific cells in the original palette atlas.
No hand-authored anatomical primitives or procedural petting IK.

`wardrobe.mjs` is the model adapter; `contract.mjs` owns allowed choices and strict
local-save readback; `workbench.mjs` is the renderer, UI and WebMCP adapter.
Preview storage key: `satoru:avatar-wardrobe-lab:v2`; no Satoru data keys are read.
WebMCP exposes inspect, stage and local save as three separate tools sharing UI
actions. Inputs are allowlisted and failures do not report success.

## Do not overclaim

This proves a narrow wardrobe assembly route, NOT production visual acceptance,
a Sims-like creator, free hairstyles/body morphs, performance on physical phones,
pet contact, the Traveller art direction, or gold's motivational effectiveness.
Walking is an in-place preview of an authored cycle, not world navigation.
Skin/hair and scout-cloth colours work; mage/knight cloth colours are not exposed.
Helmet/hair/cape intersections still need artist-level approval across motions.
All three GLBs load at startup (~10.4 MiB); trim/LOD assets before app integration.
Current fixed production characters/pets must remain until the owner accepts art.
