# Sphere controls and shared visual cleanup — v280–v281

Final visual follow-up v281: the generic AI close button had a 27×19px inherited
target. It is now 44×44px with heading clearance. Final evidence waits for the SVG
mask resources, so screenshots distinguish asset loading from actual missing icons.
The final full suite is repeated on v281, after this correction and its cache bump.

## Result and contract

R02B is implemented. Settings exposes persistent labels for color, name and parent,
44px reorder/collapse/delete controls, and an explicit parent-shade checkbox.
The new pure `SphereColorsV1` resolver preserves existing explicit hex colors by
default. Optional `skill.colorMode: 'auto' | 'manual'` records an explicit choice;
new areas start automatic. Changing the color makes it manual. Automatic child
shades derive recursively from the parent, distinguish adjacent siblings (six-tone
cycle), and remain distinct for black/white parents. Name/path remain the primary
identification channels. Derived hex colors are persisted through the existing
Settings autosave, so existing chart/task consumers read the same colors.
No data migration or server owner change; existing skills remain manual unless
the user explicitly selects inheritance. Choosing inheritance replaces that color.

The formerly tiny recovery dot/emoji is a labeled yes/no control with an explanation:
it disables that sphere's overload warning; records, XP and rewards do not change.
The actual load formula is unchanged and remains R04A work. The switch now awaits
Store.updateNow, disables repeat clicks and applies the new state only after the
existing owner confirms the write. Failure preserves the old state and permits retry;
an account/epoch fence rejects late completion after logout.

R03 is partially advanced, not completed across the app: settings controls, domain/
project labels, recovery control/header, Notes→Goal, stuck-task AI action and the
generic weekly AI modal now use registry icons/plain labels. Loading and weekly
modal copy is localized; user text is untouched. The unsupported quiet-sphere→
“pet in the Den, visit if you want” branch no longer displaces relevant day copy.
The mobile primary navigation wraps long labels instead of ellipsis. Settings cards
use the actual light/dark surface token. No new font family: actual Russo One title
and system UI body loading were inspected, including Cyrillic/Latin glyph smoke.

## Checks

- Synthetic local accounts only; no real user records or model requests.
- UI color inheritance, existing manual sibling preservation, explicit override,
  subsequent parent change and server readback/reload PASS.
- Real recovery write: pending state, delayed 503, retry, server readback and reload
  PASS. Unit cases also cover repeat activation and account switch while pending.
- Chrome + WebKit × RU/EN/DE/UK/ES × 375/1280, settings and recovery controls: no
  page overflow, clipped recovery labels or undersized changed controls. Light/dark
  screenshots visually inspected; reduced-motion and text contrast checked.
- AI UI uses intercepted synthetic key availability and response: pending/error/
  close, registry icons and 375px layout PASS. No cloud inference was called.
- Six new behavior tests: three color and three recovery persistence cases.
  Final full suite: **3094/3094 PASS**, zero skipped; syntax and diff checks PASS.
  Deployment receipts are recorded in the release checkpoint.
- Evidence/harness: release plan `work/spheres/`, not the public repository.

## Remaining

R03 still needs the dense Today composition/art sizing and remaining screen consumers.
This is not a new global typography design. R04 retains responsibility for truthful
progress/load semantics, crowded chart labels, weekly AI timeout/cancel/late-response
lifecycle and export. R05/R06, native device checks and release gates remain open.
