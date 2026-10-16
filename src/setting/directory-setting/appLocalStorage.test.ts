import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        homeItems: new Map<string, string>(),
        existingPaths: new Set<string>(),
        movedDirPath: null as string | null,
        markerId: 'marker-id' as string | null,
        fileHelpersLoaded: false,
        diskWrites: [] as string[],
        diskFiles: new Map<string, string>(),
        existenceChecks: [] as string[],
        listedFiles: [] as string[],
        deletedFiles: [] as string[],
        secureClears: 0,
        errors: [] as unknown[],
        failRead: false,
        failUnlink: false,
        failDelete: false,
        selectedDirExists: true,
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
    appSecureStorage: { clear: () => h.secureClears++ },
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: (error: unknown) => h.errors.push(error),
}));

vi.mock('../../server/storageFileHelpers', () => ({
    fsExistSync: (filePath: string) => {
        h.existenceChecks.push(filePath);
        return h.existingPaths.has(filePath) || h.diskFiles.has(filePath);
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
    fsReadSync: (filePath: string) => {
        if (h.failRead) throw new Error('read failed');
        return h.diskFiles.get(filePath) ?? '';
    },
    fsUnlinkSync: (filePath: string) => {
        if (h.failUnlink) throw new Error('unlink failed');
        h.diskFiles.delete(filePath);
        h.diskWrites.push(`unlink ${filePath}`);
    },
    fsWriteFileSync: () => {},
    fsWriteFileAtomicSync: (filePath: string, value: string) => {
        h.diskFiles.set(filePath, value);
        h.diskWrites.push(`write ${filePath}`);
    },
}));

vi.mock('../../server/fileHelpers', () => {
    h.fileHelpersLoaded = true;
    return {
        fsCheckDirExist: async () => h.selectedDirExists,
        fsDeleteFile: async (filePath: string) => {
            if (h.failDelete) throw new Error('delete failed');
            h.deletedFiles.push(filePath);
        },
        fsListFiles: async () => h.listedFiles,
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
    h.diskFiles.clear();
    h.existenceChecks = [];
    h.listedFiles = [];
    h.deletedFiles = [];
    h.secureClears = 0;
    h.errors = [];
    h.failRead = false;
    h.failUnlink = false;
    h.failDelete = false;
    h.selectedDirExists = true;
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

describe('settings files on the selected storage path', () => {
    test('a missing setting is cached, then a write makes it readable', async () => {
        const { appLocalStorage } = await loadAppLocalStorage();
        expect(appLocalStorage.getItem('theme')).toBeNull();
        expect(appLocalStorage.getItem('theme')).toBeNull();
        expect(
            h.existenceChecks.filter((path) => path.endsWith('/theme')),
        ).toHaveLength(1);

        appLocalStorage.setItem('theme', 'dark');
        expect(h.diskWrites).toContain('write /app-data/local-storage/theme');
        expect(appLocalStorage.getItem('theme')).toBe('dark');
        h.diskFiles.set('/app-data/local-storage/theme', 'light');
        expect(appLocalStorage.getItemForce('theme')).toBe('light');
    });

    test('removing a setting clears its cached value and ignores an absent file', async () => {
        const { appLocalStorage } = await loadAppLocalStorage();
        appLocalStorage.setItem('theme', 'dark');
        appLocalStorage.removeItem('theme');
        expect(h.diskWrites).toEqual([
            'write /app-data/local-storage/theme',
            'unlink /app-data/local-storage/theme',
        ]);
        expect(appLocalStorage.getItem('theme')).toBeNull();
        appLocalStorage.removeItem('never-written');
        expect(h.diskWrites).toHaveLength(2);
    });

    test('a folder change redirects subsequent settings and records its marker', async () => {
        const { appLocalStorage } = await loadAppLocalStorage();
        expect(appLocalStorage.localStorageDir).toBe('/app-data/local-storage');
        expect(appLocalStorage.tmpFilesDir).toBe('/app-data/tmp-files');
        await appLocalStorage.setSelectedParentDirectory('/usb/data');
        expect(appLocalStorage.localStorageDir).toBe('/usb/data/local-storage');
        expect(appLocalStorage.tmpFilesDir).toBe('/usb/data/tmp-files');
        expect(h.homeItems.get('selected-parent-dir-id')).toBe('marker-id');
        expect(appLocalStorage.defaultStorageDirPath).toBe('/usb/data');
        await appLocalStorage.setSelectedParentDirectory('');
        expect(h.homeItems.has('selected-parent-dir-id')).toBe(false);
    });

    test('reads the selected directory and lists settings only when requested', async () => {
        const { appLocalStorage } = await loadAppLocalStorage();
        expect(await appLocalStorage.getSelectedParentDirectory()).toBeNull();
        h.homeItems.set('selected-parent-dir', '/usb/data');
        expect(await appLocalStorage.getSelectedParentDirectory()).toBe(
            '/usb/data',
        );
        h.selectedDirExists = false;
        expect(await appLocalStorage.getSelectedParentDirectory()).toBeNull();
        h.listedFiles = ['theme', 'screen-bible--style-text'];
        expect(await appLocalStorage.listKeys()).toEqual(h.listedFiles);
    });

    test('clear deletes listed files and clears both settings stores', async () => {
        const { appLocalStorage } = await loadAppLocalStorage();
        h.homeItems.set('theme', 'dark');
        h.listedFiles = ['theme', 'layout'];
        await appLocalStorage.clear();
        expect(h.deletedFiles).toEqual([
            '/app-data/local-storage/theme',
            '/app-data/local-storage/layout',
        ]);
        expect(h.homeItems.size).toBe(0);
        expect(h.secureClears).toBe(1);
    });

    test('read, unlink and delete failures are reported without clearing stores', async () => {
        const { appLocalStorage } = await loadAppLocalStorage();
        h.diskFiles.set('/app-data/local-storage/theme', 'dark');
        h.failRead = true;
        expect(appLocalStorage.getItem('theme')).toBeNull();
        h.failUnlink = true;
        appLocalStorage.removeItem('theme');
        h.homeItems.set('keep', 'yes');
        h.listedFiles = ['theme'];
        h.failDelete = true;
        await appLocalStorage.clear();
        expect(h.errors.map((error) => (error as Error).message)).toEqual([
            'read failed',
            'unlink failed',
            'delete failed',
        ]);
        expect(h.homeItems.get('keep')).toBe('yes');
        expect(h.secureClears).toBe(0);
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

// The interface language is the computer's: kept in the home store, it holds
// for every data folder (`COMPUTER_SETTING_NAME_LIST`).
describe('a computer setting', () => {
    const KEY = 'language-locale';
    const FOLDER_COPY_PATH = `/app-data/local-storage/${KEY}`;

    test('reads the computer, never an old copy in the data folder', async () => {
        const { appLocalStorage } = await loadAppLocalStorage();
        h.homeItems.set(KEY, 'km-KH');
        h.diskFiles.set(FOLDER_COPY_PATH, 'en-US');

        expect(appLocalStorage.getItem(KEY)).toBe('km-KH');
        appLocalStorage.setItem(KEY, 'fr-FR');
        expect(h.homeItems.get(KEY)).toBe('fr-FR');
        expect(appLocalStorage.getItem(KEY)).toBe('fr-FR');
        expect(h.diskWrites).toEqual([]);
        expect(h.existenceChecks).not.toContain(FOLDER_COPY_PATH);

        appLocalStorage.removeItem(KEY);
        expect(h.homeItems.has(KEY)).toBe(false);
        expect(h.diskFiles.get(FOLDER_COPY_PATH)).toBe('en-US');
    });

    test("takes the data folder's value once, and leaves the folder's copy", async () => {
        const { appLocalStorage } = await loadAppLocalStorage();
        h.diskFiles.set(FOLDER_COPY_PATH, 'km-KH');

        expect(appLocalStorage.getItem(KEY)).toBe('km-KH');
        expect(h.homeItems.get(KEY)).toBe('km-KH');
        expect(h.homeItems.get(`${KEY}-migrated`)).toBe('true');
        expect(h.diskFiles.get(FOLDER_COPY_PATH)).toBe('km-KH');

        // Reset since (Import Settings): back to the default, NOT back to
        // what an old folder still holds.
        h.homeItems.delete(KEY);
        expect(appLocalStorage.getItemForce(KEY)).toBeNull();
        expect(h.homeItems.has(KEY)).toBe(false);
    });

    test('with no value anywhere, nothing is written but the marker', async () => {
        const { appLocalStorage } = await loadAppLocalStorage();
        expect(appLocalStorage.getItem(KEY)).toBeNull();
        expect(appLocalStorage.getItem(KEY)).toBeNull();
        expect(Array.from(h.homeItems.entries())).toEqual([
            [`${KEY}-migrated`, 'true'],
        ]);
        expect(
            h.existenceChecks.filter((path) => path === FOLDER_COPY_PATH),
        ).toHaveLength(1);
    });

    test('holds its answer a few seconds, then asks again', async () => {
        const { appLocalStorage } = await loadAppLocalStorage();
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            vi.setSystemTime(0);
            h.homeItems.set(KEY, 'km-KH');
            expect(appLocalStorage.getItem(KEY)).toBe('km-KH');

            // Chosen in another window.
            h.homeItems.set(KEY, 'fr-FR');
            vi.setSystemTime(9000);
            expect(appLocalStorage.getItem(KEY)).toBe('km-KH');
            vi.setSystemTime(10001);
            expect(appLocalStorage.getItem(KEY)).toBe('fr-FR');
        } finally {
            vi.useRealTimers();
        }
    });

    test("a folder's copy is not listed, so nothing removes the computer's value by key", async () => {
        const { appLocalStorage } = await loadAppLocalStorage();
        h.listedFiles = [KEY, 'app-font-family'];
        expect(await appLocalStorage.listKeys()).toEqual(['app-font-family']);
    });

    test("a screen page reads the presenter's context, never the main process", async () => {
        const { appLocalStorage } = await loadAppLocalStorage();
        const { default: appProvider } =
            await import('../../server/appProvider');
        h.homeItems.set(KEY, 'fr-FR');
        (appProvider as any).screenUtils = {
            getContext: () => ({ settings: { [KEY]: 'km-KH' } }),
        };
        try {
            expect(appLocalStorage.getItem(KEY)).toBe('km-KH');
        } finally {
            delete (appProvider as any).screenUtils;
        }
    });

    test("Export / Import Settings knows every one of them is the computer's", async () => {
        const { COMPUTER_SETTING_NAME_LIST } = await loadAppLocalStorage();
        const { toCurrentSettingStore, classifySettingKey } =
            await import('../setting-archive/settingArchiveCatalog');
        for (const key of COMPUTER_SETTING_NAME_LIST) {
            expect(toCurrentSettingStore('local', key)).toBe('home');
            expect(classifySettingKey('local', key)).toBe('excluded');
            expect(classifySettingKey('home', key)).not.toBe('excluded');
        }
    });
});
