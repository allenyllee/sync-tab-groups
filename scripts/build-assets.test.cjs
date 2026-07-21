const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const buildRoot = path.resolve(__dirname, '../build/chrome');
const fontRoot = path.join(buildRoot, 'fonts');

const expectedFonts = {
  'fontawesome-webfont.eot': 100000,
  'fontawesome-webfont.svg': 100000,
  'fontawesome-webfont.ttf': 100000,
  'fontawesome-webfont.woff': 50000,
  'fontawesome-webfont.woff2': 50000,
};

test('Chrome build uses an MV3 service worker', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(buildRoot, 'manifest.json'), 'utf8'),
  );

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, 'service-worker.js');
  assert.ok(fs.existsSync(path.join(buildRoot, 'service-worker.js')));
});

test('Font Awesome assets contain real font data', () => {
  for (const [filename, minimumSize] of Object.entries(expectedFonts)) {
    const fontPath = path.join(fontRoot, filename);
    const contents = fs.readFileSync(fontPath);

    assert.ok(
      contents.length > minimumSize,
      `${filename} is unexpectedly small (${contents.length} bytes)`,
    );
    assert.doesNotMatch(
      contents.subarray(0, 80).toString('utf8'),
      /export default/,
      `${filename} contains a JavaScript loader stub instead of font data`,
    );
  }

  assert.equal(
    fs.readFileSync(path.join(fontRoot, 'fontawesome-webfont.woff2'))
      .subarray(0, 4)
      .toString('ascii'),
    'wOF2',
  );
});

test('UI bundles reference the emitted fonts directory', () => {
  const bundles = [
    'popup/popup.js',
    'options/option-page.js',
    'manage/manage-groups.js',
    'tabpages/selector-groups/selector-groups-controller.js',
  ];

  for (const bundle of bundles) {
    const source = fs.readFileSync(path.join(buildRoot, bundle), 'utf8');
    assert.match(source, /fonts\/fontawesome-webfont\.woff2/);
  }
});

test('Chrome build has no loader-stub font files at its root', () => {
  const rootFonts = fs.readdirSync(buildRoot)
    .filter(filename => /\.(eot|svg|ttf|woff2?)$/.test(filename));

  assert.deepEqual(rootFonts, []);
});
