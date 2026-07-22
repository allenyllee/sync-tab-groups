/**
 * Everything related to do automatic/manual backup
 */
import Utils from '../utils/utils'
import LogManager from '../error/logmanager'
import OptionManager from '../core/optionmanager'
import GroupManager from '../core/groupmanager'
import OPTION_CONSTANTS from '../core/OPTION_CONSTANTS'
import BACKUP_LOCATION from './BACKUP_LOCATION'

const BackupStorage = {};
BackupStorage.ALARM_PREFIX = "sync-tab-groups-download-backup-";
BackupStorage.LOCATION = BACKUP_LOCATION;

BackupStorage.TIMERS = Utils.setObjectPropertiesWith(OPTION_CONSTANTS.TIMERS(), undefined);


BackupStorage.init = async function() {
  if (!OptionManager.options.backup.download.enable) {
    return;
  }

  // Start enable timers
  BackupStorage.TIMERS = {};
  const timers = [];
  for (let t in OptionManager.options.backup.download.time) {
    if (OptionManager.options.backup.download.time[t]) {
      timers.push(BackupStorage.startTimer(t));
    } else {
      BackupStorage.TIMERS[t] = undefined
    }
  }
  await Promise.all(timers);
}


BackupStorage.stopAll = function() {
  // Stop all timers
  return Promise.all(Object.keys(BackupStorage.TIMERS)
    .map(time => BackupStorage.stopTimer(time)));
}

// Stop a specific timer
BackupStorage.stopTimer = function(timer) {
  BackupStorage.TIMERS[timer] = undefined;
  return browser.alarms.clear(BackupStorage.ALARM_PREFIX + timer);
}

/**
  * Start a specific timer
  * Stop previous one if there was
  */
BackupStorage.startTimer = async function(timer) {
  await BackupStorage.stopTimer(timer);
  const periodInMinutes = OPTION_CONSTANTS.TIMERS()[timer] / (60 * 1000);
  browser.alarms.create(BackupStorage.ALARM_PREFIX + timer, {
    delayInMinutes: periodInMinutes,
    periodInMinutes,
  });
  BackupStorage.TIMERS[timer] = true;
}

BackupStorage.onAlarm = async function(alarm) {
  if (!alarm.name.startsWith(BackupStorage.ALARM_PREFIX)) {
    return false;
  }

  const timer = alarm.name.substring(BackupStorage.ALARM_PREFIX.length);
  await BackupStorage.backup(timer.substring(2));
  return true;
}



/**
 *  Save the groups in a json file in BackupStorage.LOCATION subfolder in the browser download folder.
 * The file name is "synctabgroups-backup-" with time variable as a suffix.
 * Every new back up overwrites the previous one.
 * A download is immediately removed from the history.
 */
BackupStorage.backup = async function(time, groups=GroupManager.groups) {
  try {
    // Avoid corrupted backup
    if (GroupManager.checkCorruptedGroups(groups)) {
      return;
    }

    let url = Utils.createGroupsJsonFile(
      GroupManager.getGroupsWithoutPrivate(groups)
    );

    const manual = time === "manual";
    if (manual) {
      const date = new Date();
      time = "manual-" + date.getFullYear()
        + ("0" + (date.getMonth() + 1)).slice(-2)
        + ("0" + date.getDate()).slice(-2)
        + "-" + ("0" + date.getHours()).slice(-2)
        + ("0" + date.getMinutes()).slice(-2)
        + ("0" + date.getSeconds()).slice(-2)
        + "-" + ("00" + date.getMilliseconds()).slice(-3);
    }

    let id = await browser.downloads.download({
      url: url,
      filename: BackupStorage.LOCATION + "synctabgroups-backup-" + time + ".json",
      conflictAction: manual ? "uniquify" : "overwrite",
      saveAs: false,
    });

    // Wait complete download for Chrome
    await Utils.waitDownload(id);

    await browser.downloads.erase({
      id: id,
    });
    Utils.revokeFileUrl(url);
  } catch (e) {
    LogManager.error(e, {args: arguments});
  }
}
export default BackupStorage
