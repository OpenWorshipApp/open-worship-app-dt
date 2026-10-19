import { handleError } from '../../helper/errorHelpers';
import CacheManager from '../../others/CacheManager';
import appProvider from '../../server/appProvider';
import { appHomeStorage } from '../../server/appHomeStorage';
import { appSecureStorage } from '../../server/appSecureStorage';
import {
    ensureDataDirMarkerIdSync,
    findMovedDataDirSync,
    fsExistSync,
    fsMkDirSync,
    fsReadSync,
    fsUnlinkSync,
    fsWriteFileAtomicSync,
    getUserWritablePath,
    pathJoin,
} from '../../server/storageFileHelpers';
import {
    addParentDirHistory,
    replaceParentDirHistory,
} from './parentDirHistoryHelpers';

export const SELECTED_PARENT_DIR_SETTING_NAME = 'selected-parent-dir';
// The chosen folder's marker id (`ensureDataDirMarkerIdSync`), kept beside its
// path on this computer so the folder can be recognised on another drive.
export const SELECTED_PARENT_DIR_ID_SETTING_NAME = 'selected-parent-dir-id';
// A move of the data folder off the Desktop, asked for and waiting for the
// next start (`dataDirMoveHelpers.ts`). Here, in the home store, so `init()`
// can look for it without importing anything more.
export const DATA_DIR_MOVE_PENDING_SETTING_NAME = 'data-dir-move-pending';
// Its outcome, from that start to the same window once it has rendered.
export const DATA_DIR_MOVE_RESULT_SESSION_NAME = 'data-dir-move-result';

export const LOCAL_STORAGE_FOLDER_NAME = 'local-storage';
export const TMP_FILES_FOLDER_NAME = 'tmp-files';

/**
 * Settings that belong to this COMPUTER, not to the data folder: read and
 * written here like any other, but kept in the main process's own store
 * (`appHomeStorage`), so they stay as they are when another data folder is
 * chosen. In `local-storage/` the interface language went with the folder,
 * and every folder switched to opened in whatever language it last had --
 * English for a new one -- leaving the operator to find the Language buttons
 * in a language they may not read.
 *
 * Spelled out again in `settingArchiveCatalog.ts` (`MOVED_TO_HOME_KEY_LIST`),
 * which must stay pure; a test holds the two together.
 */
export const COMPUTER_SETTING_NAME_LIST: readonly string[] = [
    'language-locale', // `LOCALE_SETTING_NAME`, `src/lang/langHelpers.ts`
];
function checkIsComputerSetting(key: string) {
    return COMPUTER_SETTING_NAME_LIST.includes(key);
}
function toComputerCacheKey(key: string) {
    return `computer:${key}`;
}
const cache = new CacheManager<string>(10);
// Separate from `cache` because `CacheManager.getSync` uses null for "miss",
// so a cached "this key has no file" cannot live in the value cache.
const absentCache = new CacheManager<boolean>(10);
// The chosen data folder when it was NOT there as this window started, for the
// start-up check to name (`useCheckSetting`). Per window, like the rest here.
let missingParentDirPath: string | null = null;
// Once per window: the marker costs a stat, and this getter runs every time
// its 10-second cache lapses.
let checkedMarkerDirPath: string | null = null;

/**
 * The chosen data folder, or null when there is none to use. A folder that is
 * not where it was is looked for on the other drives first (a stick that came
 * back as `F:`); one found nowhere is KEPT as the choice, never deleted --
 * forgetting it meant a stick plugged in late opened the app on an empty
 * folder, and stayed forgotten after it was plugged back in.
 */
