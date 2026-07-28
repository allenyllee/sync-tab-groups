const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const versionFiles = [
  'package.json',
  'extension/manifest.json',
  'extension/manifest.chrome.json',
  'extension/manifest.firefox.json',
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function normalizeTag(tag) {
  assert.match(
    tag || '',
    /^v\d+(?:\.\d+){0,3}$/,
    'Release tag must use a numeric Chrome version such as v1.0.1',
  );
  return tag.slice(1);
}

function checkReleaseVersion(tag) {
  const expected = normalizeTag(tag);
  const versions = new Map(
    versionFiles.map(filename => [filename, readJson(filename).version]),
  );
  const lockfile = readJson('package-lock.json');
  versions.set('package-lock.json', lockfile.version);
  versions.set('package-lock.json packages[""]', lockfile.packages[''].version);

  for (const [filename, version] of versions) {
    assert.equal(
      version,
      expected,
      `${filename} has version ${version}; expected ${expected}`,
    );
  }

  console.log(`Release tag and package versions agree: ${expected}`);
  return expected;
}

if (require.main === module) {
  checkReleaseVersion(process.argv[2]);
}

module.exports = {checkReleaseVersion, normalizeTag};
