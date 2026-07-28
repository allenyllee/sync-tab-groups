# Automated Chrome Web Store publishing

The `Publish Chrome Web Store` GitHub Actions workflow performs a fully
automatic production release when a numeric `v*` tag is pushed.

It requires the tagged commit to be on `master`, verifies that the tag matches
every package and manifest version, installs Brave, runs the regression and
lint suites, builds and validates the production ZIP, preserves that ZIP as a
workflow artifact, uploads it through Chrome Web Store API v2, and submits it
with `DEFAULT_PUBLISH`. Google will publish the update automatically after it
passes review.

API warnings block submission. Documentation-only pushes do not trigger a
release.

## One-time publisher setup

1. In Google Cloud, enable the Chrome Web Store API and create a service
   account.
2. Create a JSON key for that service account. Treat it like a password.
3. In the Chrome Web Store Developer Dashboard, open **Account** and add the
   service account email. A publisher can currently have only one service
   account.
4. In the GitHub repository, create an environment named
   `chrome-web-store-production`. Do not add required reviewers or a wait timer
   if releases should remain fully automatic.
5. Add an environment secret named `CWS_SERVICE_ACCOUNT_JSON` containing the
   complete JSON key.
6. Add an environment variable named `CWS_PUBLISHER_ID` containing the
   publisher ID shown by the Developer Dashboard.

The item ID is not secret and is fixed in the workflow as
`bmjkpeefoomkdgodlecgdjjgdkoldofj`.

Never commit the service account key or paste it into an issue, log, workflow,
or source file. Rotate the key immediately if it is exposed.

## Release a version

The first automated update must be newer than the currently published `1.0.0`.
For example:

```sh
npm run version:set -- 1.0.1
npm run release:check-version -- v1.0.1
git add package.json package-lock.json extension/manifest.json \
  extension/manifest.chrome.json extension/manifest.firefox.json
git commit -m "Release 1.0.1"
git push origin master
git tag v1.0.1
git push origin v1.0.1
```

Pushing the tag starts the release. A successful workflow ends after the new
version has been submitted for review. `DEFAULT_PUBLISH` causes it to become
public automatically when Google approves it; review time is controlled by
Google.

If a run fails before upload, correct the problem and replace the unpublished
tag only after confirming that no package was submitted. If upload or
submission may have succeeded, inspect the Developer Dashboard before retrying
with another version.
