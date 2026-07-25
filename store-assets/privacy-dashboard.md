# Chrome Web Store privacy form

Use the following text in the **Privacy practices** tab. Recheck it against the
dashboard wording before submitting because Google may rename fields.

## Single purpose

Organize the user's browser tabs into persistent groups that can be searched,
closed, restored, moved, exported, and backed up, including preserving pinned
tabs within their groups.

## Permission justifications

### `tabs`

Required to read the URL, title, favicon, position, active state, and pinned
state of tabs and to create, activate, move, pin, discard, or close tabs when the
user manages and restores groups.

### `storage`

Required to store group definitions, tab metadata, extension preferences,
scheduled-backup settings, and user-controlled local backups in browser-local
extension storage.

### `sessions`

Required to attach a group identifier to its browser window so the extension can
restore the correct group-to-window association after service-worker suspension
or a browser restart.

### `downloads`

Required to create JSON exports, manual and scheduled backups, and diagnostic
logs when the user invokes or configures those features.

### `notifications`

Required to report completed operations, recoverable problems, update
information, and errors that need the user's attention.

### `contextMenus`

Required to provide user-facing commands for moving tabs, managing groups, and
creating a manual backup from browser context menus.

### `unlimitedStorage`

Required so large tab collections and user-configured local backup histories do
not fail at the normal extension-storage quota.

### `alarms`

Required to run user-configured automatic backups and periodic reliability
maintenance after a Manifest V3 service worker has been suspended.

## Remote code

Select:

> No, I am not using remote code.

All executable logic is packaged inside the extension. External page and
support links are opened only as normal browser tabs.

## Data disclosure

Select:

- **Web history**

Reason: the extension locally handles URLs and page titles of tabs in order to
display, search, close, restore, export, and back up the groups selected by the
user.

Do not select the other categories unless the implementation changes. In
particular, the extension does not collect personally identifiable information,
authentication information, personal communications, location, financial or
health information, keystrokes, mouse activity, or page content.

## Data-use certifications

The current implementation supports certifying that data:

- is not sold to third parties;
- is not used or transferred for purposes unrelated to the extension's single
  purpose;
- is not used or transferred to determine creditworthiness or for lending;
- is not used for personalized advertising;
- is not transmitted to the developer or third parties.

## Privacy policy URL

https://github.com/allenyllee/sync-tab-groups/blob/master/PRIVACY.md
