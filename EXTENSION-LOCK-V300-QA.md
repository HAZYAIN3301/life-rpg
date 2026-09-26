# v300 — Satoru Attention 0.9.0: lock without early unlock, block-page motivation, store kit

Owner 26.09: "the ability to lift the blocker is exactly what fails near a relapse — remove it";
lively copy like StayFocusd; motivation instead of a bare block; publish in the Chrome Web Store.
Decisions: no early unlock at all; prepare store + Brave policy (owner submits/installs);
doomscroll chess puzzle and motivation next; iOS Family Controls in the native session.

## Change

- **Lock** (`protection.js`, service worker, options): 7/30/90 days, only while protection is on.
  While locked every loosening is refused by the service worker (`protection_locked`): turning
  protection off, unchecking a category, allowlisting, removing a denylist entry, switching off
  SafeSearch/YouTube Restricted/bypass blocking, enabling or changing Recreation Time. Tightening
  still applies. The lock field is owned by the worker (a page cannot drop or shorten it);
  extending never shortens. Time is credited by observations (30-min alarm, messages): at most
  12 h per observation, nothing for a clock set backwards — a 40-day clock jump buys 12 h. A locked
  adult list ignores Recreation Time, so moving the clock into a pause window opens nothing.
- **Options:** lock card (duration, "no early unlock" confirmation, time left, Shadow's refusal
  lines), loosening controls disabled while locked; «Your reasons» (≤5 lines, local).
- **Block page:** today's attempt number (a count only), Shadow's line for it, one practical tip,
  the person's reasons. Five languages throughout.
- **Store kit** `extensions/satoru-attention/store-kit-v300/`: step-by-step Russian submission
  guide, 1280×800 screenshots RU/EN, updated STORE-LISTING, and a Brave/Chrome configuration
  profile template (force-install, no private/Tor/guest windows, no DevTools for the extension).
- Privacy page 0.9.0 lists the locally stored lock, attempt count and reasons. Package v300.
- iOS: spec for the native session in the external plan (`tasks/13-family-controls.md`).

## Verification

- Extension unit tests 52/52: lock start/extend/validation, each loosening vs tightening, clock
  jump and rollback, 30 honest days finish the lock, locked adult list during recreation, i18n.
- Chromium with the extension (all hosts on a closed local port): enable → lock 30 days →
  disabling and allowlisting refused; a save that tries to drop the lock keeps it; «extend 7»
  keeps 30; options show time left and disable loosening controls (unchecked categories stay
  enabled for tightening); block page attempt 1/2 lines, tip and reasons (RU and EN).
- Web suite 3162/3162.

**Not verified:** Brave on the owner's Mac; the configuration profile (needs the store ID and an
admin password — owner); Chrome Web Store review.
