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
    addResourcesFolders,
    addResourcesFoldersToList,
    carryResourcesFolderSettings,
    getResourcesFolderList,
    promptAddResourcesFolders,
    removeResourcesFolderSettings,
    replaceResourcesFolder,
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

describe('addResourcesFolders', () => {
    beforeEach(() => {
        state.isLinux = false;
    });

    test('appends the new ones and names them', () => {
        expect(addResourcesFolders(['/a/songs'], ['/b/notes'])).toEqual({
            newDirPathList: ['/a/songs', '/b/notes'],
            addedDirPaths: ['/b/notes'],
            duplicatedDirPaths: [],
        });
    });

    test('reports a folder the list already holds instead of re-adding it', () => {
        // The whole reason a drop needs more than the new list back: this is
        // the case where the panel does not visibly change.
        expect(addResourcesFolders(['/a/songs'], ['/a/songs/'])).toEqual({
            newDirPathList: null,
            addedDirPaths: [],
            duplicatedDirPaths: ['/a/songs'],
        });
    });

    test('counts two spellings of one folder in a single drop once', () => {
        expect(addResourcesFolders([], ['/B/Notes', '/b/notes'])).toEqual({
            newDirPathList: ['/B/Notes'],
            addedDirPaths: ['/B/Notes'],
            duplicatedDirPaths: [],
        });
    });

    test('keeps both casings on Linux, where they are two folders', () => {
        state.isLinux = true;
        expect(addResourcesFolders([], ['/B/Notes', '/b/notes'])).toEqual({
            newDirPathList: ['/B/Notes', '/b/notes'],
            addedDirPaths: ['/B/Notes', '/b/notes'],
            duplicatedDirPaths: [],
        });
    });

    test('takes the new ones out of a drop that also held known ones', () => {
        expect(
            addResourcesFolders(['/a/songs'], ['/a/songs', '/c/media']),
        ).toEqual({
            newDirPathList: ['/a/songs', '/c/media'],
            addedDirPaths: ['/c/media'],
            duplicatedDirPaths: ['/a/songs'],
        });
    });
});

describe('addResourcesFoldersToList', () => {
    beforeEach(() => {
        state.isLinux = false;
        getItemMock.mockReset();
        setItemMock.mockReset();
    });

    test('saves the list with the new folders on the end', () => {
        getItemMock.mockReturnValue('["/a/songs"]');
        expect(
            addResourcesFoldersToList(['/d/resources/pdf', '/a/Songs']),
        ).toEqual(['/d/resources/pdf']);
        expect(setItemMock).toHaveBeenCalledWith(
            'resources-folder-list',
            '["/a/songs","/d/resources/pdf"]',
        );
    });

    test('writes nothing when every folder is already listed', () => {
        // A second import of the same backup must not rewrite the setting.
        getItemMock.mockReturnValue('["/d/resources/pdf"]');
        expect(addResourcesFoldersToList(['/d/resources/pdf/'])).toEqual([]);
        expect(setItemMock).not.toHaveBeenCalled();
    });
});

describe('replaceResourcesFolder', () => {
    beforeEach(() => {
        state.isLinux = false;
    });

    test("puts the copy in the original folder's place", () => {
        expect(
            replaceResourcesFolder(
                ['/a/songs', '/b/youtube', '/c/media'],
                '/b/youtube',
                '/data/resources/youtube',
            ),
        ).toEqual(['/a/songs', '/data/resources/youtube', '/c/media']);
    });

    test("finds the original by the file system's own spelling rules", () => {
        expect(
            replaceResourcesFolder(['/B/YouTube/'], '/b/youtube', '/d/yt'),
        ).toEqual(['/d/yt']);
    });

    test('keeps the copy once when it was already listed', () => {
        expect(
            replaceResourcesFolder(
                ['/d/yt', '/b/youtube'],
                '/b/youtube',
                '/d/yt',
            ),
        ).toEqual(['/d/yt']);
    });

    test('changes nothing when the original is no longer listed', () => {
        expect(
            replaceResourcesFolder(['/a/songs'], '/b/youtube', '/d/yt'),
        ).toEqual(['/a/songs']);
    });
});

describe('carryResourcesFolderSettings', () => {
    beforeEach(() => {
        getItemMock.mockReset();
        setItemMock.mockReset();
    });

    test("hands a collapsed folder's state to its copy", () => {
        getItemMock.mockReturnValue('false');
        carryResourcesFolderSettings('/b/youtube', '/d/yt');
        expect(getItemMock).toHaveBeenCalledWith(
            toResourcesFolderExpandedSettingName('/b/youtube'),
        );
        expect(setItemMock).toHaveBeenCalledWith(
            toResourcesFolderExpandedSettingName('/d/yt'),
            'false',
        );
    });

    test('writes nothing for a folder that never stored a state', () => {
        getItemMock.mockReturnValue(null);
        carryResourcesFolderSettings('/b/youtube', '/d/yt');
        expect(setItemMock).not.toHaveBeenCalled();
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
