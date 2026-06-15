import { handleError } from '../helper/errorHelpers';
import appProvider from './appProvider';

export const OWA_HOME_FOLDER_NAME = '.owa';
export const HOME_STORAGE_FILE_NAME = 'local-storage.json';

type StorageDataType = { [key: string]: string };

class AppHomeStorage {
    private cachedData: StorageDataType | null = null;

    private get isFileStorageEnabled() {
        return appProvider.isDesktop;
    }

    private get owaDirPath() {
        const homePath = appProvider.messageUtils.sendDataSync(
            'main:app:get-special-path',
            'home',
        );
        return appProvider.pathUtils.join(
            homePath,
            OWA_HOME_FOLDER_NAME +
                (appProvider.systemUtils.isDev ? '-dev' : ''),
        );
    }

    get storageFilePath() {
        return appProvider.pathUtils.join(
            this.owaDirPath,
            HOME_STORAGE_FILE_NAME,
        );
    }

    private ensureOwaDir() {
        const dirPath = this.owaDirPath;
        if (!appProvider.fileUtils.existsSync(dirPath)) {
            appProvider.fileUtils.mkdirSync(dirPath, { recursive: true });
        }
    }

    private fileExists() {
        return appProvider.fileUtils.existsSync(this.storageFilePath);
    }

    private readStoredData(): StorageDataType | null {
        try {
            if (!this.fileExists()) {
                return null;
            }
            const raw = appProvider.fileUtils.readFileSync(
                this.storageFilePath,
                'utf8',
            );
            const parsed = JSON.parse(raw);
            if (parsed !== null && typeof parsed === 'object') {
                return parsed as StorageDataType;
            }
        } catch (error) {
            handleError(error);
        }
        return null;
    }

    private writeStoredData(data: StorageDataType) {
        try {
            this.ensureOwaDir();
            appProvider.fileUtils.writeFileSync(
                this.storageFilePath,
                JSON.stringify(data),
                { encoding: 'utf8', flag: 'w' },
            );
        } catch (error) {
            handleError(error);
        }
    }

    private migrateFromLocalStorage(): StorageDataType {
        const data: StorageDataType = {};
        try {
            const storage = globalThis.localStorage;
            for (let index = 0; index < storage.length; index++) {
                const key = storage.key(index);
                if (key === null) {
                    continue;
                }
                const value = storage.getItem(key);
                if (value !== null) {
                    data[key] = value;
                }
            }
        } catch (error) {
            handleError(error);
        }
        return data;
    }

    private ensureLoaded(): StorageDataType {
        if (this.cachedData !== null) {
            return this.cachedData;
        }
        if (this.fileExists()) {
            this.cachedData = this.readStoredData() ?? {};
        } else {
            this.cachedData = this.migrateFromLocalStorage();
            this.writeStoredData(this.cachedData);
        }
        return this.cachedData;
    }

    getItem(key: string): string | null {
        if (!this.isFileStorageEnabled) {
            return globalThis.localStorage.getItem(key);
        }
        const data = this.ensureLoaded();
        return Object.hasOwn(data, key) ? data[key] : null;
    }

    setItem(key: string, value: string): void {
        if (!this.isFileStorageEnabled) {
            globalThis.localStorage.setItem(key, value);
            return;
        }
        this.ensureLoaded();
        const data = this.readStoredData() ?? { ...this.cachedData };
        data[key] = String(value);
        this.cachedData = data;
        this.writeStoredData(data);
    }

    removeItem(key: string): void {
        if (!this.isFileStorageEnabled) {
            globalThis.localStorage.removeItem(key);
            return;
        }
        this.ensureLoaded();
        const data = this.readStoredData() ?? { ...this.cachedData };
        if (Object.hasOwn(data, key)) {
            delete data[key];
        }
        this.cachedData = data;
        this.writeStoredData(data);
    }

    clear(): void {
        if (!this.isFileStorageEnabled) {
            globalThis.localStorage.clear();
            return;
        }
        this.cachedData = {};
        this.writeStoredData(this.cachedData);
    }
}

export const appHomeStorage = new AppHomeStorage();
