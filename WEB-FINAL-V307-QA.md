# Web acceptance — v307, 28.09.2026

Published runtime: **v307 / `dd3c903`**, Railway `bdffc55b-4f21-406f-a9b1-dde5cf719c51`
SUCCESS. Both domains confirmed 28.09 09:02 UTC; five shell files SHA-256 **10/10**.
Chromium/WebKit production login: no page errors. Existing synthetic SW client
updated from v306 to v307.

Base: v306 / `147c030`. Codex web lane only. Senku integration is explicitly
excluded by the owner; Attention extension and its installer remain Claude's lane.
This document does not certify App Store readiness or physical-device behavior.

## Было → стало

- Achievement notification/unlock preceded an unawaited write → the notification,
  sound and local unlock follow a confirmed write. Concurrent checks share one
  operation; a lost acknowledgement retries the same timestamp. Account/epoch
  fences prevent a late receipt appearing in another account. Title/rank are
  translated; the receipt no longer uses platform trophy emoji.
- Focus PiP used a separate system font, 11px truncated title, icon-only buttons
  and Russian status → shared loaded font/theme, wrapping 14px title, 44px labeled
  controls and translated focus/break/remaining status. Default window 300×220.
- More's closing sheet could intercept Escape before helper initial focus → it is
  disposed before opening the helper; immediate Escape closes the visible helper.
- First-result primary action had 2.99 contrast in light mode → correct on-accent
  token. First-result/Board small headings have a 12px floor. Task duration and
  provider links receive 44px touch targets. Chart values have a solid backing.
- A video button without an image could have 4.27 contrast → solid dark backing.
- Den editor forced four theme/three furniture columns even beside the tablet
  sidebar, breaking German names into fragments → adaptive column counts with
  enough space for both preview and label, also checked at 768/1024.
- Day observation interpolated stored Russian sphere names in other languages →
  standard sphere names pass through the existing translator; custom names remain.

## Integrated candidate checks

`node --check public/app.js`, `node --check public/sw.js`, `git diff --check`: PASS.
Full `node --test --test-concurrency=2 scripts/*.test.js`: **3179/3179 PASS**,
no skips, final run 51.2s after the Den grid repair.

## Evidence and boundaries

Only isolated synthetic users on port 52000, DATA_DIR `qa-data`. Local raw evidence
and executable browser checks: `work/final/` (not committed; no real-user data).

