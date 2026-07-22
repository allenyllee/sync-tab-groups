import Utils from '../utils/utils'
import LogManager from '../error/logmanager'
import GroupManager from '../core/groupmanager'
import TabManager from '../core/tabmanager/tabManager'
import BackgroundHelper from '../core/backgroundHelper'
import TaskManager from '../utils/taskManager'

import getGroupIndexSortedByPosition from './getGroupIndexSortedByPosition'
import ExtensionStorageManager from '../storage/storageManager'
import Lifecycle from '../lifecycle'

const ContextMenu = {};
globalThis.ContextMenu = ContextMenu;

ContextMenu.MoveTabMenu_ID = "stg-move-tab-group-";
ContextMenu.SpecialActionMenu_ID = "stg-special-actions-";
ContextMenu.MoveTabMenuIds = [];
ContextMenu.SpecialActionMenuIds = [];

ContextMenu.repeatedtask = new TaskManager.RepeatedTask(1000);

ContextMenu.occupied = false;
ContextMenu.again = false;

// webextension-polyfill cannot promisify contextMenus.create because Chrome
// returns the menu id synchronously. Use the native callback on Chromium so
// creation order is real and runtime.lastError is always consumed.
ContextMenu.createMenu = function(properties) {
  if (!Utils.isChrome()) {
    return browser.contextMenus.create(properties);
  }
  return new Promise((resolve, reject) => {
    globalThis.chrome.contextMenus.create(properties, () => {
      const error = globalThis.chrome.runtime.lastError;
      if (error) {
        reject(Error(error.message));
      } else {
        resolve(properties.id);
      }
    });
  });
};

ContextMenu.removeMenu = function(id) {
  if (!Utils.isChrome()) {
    return browser.contextMenus.remove(id).then(() => true, () => false);
  }
  return new Promise(resolve => {
    globalThis.chrome.contextMenus.remove(id, () => {
      const removed = globalThis.chrome.runtime.lastError == null;
      resolve(removed);
    });
  });
};

ContextMenu.removeAllMenus = function() {
  if (!Utils.isChrome()) {
    return browser.contextMenus.removeAll();
  }
  return new Promise((resolve, reject) => {
    globalThis.chrome.contextMenus.removeAll(() => {
      const error = globalThis.chrome.runtime.lastError;
      if (error) {
        reject(Error(error.message));
      } else {
        resolve();
      }
    });
  });
};

ContextMenu.createMoveTabMenu = async function({throwOnError=false}={}) {
  try {
    // Security for avoiding concurrency
    if (ContextMenu.occupied) {
      ContextMenu.again = true;
      return;
    }
    ContextMenu.occupied = true;

    // Remove children before their parent. Chromium removes a parent's children
    // automatically, so removing the parent first leaves stale ids and aborts
    // the rebuild when the children can no longer be found.
    const menuIdsToRemove = ContextMenu.MoveTabMenuIds.slice().reverse();
    ContextMenu.MoveTabMenuIds = [];
    for (let id of menuIdsToRemove) {
      // The browser may already have removed an item during a worker restart.
      // Continue rebuilding from the authoritative group list.
      await ContextMenu.removeMenu(id);
    }
    await Utils.wait(100)

    const contexts = ["page"];
    if (!Utils.isChrome()) { // Incompatible Chrome: "tab" in context menus
      contexts.push("tab");
    }

    let parentId = ContextMenu.MoveTabMenu_ID + "title";
    const contextManageGroups = {
      id: parentId,
      title: browser.i18n.getMessage("move_tab_group"),
      contexts: contexts,
    };
    if (!Utils.isChrome()) {
      contextManageGroups.icons = {
        "64": "/share/icons/tabspace-active-64.png",
        "32": "/share/icons/tabspace-active-32.png",
      };
    }
    await ContextMenu.createMenu(contextManageGroups);
    ContextMenu.MoveTabMenuIds.push(parentId);


    let currentWindowId;
    try {
      currentWindowId = (await browser.windows.getLastFocused()).id;
    } catch (e) {
      LogManager.warning(e.message);
    }


    let groups = GroupManager.getCopy();
    let sortedIndex = getGroupIndexSortedByPosition(groups);
    for (let i of sortedIndex) {
      const menuId = ContextMenu.MoveTabMenu_ID + groups[i].id;
      const openPrefix = groups[i].windowId !== browser.windows.WINDOW_ID_NONE ? "[OPEN]" : "";
      await ContextMenu.createMenu({
        id: menuId,
        title: openPrefix + " " + Utils.getGroupTitle(groups[i]),
        contexts: contexts,
        parentId: parentId,
        enabled: currentWindowId !== groups[i].windowId,
      });
      ContextMenu.MoveTabMenuIds.push(menuId);
    }

    const separatorId = ContextMenu.MoveTabMenu_ID + "separator-2";
    await ContextMenu.createMenu({
      id: separatorId,
      type: "separator",
      contexts: contexts,
      parentId: parentId,
    });
    ContextMenu.MoveTabMenuIds.push(separatorId);

    const newGroupId = ContextMenu.MoveTabMenu_ID + "new";
    await ContextMenu.createMenu({
      id: newGroupId,
      title: browser.i18n.getMessage("add_group"),
      contexts: contexts,
      parentId: parentId,
    });
    ContextMenu.MoveTabMenuIds.push(newGroupId);

    if (ContextMenu.again) {
      setTimeout(() => {
        ContextMenu.repeatedtask.add(() => ContextMenu.createMoveTabMenu())
      }, 0);
      ContextMenu.again = false;
    }
  } catch (e) {
    if (throwOnError) {
      throw e;
    }
    LogManager.error(e);
  } finally {
    ContextMenu.occupied = false;
  }
};

