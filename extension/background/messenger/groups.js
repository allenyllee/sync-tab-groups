import BackgroundHelper from '../core/backgroundHelper'
const GroupsMessenger = {};

// Event from: popup
GroupsMessenger.popupMessenger = async function(message) {
  switch (message.task) {
  case "Group:Add":
    return BackgroundHelper.onGroupAdd(message.params);
  case "Group:AddWithTab":
    return BackgroundHelper.onGroupAddWithTab(message.params);
  case "Group:Close":
    return BackgroundHelper.onGroupClose(message.params);
  case "Group:ChangePosition":
    return BackgroundHelper.onGroupChangePosition(message.params);
  case "Group:Remove":
    return BackgroundHelper.onGroupRemove(message.params);
  case "Group:Rename":
    return BackgroundHelper.onGroupRename(message.params);
  case "Group:Select":
    return BackgroundHelper.onGroupSelect(message.params);
  case "Group:MoveTab":
    return BackgroundHelper.onMoveTabToGroup(message.params);
  case "Tab:Select":
    return BackgroundHelper.onTabSelect(message.params);
  case "Group:OpenGroupInNewWindow":
    return BackgroundHelper.onOpenGroupInNewWindow(message.params);
  case "Data:Ask":
    return BackgroundHelper.refreshData(message.params);
  case "App:OpenSettings":
    return BackgroundHelper.onOpenSettings();
  case "Window:Sync":
    return BackgroundHelper.changeSynchronizationStateOfWindow(message.params);
  case "Tab:Open":
    return BackgroundHelper.onTabOpen(message.params);
  case "Tab:Close":
    return BackgroundHelper.onTabClose(message.params);
  case "Tab:ChangePin":
    return BackgroundHelper.onTabChangePin(message.params);
  case "Group:Expand":
    return BackgroundHelper.onChangeExpand(message.params);
  case "Tab:RemoveHiddenTab":
    return BackgroundHelper.onRemoveHiddenTab(message.params);
  case "Group:RemoveHiddenTabsInGroup":
    return BackgroundHelper.onRemoveHiddenTabsInGroup(message.params);
  }
}

export default GroupsMessenger
