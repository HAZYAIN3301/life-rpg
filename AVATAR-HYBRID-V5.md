# Avatar v5 — volume first, illustrated rendering

08.09.2026. Current direction after the owner rejected v4. This supersedes the
drawn-corrective-view roadmap in AVATAR-DRAWN-RIG-V3.md. Production remains unchanged.

## Exact feedback and decision

The owner rejected the sheet-thin arm, comic-panel appearance and lack of volume.
They explicitly want to try actual 3D in Satoru's illustrated style, not generate
many palm/forearm pictures or redraw animation for every appearance combination.
V1 mannequin and V2 bulky KayKit remain artistically rejected. Do not relabel them
as accepted. Current Traveller, Shadow and den remain the visual reference.

Stop extending the deformed PNG route as the main wardrobe architecture. No mass
sprite generation, no separately generated limbs. New direction: a closed-volume
custom Traveller mesh, common skeleton, modular skinned clothes, illustrated NPR
rendering. A diffuse pigment shader is only one ingredient, not proof of style match.

## Delivered now: arm close-up, not a complete avatar

`art-factory/avatar-wardrobe-v2-20260908/site/volume.html` is a separate study:

- Continuous closed upper-arm/forearm/palm surface, real depth and end caps.
- One THREE.Skeleton with shoulder, elbow and wrist, shared by ten skinned meshes.
- Short rolled sleeve, long fabric sleeve, short sleeve + bracer. These are different
  geometries, not three recolours. Switching them keeps identical bone trajectories.
- Bend, reach and wrist turn; manual pose and −90°…150° view, pause/resume/one-shot.
- Volumetric fingers with a bounded grip pose; prop socket is in the palm.
- Local shared elbow cross-section compensation reduces LBS pinching; no per-outfit
  animation tables. Palm is part of the continuous skin, avoiding a wrist cap seam.
- Matte toon materials, restrained local pigment noise, source-aligned teal/brass/skin
  palette; clay mode exposes the geometry. No new raster generation or paid assets.
- Cropped torso is a support for this study, **not** a proposed headless hero design.
  No face, hair, lower body, authored whole-character sculpture or final textures.

The finite number/closed mesh tests do not establish human anatomy, artistic quality,
natural shoulder mechanics, or correct contact in every pose. Fingers are simple
segmented meshes, not a production hand rig. Pose-specific polish is still necessary.

## Why combinations do not multiply animations

| Component | Author once | Still needs checking |
|---|---|---|
| Skeleton + action library | One compatible skeleton, each action once | Joint limits, contacts, body proportions |
| New jacket | Mesh, UV/material, weights to existing bones | Elbow/shoulder bends, body clipping |
| Hair / hat | Mesh + head attachment, optional secondary bones | Hat/hair collisions and silhouette |
| Held item | Mesh + hand socket / grip preset | Palm/finger contact, long-item collisions |
| Colour | Material parameter / semantic mask | Palette readability and material separation |
| Long cape / skirt | Extra bones or bounded simulation | Action-dependent clipping and mobile cost |

For K ordinary jackets and A actions, the authoring target is K garment bindings +
A clips, not K×A new drawings. **QA still samples combinations**; complex garments
may need corrective shapes/poses. Body morphology can invalidate fit and is deferred.
This is reuse on compatible rigs, not a promise that arbitrary meshes work automatically.

## Revised production sequence

1. **This mechanical gate:** retain thickness through rotation and bend, one motion on
   different sleeve meshes. Compare front/side/clay; reject sheet-like collapse.
2. **Art gate:** create one complete sculpted Traveller based on the existing approved
   silhouette, face, hair, goggles, scarf and proportions. Front/three-quarter/side
   compared against the current PNG in the same den. Not a collection of visible
   primitives and not KayKit with a new colour/outline. One character first.
3. **Illustrated render gate:** low-specular pigment materials, deliberate light/shadow
   shapes, authored textures/normals and selective linework. The character must belong
   with the existing Shadow/den; do not regenerate the world to hide a style mismatch.
4. **Reusable wardrobe proof:** two actual jackets, two hairstyles, one prop; same
   idle/reach/walk/sit clips. Body-region occlusion masks for opaque clothes, corrective
   joint shapes where needed. Do not bake the appearance Cartesian product into sprites.
5. **Runtime choice:** validate mobile WebGL memory/frame cost/offline/fallback. Prefer
   live 3D under the illustrated presentation for combinatorial customisation. Rendering
   3D to 2D is an optional constrained fallback, not the present delivery or a zero-cost
   solution to the combination problem. Any new app dependency requires its integration gate.
6. **Only after visual acceptance:** adapt existing inventory/ownership and durable gold
   purchase, then additional items and companion contacts. No current economy changes.

A skilled character modeller/technical artist may be needed for the complete art gate.
No commissioning, licensing or paid service has been authorised by this experiment.
No promise that this generated code study itself is the final model.

## Evidence and boundaries

- `npm test`: 20/20, including 5 new volume/shared-rig tests, previous 15 retained.
- `node tests/volume-browser.mjs`: 9 grouped scenarios, 27 gesture/garment/pose
  combinations; 10 screenshots, keyboard, invalid batch, pause/resume/one-shot,
  reduced motion, 375px, 200% text and unavailable WebGL; no JS errors/external calls.
- Actual IAB WebMCP: configure long/pose1/yaw90, inspect matching result, invalid outfit
  refused without state mutation. Measured palm cross-section about .1011 scene units.
- Evidence: `art-factory/avatar-wardrobe-v2-20260908/qa-volume-v5/`.
- Visual checks caught wrist end-cap seam and coplanar sleeve/cuff flicker; fixed before
  final screenshots. Style is NOT accepted. Physical Safari/mobile performance not tested.
- No production/public runtime diff; v248, classic v244, account, pets, gold untouched.
- Publishing is the same owner-private Site, new `/volume.html`, old routes retained.
  Published successfully 08.09 at 18:50 UTC (Site version 4); exact provenance in
  `qa-volume-v5/deployment-receipt.json`. Actual IAB route and enabled controls verified.
  [Open owner-private volume study](https://satoru-avatar-wardrobe-lab-sept8.albertprokopets3301.chatgpt.site/volume.html).

Technical references, checked 08.09 (do not confuse library capability with our art QA):
[SkinnedMesh](https://threejs.org/docs/#api/en/objects/SkinnedMesh),
[MeshToonMaterial](https://threejs.org/docs/#api/en/materials/MeshToonMaterial).
