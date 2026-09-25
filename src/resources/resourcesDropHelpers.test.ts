import { beforeEach, describe, expect, test, vi } from 'vitest';

const { checkDirExistMock, state } = vi.hoisted(() => ({
    checkDirExistMock: vi.fn(),
    state: { isLinux: false },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        get systemUtils() {
            return { isLinux: state.isLinux, isDev: false };
        },
    },
}));

vi.mock('../server/fileHelpers', () => ({
    fsCheckDirExist: checkDirExistMock,
    // Mirrors the real `pathResolve`, which `sanitizeResourcesFolderList`
    // runs every candidate through: absolute-ish, no trailing separator.
    pathResolve: (dirPath: string) => {
        const resolved = dirPath.startsWith('/') ? dirPath : `/cwd/${dirPath}`;
        return resolved.endsWith('/') ? resolved.slice(0, -1) : resolved;
    },
    // Mirror the real ones on macOS/Linux (tested in `fileHelpers.test.ts`).
    checkIsForeignAbsolutePath: (dirPath: string) => {
        return /^[A-Za-z]:[\\/]/.test(dirPath);
    },
    toPathCompareKey: (dirPath: string) => {
        return state.isLinux ? dirPath : dirPath.toLowerCase();
    },
    selectDirs: vi.fn(),
}));

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: vi.fn(() => null),
    },
}));

import {
    checkIsDraggingFiles,
    MAX_DROPPED_PATHS,
    planResourcesFolderDrop,
    readDroppedPaths,
} from './resourcesDropHelpers';

function genDataTransfer({
    items = [],
    files = [],
}: {
    items?: { kind: string }[];
    files?: unknown[];
} = {}) {
    return { items, files } as unknown as DataTransfer;
}

// `appFilePath` is a PROTOTYPE getter in the real app, so a dropped `File`
// carries it without owning it; a plain object with the property reads the
// same way to `getAppFilePathFromFile`, which is all this module asks of one.
function genDroppedFile(filePath?: unknown) {
    return filePath === undefined ? {} : { appFilePath: filePath };
}

describe('checkIsDraggingFiles', () => {
    test('accepts a drag carrying only files', () => {
        expect(
            checkIsDraggingFiles(
                genDataTransfer({ items: [{ kind: 'file' }] }),
            ),
        ).toBe(true);
    });

    test('refuses an empty drag, where `every` is vacuously true', () => {
        expect(checkIsDraggingFiles(genDataTransfer())).toBe(false);
        expect(checkIsDraggingFiles(null)).toBe(false);
    });

    test("refuses the app's own drags, which travel as strings", () => {
        expect(
            checkIsDraggingFiles(
                genDataTransfer({ items: [{ kind: 'string' }] }),
            ),
        ).toBe(false);
        expect(
            checkIsDraggingFiles(
                genDataTransfer({
                    items: [{ kind: 'file' }, { kind: 'string' }],
                }),
            ),
        ).toBe(false);
    });
});

describe('readDroppedPaths', () => {
    test('reads the stamped paths, in drop order', () => {
        expect(
            readDroppedPaths(
                genDataTransfer({
                    files: [
                        genDroppedFile('/a/songs'),
                        genDroppedFile('/b/notes'),
                    ],
                }),
            ),
        ).toEqual(['/a/songs', '/b/notes']);
    });

    test('drops repeats and anything with no path on it', () => {
        expect(
            readDroppedPaths(
                genDataTransfer({
                    files: [
                        genDroppedFile('/a/songs'),
                        // A blob made in the renderer: no path to shelve.
                        genDroppedFile(),
                        genDroppedFile(''),
                        genDroppedFile(42),
                        genDroppedFile('/a/songs'),
                    ],
                }),
            ),
        ).toEqual(['/a/songs']);
    });

    test('answers nothing for a drag with no files at all', () => {
        expect(readDroppedPaths(genDataTransfer())).toEqual([]);
        expect(readDroppedPaths(null)).toEqual([]);
    });
});

describe('planResourcesFolderDrop', () => {
    beforeEach(() => {
        state.isLinux = false;
        checkDirExistMock.mockReset();
    });

    test('adds the folders and leaves the files out of the list', async () => {
        checkDirExistMock.mockImplementation(async (dirPath: string) => {
            return dirPath === '/b/notes';
        });
        expect(
            await planResourcesFolderDrop(
                ['/b/notes', '/b/notes/song.pdf'],
                ['/a/songs'],
            ),
        ).toEqual({
            newDirPathList: ['/a/songs', '/b/notes'],
            addedDirPaths: ['/b/notes'],
            duplicatedDirPaths: [],
            isNonFolderDropped: true,
        });
    });

    test('never turns a dropped file into its parent folder', async () => {
        // Dropping one PDF must not shelve the whole Downloads folder it sat
        // in -- that is a recursive walk of everything the user owns.
        checkDirExistMock.mockResolvedValue(false);
        expect(
            await planResourcesFolderDrop(['/downloads/song.pdf'], []),
        ).toEqual({
            newDirPathList: null,
            addedDirPaths: [],
            duplicatedDirPaths: [],
            isNonFolderDropped: true,
        });
    });

    test('says a dropped folder was already listed', async () => {
        checkDirExistMock.mockResolvedValue(true);
        expect(
            await planResourcesFolderDrop(['/a/songs/'], ['/a/songs']),
        ).toEqual({
            newDirPathList: null,
            addedDirPaths: [],
            duplicatedDirPaths: ['/a/songs'],
            isNonFolderDropped: false,
        });
    });

    test('treats a path it cannot even read as not a folder', async () => {
        // A permission-denied share or a device pulled mid-drag must not take
        // the rest of the drop down with it.
        checkDirExistMock.mockImplementation(async (dirPath: string) => {
            if (dirPath === '/mnt/gone') {
                throw new Error('EACCES');
            }
            return true;
        });
        expect(
            await planResourcesFolderDrop(['/mnt/gone', '/b/notes'], []),
        ).toEqual({
            newDirPathList: ['/b/notes'],
            addedDirPaths: ['/b/notes'],
            duplicatedDirPaths: [],
            isNonFolderDropped: true,
        });
    });

    test('stats no more than the cap, whatever was dropped', async () => {
        checkDirExistMock.mockResolvedValue(false);
        const droppedPaths = Array.from(
            { length: MAX_DROPPED_PATHS + 20 },
            (_value, index) => {
                return `/downloads/file-${index}.pdf`;
            },
        );
        await planResourcesFolderDrop(droppedPaths, []);
        expect(checkDirExistMock).toHaveBeenCalledTimes(MAX_DROPPED_PATHS);
    });
});
