# Integrated native navigation and settings discovery

21 September 2026. Companion native build: 1.0 (7).

- Web navigation is the single navigation surface on Mac, iPad and iPhone.
  The native split sidebar and native top navigation bar are hidden/removed.
  Settings has a visible label; device settings live inside Profile & access.
- Five existing B3 entries remain in a compact Quick actions disclosure.
  Commands use the native EntryInbox contract, never invented web routes.
- Native WKScriptMessageHandler accepts only the trusted main-frame origin.
  Messages allow settings, the five known entries, Apple/Google and five languages.
  App language drives native Copy and SwiftUI locale, persisted in own UserDefaults.
- Available OAuth providers appear on the login screen. Existing linked accounts
  only; new-account OAuth and automatic email merging remain disabled. Biometric
  unlock protects an existing session and still requires one-time opt-in.
- Search indexes cards in all settings groups locally, including closed details.
  Result selection reveals ancestors and focuses the target. IDs derive from
  group and heading, not mutable card positions. Empty query has no suggestions.
- Explicit AI search uses the existing authenticated /api/ai/chat endpoint and
  configured provider/entitlement. Only query and heading catalog are sent;
  no field values or card contents. Responses are restricted to known IDs,
  deduplicated, and never apply settings. Stale/disconnected results are ignored.
  If unavailable, local search remains usable. Live model quality is not verified.

Validation: 3051 web tests pass. One earlier unchanged duo-server test failed
with an HTML response; isolated retry and full rerun passed. Four search unit tests
also pass after final DOM corrections. Native 18 tests, shared contracts, signed
iOS and Mac Catalyst Release archives pass. Browser QA: RU/DE/EN, 375/834/1280,
dark/light, search/no-results/unavailable AI, closed-card focus and native action
messages via a local bridge fixture. Fixture is not a real biometric/OAuth test.
Native release/upload and production receipts are recorded separately.

Launch gates remain: Google Cloud account/project setup, Family Controls approval,
real store screenshots, final privacy labels/consent, seller/legal/payment details.
