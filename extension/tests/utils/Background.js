import BackgroundHelper from '../../background/core/backgroundHelper'
import GroupManager from '../../background/core/groupmanager'
import ImportSelector from '../../background/core/importSelector'
import OptionManager from '../../background/core/optionmanager'
import TabHidden from '../../background/core/tabhidden'
import TabManager from '../../background/core/tabmanager/tabManager'
import WindowManager from '../../background/core/windowmanager'
import LogManager from '../../background/error/logmanager'
import Events from '../../background/event/event'
import Lifecycle from '../../background/lifecycle'
import ExtensionStorageManager from '../../background/storage/storageManager'
import TaskManager from '../../background/utils/taskManager'
import Utils from '../../background/utils/utils'

// MV3 service workers do not expose a background Window. Unit tests instead
// load the same modules into the test-page bundle and exercise those local
// instances directly.
const Background = {
  BackgroundHelper,
  Error,
  Events,
  ExtensionStorageManager,
  GroupManager,
  ImportSelector,
  LogManager,
  OptionManager,
  TabHidden,
  TabManager,
  TaskManager,
  Utils,
  WindowManager,
  clearInterval,
  clearTimeout,
  setInterval,
  setTimeout,
}

window.Background = Background

const waitInit = (async() => {
  const nativeCreateWindow = browser.windows.create.bind(browser.windows);
  const nativeGetLastFocused = browser.windows.getLastFocused.bind(browser.windows);
  const nativeUpdateWindow = browser.windows.update.bind(browser.windows);
  let lastFocusedWindowId = (await browser.windows.getCurrent()).id;

  // Headless Chromium does not consistently update getLastFocused(). Keep the
  // browser-facing behavior deterministic for the legacy window integration
  // suite without changing the production implementation.
  browser.windows.create = async function(createData) {
    const createdWindow = await nativeCreateWindow(createData);
    if (!createData || createData.focused !== false) {
      lastFocusedWindowId = createdWindow.id;
    }
    return createdWindow;
  };
  browser.windows.update = async function(windowId, updateInfo) {
    const updatedWindow = await nativeUpdateWindow(windowId, updateInfo);
    if (updateInfo.focused) {
      lastFocusedWindowId = windowId;
    }
    return updatedWindow;
  };
  browser.windows.getLastFocused = async function(getInfo) {
    try {
      return await browser.windows.get(lastFocusedWindowId, getInfo);
    } catch (error) {
      return nativeGetLastFocused(getInfo);
    }
  };

  LogManager.init();
  Events.Tabs.initTabsEventListener();
  Events.Windows.initWindowsEventListener();
  await OptionManager.init();
  await GroupManager.init();
  await TabHidden.onStartInitialization();
  BackgroundHelper.install = false;
  BackgroundHelper.initialized = true;
  Lifecycle.complete();
  return Background;
})().catch(error => {
  Lifecycle.fail(error);
  throw error;
})

export {Background, waitInit}
