import Utils from '../utils/utils'
import GroupManager from './groupmanager'
import SELECTOR_TYPE from './SELECTOR_TYPE'

const ImportSelector = {};
globalThis.ImportSelector = ImportSelector
ImportSelector.STORAGE_KEY = "mv3ImportSelectorState";

ImportSelector.WINDOW_ID = browser.windows.WINDOW_ID_NONE;

// Export or Import
ImportSelector.type = SELECTOR_TYPE.IMPORT;
// The groups currently under selection (never directly the groups in place)
ImportSelector.groups = [];
// What kind of groups (Example: my-groups.json, back-up-10-1993..)
ImportSelector.file = "No groups selected";

ImportSelector.persistState = function() {
  return browser.storage.local.set({
    [ImportSelector.STORAGE_KEY]: {
      windowId: ImportSelector.WINDOW_ID,
      type: ImportSelector.type,
      groups: ImportSelector.groups,
      file: ImportSelector.file,
    },
  });
}

ImportSelector.restoreState = async function() {
  const stored = await browser.storage.local.get(ImportSelector.STORAGE_KEY);
  const state = stored[ImportSelector.STORAGE_KEY];
  if (!state) {
    return;
  }
  ImportSelector.WINDOW_ID = state.windowId;
  ImportSelector.type = state.type;
  ImportSelector.groups = state.groups || [];
  ImportSelector.file = state.file || ImportSelector.file;
}

ImportSelector.validateWindow = async function() {
  if (ImportSelector.WINDOW_ID === browser.windows.WINDOW_ID_NONE) {
    return;
  }

  try {
    await browser.windows.get(ImportSelector.WINDOW_ID);
  } catch (e) {
    ImportSelector.WINDOW_ID = browser.windows.WINDOW_ID_NONE;
    await ImportSelector.clearState();
  }
}

ImportSelector.clearState = function() {
  return browser.storage.local.remove(ImportSelector.STORAGE_KEY);
}


ImportSelector.onOpenGroupsSelector = async function({
  title=ImportSelector.file,
  groups=[],
  type=SELECTOR_TYPE.IMPORT,
  force=false,
}={}) {
  await ImportSelector.restoreState();
  await ImportSelector.validateWindow();
  if (groups.length === 0 && !force) {
    browser.notifications.create({
      "type": "basic",
      "iconUrl": browser.runtime.getURL("/share/icons/tabspace-active-64.png"),
      "title": type + " " + title,
      "message": "The group list was empty...",
      "eventTime": 4000,
    });
    return;
  }
  if (GroupManager.checkCorruptedGroups(groups)) {
    browser.notifications.create({
      "type": "basic",
      "iconUrl": browser.runtime.getURL("/share/icons/tabspace-active-64.png"),
      "title": type + " " + title,
      "message": "The group list is corrupted... It is impossible to load it.",
      "eventTime": 4000,
    });
    return;
  }

  const preUrl = Utils.SELECTOR_PAGE_URL
  + "?title=" + type + " " + title
  + "&type=" + type;
  const url = browser.runtime.getURL(
    preUrl
  );

  const windowInfo = {
    width: 850,
    top: 50,
  };

  ImportSelector.groups = GroupManager.getGroupsWithoutPrivate(
    groups.filter(group => group.tabs.length) // Only non empty groups
  );
  GroupManager.prepareGroups(ImportSelector.groups);
  ImportSelector.type = type;
  ImportSelector.file = title;

  if (ImportSelector.WINDOW_ID === browser.windows.WINDOW_ID_NONE) {
    windowInfo["url"] = url;
    // The window is not visible
    windowInfo["type"] = "popup";
    ImportSelector.WINDOW_ID = (await browser.windows.create(windowInfo)).id;

  } else {
    const tab = await browser.tabs.query({
      windowId: ImportSelector.WINDOW_ID,
      index: 0,
    });
    await browser.tabs.update(tab[0].id, {
      url,
    });
    windowInfo["focused"] = true;
    await browser.windows.update(ImportSelector.WINDOW_ID, windowInfo);
  }
  await ImportSelector.persistState();
}

ImportSelector.wasClosedGroupsSelector = async function(windowId) {
  if (windowId === ImportSelector.WINDOW_ID && windowId !== browser.windows.WINDOW_ID_NONE) {
    ImportSelector.WINDOW_ID = browser.windows.WINDOW_ID_NONE;
    await ImportSelector.clearState();
  }
}

ImportSelector.closeGroupsSelector = async function() {
  if (ImportSelector.WINDOW_ID !== browser.windows.WINDOW_ID_NONE) {
    try {
      await browser.windows.remove(ImportSelector.WINDOW_ID);
    } catch (e) {return} finally {
      ImportSelector.WINDOW_ID = browser.windows.WINDOW_ID_NONE;
      await ImportSelector.clearState();
    }
  }
}

export default ImportSelector
