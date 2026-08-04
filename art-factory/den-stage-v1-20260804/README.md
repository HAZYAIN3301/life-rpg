# Den Stage v1

Date: 2026-08-04
Status: runtime candidate, QA passed
World: coherent Den v5, `1536 × 864`

## Problem closed by this batch

The Den previously had three unrelated coordinate systems:

1. index-based positions for legacy pets;
2. a hard-coded BODY-toad position;
3. a separate fixed rectangle for complete BODY pair frames.

This allowed the BODY guardian to cover Fortune Cat, change apparent size and
swap sides when a pair interaction began. Traveller locomotion also translated
the actor horizontally without changing depth scale.

## Runtime contract

`public/den-stage-v1.js` owns deterministic stage placement.

- The room remains a locked `1536 × 864` world.
- Every pet receives one named ground-contact slot: `west`, `east` or
  `mid-east`.
- BODY-toad is reserved first because it has the largest footprint.
- Fortune Cat prefers `west`; the BODY guardian prefers `mid-east`; remaining
  pets take a free slot.
- Slot allocation is independent of viewport size and mobile orientation.
- Placement is exported through CSS custom properties. Legacy index classes
  remain as a fallback for non-v5 room themes.
- The window visit interpolates both translation and depth scale (`1 → .86`).

This is deliberately a scripted 2.5D stage, not a physics engine. A cozy room
needs stable occupancy and authored routes, not free collision simulation.

## BODY pair continuity

Before contact, Traveller and the guardian approach the shared meeting area for
`820 ms`. Only after that transition does the decoded atomic pair frame replace
the independent actors.

The approved pair art originally placed the toad on the opposite screen side
from its Den idle. Runtime mirrors the complete pair frame as one unit. This
preserves the side relationship without cutting hands or reauthoring contact.

The pair overlay is reduced from `52%` to `36%` of room width and grounded at
the same rear-floor area. The apparent guardian scale now remains close to its
idle scale while the pair correctly reads as deeper in the room.

## Pet cards

Every species now renders inside the same square art viewport. BODY-toad no
longer spans two grid columns or creates a taller art allocation. Species keep
internal normalization: Fortune Cat uses `94%`, common pets `76%`, and the
BODY guardian uses the full square.

## Honest boundary

This batch does not add the ten domain vignettes, a pet wing, autonomous pet
walking or a generic skeleton. It supplies the geometry foundation those
features require. The next vertical slice remains BODY-domain ambient motion,
followed by MONEY / RESOURCES with Fortune Cat.
