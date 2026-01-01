import { handleError } from '../../helper/errorHelpers';
import CacheManager from '../../others/CacheManager';
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

const FOLDER_NAME = 'local-storage';
const cache = new CacheManager<string>(10);
class AppLocalStorage {
    get defaultStorage() {
        const cachedDefaultStorage = cache.getSync(
            SELECTED_PARENT_DIR_SETTING_NAME,
        );
        if (cachedDefaultStorage !== null) {
            return cachedDefaultStorage;
        }
        let selectedParentDir = globalThis.localStorage.getItem(
            SELECTED_PARENT_DIR_SETTING_NAME,
        );
        if (!selectedParentDir || !fsExistSync(selectedParentDir)) {
            globalThis.localStorage.removeItem(
                SELECTED_PARENT_DIR_SETTING_NAME,
            );
            selectedParentDir = getUserWritablePath();
        }
        cache.setSync(SELECTED_PARENT_DIR_SETTING_NAME, selectedParentDir);
        return selectedParentDir;
    }

    get localStorageDir() {
        const cachedLocalStorageDir = cache.getSync(FOLDER_NAME);
        if (cachedLocalStorageDir !== null) {
            return cachedLocalStorageDir;
        }
        const defaultStorage = this.defaultStorage;
        const localStorageDir = pathJoin(defaultStorage, FOLDER_NAME);
        if (!fsExistSync(localStorageDir)) {
            fsMkDirSync(localStorageDir, true);
        }
        cache.setSync(FOLDER_NAME, localStorageDir);
        return localStorageDir;
    }

    async getSelectedParentDirectory() {
        const selectedParentDir = globalThis.localStorage.getItem(
            SELECTED_PARENT_DIR_SETTING_NAME,
        );
        if (!selectedParentDir || !(await fsCheckDirExist(selectedParentDir))) {
            return null;
        }
        return selectedParentDir;
    }

    async setSelectedParentDirectory(dirPath: string) {
        if (!(await fsCheckDirExist(dirPath))) {
            throw new Error(`Directory does not exist: ${dirPath}`);
        }
        cache.setSync(SELECTED_PARENT_DIR_SETTING_NAME, dirPath);
        globalThis.localStorage.setItem(
            SELECTED_PARENT_DIR_SETTING_NAME,
            dirPath,
        );
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
        try {
            if (!fsExistSync(fullPath)) {
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
        return this.getItem(key);
    }

    setItem(key: string, value: string): void {
        const fullPath = this.toFullPath(key);
        fsWriteFileSync(fullPath, value);
        cache.setSync(fullPath, value);
    }

    removeItem(key: string): void {
        const fullPath = this.toFullPath(key);
        try {
            fsUnlinkSync(fullPath);
        } catch (error) {
            handleError(error);
        }
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
            globalThis.localStorage.clear();
        } catch (error) {
            handleError(error);
        }
    }
}

export const appLocalStorage = new AppLocalStorage();
