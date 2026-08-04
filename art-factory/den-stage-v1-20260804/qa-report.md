# Den Stage v1 — QA report

Date: 2026-08-04
Result: PASS

## Automated

- `public/app.js`: syntax PASS.
- `public/den-stage-v1.js`: syntax PASS.
- Full repository Node suite: `14/14` PASS.
- Deterministic allocation: three entities receive three unique slots.
- BODY-toad + Fortune Cat footprints: no overlap.
- Input order does not change the guardian reservation.
- Fourth pet is intentionally omitted when all three room places are occupied.
- Service worker contains `den-stage-v1.js` and uses cache `satoru-v92`.
- Index and CSS use the `20260804-den-stage-v1` cache-busting version.

## Browser acceptance

Checked against a complete local copy of the application with demo user X7.

### Desktop

- coherent room: `1038 × 583.875`;
- Traveller: `243.3 × 364.3`;
- BODY guardian: `159.4 × 159.4`, slot `mid-east`;
- other pets: slots `west` and `east`;
- no entity overlap at rest;
- approach is visible before contact;
- mirrored pair preserves Traveller-left / guardian-right relationship;
- pair is grounded on the rug and no longer fills half the room.

### Mobile `390 × 844`

- room: `364 × 204.75`;
- BODY guardian: `55.9 × 55.9`, same `mid-east` slot;
- pair: `130 × 130`, same world percentages as desktop;
- no orientation-specific offsets;
- fixed bottom navigation does not cover the scene;
- pet art viewports are all `190 × 190` in the one-column layout.

### Runtime health

- Browser console errors: `0`.
- Browser warnings: `0`.
- Reduced-motion fallback retains static positions and atomic contact.

## Visual finding fixed during QA

The first candidate still appeared to teleport because the source pair frames
placed the two actors on opposite sides. Visual browser QA exposed this; the
complete pair frame is now mirrored as one atomic image.
