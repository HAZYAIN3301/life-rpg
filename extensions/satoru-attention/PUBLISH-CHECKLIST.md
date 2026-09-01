# Satoru Attention v215 — signed store publication checklist

`npm run build:browser-extension` creates three engine packages from one source tree and
the upload aliases below. Every store update must increment `manifest.version`, rebuild,
run the full extension/repository gate and be submitted under the same store item ID.

## Chromium stores

- Chrome Web Store: `public/downloads/satoru-attention-chrome-store-v215.zip`
- Microsoft Edge Add-ons: `public/downloads/satoru-attention-edge-store-v215.zip`
- Opera Add-ons: `public/downloads/satoru-attention-opera-store-v215.zip`
- Brave and Vivaldi use the Chrome Web Store listing; the manual Chromium test package is
  `public/downloads/satoru-attention-chromium-v215.zip`.

For every listing, sign in with the owner account, create the item once, upload the matching
ZIP, complete privacy/permission declarations from `STORE-LISTING.md`, add screenshots,
support email and the public privacy-policy URL, then submit for review. Never invent a store
URL before the listing exists. After approval, add the exact URLs to the public landing-page
release map and verify installation plus an incremented-version update.

## Firefox AMO

Upload `public/downloads/satoru-attention-firefox-amo-v215.zip`. The generated manifest uses
the stable ID `satoru-attention@satoru.app`, Firefox MV3 event-page background, minimum
Firefox 128 and the required `data_collection_permissions.required = ["none"]` disclosure.
Release Firefox requires Mozilla signing; a temporary `about:debugging` install is QA only
and disappears after restart. AMO-listed updates are delivered automatically.

## Safari / Apple App Store

Upload `public/downloads/satoru-attention-safari-app-store-v215.zip` to Safari Web Extension
Packager in App Store Connect, or convert it with Xcode. Test via TestFlight, then submit the
containing app/extension for review. Public Safari distribution requires an Apple Developer
membership and signing. The temporary macOS extension route is QA only.

## Release invariants

1. Permanent host access stays limited to the exact Satoru production origin.
2. Browser Protection requests broad optional access only after explicit opt-in.
3. No remote code, analytics, browsing-history transfer or store-specific feature fork.
4. Store URLs replace only test-download calls to action; test packages remain clearly named.
5. Verify automatic update with two signed versions: install N, publish N+1, request a check,
   close extension pages, and confirm the browser reports/applies N+1 without data loss.