| Promise / scope | Evidence | Status / practical boundary |
|---|---|---|
| R05: help/boundary → action | v301 manual boundary failure/retry/readback; v307 planned offer refusal/retry opened the exact task, completion confirmed on fresh load; stale task rejected | PASS synthetic flow; real AI quality not inferred |
| R05: 30 days with Shadow | v301 persisted status/exit/export; v306 owner-approved launch deferral preserves history | DEFERRED by owner, not a working new-run feature |
| R05: Board → order → progress → result | ROUTES-R05-V301-QA.md: accepted/completed/custom orders survive reload; current full-suite regression | PASS bounded scenario |
| R06: chest and bond | v301 chest lost-response replay; v302 daily care; v306 atomic Entry completion/undo/retry | PASS, see respective QA receipts |
| R06: all Shadow thresholds | `stages.cjs`: 5→6, 19→20, 49→50 in Chromium/WebKit; refusal retains prior stage, repeat unchanged, reload preserved; next-day care grants once | PASS synthetic persisted state, reduced motion |
| R06: streak and achievement receipt | `routes.cjs`: seven saved activity days, one award timestamp after reload/next morning; `receipts.cjs`: five-language refusal/retry notices; `achievement-lost.cjs`: real server commit then dropped response, retry/readback retains timestamp | PASS tested receipts; no claim of an atomic server-wide transaction across every legacy achievement source |
| 04: habit daily cycle | v302/v306 habit create/check/undo, refusal/replay, pause/resume/reload/next day; v307 dense/empty matrix and five-language editor draft/Escape | PASS synthetic scenarios |
| 06: navigation/settings | v303 search across five languages; v306 More→settings→search result→theme save→reload→Today; v307 immediate helper Escape and real WebKit light/dark navigation | PASS; device VoiceOver remains external |
| 07: secretary | Planned transport refusal/retry/action/readback; exact-target prepared dialog (planned/return) and evening dismissal at 375/1280 × five languages; evening planning opens tomorrow; ready→plan→refused write→retry→persisted closed day. Server/client suite covers acceptance, stale links, claim ownership, delayed responses and account switch | PASS combined browser + transport evidence; return dialog probes do not masquerade as new live after-lapse delivery runs |
| 08A: three tastes | `inspiration.cjs`: interiors, nature, sport edits configured in UI, saved and reloaded independently. Interiors and sport returned an honest empty state; nature returned two loaded Pinterest images, one labeled AI collage | PARTIAL: persistence works, catalogue coverage does not satisfy all three tastes |
| 08B: real viewer | `viewer.cjs`: actual image loaded; Escape removes dialog/restores opener; failed image load offers explicit source fallback. TikTok timed out, removed iframe and showed source fallback; no playback receipt observed | PARTIAL / provider playback not verified |
| 09: Den | Existing saved-light refusal/retry/readback plus v307 empty/dense routes and screenshots at 375/768/1024/1280 in Chromium/WebKit, reduced motion | PASS web layout; not physical iPad evidence |
| 10: mixed importer/locales | `import-habit.cjs`: sphere/level/goal/null proposal rows, invalid metric blocks Apply, source JSON retained, error labels localized, Escape; achievement receipt in RU/UK/DE/EN/ES | PASS affected paths; not a claim that every historical admin label is translated |
| Design C01–C14 | 22 routes × dense/empty × five languages × 375 dark /1280 light = 440 states per engine; 880 total, no horizontal overflow or page errors. Focus window tested separately at 300×220, five languages/two themes. Representative screenshots inspected | PASS measured web surfaces; manual aesthetics, content rights, native exports are separate gates |
| 11/native | Build 9 existing native QA is the baseline. No owner confirmation of failed .ics/archive/PNG export was received; no WKDownloadDelegate change made | DEVICE GATE, not a reproduced native defect |
| 12/release | Shell/cache and active pins v307, node checks, diff check, integrated suite; deployment/hash receipt appended after publication | PASS web deployment; external launch gates remain |
| 13/Family Controls | Separate native release after first free launch; chess contract owned by Claude | DEFERRED, no work claimed |

### Visual audit interpretation

The first WebKit bulk fixture switched themes and moved route DOM in the same
evaluation; it reported stale inherited colors. Real settings-button transitions
passed in both directions. The harness now lets the selected theme paint before
installing the next fixture. Experimental production workarounds were removed.
The remaining actual video-button contrast finding was repaired and the Shelf
matrix rerun. Hidden screen-reader labels/private admin chips/user content are
not silently classified as failed user-interface copy. Expanded sphere pickers
are excluded from the bulk disclosure-opening pass; their popup can cover the
screen by design. This audit is not a contrast measurement of text over every
possible third-party image.

## Release gates still requiring an owner or outside evidence

1. Inspiration product decision: personal links/preferences first, public catalogue
   after licensed supply (recommended), or retain limited web catalogue and keep
   App Store blocked. Asked in this session; no replacement rights assumed.
2. Native `.ics`, archive and week PNG receipts on the owner's Mac/iPhone; iPhone
   VoiceOver/PWA/share/calendar checks. Implement export repair only after confirmation.
3. Apple age rating, content rights, privacy/tracking declarations and trader status;
   owner decisions and final submission. Existing store metadata already qualifies
   AI availability; no new paid/provider promise added here.
4. Extension store ID/Brave/live-site/lock receipts remain Claude/owner items.
5. Senku is another Codex session's scope. It is not a blocker for these fixes.

Web bug fixes can ship independently of these gates. The first free App Store
release must not be marked accepted on the strength of a web deployment alone.