function resolveSelectedParentDir() {
    const selectedParentDir = appHomeStorage.getItem(
        SELECTED_PARENT_DIR_SETTING_NAME,
    );
    if (!selectedParentDir) {
        missingParentDirPath = null;
        return null;
    }
    if (fsExistSync(selectedParentDir)) {
        missingParentDirPath = null;
        return selectedParentDir;
    }
    const movedDirPath = findMovedDataDirSync(
        selectedParentDir,
        appHomeStorage.getItem(SELECTED_PARENT_DIR_ID_SETTING_NAME),
    );
    if (movedDirPath !== null) {
        appHomeStorage.setItem(SELECTED_PARENT_DIR_SETTING_NAME, movedDirPath);
        replaceParentDirHistory(selectedParentDir, movedDirPath);
        missingParentDirPath = null;
        return movedDirPath;
    }
    missingParentDirPath = selectedParentDir;
    return null;
}

function rememberDataDirMarker(dirPath: string) {
    if (checkedMarkerDirPath === dirPath) {
        return;
    }
    checkedMarkerDirPath = dirPath;
    const id = ensureDataDirMarkerIdSync(dirPath);
    if (
        id !== null &&
        appHomeStorage.getItem(SELECTED_PARENT_DIR_ID_SETTING_NAME) !== id
    ) {
        appHomeStorage.setItem(SELECTED_PARENT_DIR_ID_SETTING_NAME, id);
    }
}

class AppLocalStorage {
    get defaultStorageDirPath() {
        if (appProvider.screenUtils) return '';
        const cachedDefaultStorage = cache.getSync(
            SELECTED_PARENT_DIR_SETTING_NAME,
        );
        if (cachedDefaultStorage !== null) {
            return cachedDefaultStorage;
        }
        let selectedParentDir = resolveSelectedParentDir();
        if (selectedParentDir === null) {
            // This session runs on the app's own folder; the choice stands.
            selectedParentDir = getUserWritablePath();
        } else {
            rememberDataDirMarker(selectedParentDir);
        }
        cache.setSync(SELECTED_PARENT_DIR_SETTING_NAME, selectedParentDir);
        return selectedParentDir;
    }

    /**
     * The chosen data folder when it could not be found as this window
     * started -- a stick not plugged in -- or null. The app is running on its
     * own folder meanwhile, and says so rather than looking empty.
     */
    get missingParentDirPath() {
        // Set by `defaultStorageDirPath`, which `init()` reads before a
        // window renders anything.
        return missingParentDirPath;
    }

    get localStorageDir() {
        const cachedLocalStorageDir = cache.getSync(LOCAL_STORAGE_FOLDER_NAME);
        if (cachedLocalStorageDir !== null) {
            return cachedLocalStorageDir;
        }
        const defaultStorageDirPath = this.defaultStorageDirPath;
        const localStorageDir = pathJoin(
            defaultStorageDirPath,
            LOCAL_STORAGE_FOLDER_NAME,
        );
        if (!fsExistSync(localStorageDir)) {
            fsMkDirSync(localStorageDir, true);
        }
        cache.setSync(LOCAL_STORAGE_FOLDER_NAME, localStorageDir);
        return localStorageDir;
    }

    get tmpFilesDir() {
        const tmpFilesDir = pathJoin(
            this.defaultStorageDirPath,
            TMP_FILES_FOLDER_NAME,
        );
        if (!fsExistSync(tmpFilesDir)) {
            fsMkDirSync(tmpFilesDir, true);
        }
        return tmpFilesDir;
    }

    async getSelectedParentDirectory() {
        const { fsCheckDirExist } = await import('../../server/fileHelpers');
        const selectedParentDir = appHomeStorage.getItem(
            SELECTED_PARENT_DIR_SETTING_NAME,
        );
        if (!selectedParentDir || !(await fsCheckDirExist(selectedParentDir))) {
            return null;
        }
        return selectedParentDir;
    }

