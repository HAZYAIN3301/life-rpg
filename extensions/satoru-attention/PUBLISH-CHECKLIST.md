# Chrome Web Store publication checklist

The runtime package is generated as `public/downloads/satoru-attention-store-v210.zip`.
Do not upload the user-facing ZIP with its enclosing folder; the store ZIP must have
`manifest.json` at its root.

1. Sign into the Chrome Web Store Developer Dashboard with the owner’s Google account.
2. Complete two-step verification and pay the one-time developer registration fee if the
   dashboard requests it.
3. Create a new item and upload `satoru-attention-store-v210.zip`.
4. Use `STORE-LISTING.md` for the description, single-purpose statement and permission
   rationales.
5. Add real screenshots from the packaged extension, the support email and the public
   privacy-policy URL.
6. In Privacy practices, declare local-only user activity exactly as documented; do not
   claim that no data exists when local policies and sessions do exist.
7. Explain the optional all-site grant: exact-site Attention remains narrow; the grant is
   requested only when the person explicitly enables category/domain Browser Protection.
8. Submit for review. Do not add remote code or analytics while the listing is under review.
9. After approval, put the real store URL in `BROWSER_COMPANION_STORE_URL` in `public/app.js`,
   verify “Add to Brave” and “Add to Chrome”, and release with a new SW/cache pin.

The website must never invent a store URL or present the development ZIP as one-click
installation. On macOS and Windows, ordinary users install signed extensions through the
Chrome Web Store; unpacked loading remains the explicit test path.
