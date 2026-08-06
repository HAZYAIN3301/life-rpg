# BODY Guardian life v4 — QA

Status: **PASS** — 23/23 PNG assets and the 21-frame idle GIF passed runtime QA.

Scope:

- stable 19.2% Den footprint for the approved final toad;
- authored blink, idle loop, hop crouch/air, solo stretch and bench nap;
- male Traveller pair actions on a shared 1536×1536 canvas;
- pair recomposition: Traveller 142–146%; push-up toad 88% to preserve spacing;
- four-frame shadowboxing loop;
- filled portal core, layered rim and complete reach pose;
- deterministic approach/return locomotion for both actors.

The generated sources use a flat magenta production background. `build_motion_pack.py`
removes it with a bounded hue mask and grounds every runtime sprite. `qa_runtime.py`
rejects wrong canvases, missing alpha, opaque corners and surviving magenta fringe.

Automated checks:

- 6 standalone motion frames: 1024×1024 RGBA;
- 13 pair frames: 1536×1536 RGBA, groundY 1470;
- 4 portal/reach assets with transparent corners, including the seated reach pose;
- idle-breath.gif: 21 frames on a 1024×1024 canvas;
- vivid chroma leakage below the rejection threshold for every PNG;
- browser timing audit observed the non-rotating filled portal, seated reach,
  delayed reading frame, pair collision isolation and the Recovery Guardian card;
- hop-tour and bench-nap use directional parabolic routes with stable scale;
- PWA cache generation: `satoru-v101`;
- Node contract suite: 5/5 focused files passed; full project suite: 16/16 passed.
