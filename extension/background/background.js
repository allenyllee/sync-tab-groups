/**
 * Entry Point of the Extension
 * Init the Data -> Events
 * Manage the messages with all the extensive parts of the Extension
 */

import LogManager from "./error/logmanager"
import Utils from './utils/utils'
import ExtensionStorageManager from './storage/storageManager'
import Events from './event/event'
import Messenger from './messenger/messenger'
import TabManager from './core/tabmanager/tabManager'
import OptionManager from './core/optionmanager'
import GroupManager from './core/groupmanager'
import ContextMenu from './core/contextmenus'
import BackgroundHelper from './core/backgroundHelper'
import Lifecycle from './lifecycle'
import TabHidden from './core/tabhidden'

LogManager.LOCATION = LogManager.BACK

function registerBrowserEventListeners() {
  LogManager.init();
  Events.Tabs.initTabsEventListener();
  Events.Windows.initWindowsEventListener();
  Events.Commands.initCommandsEventListener();
  ContextMenu.registerEventListeners();

  browser.runtime.onMessage.addListener(async(message) => {
    await Lifecycle.ready();
    await Messenger.Groups.popupMessenger(message);
    await GroupManager.waitForStore();
    await Messenger.Options.optionMessenger(message);
    await Messenger.Selector.selectorMessenger(message);
  });

  browser.alarms.onAlarm.addListener(async(alarm) => {
    await Lifecycle.ready();
    if (await ExtensionStorageManager.Local.onAlarm(alarm)) {
      return;
    }
    if (await ExtensionStorageManager.Backup.onAlarm(alarm)) {
      return;
    }
    await TabHidden.onAlarm(alarm);
  });
}

/**
 * Only read groups data, never write directly
 */
async function init() {
  LogManager.information(LogManager.EXTENSION_START);

  await OptionManager.init();
  await GroupManager.init();
  await TabHidden.onStartInitialization();
  await TabHidden.startCleaningUnknownHiddenTabsProcess();

  Events.Install.prepareExtensionForUpdate(
    BackgroundHelper.lastVersion,
    (browser.runtime.getManifest()).version
  );

  Events.Extension.initSendDataEventListener();
  await ContextMenu.initContextMenus();

  Utils.setBrowserActionIcon(OptionManager.options.popup.whiteTheme);

  BackgroundHelper.refreshUi();
  BackgroundHelper.refreshOptionsUI();

  await ExtensionStorageManager.Local.planBackUp();
  await ExtensionStorageManager.Backup.init();
  BackgroundHelper.install = false;
  BackgroundHelper.initialized = true;

  LogManager.information(LogManager.EXTENSION_INITIALIZED, {
    groups: GroupManager.groups.map((group) => ({
      id: group.id,
      tabsLength: group.tabs.length,
      windowId: group.windowId,
    })),
  });
}

/*** Init CRITICAL Event ***/
browser.runtime.onInstalled.addListener(async(details) => {
  if (details.reason === "install") {
    BackgroundHelper.install = true;
  } else if (details.reason === "update") {
    BackgroundHelper.lastVersion = details.previousVersion;
  }

  await Lifecycle.ready();

  // Only when the extension is installed for the first time
  if (details.reason === "install") {
    Events.Install.onNewInstall();
    LogManager.information(LogManager.EXTENSION_INSTALLED);
  // Extension update detection
  } else if (details.reason === "update"
      && (browser.runtime.getManifest()).version !== details.previousVersion) {
    Events.Install.onUpdate(details.previousVersion);
    LogManager.information(LogManager.EXTENSION_UPDATED);
  }
});

if (Utils.isChrome()) { // Extension tabs are closed on update
  browser.runtime.onUpdateAvailable.addListener(TabManager.undiscardAll);
}

// START of the extension
registerBrowserEventListeners();
init().then(Lifecycle.complete, Lifecycle.fail);
