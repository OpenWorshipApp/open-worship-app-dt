import appProvider from './appProvider';

export const OWA_HOME_FOLDER_NAME = '.owa';
export const HOME_STORAGE_FILE_NAME = 'local-storage.json';

function getMessage(data: {
    type: 'get' | 'set' | 'delete' | 'get-all-keys' | 'clear';
    key: string;
    value?: any;
}): string | null {
    const value = appProvider.messageUtils.sendDataSync(
        'main:app:client-setting',
        data,
    );
    if (typeof value !== 'string') {
        return null;
    }
    return value;
}

class AppHomeStorage {
    getItem(key: string): string | null {
        const message = getMessage({
            type: 'get',
            key,
        });
        return message;
    }

    setItem(key: string, value: string): void {
        appProvider.messageUtils.sendData('main:app:client-setting', {
            type: 'set',
            key,
            value,
        });
    }

    removeItem(key: string): void {
        appProvider.messageUtils.sendData('main:app:client-setting', {
            type: 'delete',
            key,
        });
    }

    clear(): void {
        getMessage({
            type: 'clear',
            key: '',
        });
    }

    getAllKeys(): string[] {
        const allKeys = getMessage({
            type: 'get-all-keys',
            key: '',
        });
        if (allKeys) {
            const keysArray = JSON.parse(allKeys);
            if (Array.isArray(keysArray)) {
                return keysArray;
            }
        }
        return [];
    }
}

export const appHomeStorage = new AppHomeStorage();
