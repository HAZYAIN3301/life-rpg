# Den Life v1 — QA report

Date: 2026-08-04  
Result: PASS

## Automated

- `public/den-life-v1.js`: syntax PASS.
- `public/app.js`: syntax PASS.
- Snapshot Node suite: `5/5` PASS.
- BODY focus is distinct from other canonical domains.
- Ambient sequence is deterministic and contains three finite actions.
- Every quiet interval is at least `12 s`.
- Failed automatic pair attempts remain retryable.
- Service worker cache is `satoru-v93` and includes `den-life-v1.js`.
- Index loads the director after Den Stage and before the application.

## Browser acceptance

- Desktop coherent Den: all actors retained their Den Stage v1 slots.
- Ambient beat started only after Traveller locomotion finished.
- BODY focus was detected from a real demo task mapped to `body`.
- Automatic pair entered `train` mode and the shell reached the active pair
  state without a manual click.
- Tutorial overlay blocked the background director.
- After the overlay closed, the director remained retryable.
- Mobile `390 × 844`: room `364 × 203.75`, Traveller `85.31 × 127.34`, BODY
  guardian `55.91 × 55.91`; no overlap or orientation-specific offset.
- Browser console errors: `0`; warnings: `0`.

## Visual findings fixed during QA

1. Tutorials initially did not pause background direction. They now do.
2. A failed automatic pair attempt was initially marked as completed. Focus
   sessions are now consumed only after a successful pair start.
