import BackgroundHelper from '../core/backgroundHelper'
import OptionManager from '../core/optionmanager'
import TabManager from '../core/tabmanager/tabManager'

const OptionsMessenger = {};

OptionsMessenger.optionMessenger = async function(message) {
  switch (message.task) {
  case "Option:Ask":
    return BackgroundHelper.refreshOptionsUI();
  case "BackupList:Ask":
    return BackgroundHelper.refreshBackupListUI();
  case "Option:Change":
    await OptionManager.updateOption(message.params.optionName, message.params.optionValue);
    BackgroundHelper.refreshOptionsUI();
    return;
  case "Option:BackUp":
    return BackgroundHelper.onBookmarkSave();
  case "Option:Import":
    await BackgroundHelper.onImportGroups(message.params);
    BackgroundHelper.refreshUi();
    return;
  case "Option:Export":
    return BackgroundHelper.onExportGroups();
  case "Option:DeleteAllGroups":
    return BackgroundHelper.onRemoveAllGroups();
  case "Option:ReloadGroups":
    return BackgroundHelper.onReloadGroups();
  case "Option:OpenGuide":
    return BackgroundHelper.onOpenGuide();
  case "Option:UndiscardLazyTabs":
    return TabManager.undiscardAll();
    /*   case "Option:CloseAllHiddenTabs":
    TabHidden.removeAllHiddenTabs();
    break; */
  case "Option:RemoveBackUp":
    return BackgroundHelper.onRemoveBackUp(message.params.id);
  case "Option:ImportBackUp" :
    return BackgroundHelper.onImportBackUp(message.params.id);
  case "Option:ExportBackUp" :
    return BackgroundHelper.onExportBackUp(message.params.id);
  }
}

export default OptionsMessenger
