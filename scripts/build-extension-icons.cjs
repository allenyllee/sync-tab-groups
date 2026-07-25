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

const root = path.resolve(__dirname, '..');
const source = path.join(
  root,
  'store-assets/source/tab-groups-resurrection.svg',
);
const promoSource = path.join(root, 'store-assets/source/promo-small.svg');
const masterOutput = path.join(
  root,
  'store-assets/source/tab-groups-resurrection-master.png',
);
const promoOutput = path.join(
  root,
  'store-assets/tab-groups-resurrection-promo-small-440x280.png',
);
const outputs = new Map([
  [16, [
    'extension/share/icons/tab-groups-resurrection-16.png',
  ]],
  [32, [
    'extension/share/icons/tab-groups-resurrection-32.png',
  ]],
  [64, [
    'extension/share/icons/tab-groups-resurrection-64.png',
  ]],
  [128, [
    'extension/share/icons/tab-groups-resurrection-128.png',
    'store-assets/tab-groups-resurrection-store-icon-128.png',
  ]],
  [1254, [
    'store-assets/source/tab-groups-resurrection-master.png',
  ]],
]);

function getBrowserPath(filePath) {
  if (process.platform !== 'linux'
      || !fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop')) {
    return filePath;
  }

  const result = spawnSync('wslpath', ['-w', filePath], {encoding: 'utf8'});
  assert.equal(result.status, 0, `wslpath failed: ${result.stderr}`);
  return result.stdout.trim();
}

function createRenderUrl(svg) {
  const svgUrl = `data:image/svg+xml;base64,${
    Buffer.from(svg).toString('base64')
  }`;
  return `data:text/html;base64,${
    Buffer.from(
      `<style>*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:transparent}img{display:block;width:100%;height:100%}</style><img src="${svgUrl}">`,
    ).toString('base64')
  }`;
}

async function capture(page, width, height, renderUrl, validateIcon = false) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.send('Emulation.setDefaultBackgroundColorOverride', {
    color: {r: 0, g: 0, b: 0, a: 0},
  });
  await page.send('Page.navigate', {url: renderUrl});
  await waitFor(
    () => page.evaluate(`document.readyState === "complete"
      && document.querySelector("img")?.complete
      && document.querySelector("img")?.naturalWidth > 0`),
    `${width}x${height} artwork render`,
  );

  if (validateIcon) {
    const metrics = await page.evaluate(`(() => {
      const canvas = document.createElement('canvas');
      canvas.width = ${width};
      canvas.height = ${height};
      const context = canvas.getContext('2d');
      context.drawImage(
        document.querySelector('img'), 0, 0, ${width}, ${height},
      );
      const pixels = context.getImageData(0, 0, ${width}, ${height}).data;
      let opaque = 0;
      let bright = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] < 128) continue;
        opaque++;
        const luminance = 0.2126 * pixels[index]
          + 0.7152 * pixels[index + 1]
          + 0.0722 * pixels[index + 2];
        if (luminance >= 140) bright++;
      }
      const total = ${width} * ${height};
      return {opaqueRatio: opaque / total, brightRatio: bright / total};
    })()`);
    assert.ok(
      metrics.opaqueRatio >= 0.5,
      `${width}px icon occupies only ${
        (metrics.opaqueRatio * 100).toFixed(1)
      }%`,
    );
    assert.ok(
      metrics.brightRatio >= 0.2,
      `${width}px icon has only ${
        (metrics.brightRatio * 100).toFixed(1)
      }% bright pixels`,
    );
  }

  const result = await page.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
    clip: {x: 0, y: 0, width, height, scale: 1},
  });
  return Buffer.from(result.data, 'base64');
}

async function run() {
  assert.ok(fs.existsSync(source), `Missing icon source: ${source}`);
  assert.ok(fs.existsSync(promoSource), `Missing promo source: ${promoSource}`);
  const brave = findBrave();
  assert.ok(brave, 'Brave was not found; set BRAVE_BINARY to brave.exe');

  const renderUrl = createRenderUrl(fs.readFileSync(source));
  const port = await getFreePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tgr-icon-render-'));
  const browser = spawn(brave, [
    `--user-data-dir=${getBrowserPath(profile)}`,
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    '--headless=new',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], {stdio: ['ignore', 'ignore', 'pipe']});

  let browserClient;
  let page;

  try {
    const version = await waitFor(
      () => getJson(`http://127.0.0.1:${port}/json/version`),
      'Brave DevTools endpoint',
    );
    browserClient = await new CdpClient(
      version.webSocketDebuggerUrl,
    ).connect();
    const created = await browserClient.send('Target.createTarget', {
      url: 'about:blank',
    });
    const target = await waitFor(async() => {
      const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
      return targets.find(item => item.id === created.targetId);
    }, 'icon render page');
    page = await new CdpClient(target.webSocketDebuggerUrl).connect();
    await page.send('Runtime.enable');
    await page.send('Page.enable');

    for (const [size, destinations] of outputs) {
      const png = await capture(page, size, size, renderUrl, true);
      for (const relativePath of destinations) {
        const destination = path.join(root, relativePath);
        fs.mkdirSync(path.dirname(destination), {recursive: true});
        fs.writeFileSync(destination, png);
        console.log(`Wrote ${relativePath} (${size}x${size})`);
      }
    }

    const masterUrl = `data:image/png;base64,${
      fs.readFileSync(masterOutput).toString('base64')
    }`;
    const promoSvg = fs.readFileSync(promoSource, 'utf8').replace(
      'tab-groups-resurrection-master.png',
      masterUrl,
    );
    const promoPng = await capture(
      page,
      440,
      280,
      createRenderUrl(promoSvg),
    );
    fs.writeFileSync(promoOutput, promoPng);
    console.log(
      'Wrote store-assets/tab-groups-resurrection-promo-small-440x280.png '
        + '(440x280)',
    );
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
  }
}

run().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