    async setSelectedParentDirectory(dirPath: string) {
        cache.setSync(SELECTED_PARENT_DIR_SETTING_NAME, dirPath);
        // The settings folder moves with the choice. Left cached, a setting
        // written in the next ten seconds -- the child folders the choice
        // asks about -- went into the OLD folder's settings.
        cache.deleteSync(LOCAL_STORAGE_FOLDER_NAME);
        missingParentDirPath = null;
        // The folder being left is recorded too: one chosen before the list
        // existed is then on it from the first switch away.
        addParentDirHistory(
            appHomeStorage.getItem(SELECTED_PARENT_DIR_SETTING_NAME),
            dirPath,
        );
        appHomeStorage.setItem(SELECTED_PARENT_DIR_SETTING_NAME, dirPath);
        if (dirPath) {
            checkedMarkerDirPath = null;
            rememberDataDirMarker(dirPath);
        } else {
            appHomeStorage.removeItem(SELECTED_PARENT_DIR_ID_SETTING_NAME);
        }
        // The window can keep running on the new folder without a reload
        // (answering No to setting the child folders), so its `$DATA_DIR_PATH`
        // must follow at once.
        appProvider.sessionData.defaultStorageDirPath = dirPath || null;
    }

    toFullPath(key: string): string {
        return pathJoin(this.localStorageDir, key);
    }

    getItem(key: string): string | null {
        if (appProvider.screenUtils)
            return appProvider.screenUtils.getContext()?.settings[key] ?? null;
        if (checkIsComputerSetting(key)) {
            return this.getComputerItem(key);
        }
        return this.getFileItem(key);
    }

    /**
     * Held for the same 10 s as a file: the home store answers over a
     * SYNCHRONOUS IPC, and `tran()` asks for the locale on every label.
     */
    private getComputerItem(key: string): string | null {
        const cacheKey = toComputerCacheKey(key);
        const cachedValue = cache.getSync(cacheKey);
        if (cachedValue !== null) {
            return cachedValue;
        }
        if (absentCache.getSync(cacheKey) !== null) {
            return null;
        }
        const value = this.readComputerItem(key);
        if (value === null) {
            absentCache.setSync(cacheKey, true);
        } else {
            cache.setSync(cacheKey, value);
        }
        return value;
    }

    /**
     * A value chosen while the setting still lived in the data folder is
     * given, ONCE, to the whole computer by the folder open then
     * (`<key>-migrated` remembers it was asked). Asked whenever the computer
     * had no value, a Language that Import Settings reset would come back as
     * whatever an old folder still held. The folder's copy is left alone --
     * an older version on that folder still reads it.
     */
    private readComputerItem(key: string): string | null {
        const value = appHomeStorage.getItem(key);
        if (value !== null) {
            return value;
        }
        const migratedKey = `${key}-migrated`;
        if (appHomeStorage.getItem(migratedKey) !== null) {
            return null;
        }
        appHomeStorage.setItem(migratedKey, 'true');
        const dataDirValue = this.getFileItem(key);
        if (!dataDirValue) {
            return null;
        }
        appHomeStorage.setItem(key, dataDirValue);
        return dataDirValue;
    }

    private getFileItem(key: string): string | null {
        const fullPath = this.toFullPath(key);
        const cachedValue = cache.getSync(fullPath);
        if (cachedValue !== null) {
            return cachedValue;
        }
        // The ABSENCE of a setting is cached too, on the same short window.
        // Settings are read from React render bodies (`useStateSettingBoolean`
        // and friends), and a key that has never been written — a row never
        // expanded, a panel never opened — hit `fsExistSync` on every render
        // forever, because only a successful read was ever cached.
        if (absentCache.getSync(fullPath) !== null) {
            return null;
        }
        try {
            if (!fsExistSync(fullPath)) {
                absentCache.setSync(fullPath, true);
                return null;
            }
            const value = fsReadSync(fullPath);
            cache.setSync(fullPath, value);
            return value;
        } catch (error) {
            handleError(error);
            return null;
        }
    }

    getItemForce(key: string): string | null {
        if (appProvider.screenUtils) return this.getItem(key);
        this.removeItemCache(key);
        return this.getItem(key);
    }

