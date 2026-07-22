const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const {spawn, spawnSync} = require('node:child_process');
const WebSocket = require('ws');

const extensionRoot = path.resolve(__dirname, '../build/chrome');

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => body += chunk);
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    request.setTimeout(1000, () => request.destroy(new Error('HTTP timeout')));
  });
}

async function waitFor(action, description, timeout=20000) {
  const deadline = Date.now() + timeout;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const result = await action();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }

  const detail = lastError ? `: ${lastError.message}` : '';
  throw new Error(`Timed out waiting for ${description}${detail}`, {cause: lastError});
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const {port} = server.address();
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function getBrowserPath(filePath) {
  if (process.platform !== 'linux'
      || !fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop')) {
    return filePath;
  }

  const result = spawnSync('wslpath', ['-w', filePath], {encoding: 'utf8'});
  assert.equal(result.status, 0, `wslpath failed: ${result.stderr}`);
  return result.stdout.trim();
}

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.socket = new WebSocket(url);
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.once('open', resolve);
      this.socket.once('error', reject);
    });
    this.socket.on('message', data => {
      const message = JSON.parse(data.toString());
      if (!message.id) {
        this.events.push(message);
        return;
      }
      if (!this.pending.has(message.id)) return;
      const {resolve, reject} = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
    this.socket.on('close', () => {
      for (const {reject} of this.pending.values()) {
        reject(new Error('CDP connection closed'));
      }
      this.pending.clear();
    });
    return this;
  }

  send(method, params={}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject});
      this.socket.send(JSON.stringify({id, method, params}));
    });
  }

  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.exceptionDetails) {
      const detail = response.exceptionDetails.exception
        ? response.exceptionDetails.exception.description
        : response.exceptionDetails.text;
      throw new Error(detail);
    }
    return response.result.value;
  }

  close() {
    this.socket.close();
  }
}

function findBrave() {
  const candidates = [
    process.env.BRAVE_BINARY,
    process.env.PROGRAMFILES && path.join(
      process.env.PROGRAMFILES,
      'BraveSoftware/Brave-Browser/Application/brave.exe',
    ),
    process.env['PROGRAMFILES(X86)'] && path.join(
      process.env['PROGRAMFILES(X86)'],
      'BraveSoftware/Brave-Browser/Application/brave.exe',
    ),
    process.env.LOCALAPPDATA && path.join(
      process.env.LOCALAPPDATA,
      'BraveSoftware/Brave-Browser/Application/brave.exe',
    ),
  ].filter(Boolean);

  return candidates.find(candidate => fs.existsSync(candidate));
}

