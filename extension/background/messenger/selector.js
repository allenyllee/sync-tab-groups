import Utils from '../utils/utils'
import ImportSelector from '../core/importSelector'
import BackgroundHelper from '../core/backgroundHelper'
import GroupManager from '../core/groupmanager'
import SELECTOR_TYPE from '../core/SELECTOR_TYPE'
import ExtensionStorageManager from '../storage/storageManager'

const SelectorMessenger = {};

SelectorMessenger.selectorMessenger = async function(message) {
  switch (message.task) {
  case "Ask:SelectorGroups":
    await ImportSelector.restoreState();
    return Utils.sendMessage("Selector:Groups", {
      groups: ImportSelector.groups,
    });
  case "Selector:Finish":
    return SelectorMessenger.manageFinish(message.params);
  case "Ask:Options":
    return BackgroundHelper.refreshOptionsUI();
  }
}

SelectorMessenger.manageFinish = async function({
  filter,
  importType,
}) {
  await ImportSelector.restoreState();
  let done = false;
  if (ImportSelector.type === SELECTOR_TYPE.EXPORT) {
    done = await ExtensionStorageManager.File.downloadGroups(
      GroupManager.filterGroups(
        ImportSelector.groups,
        filter,
      )
    );
  } else {
    let ids = GroupManager.addGroups(
      GroupManager.filterGroups(
        ImportSelector.groups,
        filter,
      ), {
        showNotification: true,
      });
    done = ids.length>0;
  }

  // In case of success
  if (done) {
    await ImportSelector.closeGroupsSelector();
  }
}

export default SelectorMessenger
