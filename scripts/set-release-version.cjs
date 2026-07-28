const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifests = [
  'extension/manifest.json',
  'extension/manifest.chrome.json',
  'extension/manifest.firefox.json',
];

function writeJson(relativePath, value) {
  fs.writeFileSync(
    path.join(root, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

function replaceManifestVersion(relativePath, version) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  assert.match(source, /"version":\s*"[^"]+"/);
  fs.writeFileSync(
    filename,
    source.replace(
      /("version":\s*")[^"]+"/,
      `$1${version}"`,
    ),
  );
}

function setReleaseVersion(version) {
  assert.match(
    version || '',
    /^\d+(?:\.\d+){0,3}$/,
    'Chrome Web Store versions must contain one to four numeric components',
  );

  const packageJson = require(path.join(root, 'package.json'));
  const packageLock = require(path.join(root, 'package-lock.json'));
  packageJson.version = version;
  packageLock.version = version;
  packageLock.packages[''].version = version;
  writeJson('package.json', packageJson);
  writeJson('package-lock.json', packageLock);

  for (const filename of manifests) {
    replaceManifestVersion(filename, version);
  }

  console.log(`Set release version to ${version}`);
}

if (require.main === module) {
  setReleaseVersion(process.argv[2]);
}

module.exports = {setReleaseVersion};
