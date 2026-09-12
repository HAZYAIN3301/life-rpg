# Satoru Attention 0.6.0 — Chrome/Brave submission kit

Prepared 12 September 2026. **Not submitted, signed, reviewed or published.**
No store item URL is known. Do not replace the test download with a guessed link.
Brave installs Chromium extensions through the Chrome Web Store; a separate Brave store
submission is not needed. [Brave's installation instructions](https://support.brave.app/hc/en-us/articles/360017909112-How-can-I-add-extensions-to-Brave).

## Files ready for review

- Upload: `public/downloads/satoru-attention-chrome-store-v260.zip`.
- Manual Chrome/Brave: `public/downloads/satoru-attention-chromium-v260.zip` (identical bytes).
- `release.json`: generated archive hashes and every runtime file hash.
- `../STORE-LISTING.md`: English/Russian listing, single purpose and permission rationale.
- `PRIVACY-DRAFT.md`: source-backed privacy text for owner review/publication.
- `store-icon-128.png`: 128×128 export of the existing extension mark.
- `small-promo-440x280.png`: 440×280 exact-text tile using that same mark.
- `chrome-options-1280x800.png` / `chrome-boundary-1280x800.png`: actual Chrome UI,
  Russian locale and a clearly synthetic configured website; use for the Russian listing.
- `store-assets.html` / `store-assets.json`: editable source, dimensions and provenance.
- Browser QA receipts and screenshots, where present, describe their exact synthetic scope.
  They do not certify the owner's ordinary browser or signed delivery.

Rebuild from the repository root with `node scripts/build-browser-companion-v260.mjs`.
The builder uses a fixed timestamp and sorted runtime allowlist; it does not include tests,
developer documents or this kit in the upload. The manifest keeps the existing four
permissions, exact permanent Satoru host and optional HTTP/HTTPS host access unchanged.

Re-export the deterministic icon/tile with `node scripts/export-browser-store-assets-v260.cjs`
using the same `SATORU_PLAYWRIGHT_MODULE` setup as the QA script. No logo redesign or new
generated art is involved. Review these exact assets before uploading. If the live dashboard
requires a promotional video or a different localized screenshot set, prepare that field
without inventing a public YouTube URL.

## Dashboard fields to enter

Use **Satoru Attention** as the name; productivity is the proposed category. Copy the short
and full descriptions from `../STORE-LISTING.md`. The primary language can be English with
the Russian listing added as a translation. Other runtime UI languages are DE/UK/ES.

Use the single-purpose and per-permission rationales in that file. No remote code is loaded;
the catalog, engine, UI and language tables are packaged. There is no off-device analytics,
history upload, account linking, identity permission, cookies access or native messaging.
The optional host warning is expected. Local processing and the bounded status bridge are
described in the privacy draft; review the current dashboard wording before attesting to
its data-use declarations. Do not describe local session information as nonexistent.

An owner must supply the publisher identity, verified support contact, published privacy URL,
distribution/country choices and account/security details. Complete any account registration
and fee directly. No credentials, payment or owner attestation were performed by this build.

Google's current flow is ZIP upload → listing/privacy/distribution/testing information →
Submit for Review. A prepared ZIP is not a review submission. See [publication](https://developer.chrome.com/docs/webstore/publish),
[listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), and
[privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), checked
12 September 2026. Follow the live dashboard if its required fields change.

## Reviewer instructions (no Satoru account required)

1. Open extension Options. Add one exact website (for example `www.youtube.com`) and approve
   only that host's HTTP/HTTPS access. Saving must report applied rules.
2. Select the saved website in **Check your boundary** and run the test. It opens that real
   site in a new tab; the local entry gate must appear and save a test receipt. If blocking
   fails, the website may load. An existing open time window must be finished before testing.
3. Choose an allowed purpose, enter any required detail/outcome and select one minute.
   Start the window, then verify that expiry returns the active tab to the boundary.
4. Finish the session and verify the next access follows the saved cooldown/daily limits.
5. Optionally enable Browser Protection and accept its separate all-site prompt. A selected
   category must apply immediately. Remove optional access and confirm that status explicitly
   reports missing permission. Restore it using the existing settings action.
6. Reload the extension and its Options page. Rules survive; no heartbeat disconnect is
   shown solely because the MV3 worker sleeps. A changed version invalidates the old test.
7. Open Satoru's public `/browser-companion.html` in the same browser, reload the page, and
   check connection. Only bounded status is exposed; the site list is not sent to that page.

Run on both current desktop Chrome and Brave with an ordinary browser profile before release.
Do not claim mobile Chrome/Brave support from these desktop artifacts.

## Final owner gates

- Review visible store copy and real screenshots; publish the approved privacy text at an
  HTTPS URL and provide the actual support contact.
- Upload with the owner Chrome Web Store account, complete required attestations and submit.
- After approval, record the actual item ID/listing URL. Verify installation in ordinary
  Chrome and ordinary Brave. Only then enable that exact URL as the install CTA.
- Publish a later signed version under the same item ID and confirm N→N+1 installs without
  deleting rules or session state. Manual ZIP Reload does not prove automatic updates.

Apple Developer membership does not sign or publish the Chrome/Brave extension. Firefox,
Safari, Edge and Opera store submission are outside this Chrome/Brave release slice.
