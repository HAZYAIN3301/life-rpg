# Traveller female F2 — production prompts

This file is the reproducibility record for the 37 authored expansion frames
in `PRODUCTION-INVENTORY-F2.json`. All are now produced, QA PASS and manually
reviewed; these prompts remain the immutable regeneration contract rather than
a queue of pending work.

## Immutable identity block

Always attach this exact identity reference first:

`sources/identity-variants-04/candidate-f2-high-ponytail-keyed.png`
SHA-256 `5d811618fc851eec48eb910c7efc98eec46e23a94919b376d3c64f5ae24d62da`

> Reproduce the exact approved F2 young-adult female Traveller. Preserve her
> face, two isolated solid-black oval paper eyes with no sclera, iris, pupil,
> highlight, lashes or enclosing eye shape; high long dark-brown adventure
> ponytail with the same tie point and two face-framing locks; narrower
> shoulders, defined waist, coat flare and fuller athletic hips/thighs. Keep
> the exact teal-and-ochre coat, cream shirt, rust scarf, charcoal cropped
> trousers, gloves, boots and brass goggles. Preserve Satoru's layered matte
> cut-paper construction, visible fibres, edge depth, restrained lighting and
> cartoon proportions. No backpack, lantern, straps, pouch or added equipment.
> Do not age, infantilise, sexualise, slim down, shorten or loosen the hair, or
> introduce anime eye whites, painterly rendering, glossy 3D or SVG drift.

Every frame also attaches the exact male choreography reference recorded in
the JSON ledger. It controls pose, actor positions, scale hierarchy, props,
contact, occlusion, camera and phase — never the female identity.

## Technical output block

> Produce one complete full-resolution character or atomic pair plate on a
> perfectly flat edge-to-edge `#FF00FF` technical field. Keep generous clear
> padding. No room, floor, furniture beyond an explicitly referenced held prop,
> caption, logo, UI, cast shadow, gradient, unrelated particle, cropped actor,
> detached anatomy or extra limb. The factory creates real alpha and canonical
> placement; do not bake runtime offsets into the drawing.

## Sequential edit rule

For the first frame of a continuity group, attach F2 plus its matching male
reference. For each later frame, attach:

1. F2 identity;
2. the immediately previous **accepted female** phase;
3. the matching male phase.

> Edit the previous accepted female phase only as required by the matching
> male choreography. Preserve camera, group scale, background field, costume,
> face, ponytail construction, pet/Shadow identity, props and all anatomy that
> does not move. Never mirror a phase and never regenerate a later phase from
> F2 alone.

## Core and workshop gap

### `female-poses-f2-full-01`

- `seated`: use `male/poses/seated.png`; author a complete relaxed seated body
  with clear invisible-seat contact, natural hands, complete legs and boots.

### `female-room-f2-full-01`

- `bench-rest`: use the male frame; no furniture in the plate.
- `bench-portal-reach`: edit accepted `bench-rest`; preserve the lower body and
  seat alignment while matching the male reach direction and hand geometry.
- `bench-read-b`: edit approved female `bench-read-a`; preserve body, journal,
  lower-body alignment and camera, changing only the authored page-turn/gaze
  beat shown by the male B reference.

## Atomic pair block

Append this to every guardian or Shadow request:

> Create one indivisible Traveller-plus-companion plate. Replace only the male
> Traveller morphology with approved F2. Preserve the companion exactly,
> including its silhouette, expression, costume, material, scale and state.
> Preserve the reference choreography, hand/paw/body contact, prop placement,
> overlaps and foreground/background occlusion. Never create two stickers for
> later assembly and never hide a failed contact behind particles.

## Gamabunta groups

All matching references live in `public/art/pets/body-toad-v1/pair-v4/`.

- `train-low → train-high`: retain one squat/mobility loop; move only the
  joints and Gamabunta coaching beat required by the two references.
- `whistle-a → whistle-b → whistle-c → whistle-d`: retain exact four-phase
  shadowboxing/whistle continuity, including only action marks already present
  in the reference.
- `pushup-down → pushup-up`: keep floor contact, hand spacing, foot placement
  and Gamabunta's coaching position stable across the cycle.
- `stretch-a → stretch-b`: preserve the physical assisted-stretch contact;
  hands may not float or pass through a limb.
- `rest-contact → rest-pet`: preserve the authored touch progression and both
  grounded silhouettes.

## Katsuya groups

Use the exact active references, not the older concept sources.

- `greet-contact`: preserve the quiet greeting and complete slug/Traveller
  contact from `pair-v2/greet-contact.png`.
- `breathe-in → breathe-out`: keep both actors, camera and placement stable;
  change only the paired breathing phase. Any broad authored breathing motion
  belongs to the actors, not a new scene background.
- `restore-contact`: preserve the single sustained recovery contact.
- `stretch-a → stretch-soft-b-v155`: first use
  `pair-v2/stretch-a.png`, then edit against the active corrected
  `pair-v3/stretch-soft-b-v155.png`. Never use quarantined
  `pair-v2/stretch-b.png`.

Katsuya plates remain `1536×1536` and follow the exact active reference
composition frame by frame; do not force the Gamabunta ground/bbox geometry.

## Mister P groups

All matching references live in
`public/art/pets/resources-penguin-v1/pair-v1/`.

- `greet-contact`: preserve the formal greeting contact.
- `budget-point → budget-reserve`: keep ledger/plan placement and pointing
  direction coherent; phase two is an edit of phase one.
- `count-pass → count-place → count-stack`: keep the same coins, hand/paw
  scale, tabletop implication and actor positions while advancing the exact
  pass/place/stack sequence.
- `reserve-offer → reserve-accept`: preserve the same offered resource and
  continuous handoff contact.
- `focus-work → focus-check → focus-nod`: hold the work surface, book and
  camera stable; advance only work/check/nod.
- `close-stamp`: preserve the exact closing stamp action and prop contact.

No coin, book, ledger, stamp or hand may appear/disappear between adjacent
phases unless the matching male reference explicitly does so.

## Shadow forms

Generate in evolution order:

`attune-spirit → attune-guardian → attune-keeper`

Each request uses the matching file under
`public/art/companions/shadow-den-v1/pair-v1/`.

> Preserve the exact Spirit, Guardian or Keeper form; never fall back to Spark
> and never interpolate one form into another. Replace only the Traveller with
> F2 while keeping the reference hand relationship, gaze, scale hierarchy,
> centre and action silhouette. Semantic violet belongs to the Shadow and must
> survive matte extraction. The surrounding technical field remains flat
> `#FF00FF`; do not add glow clouds as a substitute for physical contact.

## Rejection gate

Reject before factory processing if any frame changes F2's age, eyes, face,
ponytail, figure, costume or paper family; alters a companion; breaks a
multi-frame prop/contact path; substitutes a different reference version;
contains a non-uniform key field; or makes the action understandable only from
its filename.
