import { handleError } from '../../helper/errorHelpers';
import CacheManager from '../../others/CacheManager';
import { appHomeStorage } from '../../server/appHomeStorage';
import {
    fsCheckDirExist,
    fsDeleteFile,
    fsExistSync,
    fsListFiles,
    fsMkDirSync,
    fsReadSync,
    fsUnlinkSync,
    fsWriteFileSync,
    getUserWritablePath,
    pathJoin,
} from '../../server/fileHelpers';

export const SELECTED_PARENT_DIR_SETTING_NAME = 'selected-parent-dir';

export const LOCAL_STORAGE_FOLDER_NAME = 'local-storage';
export const TMP_FILES_FOLDER_NAME = 'tmp-files';
const cache = new CacheManager<string>(10);
// Separate from `cache` because `CacheManager.getSync` uses null for "miss",
// so a cached "this key has no file" cannot live in the value cache.
const absentCache = new CacheManager<boolean>(10);
class AppLocalStorage {
    get defaultStorage() {
        const cachedDefaultStorage = cache.getSync(
            SELECTED_PARENT_DIR_SETTING_NAME,
        );
        if (cachedDefaultStorage !== null) {
            return cachedDefaultStorage;
        }
        let selectedParentDir = appHomeStorage.getItem(
            SELECTED_PARENT_DIR_SETTING_NAME,
        );
        if (!selectedParentDir || !fsExistSync(selectedParentDir)) {
            appHomeStorage.removeItem(SELECTED_PARENT_DIR_SETTING_NAME);
            selectedParentDir = getUserWritablePath();
        }
        cache.setSync(SELECTED_PARENT_DIR_SETTING_NAME, selectedParentDir);
        return selectedParentDir;
    }

    get localStorageDir() {
        const cachedLocalStorageDir = cache.getSync(LOCAL_STORAGE_FOLDER_NAME);
        if (cachedLocalStorageDir !== null) {
            return cachedLocalStorageDir;
        }
        const defaultStorage = this.defaultStorage;
        const localStorageDir = pathJoin(
            defaultStorage,
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
            this.defaultStorage,
            TMP_FILES_FOLDER_NAME,
        );
        if (!fsExistSync(tmpFilesDir)) {
            fsMkDirSync(tmpFilesDir, true);
        }
        return tmpFilesDir;
    }

    async getSelectedParentDirectory() {
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
        appHomeStorage.setItem(SELECTED_PARENT_DIR_SETTING_NAME, dirPath);
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
        fsWriteFileSync(fullPath, value);
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
        const files = await fsListFiles(this.localStorageDir);
        try {
            await Promise.all(
                files.map(async (f) => {
                    const fullPath = pathJoin(this.localStorageDir, f);
                    return fsDeleteFile(fullPath);
                }),
            );
            appHomeStorage.clear();
        } catch (error) {
            handleError(error);
        }
    }
}

export const appLocalStorage = new AppLocalStorage();
