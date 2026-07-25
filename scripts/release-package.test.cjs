const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const releaseRoot = path.resolve(__dirname, '../release/chrome');

function walk(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

test('Chrome Web Store package has the expected identity', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(releaseRoot, 'manifest.json'), 'utf8'),
  );

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, 'Tab Groups Resurrection');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(
    manifest.icons['128'],
    '/share/icons/tab-groups-resurrection-128.png',
  );
  assert.ok(fs.existsSync(path.join(
    releaseRoot,
    'share/icons/tab-groups-resurrection-128.png',
  )));
});

test('production package excludes development-only files', () => {
  const relativeFiles = walk(releaseRoot)
    .map(filename => path.relative(releaseRoot, filename).replaceAll('\\', '/'));

  assert.equal(fs.existsSync(path.join(releaseRoot, 'tests')), false);
  assert.deepEqual(relativeFiles.filter(filename => filename.endsWith('.map')), []);
  assert.deepEqual(relativeFiles.filter(filename => filename.includes('/tests/')), []);
  assert.deepEqual(
    relativeFiles.filter(filename => /share\/icons\/(?:sync-tab-groups|tabspace|chrome\.png|firefox\.png)/.test(filename)),
    [],
  );
});

test('production package contains no remotely hosted executable code', () => {
  const executableFiles = walk(releaseRoot)
    .filter(filename => /\.(?:html|js)$/.test(filename));

  for (const filename of executableFiles) {
    const source = fs.readFileSync(filename, 'utf8');
    assert.doesNotMatch(
      source,
      /<script[^>]+src=["']https?:\/\//i,
      path.relative(releaseRoot, filename),
    );
    assert.doesNotMatch(
      source,
      /importScripts\s*\([^)]*https?:\/\//i,
      path.relative(releaseRoot, filename),
    );
  }
});
