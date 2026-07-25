# Chrome Web Store submission checklist

## Package

- [ ] Run `npm ci`.
- [ ] Run `npm run test:regression`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run release`.
- [ ] Run `npm run test:release`.
- [ ] Confirm `manifest.json` is at the root of
      `release/tab-groups-resurrection-chrome.zip`.
- [ ] Confirm the package version is greater than every previously uploaded
      version.
- [ ] Confirm the production ZIP contains no tests, source maps, secrets, or
      remotely hosted executable code.

## Developer account

- [ ] Complete Chrome Web Store developer registration and identity/account
      verification.
- [ ] Set the publisher display name.
- [ ] Add and verify the developer contact email.

## Store listing

- [ ] Product name: `Tab Groups Resurrection`.
- [ ] Category: `Workflow & Planning`.
- [ ] Paste the English listing from `store-listing-en.md`.
- [ ] Optionally add the Traditional Chinese localization from
      `store-listing-zh-TW.md`.
- [ ] Upload `tab-groups-resurrection-store-icon-128.png`.
- [ ] Upload at least one 1280x800 screenshot, up to five.
- [ ] Upload `tab-groups-resurrection-promo-small-440x280.png`.
- [ ] Set the homepage and support URLs.

## Privacy practices

- [ ] Paste the single-purpose and permission justifications from
      `privacy-dashboard.md`.
- [ ] Declare no remote code.
- [ ] Disclose Web history because tab URLs and titles are handled locally.
- [ ] Complete the Limited Use certifications.
- [ ] Set the public privacy policy URL.

## Distribution and review

- [ ] Choose visibility and countries/regions.
- [ ] State whether the publisher is a trader or non-trader as applicable.
- [ ] Paste `reviewer-notes.md` into Test instructions.
- [ ] Choose deferred publishing if you want to inspect the approved item before
      it goes public.
- [ ] Submit for review.
