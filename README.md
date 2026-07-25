# Tab Groups Resurrection

Tab Groups Resurrection is an independently maintained, Chromium-focused fork
of [Sync Tab Groups](https://github.com/Morikko/sync-tab-groups), originally
created by [Morikko](https://github.com/Morikko).

It keeps the original workflow of organizing tabs by topic, switching between
groups, and keeping pinned tabs inside their groups. Groups can be closed and
reopened without losing their tabs, and can be searched, moved, exported, and
backed up.

## Current status

- The extension has been migrated from Manifest V2 to Manifest V3.
- The current fork release is `v0.9.4`.
- Chromium-based browsers are the primary maintenance target. Development and
  regression testing are currently performed with Brave.
- Groups, tabs, pinned tabs, window associations, context menus, options, and
  backup scheduling are designed to survive service-worker suspension and full
  browser restarts.
- Firefox builds are still produced, but Firefox compatibility is currently
  best-effort and is not validated to the same level as Chromium.
- Maintenance is intentionally modest: keep the extension usable, adapt it to
  browser changes, and fix practical bugs. There is no large feature roadmap.
- This fork does not currently provide cloud or cross-device synchronization.
- The new name is not yet published on the Chrome Web Store. Until then, build
  and load the extension locally from this repository.

The Manifest V3 migration was developed with assistance from OpenAI Codex and
then validated with automated asset checks, Jasmine unit and integration tests,
and a Brave regression suite covering service-worker and full-browser restarts.

## Install in Chromium or Brave

```sh
npm install
npm run build:chrome
```

Open `brave://extensions` or `chrome://extensions`, enable **Developer mode**,
choose **Load unpacked**, and select the generated `build/chrome` directory.

Run the complete automated test suite with:

```sh
npm run test:regression
```

## Relationship to Sync Tab Groups

The original Sync Tab Groups project ended active maintenance and its repository
was archived. Morikko reviewed this fork and asked that it continue
independently under a different name to avoid confusing users about which
project is active and where to request support.

See the maintainer discussion in
[issue #1](https://github.com/allenyllee/sync-tab-groups/issues/1).

Tab Groups Resurrection preserves the original license, copyright notices, and
project attribution. It is a community-maintained fork and is not maintained or
endorsed by Morikko.

For the history of the original project, see
[The story of Sync Tab Groups](https://medium.com/@Morikko/the-story-of-sync-tab-groups-the-web-extension-for-managing-your-tabs-d40ebb1079ec).

## Contributing

Bug reports and focused compatibility fixes are welcome. Before submitting a
change:

- run `npm run test:regression`
- run `npm run lint`
- avoid regressions to existing group, pinned-tab, and backup workflows
- keep browser-specific behavior isolated so it does not break other targets

## Translation

Translations inherited from Sync Tab Groups are kept in `extension/_locales`.
Translation fixes and new locales can be submitted to this fork with a pull
request. Use `extension/_locales/en/messages.json` as the current source.

## Bugs

If you find a bug, please [open an issue](https://github.com/allenyllee/sync-tab-groups/issues).

## Build

### External dependencies
 - Node >= 20
 - Firefox Dev Edition (if you want to use web-ext)

### Scripts (with `npm run`)
- `test:regression` runs the asset, Jasmine unit/integration, and Brave MV3 regression suites
- `test:brave` runs the Brave MV3 browser regression suite
- `test:jasmine:unit` / `test:jasmine:integration` run the legacy Jasmine suites in Brave
- `build` builds both MV3 targets in development mode to `build/firefox/` and `build/chrome/`
- `build:firefox` / `build:chrome` build one development target
- `watch` watches and rebuilds the Firefox development target
- `build:prod` builds both production targets to `release/firefox/` and `release/chrome/`
- `build:prod:firefox` / `build:prod:chrome` build one production target
- `zip` creates `release/sync-tab-groups-firefox.xpi` and `release/sync-tab-groups-chrome.zip`
- `release` Do the `build:prod` and `zip` commands
- `lint` show only errors
- `clean` Remove the folders `build/` and `release/`
- `firefox:dev` run firefox loaded with the dev extension
- `firefox:prod` run firefox loaded with the production extension

### Difference between mode
1. `process.env.IS_PROD` is only true in the production code, so `Utils.DEBUG_MODE` is true only in the dev code
2. Tests are only built in the dev version
3. Firefox and Chrome use separate MV3 manifests because Firefox still uses a background script while Chrome uses a service worker


## Credits

Translations inherited from the original project:
 - German (thanks @bitkleberAST)
 - Russian (thanks @Александр)
 - Spanish (thanks [@lucas-mancini](https://github.com/lucas-mancini/))
 - Taiwanese Mandarin (thanks @rzfang)
 - French (thanks @ko-dever)
 
[Original website repository](https://github.com/Morikko/synctabgroups)

Thank you to everyone who helped improve and fix the original extension.
