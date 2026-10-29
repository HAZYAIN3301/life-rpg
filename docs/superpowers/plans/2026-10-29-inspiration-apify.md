# Daily edit supply implementation plan

> Execute inline with superpowers:executing-plans. Owner prohibits subagents.

**Goal:** Automatic finite daily edits by saved interests, played inside accepted B2.17.
**Spec:** Owner29.10 explicitly requests Apify integration after v349 playback approval.
**Architecture:** Server-only Apify metadata inventory, fixed public topic queries;
account-bound signed recommendation records remain separate from licensed catalog.
Existing Profile selector/CAS, history, feedback, refs and exact-ID viewer remain owners.
**Tech:** Node built-ins/CommonJS + existing browser modules; no new dependency.

## Decisions / constraints

- `scrapeforge/tiktok-posts`: public topic search, date-posted/this-month, bounded50 rows;
  no downloads, avatars, covers, comments, followers or transcripts. No private custom
  text/ref descriptions/account/history goes to Apify. Unmapped topics yield honest gap.
- Free provider: one source and one run / rolling24 hours; other topics use cached
  inventory. No promise of fresh acquisition for every account/interest every day.
- Max$0.10/run,$0.20/day,$4.50/month in durable reservations, before POST. Free-credit
  account and owner key entry needed. No payment/subscription; paid cash needs owner.
- Resume recorded run IDs; uncertain POST outcome is not retried. Serialized state,
  single flight, daily query cache, pending/failed/budget states, bounded network bytes.
- Link recommendation is not a content licence. Shared catalog gate unchanged;
  separate signed private candidates, not globally published user reference URLs.
- ≤3 fixed items/day,45-day cooldown, no replacement of nonempty day. Metadata is
  not playback proof. Old source can be newly seen; publication date is not fabricated.
- First load polls pending inventory with abort/epoch guards; failed/pending results
  cannot fix an empty digest as a successful finished day. Old inventory stays usable.
- Same card/player design, no autoplay/next/rewards; saved edit URL still plays after
  rolling metadata expires. Five locales/privacy and v323/v349 supersession docs.

## Tasks / review ledger

- [x] RED/GREEN signed edit schema, metadata relevance, private runtime admission,
  fixed digest/history/reference/feedback, owner spoof/account isolation and save fallback.
  Files: public/inspiration-edit-media-v1.js, server-inspiration-profile-v1.js,
  public/inspiration-supply-runtime-v1.js; scripts/inspiration-edit-media-v1.test.js.
- [x] RED/GREEN Apify adapter/durable run and budget store: no duplicate POST after
  restart/lost response, exact safe input, bounded output, failure/budget/no-key.
  Files: server-inspiration-apify-v1.js, scripts/inspiration-apify-v1.test.js.
- [x] Supply endpoint merges licensed+signed edit rows, validates session/current day;
  client polls only pending same-account attempt. UI keeps existing design and viewer.
  Files: server.js, app.js, return-shelf-ui-v1.js, copy module, existing tests.
- [ ] Owner enters key in Railway (never read it); first real capped run and receipt,
  authentic daily save/reload/player. Confirm actual account/pricing/credit before run.
- [ ] Build/cache350/pins; full source+live+contracts; browser phone/desktop, signed
  iPhone Simulator playback with isolated QA. Docs, scoped commit/deploy, both domains.

Ruling: Reuse current isolated web checkout; base908eafe4 equals fresh origin/master.
Existing .qa-inline-v349 is private local QA data, never staged or overwritten.
No native product changes/remote/push planned. No brainstorming interview: owner has
specified behavior, accepted design/playback and directly asked for execution.

Provider ruling after real pilot: Clockworks Data Extractor returned0 rows because
device registration failed (runQn1zkiaK7sfxCOgbY,charge$0.000). Preserve its reservation.
Use Scrapeforge's compatible metadata, separate method key and rolling24h guard.
Approved$0.10 cap remains unchanged; result$0.30/1000 +start$0.00005/GB. No cash/card.
API Dojo was rejected before a run: Free5/month cannot support daily acquisition.

QA ledger:3434/3434 source,184/184 live, native byte contracts PASS. Dedicated local
QA UI→API→reload, real player started/ended; saved recommendation uses the existing
personal saved-card layout, without a duplicate title or losing Play. Owner-authorized
XCUITest InspirationDaily PASS22:17CET: daily Play/time/source/end, relaunch/Saved Play.
Metadata in this local QA is an explicit provider fixture, not a real Apify response.
Native test credential entry uses Show password for the synthetic fixture because
Simulator's secure typing dropped letters; no product auth/runtime change.
