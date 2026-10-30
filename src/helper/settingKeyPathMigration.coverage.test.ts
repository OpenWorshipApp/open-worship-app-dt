import { beforeEach, describe, expect, test, vi } from 'vitest';

// The migration run itself, over a stand-in store -- the companion
// `settingKeyPathMigration.test.ts` holds the key rewriting alone.
const h = vi.hoisted(() => ({
    dataDir: null as string | null,
    childDirs: [] as string[],
    store: new Map<string, string>(),
    settings: new Map<string, string>(),
    failingKeys: new Set<string>(),
    listDirectories: vi.fn(),
    handleError: vi.fn(),
}));

vi.mock('../server/fileHelpers', () => ({
    DATA_DIR_RELATIVE_PATH_TOKEN: '@data',
    fsListDirectories: h.listDirectories,
    getDataDirPath: () => h.dataDir,
    pathSeparator: '\\',
    // Inside the data folder reads relative; anything else as it is.
    toDataDirRelativePath: (filePath: string) => {
        return h.dataDir !== null && filePath.startsWith(h.dataDir)
            ? `@data${filePath.slice(h.dataDir.length).replaceAll('\\', '/')}`
            : filePath;
    },
}));
vi.mock('./constants', () => ({
    dirSourceSettingNames: {
        APP_DOCUMENT: 'selected-dir-documents',
        LYRIC: 'selected-dir-lyrics',
        BACKGROUND_VIDEO: 'selected-dir-videos',
    },
}));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        listKeys: async () => [...h.store.keys()],
        getItem: (key: string) => h.store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            if (h.failingKeys.has(key)) {
                throw new Error(`disk full writing ${key}`);
            }
            h.store.set(key, value);
        },
        removeItem: (key: string) => {
            h.store.delete(key);
        },
    },
}));
vi.mock('./errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('./settingHelpers', () => ({
    getSetting: (name: string) => h.settings.get(name) ?? null,
    toAbsoluteFilePathSettingKey: (...parts: string[]) => {
        return parts
            .join('-')
            .replace(/[\\/:*?"<>|.]/g, '_')
            .replace(/\s+/g, '_');
    },
}));

import migrateSettingKeyPaths from './settingKeyPathMigration';

const DATA_DIR = 'C:\\Users\\me\\open-worship-data';
const PREFIX = 'widget-size-app-document-previewer-';

beforeEach(() => {
    h.dataDir = DATA_DIR;
    h.childDirs = ['documents', 'lyrics'];
    h.store.clear();
    h.settings.clear();
    h.failingKeys.clear();
    h.listDirectories.mockImplementation(async () => h.childDirs);
});

describe('migrateSettingKeyPaths', () => {
    test('does nothing while no data folder is in use', async () => {
        h.dataDir = null;
        h.store.set(
            `${PREFIX}C__Users_me_open-worship-data_documents_a_ows`,
            '1',
        );
        await migrateSettingKeyPaths();
        expect(h.listDirectories).not.toHaveBeenCalled();
        expect([...h.store.keys()]).toEqual([
            `${PREFIX}C__Users_me_open-worship-data_documents_a_ows`,
        ]);
    });

    test("renames this folder's and another computer's keys, keeping the values", async () => {
        h.store.set(
            `${PREFIX}C__Users_me_open-worship-data_documents_song_ows`,
            '0.4',
        );
        h.store.set(`${PREFIX}E__Church_owa-data_lyrics_hymn_owl`, '0.6');
        h.store.set('language', 'km');
        await migrateSettingKeyPaths();

        expect(h.listDirectories).toHaveBeenCalledWith(DATA_DIR);
        expect(Object.fromEntries(h.store)).toEqual({
            [`${PREFIX}@data_documents_song_ows`]: '0.4',
            [`${PREFIX}@data_lyrics_hymn_owl`]: '0.6',
            language: 'km',
        });
    });

    test('a newer setting under the new name is never overwritten', async () => {
        h.store.set(
            `${PREFIX}C__Users_me_open-worship-data_documents_song_ows`,
            'old',
        );
        h.store.set(`${PREFIX}@data_documents_song_ows`, 'new');
        await migrateSettingKeyPaths();
        expect(Object.fromEntries(h.store)).toEqual({
            [`${PREFIX}@data_documents_song_ows`]: 'new',
        });
    });

    test('a folder kept outside the data folder keeps its absolute keys', async () => {
        h.settings.set('selected-dir-documents', 'D:\\Docs');
        // Inside the data folder, and unset: neither is "outside".
        h.settings.set('selected-dir-lyrics', `${DATA_DIR}\\lyrics`);
        const outsideKey = `${PREFIX}D__Docs_documents_song_ows`;
        h.store.set(outsideKey, '0.5');
        h.store.set(`${PREFIX}F__Old_owa_lyrics_x_owl`, '0.7');
        await migrateSettingKeyPaths();
        expect(Object.fromEntries(h.store)).toEqual({
            [outsideKey]: '0.5',
            [`${PREFIX}@data_lyrics_x_owl`]: '0.7',
        });
    });

    test('a write that fails is reported and the rest still move', async () => {
        const failingNewKey = `${PREFIX}@data_documents_a_ows`;
        h.failingKeys.add(failingNewKey);
        h.store.set(
            `${PREFIX}C__Users_me_open-worship-data_documents_a_ows`,
            '1',
        );
        h.store.set(
            `${PREFIX}C__Users_me_open-worship-data_documents_b_ows`,
            '2',
        );
        await migrateSettingKeyPaths();

        expect(h.handleError).toHaveBeenCalledTimes(1);
        expect(h.handleError.mock.calls[0][0].message).toBe(
            `disk full writing ${failingNewKey}`,
        );
        // The failed one is left where it was, nothing lost.
        expect(Object.fromEntries(h.store)).toEqual({
            [`${PREFIX}C__Users_me_open-worship-data_documents_a_ows`]: '1',
            [`${PREFIX}@data_documents_b_ows`]: '2',
        });
    });
});
