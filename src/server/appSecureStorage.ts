import appProvider from './appProvider';

/**
 * Sibling of `appHomeStorage` for credentials. Same synchronous IPC shape, but
 * the main process encrypts the values with `safeStorage` before they reach
 * `setting.json`.
 *
 * Deliberately NOT cached in the renderer: SongSelect refresh tokens are
 * one-time-use and rotated on every refresh, so a second window holding a cached
 * copy would present a token the server has already retired. Reads stay fresh
 * per use, which also matches the short-lived-cache rule in CLAUDE.md. The
 * decrypt cost is absorbed by a cache on the main side instead.
 */
function getMessage(data: {
    type: 'get' | 'set' | 'delete' | 'clear' | 'is-available';
    key: string;
    value?: any;
}): string | null {
    const value = appProvider.messageUtils.sendDataSync(
        'main:app:secure-setting',
        data,
    );
    if (typeof value !== 'string') {
        return null;
    }
    return value;
}

// The answer is an immutable OS capability for the life of the process, and it
// is read during render, so it is resolved once per window.
let isAvailable: boolean | null = null;

class AppSecureStorage {
    getItem(key: string): string | null {
        return getMessage({
            type: 'get',
            key,
        });
    }

    setItem(key: string, value: string): void {
        appProvider.messageUtils.sendData('main:app:secure-setting', {
            type: 'set',
            key,
            value,
        });
    }

    removeItem(key: string): void {
        appProvider.messageUtils.sendData('main:app:secure-setting', {
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

    checkIsAvailable(): boolean {
        if (isAvailable === null) {
            isAvailable =
                appProvider.messageUtils.sendDataSync(
                    'main:app:secure-setting',
                    { type: 'is-available', key: '' },
                ) === true;
        }
        return isAvailable;
    }
}

export const appSecureStorage = new AppSecureStorage();
