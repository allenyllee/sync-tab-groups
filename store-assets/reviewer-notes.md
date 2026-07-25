# Reviewer notes and test instructions

No account, login, payment, external service, or test credential is required.

## Core workflow

1. Install the extension and open two or more ordinary web pages.
2. Open the extension popup.
3. Use the add button to make the current window a named group.
4. Open another tab and confirm it appears in the group.
5. Pin a tab and confirm it remains associated with that group.
6. Create another group, then switch between the groups.
7. Open the full group manager from the popup to search and move tabs.

Closing or switching a group closes its ordinary browser tabs by design. The
group can then be restored from the popup.

## Backup workflow

1. Right-click the extension toolbar icon.
2. Choose the manual backup action.
3. Confirm that a timestamped JSON file appears under
   `Downloads/sync-tab-groups/backups/`.
4. The Preferences page also lets the reviewer configure scheduled local
   backups and export selected groups.

## Browser restart

After creating at least one group, close and reopen the browser. Open the popup
and verify that the saved group list and its window association are restored.

## Privacy and network behavior

All executable code is included in the uploaded package. The extension does not
send tab data, group data, identifiers, analytics, or telemetry to the developer
or third parties. GitHub and documentation URLs are opened only when the user
clicks a help, source, privacy, or support link.

## Compatibility note

The Chrome package targets Chromium 121 or later and uses a Manifest V3 service
worker. The project is tested primarily with Brave, which uses Chromium's
extension APIs; the same Chrome package is submitted to the Chrome Web Store.