ContextMenu.updateMoveFocus = async function(disabledId) {
  try {
    if (ContextMenu.occupied) {
      //ContextMenu.again = true;
      return;
    }
    ContextMenu.occupied = true;

    await Promise.all(ContextMenu.MoveTabMenuIds.map((id) => {
      let order = id.substring(ContextMenu.MoveTabMenu_ID.length);
      let groupId = parseInt(order);
      if (groupId >= 0) {
        let groupIndex = GroupManager.getGroupIndexFromGroupId(groupId, {
          error: false,
        });
        if (groupIndex >= 0) {
          return browser.contextMenus.update(
            id, {
              enabled: disabledId !== GroupManager.groups[groupIndex].windowId,
            });
        }
      }
      return Promise.resolve();
    }));
    ContextMenu.occupied = false;
    return;
  } catch (e) {
    LogManager.error(e, null, {showNotification: false});
  } finally {
    ContextMenu.occupied = false;
  }
}

ContextMenu.createSpecialActionMenu = async function() {
  let contextManageGroups = {
    id: ContextMenu.SpecialActionMenu_ID + "manage_groups",
    title: browser.i18n.getMessage("group_manager"),
    contexts: ['action'],

  };
  if (Utils.isFirefox()) {
    contextManageGroups.icons = {
      "64": "/share/icons/list-64.png",
      "32": "/share/icons/list-32.png",
    };
  }
  await ContextMenu.createMenu(contextManageGroups);

  let contextExportGroups = {
    id: ContextMenu.SpecialActionMenu_ID + "export_groups",
    title: browser.i18n.getMessage("export_groups"),
    contexts: ['action'],
  };
  if (Utils.isFirefox()) {
    contextExportGroups.icons = {
      "64": "/share/icons/upload-64.png",
      "32": "/share/icons/upload-32.png",
    };
  }
  await ContextMenu.createMenu(contextExportGroups);

  let contextBackUp = {
    id: ContextMenu.SpecialActionMenu_ID + "backup",
    title: browser.i18n.getMessage("contextmenu_backup"),
    contexts: ['action'],
  };
  if (Utils.isFirefox()) {
    contextBackUp.icons = {
      "64": "/share/icons/hdd-o-64.png",
      "32": "/share/icons/hdd-o-32.png",
    };
  }
  await ContextMenu.createMenu(contextBackUp);
  /* TODO: not working can't ask file, wait select group in popup window with filter
  browser.contextMenus.create({
    id: ContextMenu.SpecialActionMenu_ID + "import_groups",
    title: browser.i18n.getMessage("import_groups"),
    contexts: ['action'],
    icons: {
      "64": "/share/icons/download-64.png",
      "32": "/share/icons/download-32.png"
    },
  });
  */
  /*  TODO: end of bookmark auto-save
  browser.contextMenus.create({
    id: ContextMenu.SpecialActionMenu_ID + "save_bookmarks_groups",
    title: browser.i18n.getMessage("save_bookmarks_groups"),
    contexts: ['action'],
    icons: {
      "64": "/share/icons/star-64.png",
      "32": "/share/icons/star-32.png"
    },
  });
  */

  let contextOpenPreferences = {
    id: ContextMenu.SpecialActionMenu_ID + "open_preferences",
    title: browser.i18n.getMessage("contextmenu_preferences"),
    contexts: ['action'],
  };
  if (Utils.isFirefox()) {
    contextOpenPreferences.icons = {
      "64": "/share/icons/gear-64.png",
      "32": "/share/icons/gear-32.png",
    };
  }
  await ContextMenu.createMenu(contextOpenPreferences);

  /* TODO: Add Guide
  let contextGuide = {
    id: ContextMenu.SpecialActionMenu_ID + "guide",
    title: browser.i18n.getMessage("options_guide"),
    contexts: ['action'],
  };
  if (Utils.isFirefox()) { // Incompatible Chrome: "tab" in context menus
    contextGuide.icons = {
      "64": "/share/icons/info-64.png",
      "32": "/share/icons/info-32.png"
    };
  }
  browser.contextMenus.create(contextGuide);
  */
  if (Utils.DEBUG_MODE) {
    let contextTestPreferences = {
      id: ContextMenu.SpecialActionMenu_ID + "open_tests",
      title: "Tests",
      contexts: ['action'],
    };
    await ContextMenu.createMenu(contextTestPreferences);
  }
}

