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

export const SELECTED_PARENT_DIR_SETTING_NAME = 'selected-parent-dir';
// The chosen folder's marker id (`ensureDataDirMarkerIdSync`), kept beside its
// path on this computer so the folder can be recognised on another drive.
export const SELECTED_PARENT_DIR_ID_SETTING_NAME = 'selected-parent-dir-id';

export const LOCAL_STORAGE_FOLDER_NAME = 'local-storage';
export const TMP_FILES_FOLDER_NAME = 'tmp-files';
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
        const fullPath = this.toFullPath(key);
        cache.deleteSync(fullPath);
        absentCache.deleteSync(fullPath);
        return this.getItem(key);
    }

    setItem(key: string, value: string): void {
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
            return await fsListFiles(this.localStorageDir);
        } catch (error) {
            handleError(error);
            return [];
        }
    }

    removeItemCache(key: string): void {
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
