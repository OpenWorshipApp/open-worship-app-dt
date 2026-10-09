import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        homeItems: new Map<string, string>(),
        existingPaths: new Set<string>(),
        movedDirPath: null as string | null,
        markerId: 'marker-id' as string | null,
        fileHelpersLoaded: false,
        diskWrites: [] as string[],
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

vi.mock('../../server/storageFileHelpers', () => ({
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
    pathResolve: (filePath: string) => {
        return filePath.replace(/[\\/]+$/, '');
    },
    toPathCompareKey: (filePath: string) => {
        return filePath.toLowerCase();
    },
    fsMkDirSync: () => {},
    fsReadSync: () => '',
    fsUnlinkSync: (filePath: string) => {
        h.diskWrites.push(`unlink ${filePath}`);
    },
    fsWriteFileSync: () => {},
    fsWriteFileAtomicSync: (filePath: string) => {
        h.diskWrites.push(`write ${filePath}`);
    },
}));

vi.mock('../../server/fileHelpers', () => {
    h.fileHelpersLoaded = true;
    return {
        fsCheckDirExist: async () => true,
        fsDeleteFile: async () => {},
        fsListFiles: async () => [],
    };
});

async function loadAppLocalStorage() {
    vi.resetModules();
    return await import('./appLocalStorage');
}

beforeEach(() => {
    h.homeItems.clear();
    h.existingPaths.clear();
    h.movedDirPath = null;
    h.markerId = 'marker-id';
    h.fileHelpersLoaded = false;
    h.diskWrites = [];
});

test('startup storage does not load the broad file helper graph', async () => {
    await loadAppLocalStorage();
    expect(h.fileHelpersLoaded).toBe(false);
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

describe('the folders used before', () => {
    const HISTORY_KEY = 'selected-parent-dir-history';

    function readHistory() {
        return JSON.parse(h.homeItems.get(HISTORY_KEY) ?? '[]');
    }

    test('a switch remembers the folder left and the one chosen, newest first', async () => {
        const { appLocalStorage, SELECTED_PARENT_DIR_SETTING_NAME } =
            await loadAppLocalStorage();
        // Chosen before the list existed: it is remembered on the way out.
        h.homeItems.set(SELECTED_PARENT_DIR_SETTING_NAME, 'E:\\old');

        await appLocalStorage.setSelectedParentDirectory('E:\\new');

        expect(readHistory()).toEqual(['E:\\new', 'E:\\old']);
        expect(h.fileHelpersLoaded).toBe(false);
    });

    test('unsetting the folder keeps it on the list', async () => {
        const { appLocalStorage, SELECTED_PARENT_DIR_SETTING_NAME } =
            await loadAppLocalStorage();
        h.homeItems.set(SELECTED_PARENT_DIR_SETTING_NAME, 'E:\\data');

        await appLocalStorage.setSelectedParentDirectory('');

        expect(readHistory()).toEqual(['E:\\data']);
    });

    test('a folder found on another drive takes over its entry', async () => {
        const { appLocalStorage, SELECTED_PARENT_DIR_SETTING_NAME } =
            await loadAppLocalStorage();
        h.homeItems.set(SELECTED_PARENT_DIR_SETTING_NAME, 'E:\\data');
        h.homeItems.set(
            HISTORY_KEY,
            JSON.stringify(['D:\\other', 'E:\\data', 'C:\\first']),
        );
        h.movedDirPath = 'F:\\data';

        expect(appLocalStorage.defaultStorageDirPath).toBe('F:\\data');
        expect(readHistory()).toEqual(['D:\\other', 'F:\\data', 'C:\\first']);
    });
});

// A screen page reads the settings it was opened with and never writes the
// disk. A setting the presenter syncs to it -- the Bible text style -- has to
// land in that copy, or the screen keeps drawing the old one (and sends it
// back as its own).
describe('a screen page', () => {
    test('keeps what it is told in its own copy, never on disk', async () => {
        const { appLocalStorage } = await loadAppLocalStorage();
        const { default: appProvider } =
            await import('../../server/appProvider');
        const context = {
            settings: { 'screen-bible--style-text': '{"color":"#FFFFFF"}' },
        };
        (appProvider as any).screenUtils = { getContext: () => context };
        try {
            expect(appLocalStorage.getItem('screen-bible--style-text')).toBe(
                '{"color":"#FFFFFF"}',
            );

            appLocalStorage.setItem(
                'screen-bible--style-text',
                '{"color":"#000000"}',
            );
            expect(appLocalStorage.getItem('screen-bible--style-text')).toBe(
                '{"color":"#000000"}',
            );

            appLocalStorage.removeItem('screen-bible--style-text');
            expect(appLocalStorage.getItem('screen-bible--style-text')).toBe(
                null,
            );
            expect(h.diskWrites).toEqual([]);
        } finally {
            delete (appProvider as any).screenUtils;
        }
    });
});
