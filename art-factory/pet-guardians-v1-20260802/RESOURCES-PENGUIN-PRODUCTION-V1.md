# MONEY / RESOURCES guardian — production v1

Date: 2026-08-08
Status: visual production PASS; runtime integration PASS; local live-app visual QA PASS; deployment ready

## Canon

- Source: `concepts/resources-penguin/02d-03-old-school-steward.png`.
- Male Traveller only for pair scenes.
- Whole-character and whole-pair authored frames; no cosmetic overlays and no sliding static PNGs.
- Solo canvas: `1024 × 1024`, ground line `y=920`.
- Pair canvas: `1536 × 1536`, ground line `y=1470`.
- Every production image composites at `(0, 0)`.

## Four shared states

1. `calm` — canonical stern-neutral steward.
2. `thriving` — alert eyes, proud posture, neatly reset tuxedo and a restrained satisfied expression.
3. `strained` — tired eyes, lowered shoulders, slightly slack bow tie and heavy suitcase; no slapstick misery.
4. `restoring` — relieved closed or half-closed eyes, grounded suitcase and relaxed free flipper.

## Solo v1 action pack

1. `blink` — one authored closed-eye frame, used briefly inside long idle holds.
2. `waddle-left` / `waddle-right` — genuine alternating weight shift; suitcase and free flipper counter-swing.
3. `coin-sort-a` / `coin-sort-b` / `coin-sort-c` — unsorted coins become two readable stacks one coin at a time.
4. `stash-open` / `stash-place` / `stash-closed` — suitcase opens, pouch is placed inside, both latches close.
5. `ledger-read` / `ledger-mark` — follows one row and records a result without spawning separate glasses.
6. `jacket-reset` — checks the pocket watch, straightens lapels and bow tie, then returns to calm.
7. `quiet-rest` — rests beside the closed suitcase for a long hold.

## Pair v1 action pack

1. `greet-contact` — Traveller kneels and completes a clear handshake.
2. `budget-point` / `budget-reserve` — both sit at one ledger; Traveller points, the guardian moves one marker.
3. `count-pass` / `count-place` / `count-stack` — one coin visibly travels from Traveller to the correct stack.
4. `reserve-offer` / `reserve-accept` — pouch transfer with both characters touching the same prop.
5. `focus-work` / `focus-check` / `focus-nod` — long MONEY / RESOURCES focus loop at a notebook or laptop.
6. `close-stamp` — both close the ledger and hold the finished result.

## Timing

- Idle hold: 14–32 seconds.
- Solo action hold: 8–24 seconds.
- Pair action: 8–20 seconds.
- Focus loop: 24–40 seconds before repeating another related beat.
- Movement into and out of an action is slower than the contact beat; no teleportation.

## Gates

1. Four state frames and base alpha pass technical and visual QA.
2. Solo frames preserve size, ground contact, identity, suitcase continuity, and prop continuity.
3. Pair frames preserve the canonical male Traveller scale and use atomic shared canvases.
4. Contact-sheet review passes before runtime import.
5. Runtime must reserve a collision-safe Den slot and hide overlapping actors during atomic pair scenes.

## Result

- Four states: `4/4 PASS`.
- Authored blink: `1/1 PASS`.
- Solo action frames: `12/12 PASS`.
- Atomic male Traveller pair frames: `12/12 PASS`.
- Total production images: `29/29 PASS` (the four states include the canonical calm frame).
- Green fringe in final pair frames: `0 px`.
- Runtime staging module: `den-life-v4/public/resources-penguin-v1.js`.
- Canonical assignment: highest-XP top-level sphere mapped to `money`; `work` remains a separate domain.
- Den layout reserves an `east` slot with a `10.8%` footprint; BODY, MONEY / RESOURCES, and RECOVERY occupy three distinct authored anchors.
- Ambient director actions: ledger, reserve stash, quiet rest.
- MONEY-focus loop: budget → coin count → long focus check → reserve → close plan; it continues throughout the focus session.
- Meeting locomotion uses authored Traveller walk frames and alternating penguin waddle frames. Contact uses the atomic `1536 × 1536` pair plates.
- Runtime syntax and all guardian regression contracts PASS.
- Local live-app QA PASS: X7 exposes a separate `Деньги / Ресурсы` domain, renders the guardian in its reserved Den slot, exposes all six pair actions, and loads `29/29` production images over HTTP.
- Existing X7 profiles receive the missing MONEY / RESOURCES sphere through a demo-only migration; real user spheres are never modified.
