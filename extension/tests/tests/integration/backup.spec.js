import TestManager from '../../utils/TestManager'
import OPTION_CONSTANTS from '../../../background/core/OPTION_CONSTANTS'

describe("Download Back Up: ", ()=>{
  // Keep previous states
  beforeAll(TestManager.initIntegrationBeforeAll());
  // Set back previous states
  afterAll(TestManager.initIntegrationAfterAll());

  it("Check alarms are triggering automatic backup", async()=>{
    // Set options
    window.Background.OptionManager.options.backup.download = window.Background.Utils.getCopy(window.Background.OptionManager.options.backup.download);

    window.Background.OptionManager.options.backup.download.enable = true;
    window.Background.OptionManager.options.backup.download.time = window.Background.Utils.setObjectPropertiesWith(OPTION_CONSTANTS.TIMERS(), false);

    // Spy
    spyOn(window.Background.ExtensionStorageManager.Backup, "backup");

    for (let time in OPTION_CONSTANTS.TIMERS()) {
      window.Background.OptionManager.options.backup.download.time[time] = true;
      await window.Background.ExtensionStorageManager.Backup.init();
      const alarmName = window.Background.ExtensionStorageManager.Backup.ALARM_PREFIX + time;
      const alarm = await browser.alarms.get(alarmName);
      expect(alarm).toBeDefined();
      await window.Background.ExtensionStorageManager.Backup.init();
      expect((await browser.alarms.get(alarmName)).scheduledTime).toEqual(alarm.scheduledTime);
      await window.Background.ExtensionStorageManager.Backup.onAlarm({name: alarmName});

      expect(window.Background.ExtensionStorageManager.Backup.backup).toHaveBeenCalledWith(time.substring(2));

      window.Background.OptionManager.options.backup.download.time[time] = false;
    }
    await window.Background.ExtensionStorageManager.Backup.stopAll();
  });
});
