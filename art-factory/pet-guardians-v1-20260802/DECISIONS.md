# Pet Guardians v1 — product decisions

Date: 2026-08-03
Status: BODY-toad vertical slice implemented; other guardians remain gated

## Canonical life domains

- `Дело / Карьера` and `Деньги / Ресурсы` remain separate canonical domains.
- The product may offer a compact set of canonical domains while users define their own concrete spheres, projects, and practices inside them.
- A guardian belongs to a canonical domain, not to every arbitrary user-created sphere. This keeps the number of visible guardians bounded.

## Body load and recovery

- Physical development and recovery are separate signals.
- The recovery guardian is allowed to derive its state from tasks, habits, load, and `restGapDays`; the user does not need to create a separate visible Rest sphere.
- The system must not reward endless training as uniformly positive health progress.

## Unopened domains

- An unopened domain must not show a starving, neglected, or guilt-inducing pet.
- In the Den it is represented by a calm empty place: an unused bed, nest, wall frame, shelf, perch, sealed token, or another environmental hint.
- This gives room for references and discovery without turning the home screen into a crowd of guardians.

## Customization direction

- Near-term uniqueness moves from combinatorial human-avatar clothing to guardians and the Den.
- Future Den customization may include furniture sets, paintings, tables, chairs, lighting, and a stand displaying equipped gear.
- This is a later workstream and is not part of the current toad concept gate.

## Current gate

- First guardian under visual exploration: BODY-domain veteran battle toad.
- Current output is a five-level resemblance study only.
- No animation, rigging, production alpha extraction, or runtime import begins until one direction is approved.
- Product-owner preference after the first study: battle-toad level 2 (`02-close-homage.png`).
- Level 2 is not yet a universal policy. It is being calibrated against the Recovery slug and Money/Resources penguin before adoption.
- Product-owner decision: use resemblance level 2 as the working direction.
- Level 2 is a design target, not permission to retain the full signature feature bundle. The Money/Resources penguin required a `02b` safety pass: black tuxedo and a pillbox concierge cap replace the source-like colored uniform and bell cap.
- Money/Resources candidate `02c-black-plumage-tuxedo.png` was produced on 2026-08-07 as a single approval gate: the turquoise plumage from `02b` is replaced with charcoal black while the tuxedo silhouette and accessories remain locked. It does not replace `02b` or open runtime production until the product owner approves it.
- The first black-plumage candidate remained too source-adjacent in its facial construction. Five controlled `02d` alternatives were therefore produced without changing the costume, palette, body, suitcase, or material language. Their only design variable is the face: mask, brows, eyes, beak, and small forehead-feather geometry. Selection is documented in `concepts/resources-penguin/SIMILARITY-GATE-02D.md`; all five remain concept-only until one is explicitly approved.
- Final MONEY / RESOURCES approval: `02d-03-old-school-steward.png`. The canonical face has two separate brows and three short forehead-feather tufts. The connected-Y-brow experiment `02e-triple-eyebrow.png` was an incorrect interpretation and is rejected. Static/state/action production is authorized; runtime import still requires its own QA gate.

## MONEY / RESOURCES runtime staging decision — 2026-08-07

- The approved `02d-03-old-school-steward.png` is the canonical MONEY / RESOURCES guardian. No later face variant supersedes it.
- Runtime ownership is the canonical `money` domain only. `work` / career remains separate and never summons this guardian.
- When several user spheres map to `money`, the highest-XP top-level sphere owns the single guardian; duplicate penguins are forbidden.
- Four state plates, twelve solo action plates, one blink plate, and twelve male-Traveller atomic pair plates are production-approved (`29/29 PASS`).
- Runtime may swap complete authored plates only. It must not split the penguin into wearable layers, scale individual parts, or reconstruct hand/prop contact.
- The Den director has a persistent MONEY-focus sequence and longer ambient holds. The guardian waddles on authored alternating steps, occupies a collision-safe east slot, and is hidden only while an atomic pair frame is visible.
- Staging syntax, alpha, canvas, service-worker, domain, slot, and sequence contract tests pass. Live visual QA and deployment are a separate final gate.

