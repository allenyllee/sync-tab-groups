import TestManager from '../../utils/TestManager'

describe('Storage', () => {

  beforeAll(TestManager.initIntegrationBeforeAll());

  afterAll(TestManager.initIntegrationAfterAll());

  describe('Diff groups', () => {});

  // Each IT are lonely
  describe('Local Backup ', () => {
    beforeAll(async function() {});

    afterAll(async function() {});

    beforeEach(async function() {
      await browser.storage.local.set({backupList: {}});
    });

    describe('Low level function -', () => {
      it('Add a backup', async function() {
        const ref_groups = window.Background.Utils.getCopy(window.Background.GroupManager.groups);
        const ref_backupList = await window.Background.ExtensionStorageManager.Local.getBackUpList()

        const id = await window.Background.ExtensionStorageManager.Local.addBackup({groups: ref_groups});

        const backupList = await window.Background.ExtensionStorageManager.Local.getBackUpList(),
          backupGroups = await window.Background.ExtensionStorageManager.Local.getBackUp(id);

        const hasId = backupList.hasOwnProperty(id);

        expect(Object.keys(backupList).length - 1).toEqual(Object.keys(ref_backupList).length);
        expect(hasId).toBe(true);
        expect(backupGroups).toEqualGroups(ref_groups);
      });

      it('Remove a backup', async function() {
        const ref_groups = window.Background.Utils.getCopy(window.Background.GroupManager.groups);
        const id = await window.Background.ExtensionStorageManager.Local.addBackup({groups: ref_groups});

        await window.Background.ExtensionStorageManager.Local.removeBackup(id);

        const backupList = await window.Background.ExtensionStorageManager.Local.getBackUpList(),
          backupGroups = await window.Background.ExtensionStorageManager.Local.getBackUp(id);

        const hasId = backupList.hasOwnProperty(id);

        expect(Object.keys(backupList).length).toEqual(0);
        expect(hasId).toBe(false);
        expect(backupGroups).toBe(undefined);
      });

      it('Clean all backups', async function() {
        const ref_groups = window.Background.Utils.getCopy(window.Background.GroupManager.groups),
          length = 3;

        const ids = [];
        for (let i = 0; i < length; i++) {
          ids.push(await window.Background.ExtensionStorageManager.Local.addBackup({groups: ref_groups}));
          await window.Background.Utils.wait(50);
        }

        const backupListInter = await window.Background.ExtensionStorageManager.Local.getBackUpList();

        expect(Object.keys(backupListInter).length).toEqual(length);

        await window.Background.ExtensionStorageManager.Local.clearBackups();

        const backupList = await window.Background.ExtensionStorageManager.Local.getBackUpList();

        expect(Object.keys(backupList).length).toEqual(0);
      });

      it('respectMaxBackUp', async function() {
        const ref_groups = window.Background.Utils.getCopy(window.Background.GroupManager.groups),
          maxSave = 2,
          length = 5;

        const ids = [];
        for (let i = 0; i < length; i++) {
          ids.push(await window.Background.ExtensionStorageManager.Local.addBackup({groups: ref_groups}));
          await window.Background.Utils.wait(50);
        }

        expect(Object.keys(await window.Background.ExtensionStorageManager.Local.getBackUpList()).length).toEqual(length);

        await window.Background.ExtensionStorageManager.Local.respectMaxBackUp({maxSave});

        expect(Object.keys((await window.Background.ExtensionStorageManager.Local.getBackUpList())).length).toEqual(maxSave);

        await Promise.all(ids.map(async(id, index) => {
          if (index - maxSave > 0)
            return;

          expect((await window.Background.ExtensionStorageManager.Local.getBackUp(id))).toBe(undefined);
        }));
      })

      it('Update intervalTime option do not accept wrong values', async() => {
        const local = window.Background.OptionManager.options.backup.local;
        await TestManager.changeSomeOptions({"backup-local-intervalTime": 52})

        expect(local.intervalTime).toEqual(52);

        //  NaN - aaa - 0
        await window.Background.OptionManager.updateOption("backup-local-intervalTime", "abc");

        expect(local.intervalTime).toEqual(52);

        await window.Background.OptionManager.updateOption("backup-local-intervalTime", "NaN");

        expect(local.intervalTime).toEqual(52);

        // Min value trigger
        await window.Background.OptionManager.updateOption("backup-local-intervalTime", 0);

        expect(local.intervalTime).toEqual(0.01);
        await window.Background.OptionManager.updateOption("backup-local-intervalTime", -10);

        expect(local.intervalTime).toEqual(0.01);

        // Accept 10
        await window.Background.OptionManager.updateOption("backup-local-intervalTime", 10);

        expect(local.intervalTime).toEqual(10);

        await window.Background.OptionManager.updateOption("backup-local-intervalTime", 11.2);

        expect(local.intervalTime).toEqual(11.2);

        await window.Background.OptionManager.updateOption("backup-local-intervalTime", "23");

        expect(local.intervalTime).toEqual(23);
      })

      it('Update maxSave option do not accept wrong values', async() => {
        const local = window.Background.OptionManager.options.backup.local;
        await TestManager.changeSomeOptions({"backup-local-maxSave": 52})

        expect(local.maxSave).toEqual(52);

        //  NaN - aaa - 0
        await window.Background.OptionManager.updateOption("backup-local-maxSave", "abc");

        expect(local.maxSave).toEqual(52);

        await window.Background.OptionManager.updateOption("backup-local-maxSave", "NaN");

        expect(local.maxSave).toEqual(52);

        // Min value trigger
        await window.Background.OptionManager.updateOption("backup-local-maxSave", 0);

        expect(local.maxSave).toEqual(1);
        await window.Background.OptionManager.updateOption("backup-local-maxSave", -10);

        expect(local.maxSave).toEqual(1);

        // Accept 10
        await window.Background.OptionManager.updateOption("backup-local-maxSave", 10);

        expect(local.maxSave).toEqual(10);

        await window.Background.OptionManager.updateOption("backup-local-maxSave", 11.2);

        expect(local.maxSave).toEqual(11);

        await window.Background.OptionManager.updateOption("backup-local-maxSave", 11.7);

        expect(local.maxSave).toEqual(11);

        await window.Background.OptionManager.updateOption("backup-local-maxSave", "23");

        expect(local.maxSave).toEqual(23);
      })
    });

    describe('Automatic ', () => {
      const getAlarm = () => browser.alarms.get(
        window.Background.ExtensionStorageManager.Local.BACKUP_ALARM
      );

      afterEach(async() => {
        await window.Background.ExtensionStorageManager.Local.abortBackUp();
      });

      it('Back up (first) and schedule alarm', async() => {
        const ref_groups = window.Background.Utils.getCopy(window.Background.GroupManager.groups);
        window.Background.OptionManager.options.backup.local.enable = true;
        spyOn(window.Background.ExtensionStorageManager.Local, 'addBackup').and.returnValue(true);

        const id = await window.Background.ExtensionStorageManager.Local.planBackUp(ref_groups);

        expect(await getAlarm()).toBeDefined();
        expect(id).not.toBe(undefined);
        expect(window.Background.ExtensionStorageManager.Local.addBackup).toHaveBeenCalledTimes(1);
      });

      it('Back up (outdated) and schedule alarm', async() => {
        const intervalTime = Math.floor(window.Background.OptionManager.options.backup.local.intervalTime * 3600 * 1000);
        await TestManager.swapLocalStorage({
          backupList: {
            "fake-outdated": {
              date: (Date.now() - intervalTime - 1000),
            },
          },
        }, false);

        const ref_groups = window.Background.Utils.getCopy(window.Background.GroupManager.groups);

        spyOn(window.Background.ExtensionStorageManager.Local, 'addBackup').and.callThrough();

        const id = await window.Background.ExtensionStorageManager.Local.planBackUp(ref_groups);

        expect(await getAlarm()).toBeDefined();
        expect(id).not.toBe(undefined);
        expect(window.Background.ExtensionStorageManager.Local.addBackup).toHaveBeenCalledTimes(1);
      });

      it('Alarm triggers backup and reschedules itself', async() => {
        window.Background.OptionManager.options.backup.local.enable = true;
        spyOn(window.Background.ExtensionStorageManager.Local, 'addBackup').and.callThrough();
        await window.Background.ExtensionStorageManager.Local.planBackUp();
        expect(window.Background.ExtensionStorageManager.Local.addBackup).toHaveBeenCalledTimes(1);

        await window.Background.ExtensionStorageManager.Local.onAlarm({
          name: window.Background.ExtensionStorageManager.Local.BACKUP_ALARM,
        });

        expect(window.Background.ExtensionStorageManager.Local.addBackup).toHaveBeenCalledTimes(2);
        expect(await getAlarm()).toBeDefined();
      });

      it('Change option to stop backup clears alarm', async() => {
        window.Background.OptionManager.options.backup.local.enable = true;
        await window.Background.ExtensionStorageManager.Local.planBackUp();
        expect(await getAlarm()).toBeDefined();

        await TestManager.changeSomeOptions({"backup-local-enable": false});

        expect(await getAlarm()).toBe(undefined);
      });

      it('Change option to start backup schedules alarm', async() => {
        window.Background.OptionManager.options.backup.local.enable = false;
        await window.Background.ExtensionStorageManager.Local.abortBackUp();
        spyOn(window.Background.ExtensionStorageManager.Local, 'addBackup').and.callThrough();

        await TestManager.changeSomeOptions({"backup-local-enable": true});

        expect(window.Background.ExtensionStorageManager.Local.addBackup).toHaveBeenCalledTimes(1);
        expect(await getAlarm()).toBeDefined();
      });

      it('Changing interval reschedules alarm', async() => {
        window.Background.OptionManager.options.backup.local.enable = true;
        await window.Background.ExtensionStorageManager.Local.planBackUp();
        const firstAlarm = await getAlarm();

        await TestManager.changeSomeOptions({
          "backup-local-intervalTime": 20,
        });

        const changedAlarm = await getAlarm();
        expect(changedAlarm).toBeDefined();
        expect(changedAlarm.scheduledTime).not.toEqual(firstAlarm.scheduledTime);
      });
    });

    describe('Max Save ', () => {

      it('Clears on Add Backup', async() => {
        window.Background.OptionManager.options.backup.local.maxSave = 2;
        await TestManager.swapLocalStorage({
          backupList: {
            "fake-shorter": {
              date: 10,
            },
            "kept-1": {
              date: 20,
            },
          },
        }, false);

        await window.Background.ExtensionStorageManager.Local.addBackup({
          groups: [],
          time: 30,
        });

        const backupList = await window.Background.ExtensionStorageManager.Local.getBackUpList();

        expect(Object.keys(backupList).length).toEqual(2);
        expect(Object.values(backupList).filter(({date}) => date>10).length).toEqual(2);
      });

      it('Clears on Change option to smaller', async() => {
        const maxSave = 1;
        await TestManager.swapLocalStorage({
          backupList: {
            "fake-shorter": {
              date: 10,
            },
            "kept-1": {
              date: 20,
            },
          },
        }, false);

        await TestManager.changeSomeOptions({
          "backup-local-maxSave": maxSave,
        });

        const backupList = await window.Background.ExtensionStorageManager.Local.getBackUpList();

        expect(Object.keys(backupList).length).toEqual(maxSave);
        expect(Object.values(backupList).filter(({date}) => date>10).length).toEqual(maxSave);
      });

      it('Clears on Change option to bigger', async() => {
        const maxSave = 3;
        await TestManager.swapLocalStorage({
          backupList: {
            "fake-shorter": {
              date: 10,
            },
            "kept-1": {
              date: 20,
            },
          },
        }, false);

        await TestManager.changeSomeOptions({
          "backup-local-maxSave": maxSave,
        });

        const backupList = await window.Background.ExtensionStorageManager.Local.getBackUpList();

        expect(Object.keys(backupList).length).toEqual(2);
        expect(Object.values(backupList).filter(({date}) => date>10).length).toEqual(1);
      });
    })
  });

})
