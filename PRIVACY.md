# Privacy Policy for Tab Groups Resurrection

Effective date: July 25, 2026

Tab Groups Resurrection is a browser extension that organizes open tabs into
groups and lets users close, restore, search, export, and back up those groups.

## Data handled by the extension

To provide these features, the extension handles the following information:

- tab URLs, titles, favicons, pinned state, and ordering;
- group names and the relationship between tabs, groups, and browser windows;
- extension preferences, backup settings, and locally generated diagnostic
  logs.

This information may include web browsing activity because tab URLs and titles
identify pages the user has opened.

## How the data is used

The extension uses this information only to:

- display, search, organize, close, and restore tab groups;
- preserve group and window associations across browser restarts;
- import, export, and back up groups at the user's request or on the schedule
  selected by the user;
- show local status or error notifications and generate a diagnostic log that
  the user may choose to download.

## Storage and sharing

Group information and preferences are stored locally in the browser's extension
storage. Export, backup, and diagnostic files are written to the browser's
download location when those features are used.

The extension does not transmit this information to the developer or to any
third party. It has no analytics, advertising, account system, or developer-run
server. Data is not sold, used for advertising, or used for creditworthiness or
lending purposes. No human reads the data unless the user independently chooses
to attach an exported file or diagnostic log to a support request.

## Data retention and deletion

Locally stored group data remains until the user removes groups, clears the
extension's data, or uninstalls the extension. Downloaded exports and backups
remain under the user's control in the browser's download location.

## Permissions

The extension requests browser permissions only for its user-facing tab-group
features:

- `tabs` manages tabs and reads the tab information needed to save and restore
  groups;
- `storage` stores groups, preferences, and local backups;
- `sessions` preserves the association between a group and its browser window;
- `downloads` creates user-requested exports, backups, and diagnostic files;
- `notifications` reports extension status and recoverable errors;
- `contextMenus` exposes group and backup actions in browser menus;
- `unlimitedStorage` prevents larger group collections and local backups from
  exceeding the extension storage quota;
- `alarms` schedules automatic backups and reliability maintenance.

## Limited use

The use of information received from Chrome APIs adheres to the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data/),
including the Limited Use requirements. Information is used only to provide or
improve the extension's single purpose and user-facing features.

## Changes

Material changes to this policy will be documented in the project repository
and reflected in the Chrome Web Store disclosures before a release with changed
data practices is published.

## Contact

Questions and support requests can be submitted through the
[Tab Groups Resurrection issue tracker](https://github.com/allenyllee/sync-tab-groups/issues).

This extension is an independently maintained fork of Sync Tab Groups. It is
not maintained or endorsed by the original author.
