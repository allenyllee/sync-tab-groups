import TabManager from '../core/tabmanager/tabManager'
import OptionManager from '../core/optionmanager'
import TabHidden from '../core/tabhidden'
import Utils from '../utils/utils'
import Lifecycle from '../lifecycle'

const TabsEvents = {};

TabsEvents.initTabsEventListener = function() {
  browser.tabs.onActivated.addListener(async(activeInfo) => {
    await Lifecycle.ready();
    // Necessary for Chrome, this event is fired before the onRemovedWindow event
    // Else the group is finally updated with empty tabs.
    await Utils.wait(300);
    return TabManager.updateTabsInGroup(activeInfo.windowId);
  });
  browser.tabs.onCreated.addListener(async(tab) => {
    await Lifecycle.ready();
    return TabManager.updateTabsInGroup(tab.windowId);
  });
  browser.tabs.onRemoved.addListener(async(tabId, removeInfo) => {
    await Lifecycle.ready();
    /* Bug: onRemoved is fired before the tab is really close
     * Workaround: keep a delay
     * https://bugzilla.mozilla.org/show_bug.cgi?id=1396758
     */
    await Utils.wait(300);
    if (!removeInfo.isWindowClosing) {
      await TabManager.updateTabsInGroup(removeInfo.windowId);
    }
    if (Utils.hasHideFunction() && OptionManager.isClosingHidden()) {
      TabHidden.changeHiddenStateForTab(tabId);
    }
  });
  browser.tabs.onMoved.addListener(async(tabId, moveInfo) => {
    await Lifecycle.ready();
    return TabManager.updateTabsInGroup(moveInfo.windowId);
  });
  browser.tabs.onUpdated.addListener(async(tabId, changeInfo, tab) => {
    await Lifecycle.ready();
    return TabManager.updateTabsInGroup(tab.windowId);
  });
  browser.tabs.onAttached.addListener(async(tabId, attachInfo) => {
    await Lifecycle.ready();
    return TabManager.updateTabsInGroup(attachInfo.newWindowId);
  });
  browser.tabs.onDetached.addListener(async(tabId, detachInfo) => {
    await Lifecycle.ready();
    return TabManager.updateTabsInGroup(detachInfo.oldWindowId);
  });
}

export default TabsEvents
