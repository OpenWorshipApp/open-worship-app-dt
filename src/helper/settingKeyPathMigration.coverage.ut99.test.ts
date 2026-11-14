import { beforeEach, describe, expect, test, vi } from 'vitest';

// The one-off sweep itself (`migrateSettingKeyPaths`): what it reads off this
// data folder, which stored names it renames and which it must leave alone.
const { state, mocks } = vi.hoisted(() => ({
    state: {
        dataDirPath: null as string | null,
        dirSourceSettingNames: {} as Record<string, string>,
        settings: new Map<string, string>(),
        storage: new Map<string, string>(),
    },
    mocks: {
        fsListDirectories: vi.fn(),
        handleError: vi.fn(),
        listKeys: vi.fn(),
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    },
}));

vi.mock('../server/fileHelpers', () => ({
    DATA_DIR_RELATIVE_PATH_TOKEN: '@data',
    fsListDirectories: mocks.fsListDirectories,
    getDataDirPath: () => state.dataDirPath,
    pathSeparator: '\\',
    // A folder inside this data folder reads back relative; any other path
    // comes back unchanged.
    toDataDirRelativePath: (dirPath: string) => {
        const prefix = `${state.dataDirPath}\\`;
        return state.dataDirPath !== null && dirPath.startsWith(prefix)
            ? `@data/${dirPath.slice(prefix.length)}`
            : dirPath;
    },
}));

vi.mock('./constants', () => ({
    get dirSourceSettingNames() {
        return state.dirSourceSettingNames;
    },
}));

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        listKeys: mocks.listKeys,
        getItem: mocks.getItem,
        setItem: mocks.setItem,
        removeItem: mocks.removeItem,
    },
}));

vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));

vi.mock('./settingHelpers', () => ({
    getSetting: (settingName: string) => state.settings.get(settingName),
    toAbsoluteFilePathSettingKey: (...parts: string[]) => {
        return parts
            .join('-')
            .replace(/[\\/:*?"<>|.]/g, '_')
            .replace(/\s+/g, '_');
    },
}));

const { default: migrateSettingKeyPaths } =
    await import('./settingKeyPathMigration');

beforeEach(() => {
    state.dataDirPath = 'C:\\Users\\me\\data';
    state.dirSourceSettingNames = {};
    state.settings.clear();
    state.storage.clear();
    mocks.fsListDirectories.mockResolvedValue(['documents', 'lyrics']);
    mocks.listKeys.mockImplementation(async () => [...state.storage.keys()]);
    mocks.getItem.mockImplementation((key: string) => {
        return state.storage.get(key) ?? null;
    });
    mocks.setItem.mockImplementation((key: string, value: string) => {
        state.storage.set(key, value);
    });
    mocks.removeItem.mockImplementation((key: string) => {
        state.storage.delete(key);
    });
});

describe('migrateSettingKeyPaths', () => {
    test('does nothing at all while no data folder is chosen', async () => {
        state.dataDirPath = null;
        state.storage.set(
            'widget-size-a-C__Users_me_data_documents_a_ows',
            '1',
        );
        await migrateSettingKeyPaths();
        expect(mocks.fsListDirectories).not.toHaveBeenCalled();
        expect(mocks.listKeys).not.toHaveBeenCalled();
        expect([...state.storage.keys()]).toEqual([
            'widget-size-a-C__Users_me_data_documents_a_ows',
        ]);
    });

    test('renames the absolute names and never overwrites a newer one', async () => {
        state.storage.set(
            'widget-size-a-C__Users_me_data_documents_song_ows',
            '200',
        );
        // Another computer's path, already migrated once under the new name.
        state.storage.set(
            'widget-size-b-_Users_x_old-data_lyrics_hymn_owl',
            'old',
        );
        state.storage.set('widget-size-b-@data_lyrics_hymn_owl', 'newer');
        state.storage.set('language', 'xx');

        await migrateSettingKeyPaths();

        expect(mocks.fsListDirectories).toHaveBeenCalledWith(
            'C:\\Users\\me\\data',
        );
        expect(Object.fromEntries(state.storage)).toEqual({
            'widget-size-a-@data_documents_song_ows': '200',
            'widget-size-b-@data_lyrics_hymn_owl': 'newer',
            language: 'xx',
        });
        expect(mocks.setItem).toHaveBeenCalledTimes(1);
        expect(mocks.removeItem).toHaveBeenCalledTimes(2);
        expect(mocks.handleError).not.toHaveBeenCalled();
    });

    test('keeps the names of a list folder this data folder keeps elsewhere', async () => {
        state.dirSourceSettingNames = {
            APP_DOCUMENT: 'selected-dir-documents',
            LYRIC: 'selected-dir-lyrics',
            BIBLE: 'selected-dir-bibles',
        };
        // Outside the data folder: its files keep absolute keys.
        state.settings.set('selected-dir-documents', 'D:\\Shared\\documents');
        // Inside it: a plain folder of this data folder, nothing special.
        state.settings.set(
            'selected-dir-lyrics',
            'C:\\Users\\me\\data\\lyrics',
        );
        // 'selected-dir-bibles' is not set at all.
        const outsideKey = 'widget-size-c-D__Shared_documents_a_ows';
        state.storage.set(outsideKey, '5');
        state.storage.set('widget-size-d-E__Other_lyrics_b_owl', '6');

        await migrateSettingKeyPaths();

        expect(Object.fromEntries(state.storage)).toEqual({
            [outsideKey]: '5',
            'widget-size-d-@data_lyrics_b_owl': '6',
        });
    });

    test('logs a name it cannot move and goes on with the rest', async () => {
        const brokenKey = 'widget-size-a-C__Users_me_data_documents_a_ows';
        state.storage.set(brokenKey, '1');
        state.storage.set('widget-size-b-C__Users_me_data_lyrics_b_owl', '2');
        // Listed, but gone by the time it is read: nothing to copy.
        state.storage.set('widget-size-c-C__Users_me_data_lyrics_c_owl', '3');
        mocks.getItem.mockImplementation((key: string) => {
            if (key === brokenKey) {
                throw new Error(`unreadable ${key}`);
            }
            if (key === 'widget-size-c-C__Users_me_data_lyrics_c_owl') {
                return null;
            }
            return state.storage.get(key) ?? null;
        });

        await migrateSettingKeyPaths();

        expect(mocks.handleError).toHaveBeenCalledTimes(1);
        expect(mocks.handleError.mock.calls[0][0]).toEqual(
            new Error(`unreadable ${brokenKey}`),
        );
        expect(Object.fromEntries(state.storage)).toEqual({
            [brokenKey]: '1',
            'widget-size-b-@data_lyrics_b_owl': '2',
        });
    });
});