## BODY-toad production decision — 2026-08-02

- The first implementation is deliberately limited to the BODY toad. Recovery and Resources remain untouched at refinement.
- V1 ships as four full-sprite state assets plus a deterministic stage-locked breathing loop.
- We do not fake independent forearm motion from the approved flat image. Its front fingers overlap the rear toes, so masking would create duplicated feet or floating fragments.
- The generated hidden core is retained as research. Full limb articulation requires newly authored non-overlapping topology or dedicated interaction poses.
- No Kling dependency is introduced for this idle. Runtime import still requires a separate explicit gate.

## BODY-toad 02c candidate — 2026-08-03

- A less source-specific candidate was requested: no facial scar, no pipe or other mouth prop, and a tied black judo belt replacing the teal waist cord.
- The candidate passes canvas/alpha/safe-area/chroma QA and is stored at `refinement/body-toad/candidates/02c-judo-black-belt.png`.
- It does not replace the production states until visual approval; runtime remains unchanged.

## BODY-toad final visual approval — 2026-08-03

- `02g-short-judogi-high-belt.png` is the approved canonical BODY-toad design.
- Canonical clothing: short white open-chest judogi, diagonally overlapping front panels, high black belt, exposed lower belly; no sumo wrap, trousers, pipe, or facial scar.
- Canonical posture: broad squat with both hands planted on visibly raised knees. The belt must never descend to the groin or knee line.
- The approved candidate replaces `refinement/body-toad/base-alpha.png` and the `calm` state after deterministic normalization to `1024 × 1024`.
- The former pre-judogi state assets are superseded. New `calm`, `thriving`, `strained`, `restoring`, and `idle-breath-02g.gif` assets all use the approved short-judogi design and pass technical QA.
- Work proceeds next to the RECOVERY slug, then the MONEY / RESOURCES penguin. Runtime integration remains closed.

## BODY-toad runtime decision — 2026-08-03

- The product owner explicitly opened the runtime gate for the approved BODY toad.
- The toad is assigned to the highest-XP top-level sphere mapped to canonical domain `body`. This prevents duplicate toads when several user spheres happen to map to BODY.
- Runtime state mapping is deterministic: `hungry → strained`, `growing → calm`, `full → thriving`, `overfed → restoring`.
- The four authored state PNGs are decoded before a cross-fade. The calm state uses the approved seamless deterministic breathing GIF.
- Three finite interactions ship in the first vertical slice: greeting, joint warm-up, and resting together. The toad and human avatar react in one timed state machine.
- This first slice used fixed male/female complete-pose drafts. It is superseded by the BODY Pair v2 decision below: only the approved male Traveller remains active, and contact uses purpose-built atomic pair frames.
- The runtime uses one world-space Den anchor and scales the entire `1024 × 1024` stage. Mobile orientation must never reposition internal pixels.
- This approval applies only to BODY-toad v1. Recovery and Resources retain their own visual/runtime gates.

## BODY Pair v2 runtime decision — 2026-08-03

- The active protagonist is the approved male Traveller only. The female draft and the old standalone seated pose remain archived but are not selectable, prefetched, or cached.
- Physical interactions are atomic pair frames, never two independently positioned sprites. The runtime canvas is `1536 × 1536` with shared ground line `y=1470`.
- Approved pair frames: `greet-contact`, `rest-contact`, `rest-pet`, `train-low`, and `train-high`.
- Greeting has an explicit fist-bump; rest alternates hand-to-shoulder and hand-to-brow contact while Traveller stays seated on the floor; training alternates two articulated poses as a finite loop.
- Pair assets decode before the standalone characters are hidden. This prevents empty flashes and preserves geometry across mobile orientation changes.
- Kling is not part of this runtime path. Walking and a standalone blink system are a later locomotion/facial-motion batch, not simulated from the flattened pair art.