ContextMenu.MoveTabMenuListener = async function(info, tab) {
  await Lifecycle.ready();
  if (info.menuItemId.includes(ContextMenu.MoveTabMenu_ID)) {
    let order = info.menuItemId.substring(ContextMenu.MoveTabMenu_ID.length, info.menuItemId.length);
    let groupId = parseInt(order);
    if (groupId >= 0) {
      TabManager.moveUnFollowedTabToGroup(
        tab.id,
        groupId
      );
    } else if (order === "new") {
      TabManager.moveUnFollowedTabToNewGroup(tab.id);
    }
  }
};

ContextMenu.SpecialActionMenuListener = async function(info, tab) {
  await Lifecycle.ready();
  if (info.menuItemId.includes(ContextMenu.SpecialActionMenu_ID)) {
    let order = info.menuItemId.substring(ContextMenu.SpecialActionMenu_ID.length, info.menuItemId.length);
    switch (order) {
    case "export_groups":
      BackgroundHelper.onExportGroups();
      break;
    case "save_bookmarks_groups":
      BackgroundHelper.onBookmarkSave();
      break;
    case "open_preferences":
      BackgroundHelper.onOpenSettings();
      break;
    case "manage_groups":
      Utils.openUrlOncePerWindow(browser.runtime.getURL(
        "/manage/manage-groups.html"
      ));
      break;
    case "backup":
      ExtensionStorageManager.Backup.backup("manual");
      break;
    case "guide":
      BackgroundHelper.onOpenGuide();
      break;
    case "open_tests":
      Utils.openUrlOncePerWindow(
        browser.runtime.getURL("/tests/test-page/test-page.html"),
        true,
      );
      break;
    }
  }
};

ContextMenu.registerEventListeners = function() {
  browser.contextMenus.onClicked.addListener(ContextMenu.SpecialActionMenuListener);
  browser.contextMenus.onClicked.addListener(ContextMenu.MoveTabMenuListener);
};

ContextMenu.rebuildContextMenus = async function() {
  let initialized = false;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Chromium keeps context menus across MV3 worker restarts. Its Promise
      // wrapper can resolve before removal has completed during browser
      // startup, so use the native callback and retry the whole rebuild.
      await ContextMenu.removeAllMenus();
      ContextMenu.MoveTabMenuIds = [];
      ContextMenu.SpecialActionMenuIds = [];
      await ContextMenu.createMoveTabMenu({throwOnError: true});
      await ContextMenu.createSpecialActionMenu();
      initialized = true;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await Utils.wait(attempt * 250);
      }
    }
  }
  if (!initialized) {
    throw lastError;
  }
};

ContextMenu.initContextMenus = async function() {
  await ContextMenu.rebuildContextMenus();

  GroupManager.eventlistener.on(GroupManager.EVENT_CHANGE,
    () => {
      ContextMenu.repeatedtask.add(
        () => {
          ContextMenu.createMoveTabMenu();
        }
      )
    });
};

export default ContextMenu
