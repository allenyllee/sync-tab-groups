# Chrome Web Store assets

This directory contains the text and image assets for the independent
`Tab Groups Resurrection` Chrome Web Store listing.

## Published listing

- Store page:
  [Tab Groups Resurrection](https://chromewebstore.google.com/detail/tab-groups-resurrection/bmjkpeefoomkdgodlecgdjjgdkoldofj)
- Extension ID: `bmjkpeefoomkdgodlecgdjjgdkoldofj`
- Initial published version: `1.0.0`
- Confirmed publicly available: July 28, 2026

- `store-listing-en.md`: primary English listing copy
- `store-listing-zh-TW.md`: Traditional Chinese localization
- `privacy-dashboard.md`: single-purpose, permission, remote-code, and data-use
  answers
- `reviewer-notes.md`: reviewer test instructions
- `submission-checklist.md`: final manual submission steps
- `automated-publishing.md`: GitHub Actions and API v2 release setup
- `screenshots/`: 1280x800 screenshots of the actual extension
- `source/`: editable or full-resolution source artwork

All production icon sizes are generated from
`source/tab-groups-resurrection.svg` with `npm run icons:build`. Its
circle-free, asymmetric four-block design is based on the visual language of
the original Sync Tab Groups icon and remains legible in Chromium's small
toolbar slot.

Required final image files:

- `tab-groups-resurrection-store-icon-128.png`
- `tab-groups-resurrection-promo-small-440x280.png`
- at least one image in `screenshots/`

The listing describes this project as an independently maintained fork and does
not claim ownership or endorsement by the original Sync Tab Groups author.
