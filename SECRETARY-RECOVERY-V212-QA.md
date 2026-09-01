# Secretary Recovery v212 — one Shadow surface and a personal 30-day experiment

## Outcome

The Today screen now has one visible owner for support: the Shadow card. It chooses one timely
offer and keeps manual alternatives behind a collapsed **Other support** disclosure. Recovery,
Attention, evening close and Jarvis nudges no longer compete as separate cards.

This release also starts an owner-only private 30-day dogfood experiment. Its question is deliberately
small: does one timely return help the person resume a meaningful next step? The experiment is
not a new destination, checklist, score, streak or reward system. It is projected through the
same Shadow surface and stores only the evidence needed to answer that question.

## Arbitration contract

The visible offer has this priority:

1. an active Attention or browser boundary;
2. a known unfinished return after an Attention episode;
3. a configured evening boundary that is currently due;
4. a personal-experiment prompt or feedback request;
5. the one nudge already selected for Today;
6. a neutral fallback.

A closed day suppresses proactive work offers. It does not remove non-work support. Manual
recovery, evening close and Attention setup remain available inside **Other support**, collapsed
by default.

## Personal experiment contract

- The person opens setup explicitly from **Other support**, then chooses **Start 30 days** or
  **Not now**. A missing experiment never steals the primary slot. The interval is exactly 30
  calendar days, inclusive.
- A quiet day is never diagnosed as a failure or disappearance.
- Morning recovery appears only between 05:00 and 13:00 after a known escaped Attention episode
  recorded on the previous local day and still awaiting return. A stable per-day check-in makes
  accept/dismiss idempotent and prevents the same offer from reappearing.
- Recovery proposes one small return step; it does not create a task, alter goals, mint XP or
  gold, change a streak, or apply a penalty.
- Feedback appears only after the exact accepted return has recorded `returnedAt`; an unrelated
  publish, browse or rest episode cannot trigger it.
- Closing feedback requires one answer — **better / the same / worse**. Enjoyment, regret and
  whether the chosen boundary held are optional details and may honestly remain unknown.
- Every check-in stores a sequence, source offer reference, recovery-plan reference, offer
  outcome, boundary answer and the three feedback dimensions. Accepting an offer keeps the
  boundary unknown; `returnedAt` proves a return but does not invent whether the chosen boundary
  held. URLs, viewed content and page titles are rejected.
- Reviews appear on days 7/14/21. The final sheet appears only after the full inclusive day 30,
  so a recovery opportunity on day 30 is not displaced. Reviews show known/unknown denominators,
  current and baseline return medians with both sample sizes, after-effect, regret and boundary
  counts. Fewer than five known answers are explicitly labelled calibration rather than a result.
- The local UI has no delivery ledger. It therefore reports **decisions** (accepted/dismissed),
  not a fabricated count of seen offers; `offers.offered` stays `null` until the safe server
  Router can project atomic delivery evidence.
- The final denominator includes every elapsed day. A quiet day remains unknown instead of
  disappearing from the result.
- The experiment record lives in `settings.secretary.experimentV1`; it has no public profile
  projection and is included in the user's normal data lifecycle. Setup names the stored return
  time, answers and personal boundary snapshot (sleep/day limits), and explicitly excludes links,
  pages and viewed content.
- Writes merge through `Store.updateNow` against the latest settings snapshot. One busy fence
  disables sibling actions and feedback fields during persistence. Feedback is keyed to the exact
  accepted date/episode, so returning after midnight cannot lose or misattribute the answer.

## UI and accessibility

- One `.secretary-primary-offer` owns the changing primary state.
- The primary region uses polite status semantics; the disclosure uses native `details/summary`.
- Controls keep the product touch-target tokens and collapse to one column on narrow screens.
- Experiment motion is finite and disabled by `prefers-reduced-motion`.
- All authored strings have RU, EN, DE, UK and ES rows.

## QA completed locally

- JavaScript syntax: PASS.
- Focused Secretary contracts: **28/28 PASS**. The suite includes executed numeric fixtures for
  denominators/sample sizes, an exact cross-midnight episode, and two concurrent sibling decisions.
- Events/Router/server contracts: **33/33 PASS**. The live-server morning case derives its local
  day and timezone from the actual test clock, so the gate remains deterministic after 13:00 and
  does not expire when the calendar advances.
- All `secretary-*` suites: **83/83 PASS**. Full `npm test`: **1305/1323 PASS**; all 18 remaining
  failures are absent sparse art/font/audio files tracked in `origin/master` but not materialized in
  this isolated checkout. No functional or Secretary failure remains.
- Live desktop browser QA: one primary Shadow region, no legacy sibling cards, **Other support**
  remains open across the 10-second extension heartbeat, and the active experiment persists.
- Responsive/touch/reduced-motion contracts: PASS. The current embedded browser surface does not
  expose viewport emulation, so this final patch does not claim a new manual 390×844 screenshot.

## Router integration gate

The deterministic event/Router engine is integrated only after these invariants hold:

- malformed events and invalid time input fail closed;
- a Router offer has one channel, not several competing channels;
- an offer is claimed atomically on the server before presentation;
- `dayClosed` participates in selection;
- event payloads survive normalization without silent loss;
- private content is never copied into event payloads or assistant explanations.

The exact API and rejection cases are fixed in
[`SECRETARY-ROUTER-V212-INTEGRATION.md`](./SECRETARY-ROUTER-V212-INTEGRATION.md).
