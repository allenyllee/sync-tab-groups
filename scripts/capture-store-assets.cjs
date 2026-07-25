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

const extensionRoot = path.resolve(__dirname, '../build/chrome');
const screenshotRoot = path.resolve(__dirname, '../store-assets/screenshots');
const locale = process.argv[2] || 'en-US';
const localeSuffix = {
  'en-US': 'en',
  'zh-TW': 'zh-TW',
}[locale];

assert.ok(localeSuffix, `Unsupported screenshot locale: ${locale}`);

function getBrowserPath(filePath) {
  if (process.platform !== 'linux'
      || !fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop')) {
    return filePath;
  }

  const result = spawnSync('wslpath', ['-w', filePath], {encoding: 'utf8'});
  assert.equal(result.status, 0, `wslpath failed: ${result.stderr}`);
  return result.stdout.trim();
}

async function connectTarget(browserClient, port, url) {
  const created = await browserClient.send('Target.createTarget', {url});
  const target = await waitFor(async() => {
    const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
    return targets.find(item => item.id === created.targetId);
  }, url);
  const page = await new CdpClient(target.webSocketDebuggerUrl).connect();
  await page.send('Runtime.enable');
  await page.send('Page.enable');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  return page;
}

async function capture(page, filename) {
  await waitFor(() => page.evaluate(`(async() => {
    if (document.readyState !== 'complete') return false;
    await document.fonts.ready;
    return Boolean(document.querySelector('#content'));
  })()`), filename);
  await delay(500);
  const result = await page.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  fs.writeFileSync(path.join(screenshotRoot, filename),
    Buffer.from(result.data, 'base64'));
}

async function run() {
  assert.ok(fs.existsSync(path.join(extensionRoot, 'manifest.json')),
    'Run npm run build:chrome before capturing store assets');
  const brave = findBrave();
  assert.ok(brave, 'Brave was not found; set BRAVE_BINARY to brave.exe');

  fs.mkdirSync(screenshotRoot, {recursive: true});
  const port = await getFreePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tgr-store-assets-'));
  const browser = spawn(brave, [
    `--user-data-dir=${getBrowserPath(profile)}`,
    `--disable-extensions-except=${getBrowserPath(extensionRoot)}`,
    `--load-extension=${getBrowserPath(extensionRoot)}`,
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    '--headless=new',
    '--disable-notifications',
    `--lang=${locale}`,
    `--accept-lang=${locale}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,800',
    'about:blank',
  ], {stdio: ['ignore', 'ignore', 'pipe']});

  let browserClient;
  let worker;
  const pages = [];

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
    worker = await new CdpClient(workerTarget.webSocketDebuggerUrl).connect();
    await worker.send('Runtime.enable');
    await waitFor(() => worker.evaluate(`Boolean(
      globalThis.GroupManager
      && globalThis.BackgroundHelper
      && BackgroundHelper.initialized === true
    )`), 'background initialization');

    const englishGroups = [
      {
        id: 101,
        title: 'Research & Reading',
        tabs: [
          {title: 'MDN Web Docs', url: 'https://developer.mozilla.org/', pinned: true},
          {title: 'Chrome Extensions documentation', url: 'https://developer.chrome.com/docs/extensions/'},
          {title: 'Research papers to review', url: 'https://arxiv.org/'},
        ],
      },
      {
        id: 102,
        title: 'Work Project',
        tabs: [
          {title: 'GitHub pull requests', url: 'https://github.com/pulls', pinned: true},
          {title: 'Project roadmap', url: 'https://github.com/'},
          {title: 'Design notes', url: 'https://docs.google.com/'},
          {title: 'Issue tracker', url: 'https://github.com/issues'},
        ],
      },
      {
        id: 103,
        title: 'Personal',
        tabs: [
          {title: 'Travel planning', url: 'https://www.google.com/travel/'},
          {title: 'Recipes', url: 'https://www.allrecipes.com/'},
          {title: 'Music playlist', url: 'https://music.youtube.com/'},
        ],
      },
    ];
    const traditionalChineseGroups = [
      {
        id: 101,
        title: '研究與閱讀',
        tabs: [
          {title: 'MDN Web 文件', url: 'https://developer.mozilla.org/', pinned: true},
          {title: 'Chrome 擴充功能文件', url: 'https://developer.chrome.com/docs/extensions/'},
          {title: '待讀研究論文', url: 'https://arxiv.org/'},
        ],
      },
      {
        id: 102,
        title: '工作專案',
        tabs: [
          {title: 'GitHub Pull Requests', url: 'https://github.com/pulls', pinned: true},
          {title: '專案路線圖', url: 'https://github.com/'},
          {title: '設計筆記', url: 'https://docs.google.com/'},
          {title: '問題追蹤', url: 'https://github.com/issues'},
        ],
      },
      {
        id: 103,
        title: '個人',
        tabs: [
          {title: '旅遊規劃', url: 'https://www.google.com/travel/'},
          {title: '食譜', url: 'https://www.allrecipes.com/'},
          {title: '音樂播放清單', url: 'https://music.youtube.com/'},
        ],
      },
    ];
    const groups = locale === 'zh-TW'
      ? traditionalChineseGroups
      : englishGroups;

    await worker.evaluate(`(async() => {
      const groups = ${JSON.stringify(groups)};
      GroupManager.groups = GroupManager.check_integrity(groups);
      await browser.storage.local.set({groups: GroupManager.groups});
      BackgroundHelper.refreshUi();
      return GroupManager.groups.length;
    })()`);

    const manager = await connectTarget(
      browserClient,
      port,
      `chrome-extension://${extensionId}/manage/manage-groups.html`,
    );
    pages.push(manager);
    await waitFor(() => manager.evaluate(
      `document.querySelectorAll('.group').length >= 3`,
    ), 'rendered group manager');
    await manager.evaluate(`(() => {
      document.querySelectorAll('.group-expand').forEach(button => button.click());
      return true;
    })()`);
    await waitFor(() => manager.evaluate(
      `document.querySelectorAll('.tab').length >= 10`,
    ), 'expanded group tabs');
    await capture(
      manager,
      `01-group-manager-${localeSuffix}-1280x800.png`,
    );

    const options = await connectTarget(
      browserClient,
      port,
      `chrome-extension://${extensionId}/options/option-page.html#groups`,
    );
    pages.push(options);
    await waitFor(() => options.evaluate(
      `Boolean(document.querySelector('#backup-local-intervalTime'))`,
    ), 'rendered backup preferences');
    await capture(
      options,
      `02-local-backups-${localeSuffix}-1280x800.png`,
    );

    console.log(`Captured ${locale} store screenshots in ${screenshotRoot}`);
  } finally {
    for (const page of pages) page.close();
    if (worker) worker.close();
    if (browserClient) browserClient.close();
    if (process.platform === 'win32' && browser.pid) {
      spawnSync('taskkill.exe', ['/PID', String(browser.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
      await Promise.race([
        new Promise(resolve => browser.once('exit', resolve)),
        delay(3000),
      ]);
    } else {
      browser.kill();
      await Promise.race([
        new Promise(resolve => browser.once('exit', resolve)),
        delay(3000),
      ]);
    }
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        fs.rmSync(profile, {recursive: true, force: true});
        break;
      } catch (error) {
        if (attempt === 19) {
          console.warn(`Could not remove temporary profile: ${error.message}`);
          break;
        }
        await delay(250);
      }
    }
  }
}

run().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
