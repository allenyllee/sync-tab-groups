const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn, spawnSync} = require('node:child_process');

const {
  CdpClient,
  delay,
  findBrave,
  getFreePort,
  getJson,
  waitFor,
} = require('./brave-regression.test.cjs');

const builtExtensionRoot = path.resolve(__dirname, '../build/chrome');
const suite = process.argv[2] || 'unit';
const specFilter = process.argv.slice(3).join(' ');

assert.ok(['unit', 'integration'].includes(suite),
  'Jasmine suite must be "unit" or "integration"');

async function run() {
  assert.ok(fs.existsSync(path.join(builtExtensionRoot, 'manifest.json')),
    'Run npm run build:chrome before the Brave Jasmine test');

  const brave = findBrave();
  assert.ok(brave, 'Brave was not found; set BRAVE_BINARY to brave.exe');

  const port = await getFreePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'stg-brave-test-'));
  const extensionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stg-jasmine-extension-'));
  fs.cpSync(builtExtensionRoot, extensionRoot, {recursive: true});
  fs.writeFileSync(path.join(extensionRoot, 'service-worker.js'),
    'chrome.runtime.onInstalled.addListener(() => {});\n');
  const browser = spawn(brave, [
    `--user-data-dir=${profile}`,
    `--disable-extensions-except=${extensionRoot}`,
    `--load-extension=${extensionRoot}`,
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    '--headless=new',
    '--disable-notifications',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], {stdio: ['ignore', 'ignore', 'pipe']});

  let browserErrors = '';
  browser.stderr.on('data', chunk => browserErrors += chunk.toString());
  let browserClient;
  let page;

  try {
    const version = await waitFor(
      () => getJson(`http://127.0.0.1:${port}/json/version`),
      'Brave DevTools endpoint',
    );
    browserClient = await new CdpClient(version.webSocketDebuggerUrl).connect();

    const workerTarget = await waitFor(async() => {
      const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
      return targets.find(target => target.type === 'service_worker'
        && target.url.endsWith('/service-worker.js'));
    }, 'extension service worker');
    const extensionId = new URL(workerTarget.url).hostname;

    const created = await browserClient.send('Target.createTarget', {
      url: `chrome-extension://${extensionId}/tests/test-page/${suite}.html?enable=true&doAll=true&spec=${encodeURIComponent(specFilter)}`,
    });
    const pageTarget = await waitFor(async() => {
      const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
      return targets.find(target => target.id === created.targetId);
    }, `${suite} Jasmine page`);

    page = await new CdpClient(pageTarget.webSocketDebuggerUrl).connect();
    await page.send('Runtime.enable');
    const result = await waitFor(
      () => page.evaluate('window.__jasmineResult'),
      `${suite} Jasmine completion`,
      240000,
    );

    if (specFilter && result.specs.length === 0) {
      throw new Error(`Jasmine filter matched no specs: ${specFilter}`);
    }

    const failed = result.specs.filter(spec => spec.status === 'failed');
    const passed = result.specs.filter(spec => spec.status === 'passed');
    const pending = result.specs.filter(spec => spec.status === 'pending');

    if (failed.length) {
      failed.forEach(spec => {
        console.error(`FAIL ${spec.description}`);
        spec.failures.forEach(failure => console.error(`  ${failure}`));
      });
    }

    assert.equal(result.overallStatus, 'passed',
      `${suite} Jasmine suite failed: ${failed.length} failed`);
    console.log(`Jasmine ${suite}: ${passed.length} passed, ${pending.length} pending`);
  } catch (error) {
    if (page) {
      const state = await page.evaluate(`({
        readyState: document.readyState,
        hasBackground: Boolean(window.Background),
        hasJasmineResult: Boolean(window.__jasmineResult),
        logs: window.Background && window.Background.LogManager
          ? window.Background.LogManager.logs.slice(-10)
          : [],
        bodyText: document.body && document.body.innerText.slice(0, 4000),
      })`).catch(diagnosticError => ({diagnosticError: diagnosticError.message}));
      const exceptions = page.events
        .filter(event => event.method === 'Runtime.exceptionThrown')
        .map(event => event.params.exceptionDetails.exception?.description
          || event.params.exceptionDetails.text);
      console.error('Jasmine page state:', JSON.stringify(state, null, 2));
      if (exceptions.length) console.error('Jasmine page exceptions:', exceptions.join('\n'));
    }
    if (browserErrors) console.error('Brave stderr:', browserErrors.slice(-4000));
    throw error;
  } finally {
    if (page) page.close();
    if (browserClient) browserClient.close();
    if (process.platform === 'win32' && browser.pid) {
      spawnSync('taskkill.exe', ['/PID', String(browser.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
    } else {
      browser.kill();
    }
    if (browser.exitCode === null) {
      await Promise.race([
        new Promise(resolve => browser.once('exit', resolve)),
        delay(5000),
      ]);
    }
    fs.rmSync(profile, {
      recursive: true,
      force: true,
      maxRetries: 20,
      retryDelay: 100,
    });
    fs.rmSync(extensionRoot, {
      recursive: true,
      force: true,
      maxRetries: 20,
      retryDelay: 100,
    });
  }
}

run().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