    setItem(key: string, value: string): void {
        // A screen page reads its settings from the context it was opened
        // with, and never writes the disk. What the presenter syncs to it (a
        // Bible text style) still has to take effect there, so it lands in
        // that page's own copy. Dropping it left every open screen on the
        // style it opened with, and a screen's own contrast fix sent that old
        // style back to the presenter -- white Bible text on a white
        // background, after a toast saying the colour had been changed.
        if (appProvider.screenUtils) {
            const settings = appProvider.screenUtils.getContext()?.settings;
            if (settings) settings[key] = value;
            return;
        }
        if (checkIsComputerSetting(key)) {
            appHomeStorage.setItem(key, value);
            cache.setSync(toComputerCacheKey(key), value);
            absentCache.deleteSync(toComputerCacheKey(key));
            return;
        }
        const fullPath = this.toFullPath(key);
        // Atomic: every window reads these files, and a half-written one read
        // as broken JSON (`fsWriteFileAtomicSync`).
        fsWriteFileAtomicSync(fullPath, value);
        cache.setSync(fullPath, value);
        // The file exists now; a stale "absent" entry would keep `getItem`
        // answering null for up to the cache window.
        absentCache.deleteSync(fullPath);
    }

    removeItem(key: string): void {
        if (appProvider.screenUtils) {
            const settings = appProvider.screenUtils.getContext()?.settings;
            if (settings) delete settings[key];
            return;
        }
        if (checkIsComputerSetting(key)) {
            this.removeItemCache(key);
            appHomeStorage.removeItem(key);
            return;
        }
        const fullPath = this.toFullPath(key);
        // Drop the in-memory entry too. getItem answers from this cache before
        // touching disk, so a removal that left it behind kept handing back the
        // deleted value for the rest of the session.
        cache.deleteSync(fullPath);
        absentCache.deleteSync(fullPath);
        try {
            // Removing a key that was never written is a normal case (a screen
            // that never had a drawing, a focus panel that was never opened);
            // unlinking a missing file would just log noise.
            if (!fsExistSync(fullPath)) {
                return;
            }
            fsUnlinkSync(fullPath);
        } catch (error) {
            handleError(error);
        }
    }

    /**
     * Every key currently on disk. A directory listing, so it is for the rare
     * housekeeping pass (purging the settings of a file that has been deleted),
     * never for a read path — `getItem` is called from render bodies.
     */
    async listKeys(): Promise<string[]> {
        try {
            const { fsListFiles } = await import('../../server/fileHelpers');
            // A computer setting's file here is an older version's copy, not
            // this folder's setting: removing it by key would remove the
            // computer's.
            return (await fsListFiles(this.localStorageDir)).filter((key) => {
                return !checkIsComputerSetting(key);
            });
        } catch (error) {
            handleError(error);
            return [];
        }
    }

    removeItemCache(key: string): void {
        if (checkIsComputerSetting(key)) {
            cache.deleteSync(toComputerCacheKey(key));
            absentCache.deleteSync(toComputerCacheKey(key));
            return;
        }
        const fullPath = this.toFullPath(key);
        cache.deleteSync(fullPath);
        absentCache.deleteSync(fullPath);
    }

    async clear() {
        const { fsDeleteFile, fsListFiles } =
            await import('../../server/fileHelpers');
        const files = await fsListFiles(this.localStorageDir);
        try {
            await Promise.all(
                files.map(async (f) => {
                    const fullPath = pathJoin(this.localStorageDir, f);
                    return fsDeleteFile(fullPath);
                }),
            );
            appHomeStorage.clear();
            // Credentials live in their own store; leaving them behind after a
            // "Clear All Settings" strands the app half configured -- e.g.
            // `clientId` gone but the refresh token alive, so SongSelect still
            // reports signed in against credentials that no longer exist.
            appSecureStorage.clear();
        } catch (error) {
            handleError(error);
        }
    }
}

export const appLocalStorage = new AppLocalStorage();
