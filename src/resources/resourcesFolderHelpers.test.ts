import { beforeEach, describe, expect, test, vi } from 'vitest';

const { getItemMock, setItemMock, selectDirsMock, removeByPrefixMock, state } =
    vi.hoisted(() => ({
        getItemMock: vi.fn(),
        setItemMock: vi.fn(),
        selectDirsMock: vi.fn(),
        removeByPrefixMock: vi.fn(),
        state: { isLinux: false },
    }));

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { getItem: getItemMock, setItem: setItemMock },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        get systemUtils() {
            return { isLinux: state.isLinux, isDev: false };
        },
    },
}));

vi.mock('../server/fileHelpers', () => ({
    selectDirs: selectDirsMock,
    // Mirrors the real `pathResolve`: absolute-ish, no trailing separator.
    pathResolve: (dirPath: string) => {
        const resolved = dirPath.startsWith('/') ? dirPath : `/cwd/${dirPath}`;
        return resolved.endsWith('/') ? resolved.slice(0, -1) : resolved;
    },
}));

vi.mock('../helper/settingHelpers', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('../helper/settingHelpers')>();
    return { ...original, removeSettingsByPrefix: removeByPrefixMock };
});

import {
    getResourcesFolderList,
    promptAddResourcesFolders,
    removeResourcesFolderSettings,
    sanitizeResourcesFolderList,
    setResourcesFolderList,
    toResourcesFolderExpandedSettingName,
} from './resourcesFolderHelpers';

describe('sanitizeResourcesFolderList', () => {
    beforeEach(() => {
        state.isLinux = false;
    });

    test('resolves, trims and drops empties and non-strings', () => {
        expect(
            sanitizeResourcesFolderList([
                '  /a/songs  ',
                '',
                '   ',
                42,
                null,
                'relative',
            ]),
        ).toEqual(['/a/songs', '/cwd/relative']);
    });

    test('treats a trailing separator as the same folder', () => {
        expect(sanitizeResourcesFolderList(['/a/songs', '/a/songs/'])).toEqual([
            '/a/songs',
        ]);
    });

    test('dedupes case-insensitively off Linux, keeping the first casing', () => {
        expect(sanitizeResourcesFolderList(['/A/Songs', '/a/songs'])).toEqual([
            '/A/Songs',
        ]);
    });

    test('keeps both casings on Linux, where they are two folders', () => {
        state.isLinux = true;
        expect(sanitizeResourcesFolderList(['/A/Songs', '/a/songs'])).toEqual([
            '/A/Songs',
            '/a/songs',
        ]);
    });

    test('returns an empty list for anything that is not an array', () => {
        expect(sanitizeResourcesFolderList(null)).toEqual([]);
        expect(sanitizeResourcesFolderList('/a/songs')).toEqual([]);
    });
});

describe('getResourcesFolderList / setResourcesFolderList', () => {
    test('round-trips through the setting', () => {
        getItemMock.mockReturnValue('["/a/songs","/b/notes"]');
        expect(getResourcesFolderList()).toEqual(['/a/songs', '/b/notes']);

        setResourcesFolderList(['/b/notes/', '/b/notes']);
        expect(setItemMock).toHaveBeenCalledWith(
            'resources-folder-list',
            '["/b/notes"]',
        );
    });

    test('falls back to an empty list when the stored JSON is unusable', () => {
        getItemMock.mockReturnValue('not json');
        expect(getResourcesFolderList()).toEqual([]);

        getItemMock.mockReturnValue('{"not":"an array"}');
        expect(getResourcesFolderList()).toEqual([]);
    });
});

describe('promptAddResourcesFolders', () => {
    test('returns null when the picker is cancelled', async () => {
        selectDirsMock.mockResolvedValue([]);
        expect(await promptAddResourcesFolders(['/a'])).toBeNull();
    });

    test('returns null when every picked folder is already listed', async () => {
        selectDirsMock.mockResolvedValue(['/a/songs/']);
        expect(await promptAddResourcesFolders(['/a/songs'])).toBeNull();
    });

    test('appends the new folders, keeping the existing order', async () => {
        selectDirsMock.mockResolvedValue(['/b/notes', '/c/media']);
        expect(await promptAddResourcesFolders(['/a/songs'])).toEqual([
            '/a/songs',
            '/b/notes',
            '/c/media',
        ]);
    });
});

describe('removeResourcesFolderSettings', () => {
    test('drops every per-folder setting the feature writes', async () => {
        removeByPrefixMock.mockResolvedValue([]);
        await removeResourcesFolderSettings('/a/songs');
        expect(removeByPrefixMock).toHaveBeenCalledWith(
            toResourcesFolderExpandedSettingName('/a/songs'),
        );
    });

    test('sanitizes the path into the setting key', () => {
        // Separators and dots would otherwise become directories in a file
        // name -- every setting key is one file on disk.
        expect(toResourcesFolderExpandedSettingName('/a/song.s')).toBe(
            'resources-folder-expanded-_a_song_s',
        );
    });
});