async function run() {
  assert.ok(fs.existsSync(path.join(extensionRoot, 'manifest.json')),
    'Run npm run build:chrome before the Brave regression test');

  const brave = findBrave();
  assert.ok(brave, 'Brave was not found; set BRAVE_BINARY to brave.exe');

  const port = await getFreePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'stg-brave-test-'));
  const downloadDirectory = path.join(profile, 'downloads');
  fs.mkdirSync(downloadDirectory);
  fs.mkdirSync(path.join(profile, 'Default'));
  fs.writeFileSync(path.join(profile, 'Default', 'Preferences'), JSON.stringify({
    download: {
      default_directory: getBrowserPath(downloadDirectory),
      prompt_for_download: false,
    },
  }));
  const browser = spawn(brave, [
    `--user-data-dir=${profile}`,
    `--disable-extensions-except=${extensionRoot}`,
    `--load-extension=${extensionRoot}`,
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], {stdio: ['ignore', 'ignore', 'pipe']});

  let browserErrors = '';
  browser.stderr.on('data', chunk => browserErrors += chunk.toString());
  let worker;
  let page;
  let optionsPage;
  let controlPage;
  let browserClient;

  try {
    const version = await waitFor(
      () => getJson(`http://127.0.0.1:${port}/json/version`),
      'Brave DevTools endpoint',
    );
    browserClient = await new CdpClient(version.webSocketDebuggerUrl).connect();
    const firstWorkerTarget = await waitFor(async() => {
      const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
      return targets.find(target => target.type === 'service_worker'
        && target.url.endsWith('/service-worker.js'));
    }, 'extension service worker');

    const extensionId = new URL(firstWorkerTarget.url).hostname;
    worker = await new CdpClient(firstWorkerTarget.webSocketDebuggerUrl).connect();
    await worker.send('Runtime.enable');
    await worker.send('Log.enable');
    try {
      await waitFor(
        () => worker.evaluate(`Boolean(
          globalThis.GroupManager
          && globalThis.OptionManager
          && globalThis.BackgroundHelper
          && BackgroundHelper.initialized === true
        )`),
        'background initialization',
      );
    } catch (error) {
      const state = await worker.evaluate(`({
        hasGroupManager: Boolean(globalThis.GroupManager),
        hasOptionManager: Boolean(globalThis.OptionManager),
        hasBackgroundHelper: Boolean(globalThis.BackgroundHelper),
        initialized: globalThis.BackgroundHelper && BackgroundHelper.initialized,
        install: globalThis.BackgroundHelper && BackgroundHelper.install,
      })`).catch(diagnosticError => ({diagnosticError: diagnosticError.message}));
      const exceptions = worker.events
        .filter(event => event.method === 'Runtime.exceptionThrown')
        .map(event => event.params.exceptionDetails.exception?.description
          || event.params.exceptionDetails.text);
      console.error('Background state:', JSON.stringify(state));
      if (exceptions.length) console.error('Background exceptions:', exceptions.join('\n'));
      if (browserErrors) console.error('Brave stderr:', browserErrors.slice(-4000));
      throw error;
    }
    console.log('PASS service worker starts and initializes');

    const created = await browserClient.send('Target.createTarget', {
      url: `chrome-extension://${extensionId}/popup/popup.html`,
    });
    const popupTarget = await waitFor(async() => {
      const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
      return targets.find(target => target.id === created.targetId);
    }, 'popup target');
    page = await new CdpClient(popupTarget.webSocketDebuggerUrl).connect();
    await page.send('Runtime.enable');
    const popupResult = await waitFor(() => page.evaluate(`(async() => {
      if (document.readyState !== 'complete') return null;
      await document.fonts.ready;
      const icon = document.querySelector('.fa');
      if (!icon) return null;
      return {
        contentChildren: document.querySelector('#content').children.length,
        fontFamily: getComputedStyle(icon, '::before').fontFamily,
      };
    })()`), 'rendered popup and loaded icon font');
    assert.ok(popupResult.contentChildren > 0, 'popup did not render');
    assert.match(popupResult.fontFamily, /FontAwesome/i);
    console.log('PASS popup renders with Font Awesome icons');

    const optionsCreated = await browserClient.send('Target.createTarget', {
      url: `chrome-extension://${extensionId}/options/option-page.html`,
    });
    const optionsTarget = await waitFor(async() => {
      const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
      return targets.find(target => target.id === optionsCreated.targetId);
    }, 'options target');
    optionsPage = await new CdpClient(optionsTarget.webSocketDebuggerUrl).connect();
    await optionsPage.send('Runtime.enable');
    const backupOptionValues = await waitFor(() => optionsPage.evaluate(`(() => {
      if (document.readyState !== 'complete') return null;
      const interval = document.querySelector('#backup-local-intervalTime');
      const maxSave = document.querySelector('#backup-local-maxSave');
      if (!interval || !maxSave) return null;
      return {interval: interval.value, maxSave: maxSave.value};
    })()`), 'local backup options');
    assert.equal(backupOptionValues.interval, '1');
    assert.equal(backupOptionValues.maxSave, '48');
    console.log('PASS local backup options render numeric defaults');

    const automaticBackupSchedule = await worker.evaluate(`(async() => {
      await OptionManager.updateOption('backup-download-enable', false);
      for (const timer of Object.keys(OptionManager.options.backup.download.time)) {
        OptionManager.options.backup.download.time[timer] = timer === 't_5mins';
      }
      await OptionManager.updateOption('backup-download-enable', true);
      const alarmName = ExtensionStorageManager.Backup.ALARM_PREFIX + 't_5mins';
      const firstAlarm = await browser.alarms.get(alarmName);
      await ExtensionStorageManager.Backup.init();
      const alarmAfterInit = await browser.alarms.get(alarmName);
      await OptionManager.updateOption('backup-download-time-t_5mins', false);
      const alarmAfterDisable = await browser.alarms.get(alarmName);
      await OptionManager.updateOption('backup-download-time-t_5mins', true);
      const alarmAfterEnable = await browser.alarms.get(alarmName);
      return {
        firstScheduledTime: firstAlarm && firstAlarm.scheduledTime,
        scheduledTimeAfterInit: alarmAfterInit && alarmAfterInit.scheduledTime,
        alarmAfterDisable: Boolean(alarmAfterDisable),
        alarmAfterEnable: Boolean(alarmAfterEnable),
      };
    })()`);
    assert.ok(automaticBackupSchedule.firstScheduledTime);
    assert.equal(
      automaticBackupSchedule.scheduledTimeAfterInit,
      automaticBackupSchedule.firstScheduledTime,
    );
    assert.equal(automaticBackupSchedule.alarmAfterDisable, false);
    assert.equal(automaticBackupSchedule.alarmAfterEnable, true);
    console.log('PASS automatic backup alarms update without resetting on worker initialization');

    const operationResult = await worker.evaluate(`(async() => {
      const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
      const suffix = Date.now().toString();
      const originalTheme = OptionManager.getOptionValue('popup-whiteTheme');

      BackgroundHelper.onGroupAdd({title: 'Regression A ' + suffix});
      BackgroundHelper.onGroupAdd({title: 'Regression B ' + suffix});
      await pause(300);

      const groupA = GroupManager.groups.find(group => group.title === 'Regression A ' + suffix);
      const groupB = GroupManager.groups.find(group => group.title === 'Regression B ' + suffix);
      if (!groupA || !groupB) throw new Error('groups were not created');

      BackgroundHelper.onGroupRename({groupId: groupA.id, title: 'Regression A renamed ' + suffix});
      await BackgroundHelper.onGroupSelect({groupId: groupA.id});
      await pause(500);

      const openGroupA = GroupManager.groups.find(group => group.id === groupA.id);
      if (openGroupA.windowId === browser.windows.WINDOW_ID_NONE) {
        throw new Error('group A did not open');
      }

      await browser.tabs.create({
        windowId: openGroupA.windowId,
        url: browser.runtime.getURL('/tabpages/shortcut-help/shortcut-help.html')
          + '?stg-regression=' + suffix,
        active: false,
      });
      await pause(800);
      await TabManager.updateTabsInGroup(openGroupA.windowId);

      const sourceIndex = openGroupA.tabs.findIndex(tab =>
        tab.url.includes('shortcut-help.html?stg-regression=' + suffix));
      if (sourceIndex < 0) throw new Error('test tab was not recorded in group A');

      await BackgroundHelper.onMoveTabToGroup({
        sourceGroupId: groupA.id,
        sourceTabIndex: sourceIndex,
        targetGroupId: groupB.id,
        targetTabIndex: -1,
      });
      await pause(500);

      const movedGroupB = GroupManager.groups.find(group => group.id === groupB.id);
      if (!movedGroupB.tabs.some(tab => tab.url.includes('shortcut-help.html?stg-regression=' + suffix))) {
        throw new Error('test tab was not moved to group B');
      }

      await BackgroundHelper.onGroupSelect({groupId: groupB.id});
      await pause(700);
      const openGroupB = GroupManager.groups.find(group => group.id === groupB.id);
      const openTabs = await browser.tabs.query({windowId: openGroupB.windowId});
      if (!openTabs.some(tab => Utils.extractTabUrl(tab.url)
        .includes('shortcut-help.html?stg-regression=' + suffix))) {
        throw new Error('moved tab was not restored when group B opened');
      }

      await BackgroundHelper.onGroupClose({groupId: groupB.id, taskRef: 'FORCE'});
      await pause(400);
      if (GroupManager.groups.find(group => group.id === groupB.id).windowId
          !== browser.windows.WINDOW_ID_NONE) {
        throw new Error('group B did not close');
      }

      await OptionManager.updateOption('popup-whiteTheme', !originalTheme);
      await GroupManager.waitForStore();
      await pause(1500);

      const contextMenuErrors = LogManager.logs.filter(log =>
        log.message && log.message.includes('Cannot find menu item'));
      if (contextMenuErrors.length) {
        throw new Error('context menu rebuild used stale menu ids: '
          + contextMenuErrors.map(log => log.message).join(', '));
      }
      const ungroupedWindowWarnings = LogManager.logs.filter(log =>
        log.message === 'Failed to find group in window');
      if (ungroupedWindowWarnings.length) {
        throw new Error('normal ungrouped-window state was logged as a warning');
      }

      return {
        suffix,
        groupAId: groupA.id,
        groupBId: groupB.id,
        expectedTheme: !originalTheme,
      };
    })()`);
    const runtimeMenuErrors = worker.events
      .filter(event => event.method === 'Log.entryAdded')
      .map(event => event.params.entry.text)
      .filter(message => message.includes('Cannot find menu item'));
    assert.deepEqual(runtimeMenuErrors, [],
      `context menu runtime errors: ${runtimeMenuErrors.join(', ')}`);
    console.log('PASS create, rename, select, move tab, switch, and close groups');
    console.log('PASS context menus rebuild without stale ids');
    console.log('PASS ungrouped window transitions do not emit warnings');
    console.log('PASS option update is written to extension storage');

    const storedBeforeRestart = await worker.evaluate(`(async() => {
      const stored = await browser.storage.local.get(['groups', 'options']);
      return {
        renamedGroup: stored.groups.some(group =>
          group.id === ${JSON.stringify(operationResult.groupAId)}
          && group.title === ${JSON.stringify('Regression A renamed ' + operationResult.suffix)}),
        movedGroup: stored.groups.some(group =>
          group.id === ${JSON.stringify(operationResult.groupBId)}
          && group.tabs.some(tab => tab.url.includes(${JSON.stringify('shortcut-help.html?stg-regression=' + operationResult.suffix)}))),
        theme: stored.options.popup.whiteTheme,
      };
    })()`);
    assert.equal(storedBeforeRestart.renamedGroup, true);
    assert.equal(storedBeforeRestart.movedGroup, true);
    assert.equal(storedBeforeRestart.theme, operationResult.expectedTheme);

    const backupDirectory = path.join(downloadDirectory, 'sync-tab-groups', 'backups');
    const backupResult = await worker.evaluate(`(async() => {
      const logIndex = LogManager.logs.length;
      const downloadChanges = [];
      const onCreated = item => downloadChanges.push({
        event: 'created',
        id: item.id,
        filename: item.filename,
        state: item.state,
      });
      const onChanged = delta => downloadChanges.push({
        event: 'changed',
        id: delta.id,
        filename: delta.filename && delta.filename.current,
        state: delta.state && delta.state.current,
        error: delta.error && delta.error.current,
      });
      browser.downloads.onCreated.addListener(onCreated);
      browser.downloads.onChanged.addListener(onChanged);
      await ExtensionStorageManager.Backup.backup('manual');
      await new Promise(resolve => setTimeout(resolve, 500));
      browser.downloads.onCreated.removeListener(onCreated);
      browser.downloads.onChanged.removeListener(onChanged);
      return {
        logs: LogManager.logs.slice(logIndex),
        downloadChanges,
      };
    })()`);
    await worker.evaluate(`ExtensionStorageManager.Backup.backup('manual')`);
    let backupFilenames;
    try {
      backupFilenames = await waitFor(() => {
        if (!fs.existsSync(backupDirectory)) return null;
        const filenames = fs.readdirSync(backupDirectory).filter(filename =>
          /^synctabgroups-backup-manual-\d{8}-\d{6}-\d{3}(?: \(\d+\))?\.json$/
            .test(filename));
        return filenames.length === 2 ? filenames : null;
      }, 'two timestamped manual backup files');
    } catch (error) {
      const downloadEvents = browserClient.events.filter(event =>
        event.method.startsWith('Browser.download'));
      throw new Error(`${error.message}; backup logs: ${JSON.stringify(backupResult)}; `
        + `download events: ${JSON.stringify(downloadEvents)}`, {cause: error});
    }
    const downloadedBackup = JSON.parse(fs.readFileSync(
      path.join(backupDirectory, backupFilenames[0]),
      'utf8',
    ));
    assert.deepEqual(downloadedBackup.version, ['syncTabGroups', 1]);
    assert.ok(downloadedBackup.groups.some(group =>
      group.id === operationResult.groupAId
      && group.title === `Regression A renamed ${operationResult.suffix}`));
    assert.ok(downloadedBackup.groups.some(group =>
      group.id === operationResult.groupBId
      && group.tabs.some(tab => tab.url.includes(
        `shortcut-help.html?stg-regression=${operationResult.suffix}`,
      ))));
    console.log('PASS repeated manual backups write distinct timestamped group JSON files');

    const exportDirectory = path.join(downloadDirectory, 'sync-tab-groups', 'exports');
    const exportSucceeded = await worker.evaluate(
      `ExtensionStorageManager.File.downloadGroups(GroupManager.groups)`,
    );
    assert.equal(exportSucceeded, true);
    const exportFilename = await waitFor(() => {
      if (!fs.existsSync(exportDirectory)) return null;
      return fs.readdirSync(exportDirectory).find(filename =>
        /^syncTabGroups-manual-\d{8}-\d{6}\.json$/.test(filename));
    }, 'downloaded group export file');
    const downloadedExport = JSON.parse(fs.readFileSync(
      path.join(exportDirectory, exportFilename),
      'utf8',
    ));
    assert.deepEqual(downloadedExport.version, ['syncTabGroups', 1]);
    assert.ok(downloadedExport.groups.some(group =>
      group.id === operationResult.groupAId
      && group.title === `Regression A renamed ${operationResult.suffix}`));
    console.log('PASS manual export writes valid group JSON');

    const controlTargetResult = await browserClient.send('Target.createTarget', {
      url: 'about:blank',
    });
    const controlTarget = await waitFor(async() => {
      const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
      return targets.find(target => target.id === controlTargetResult.targetId);
    }, 'service worker control page');
    controlPage = await new CdpClient(controlTarget.webSocketDebuggerUrl).connect();
    await controlPage.send('ServiceWorker.enable');

    const workerVersion = await waitFor(() => {
      const versions = controlPage.events
        .filter(event => event.method === 'ServiceWorker.workerVersionUpdated')
        .flatMap(event => event.params.versions);
      return versions.find(versionInfo => versionInfo.scriptURL === firstWorkerTarget.url);
    }, 'service worker version metadata');
    await controlPage.send('ServiceWorker.stopWorker', {
      versionId: workerVersion.versionId,
    });
    worker.close();
    worker = null;

    await delay(500);
    await browserClient.send('Target.createTarget', {
      url: `chrome-extension://${extensionId}/popup/popup.html?after-reload=1`,
    });

    const restartedWorkerTarget = await waitFor(async() => {
      const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
      return targets.find(target => target.type === 'service_worker'
        && target.url === firstWorkerTarget.url
        && target.id !== firstWorkerTarget.id);
    }, 'restarted extension service worker');
    worker = await new CdpClient(restartedWorkerTarget.webSocketDebuggerUrl).connect();
    await worker.send('Runtime.enable');
    const persisted = await waitFor(() => worker.evaluate(`(() => {
      if (!globalThis.GroupManager || !globalThis.OptionManager
          || !globalThis.BackgroundHelper || BackgroundHelper.initialized !== true) return null;
      return {
        renamedGroup: GroupManager.groups.some(group =>
          group.id === ${JSON.stringify(operationResult.groupAId)}
          && group.title === ${JSON.stringify('Regression A renamed ' + operationResult.suffix)}),
        movedGroup: GroupManager.groups.some(group =>
          group.id === ${JSON.stringify(operationResult.groupBId)}
          && group.tabs.some(tab => tab.url.includes(${JSON.stringify('shortcut-help.html?stg-regression=' + operationResult.suffix)}))),
        theme: OptionManager.getOptionValue('popup-whiteTheme'),
        groups: GroupManager.groups.map(group => ({
          id: group.id,
          title: group.title,
          windowId: group.windowId,
          urls: group.tabs.map(tab => tab.url),
        })),
      };
    })()`), 'state restored after service worker reload');
    if (!persisted.renamedGroup || !persisted.movedGroup
        || persisted.theme !== operationResult.expectedTheme) {
      console.error('Persisted state:', JSON.stringify(persisted, null, 2));
    }
    assert.equal(persisted.renamedGroup, true);
    assert.equal(persisted.movedGroup, true);
    assert.equal(persisted.theme, operationResult.expectedTheme);
    console.log('PASS groups, moved tab, and options survive service worker reload');

    console.log('Brave MV3 regression: 12 checks passed');
  } finally {
    if (page) page.close();
    if (optionsPage) optionsPage.close();
    if (controlPage) controlPage.close();
    if (worker) worker.close();
    if (browserClient) browserClient.close();
    if (process.platform === 'win32' && browser.pid) {
      spawnSync('taskkill.exe', ['/PID', String(browser.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
    } else {
      browser.kill();
      await Promise.race([
        new Promise(resolve => browser.once('exit', resolve)),
        delay(3000),
      ]);
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

if (require.main === module) {
  run().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
  });
}

module.exports = {
  CdpClient,
  delay,
  findBrave,
  getFreePort,
  getJson,
  waitFor,
};
