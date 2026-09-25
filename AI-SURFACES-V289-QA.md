# R07 — AI lifecycle on the remaining surfaces, v289

Follow-up of R04C (weekly review and chat got timeout/cancel/late-response fencing in
v285). Scope: every other AI request in the app — category suggestion, first step for
a stuck task, day recap, episode, goal/level proposals, personal path map, profile
refresh, onboarding questionnaire, Shadow moment line and Shadow hint phrase — plus
R03B criteria on the dialogs those requests live in.

## Before → after

| Surface | Before | After |
|---|---|---|
| All ten requests | no client timeout: a hung provider kept «Разбираю…/ИИ думает…» until the server gave up (up to 2 min); closing a window did not abort the request; a late answer could fill a form that was already reopened for something else, or reach the next account (profile could be saved from the previous account's facts) | one request per surface through `AiRequestV1`: timeout (20 s category, 30 s step, 90 s recap/episode/map/profile/onboarding, 120 s proposals, 8 s moment, 20 s hint phrase), a new request, closing the window, sign-out or «Cancel request» abort the previous one; answers after that are dropped |
| Day recap, episode, proposals, map | pending text only | pending line with «Cancel request»; timeout/cancel/network notices say the text is kept; run button disabled while pending; focus moves to «Cancel request», then back to the run button or the first result control |
| Stuck-task step | a late answer overwrote the field even if the person had typed their own step | own text is kept; Shadow's step is shown as a suggestion instead |
| Moment line | «…» until the provider answered | ready local Shadow line after 8 s |
| Onboarding analysis | «analyzing» until the provider answered | after 90 s the manual path opens with the text saved |
| Day recap / episode dictation | speech recognition was always `ru-RU` | interface language (`VoiceInputV1.langTag`) |
| Dialogs | proposals and episode were not labelled dialogs; Escape did not close recap/episode/proposals; proposals, recap and category chips were Russian in every language; 🤖 📥 📊 📋 🎒 🎤 ⏹ ⏳ 🎯 ➕ ⚑ 🚩 💡 in controls; episode chips 32px | labelled dialogs with a named close button, Escape closes and returns focus to the opener; all copy in five languages; registry icons; 44px chips and dictation button; chosen chip exposes `aria-pressed` |

## Verification

- Unit: `scripts/ai-surfaces-r07.test.js` (8) — replacement cancels and aborts the
  older request, closed surface and account/epoch change are stale, timeout aborts
  the request and is silent for a closed surface, sign-out cancels everything, every
  `/api/ai/{chat,analyze,propose}` call carries a signal and each surface uses its
  key, dialogs are labelled and close on Escape, dictation is not hard-coded to
  Russian, no system emoji in the touched templates, five-language copy. Updated
  harnesses: `shadow-persona-v260` (moment/hint run through the shared lifecycle,
  same assertions), `stuck-fork-v150` unchanged and passing.
- Full suite 3136/3136 PASS, 0 skipped (non-root); syntax and `git diff --check` PASS.
- Chromium, fake clock and a provider that never answers (EN 375): recap pending →
  timeout at 90 s with the text kept → late answer ignored; «Cancel request» →
  notice, focus on run; Escape while pending → closed, focus back on the opener,
  late answer does not reopen; proposals still pending at 91 s, timeout at 121 s;
  sign-out while pending closes the window; 5/5 abandoned requests aborted at the
  network level (`net::ERR_ABORTED`). DE: moment line falls back after 8 s; editing
  the task title aborts the category request; category timeout at 20 s in German.
- Dialog audit (recap, episode, goals, levels, map, category chip; open and result
  states): 0 emoji, 0 untranslated text/attributes, 0 targets <42px, all labelled
  dialogs, Escape closes — EN 375 dark and 1280 light, RU 375, DE 1280 dark, UK 375,
  ES 375; 0 page errors.
- Screenshots: RU day recap with result, UK episode, DE goal proposals 1280.

Inspiration was already covered: its requests have their own AbortController, a
20 s timeout and generation fences (`inspirationJSON`, `cancelInspirationWork`).

**Not verified here:** WebKit, real devices, a real provider's slow answers, real
microphone. Timeouts are client-side; the server keeps its own 120 s provider limit.

## Publication

`4af8474` on master 25.09; both domains report it with `satoru-v289` at 12:31 UTC;
12/12 SHA256 matches against the commit (app.js, design-next-v1.css, index.html,
sw.js, styles.css, ai-request-v1.js × 2 domains); login page loads the v289 shell
without console errors.
