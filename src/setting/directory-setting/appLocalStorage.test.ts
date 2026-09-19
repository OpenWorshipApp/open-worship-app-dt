import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        homeItems: new Map<string, string>(),
        existingPaths: new Set<string>(),
        movedDirPath: null as string | null,
        markerId: 'marker-id' as string | null,
    };
});

vi.mock('../../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        systemUtils: { isDev: false },
        sessionData: { defaultStorageDirPath: null },
    },
}));

vi.mock('../../server/appHomeStorage', () => ({
    appHomeStorage: {
        getItem: (key: string) => {
            return h.homeItems.get(key) ?? null;
        },
        setItem: (key: string, value: string) => {
            h.homeItems.set(key, value);
        },
        removeItem: (key: string) => {
            h.homeItems.delete(key);
        },
        clear: () => {
            h.homeItems.clear();
        },
    },
}));

vi.mock('../../server/appSecureStorage', () => ({
    appSecureStorage: { clear: () => {} },
}));

vi.mock('../../server/fileHelpers', () => ({
    fsExistSync: (filePath: string) => {
        return h.existingPaths.has(filePath);
    },
    findMovedDataDirSync: () => {
        return h.movedDirPath;
    },
    ensureDataDirMarkerIdSync: () => {
        return h.markerId;
    },
    getUserWritablePath: () => {
        return '/app-data';
    },
    pathJoin: (...parts: string[]) => {
        return parts.join('/');
    },
    fsCheckDirExist: async () => true,
    fsDeleteFile: async () => {},
    fsListFiles: async () => [],
    fsMkDirSync: () => {},
    fsReadSync: () => '',
    fsUnlinkSync: () => {},
    fsWriteFileSync: () => {},
}));

async function loadAppLocalStorage() {
    vi.resetModules();
    return await import('./appLocalStorage');
}

beforeEach(() => {
    h.homeItems.clear();
    h.existingPaths.clear();
    h.movedDirPath = null;
    h.markerId = 'marker-id';
});

describe('where the data folder is, as a window starts', () => {
    test('a folder that is not there is KEPT as the choice', async () => {
        const { appLocalStorage, SELECTED_PARENT_DIR_SETTING_NAME } =
            await loadAppLocalStorage();
        h.homeItems.set(SELECTED_PARENT_DIR_SETTING_NAME, 'E:\\data');

        // This session runs on the app's own folder, and says why.
        expect(appLocalStorage.defaultStorageDirPath).toBe('/app-data');
        expect(appLocalStorage.missingParentDirPath).toBe('E:\\data');
        // The stick plugged in later is still the one it opens on.
        expect(h.homeItems.get(SELECTED_PARENT_DIR_SETTING_NAME)).toBe(
            'E:\\data',
        );
    });

    test('the same folder found on another drive is adopted', async () => {
        const { appLocalStorage, SELECTED_PARENT_DIR_SETTING_NAME } =
            await loadAppLocalStorage();
        h.homeItems.set(SELECTED_PARENT_DIR_SETTING_NAME, 'E:\\data');
        h.movedDirPath = 'F:\\data';

        expect(appLocalStorage.defaultStorageDirPath).toBe('F:\\data');
        expect(appLocalStorage.missingParentDirPath).toBeNull();
        expect(h.homeItems.get(SELECTED_PARENT_DIR_SETTING_NAME)).toBe(
            'F:\\data',
        );
    });

    test('a folder that is there has its marker id remembered', async () => {
        const { appLocalStorage, SELECTED_PARENT_DIR_ID_SETTING_NAME } =
            await loadAppLocalStorage();
        h.homeItems.set('selected-parent-dir', 'E:\\data');
        h.existingPaths.add('E:\\data');

        expect(appLocalStorage.defaultStorageDirPath).toBe('E:\\data');
        expect(appLocalStorage.missingParentDirPath).toBeNull();
        expect(h.homeItems.get(SELECTED_PARENT_DIR_ID_SETTING_NAME)).toBe(
            'marker-id',
        );
    });

    test('with nothing chosen, the app uses its own folder and misses nothing', async () => {
        const { appLocalStorage } = await loadAppLocalStorage();
        expect(appLocalStorage.defaultStorageDirPath).toBe('/app-data');
        expect(appLocalStorage.missingParentDirPath).toBeNull();
    });
});
