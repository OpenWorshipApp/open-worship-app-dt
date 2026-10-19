// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

// A small in-memory disk: folders in a set, files as text, POSIX paths.
const mocks = vi.hoisted(() => {
    const dirs = new Set<string>();
    const files = new Map<string, string>();
    const home = new Map<string, string>();
    const toParent = (filePath: string) => {
        return filePath.slice(0, filePath.lastIndexOf('/')) || '/';
    };
    const checkIsUnder = (filePath: string, dirPath: string) => {
        return filePath === dirPath || filePath.startsWith(`${dirPath}/`);
    };
    const makeDir = (dirPath: string) => {
        while (dirPath !== '/' && !dirs.has(dirPath)) {
            dirs.add(dirPath);
            dirPath = toParent(dirPath);
        }
    };
    const writeFile = (filePath: string, text: string) => {
        makeDir(toParent(filePath));
        files.set(filePath, text);
    };
    const removeTree = (dirPath: string) => {
        for (const one of [...dirs]) {
            if (checkIsUnder(one, dirPath)) {
                dirs.delete(one);
            }
        }
        for (const one of [...files.keys()]) {
            if (checkIsUnder(one, dirPath)) {
                files.delete(one);
            }
        }
    };
    const moveTree = (oldPath: string, newPath: string) => {
        const rebase = (one: string) => {
            return newPath + one.slice(oldPath.length);
        };
        const movedDirs = [...dirs].filter((one) => {
            return checkIsUnder(one, oldPath);
        });
        const movedFiles = [...files.entries()].filter(([one]) => {
            return checkIsUnder(one, oldPath);
        });
        removeTree(oldPath);
        for (const one of movedDirs) {
            makeDir(rebase(one));
        }
        for (const [one, text] of movedFiles) {
            writeFile(rebase(one), text);
        }
    };
    const listDirents = (dirPath: string) => {
        if (!dirs.has(dirPath)) {
            throw new Error(`ENOENT: ${dirPath}`);
        }
        const names = new Map<string, boolean>();
        for (const one of dirs) {
            if (toParent(one) === dirPath && one !== dirPath) {
                names.set(one.slice(dirPath.length + 1), true);
            }
        }
        for (const one of files.keys()) {
            if (toParent(one) === dirPath) {
                names.set(one.slice(dirPath.length + 1), false);
            }
        }
        return [...names.entries()].map(([name, isDirectory]) => {
            return { name, isDirectory, isFile: !isDirectory };
        });
    };
    const listFilesUnder = (dirPath: string) => {
        return [...files.keys()].filter((one) => {
            return checkIsUnder(one, dirPath);
        });
    };
    return {
        dirs,
        files,
        home,
        makeDir,
        writeFile,
        moveTree,
        removeTree,
        listDirents,
        listFilesUnder,
        isMac: false,
        isMainWindow: true,
        renameError: null as Error | null,
        copyError: null as Error | null,
        copyDroppedFile: null as string | null,
        renameCalls: [] as [string, string][],
        relaunchApp: vi.fn(),
        handleError: vi.fn(),
        setSelectedParentDirectory: vi.fn(async (dirPath: string) => {
            home.set('selected-parent-dir', dirPath);
        }),
        removeParentDirHistory: vi.fn(),
    };
});

vi.mock('../../server/appProvider', () => ({
    default: {
        get systemUtils() {
            return { isMac: mocks.isMac, isDev: false };
        },
        browserUtils: {
            pathToFileURL: (filePath: string) => `file://${filePath}`,
        },
        fileUtils: {
            rename: (
                oldPath: string,
                newPath: string,
                callback: (error: Error | null) => void,
            ) => {
                mocks.renameCalls.push([oldPath, newPath]);
                if (mocks.renameError !== null) {
                    callback(mocks.renameError);
                    return;
                }
                mocks.moveTree(oldPath, newPath);
                callback(null);
            },
        },
    },
}));

vi.mock('../../server/appHomeStorage', () => ({
    appHomeStorage: {
        getItem: (key: string) => mocks.home.get(key) ?? null,
        setItem: (key: string, value: string) => mocks.home.set(key, value),
        removeItem: (key: string) => mocks.home.delete(key),
    },
}));

vi.mock('../../server/mainWindowHelpers', () => ({
    checkIsMainWindow: () => mocks.isMainWindow,
}));

vi.mock('../../lang/langHelpers', () => ({
    getCurrentLocale: () => 'en',
    getLangDataAsync: async () => null,
    tran: (text: string) => text,
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: mocks.handleError,
}));

vi.mock('../settingHelpers', () => ({
    relaunchApp: mocks.relaunchApp,
}));

vi.mock('./appLocalStorage', () => ({
    DATA_DIR_MOVE_PENDING_SETTING_NAME: 'data-dir-move-pending',
    DATA_DIR_MOVE_RESULT_SESSION_NAME: 'data-dir-move-result',
    SELECTED_PARENT_DIR_SETTING_NAME: 'selected-parent-dir',
    appLocalStorage: {
        setSelectedParentDirectory: mocks.setSelectedParentDirectory,
    },
}));

vi.mock('./parentDirHistoryHelpers', () => ({
    removeParentDirHistory: mocks.removeParentDirHistory,
}));

// Every file, like the real walker's app text files.
vi.mock('./directoryHelpers', () => ({
    forEachDataDirTextFile: async (
        dataDirPath: string,
        handler: (filePath: string) => Promise<void>,
    ) => {
        for (const filePath of mocks.listFilesUnder(dataDirPath)) {
            await handler(filePath);
        }
    },
}));

vi.mock('../../resources/resourcesCopyHelpers', () => ({
    copyDirTree: async (
        sourceDirPath: string,
        destinationDirPath: string,
        counts: { fileCount: number; skippedCount: number },
        onFileCopied?: () => void,
    ) => {
        mocks.makeDir(destinationDirPath);
        for (const filePath of mocks.listFilesUnder(sourceDirPath)) {
            if (mocks.copyError !== null) {
                throw mocks.copyError;
            }
            if (filePath === mocks.copyDroppedFile) {
                continue;
            }
            mocks.writeFile(
                destinationDirPath + filePath.slice(sourceDirPath.length),
                mocks.files.get(filePath) as string,
            );
            counts.fileCount++;
            onFileCopied?.();
        }
    },
    genFreeDirPath: async (parentDirPath: string, name: string) => {
        let index = 0;
        let dirPath = `${parentDirPath}/${name}`;
        while (mocks.dirs.has(dirPath)) {
            index++;
            dirPath = `${parentDirPath}/${name} (${index})`;
        }
        return dirPath;
    },
}));

vi.mock('../../server/fileHelpers', () => ({
    checkIsInOneDrivePath: (dirPath: string) => {
        return dirPath.split('/').some((name) => {
            return /^OneDrive( - .+)?$/i.test(name);
        });
    },
    DATA_DIR_MOVED_FROM_FLAG_FILE_NAME: 'migration-moved-from.txt',
    DATA_DIR_MOVED_TO_FLAG_FILE_NAME: 'migration-moved-to.txt',
    DEFAULT_DATA_DIR_NAME: 'open-worship-data',
    fsCheckDirExist: async (dirPath: string) => mocks.dirs.has(dirPath),
    fsCreateDir: async (dirPath: string) => mocks.makeDir(dirPath),
    fsDeleteDir: async (dirPath: string) => mocks.removeTree(dirPath),
    fsGetFileSize: async (filePath: string) => {
        return (mocks.files.get(filePath) as string).length;
    },
    fsListDirents: async (dirPath: string) => mocks.listDirents(dirPath),
    fsReadFile: async (filePath: string) => {
        const text = mocks.files.get(filePath);
        if (text === undefined) {
            throw new Error(`ENOENT: ${filePath}`);
        }
        return text;
    },
    fsWriteFile: async (filePath: string, text: string) => {
        mocks.writeFile(filePath, text);
        return filePath;
    },
    getDefaultDataDirPath: () => '/home/.owa/open-worship-data',
    pathDirname: (filePath: string) => {
        return filePath.slice(0, filePath.lastIndexOf('/'));
    },
    pathJoin: (...parts: string[]) => parts.join('/'),
    pathResolve: (filePath: string) => filePath,
    pathSeparator: '/',
    toPathCompareKey: (filePath: string) => filePath.toLowerCase(),
}));

import {
    checkIsDataDirMoveHidden,
    DATA_DIR_MOVE_HIDE_MS,
    hideDataDirMoveForAWhile,
    readDataDirMovedFromFlag,
    readDataDirMovedToFlag,
    requestDataDirMove,
    rewriteMovedDataDirLinks,
    runPendingDataDirMove,
} from './dataDirMoveHelpers';

const DESKTOP_DIR = '/home/Desktop/open-worship-data';
const ONE_DRIVE_DIR = '/home/OneDrive/Desktop/open-worship-data';
const TARGET_DIR = '/home/.owa/open-worship-data';

function seedDataDir(dirPath: string) {
    mocks.writeFile(`${dirPath}/.owa-data-folder.json`, '{"id":"abc"}');
    // A setting saved by an older version, with the folder's raw path.
    mocks.writeFile(
        `${dirPath}/local-storage/select-dir-app-document`,
        `${dirPath}/documents`,
    );
    mocks.writeFile(
        `${dirPath}/documents/song.ows`,
        JSON.stringify({
            image: `file://${dirPath}/images/a.png`,
            video: '$DATA_DIR_PATH/videos/b.mp4',
        }),
    );
    mocks.writeFile(`${dirPath}/images/a.png`, 'png');
}

function askForMove(fromDirPath: string) {
    mocks.home.set('selected-parent-dir', fromDirPath);
    mocks.home.set(
        'data-dir-move-pending',
        JSON.stringify({ fromDirPath, requestedAt: 1 }),
    );
}

function readResult() {
    return JSON.parse(sessionStorage.getItem('data-dir-move-result') ?? 'null');
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.dirs.clear();
    mocks.files.clear();
    mocks.home.clear();
    mocks.isMac = false;
    mocks.isMainWindow = true;
    mocks.renameError = null;
    mocks.copyError = null;
    mocks.copyDroppedFile = null;
    mocks.renameCalls.length = 0;
    mocks.makeDir('/home');
    sessionStorage.clear();
    document.body.innerHTML = '';
});

describe('the 30-day hide', () => {
    test('hides the question for 30 days and no longer', () => {
        const now = 1_000_000;
        expect(checkIsDataDirMoveHidden(now)).toBe(false);
        hideDataDirMoveForAWhile(now);
        expect(checkIsDataDirMoveHidden(now)).toBe(true);
        expect(checkIsDataDirMoveHidden(now + DATA_DIR_MOVE_HIDE_MS - 1)).toBe(
            true,
        );
        expect(checkIsDataDirMoveHidden(now + DATA_DIR_MOVE_HIDE_MS)).toBe(
            false,
        );
    });

    test('does not believe a stamp set while the clock ran far ahead', () => {
        const now = 1_000_000;
        hideDataDirMoveForAWhile(now + 10 * DATA_DIR_MOVE_HIDE_MS);
        expect(checkIsDataDirMoveHidden(now)).toBe(false);
    });
});

test('Move Now records the folder and relaunches', () => {
    requestDataDirMove(DESKTOP_DIR);
    expect(
        JSON.parse(mocks.home.get('data-dir-move-pending') as string),
    ).toMatchObject({ fromDirPath: DESKTOP_DIR });
    expect(mocks.relaunchApp).toHaveBeenCalledOnce();
});

describe('runPendingDataDirMove', () => {
    test('waits for the main window, leaving the request in place', async () => {
        seedDataDir(DESKTOP_DIR);
        askForMove(DESKTOP_DIR);
        mocks.isMainWindow = false;
        await runPendingDataDirMove();
        expect(mocks.home.has('data-dir-move-pending')).toBe(true);
        expect(mocks.dirs.has(DESKTOP_DIR)).toBe(true);
    });

    test('drops a request for a folder that is no longer the one chosen', async () => {
        seedDataDir(DESKTOP_DIR);
        askForMove(DESKTOP_DIR);
        mocks.home.set('selected-parent-dir', '/somewhere/else');
        await runPendingDataDirMove();
        expect(mocks.home.has('data-dir-move-pending')).toBe(false);
        expect(mocks.dirs.has(DESKTOP_DIR)).toBe(true);
        expect(mocks.setSelectedParentDirectory).not.toHaveBeenCalled();
        expect(readResult()).toBeNull();
    });

    test('renames a folder outside OneDrive, leaving nothing behind', async () => {
        seedDataDir(DESKTOP_DIR);
        askForMove(DESKTOP_DIR);
        await runPendingDataDirMove();

        expect(mocks.home.has('data-dir-move-pending')).toBe(false);
        expect(mocks.renameCalls).toEqual([[DESKTOP_DIR, TARGET_DIR]]);
        expect(mocks.dirs.has(DESKTOP_DIR)).toBe(false);
        expect(mocks.files.get(`${TARGET_DIR}/images/a.png`)).toBe('png');
        expect(mocks.setSelectedParentDirectory).toHaveBeenCalledWith(
            TARGET_DIR,
        );
        expect(mocks.removeParentDirHistory).toHaveBeenCalledWith(DESKTOP_DIR);
        // Old raw paths and URLs now follow the folder.
        expect(
            mocks.files.get(
                `${TARGET_DIR}/local-storage/select-dir-app-document`,
            ),
        ).toBe('$DATA_DIR_PATH/documents');
        expect(
            JSON.parse(mocks.files.get(`${TARGET_DIR}/documents/song.ows`)!),
        ).toEqual({
            image: 'file:///$DATA_DIR_PATH/images/a.png',
            video: '$DATA_DIR_PATH/videos/b.mp4',
        });
        expect(await readDataDirMovedFromFlag(TARGET_DIR)).toMatchObject({
            dirPath: DESKTOP_DIR,
        });
        expect(readResult()).toEqual({
            isMoved: true,
            fromDirPath: DESKTOP_DIR,
            toDirPath: TARGET_DIR,
            isCopied: false,
        });
        // The waiting words are gone once the window can render.
        expect(document.body.children).toHaveLength(0);
    });

    test('copies a folder under OneDrive and keeps the old one, marked', async () => {
        seedDataDir(ONE_DRIVE_DIR);
        askForMove(ONE_DRIVE_DIR);
        await runPendingDataDirMove();

        // Only the staging folder is renamed, never the OneDrive one.
        expect(mocks.renameCalls).toHaveLength(1);
        expect(mocks.renameCalls[0][0]).toMatch(
            /^\/home\/\.owa\/\.open-worship-data\.moving-\d+$/,
        );
        expect(mocks.renameCalls[0][1]).toBe(TARGET_DIR);
        expect(mocks.files.get(`${ONE_DRIVE_DIR}/images/a.png`)).toBe('png');
        expect(mocks.files.get(`${TARGET_DIR}/images/a.png`)).toBe('png');
        expect(await readDataDirMovedToFlag(ONE_DRIVE_DIR)).toMatchObject({
            dirPath: TARGET_DIR,
        });
        expect(await readDataDirMovedFromFlag(TARGET_DIR)).toMatchObject({
            dirPath: ONE_DRIVE_DIR,
        });
        // The old copy is left exactly as it was, but for its flag.
        expect(
            mocks.files.get(
                `${ONE_DRIVE_DIR}/local-storage/select-dir-app-document`,
            ),
        ).toBe(`${ONE_DRIVE_DIR}/documents`);
        expect(readResult()).toMatchObject({ isMoved: true, isCopied: true });
        expect(
            [...mocks.dirs].some((dirPath) => dirPath.includes('.moving-')),
        ).toBe(false);
    });

    test('copies when the rename is refused', async () => {
        seedDataDir(DESKTOP_DIR);
        askForMove(DESKTOP_DIR);
        mocks.renameError = Object.assign(new Error('EPERM'), {
            code: 'EPERM',
        });
        // The staging folder's rename is refused as well: nothing moves.
        await runPendingDataDirMove();
        expect(readResult()).toMatchObject({ isMoved: false });
        expect(mocks.setSelectedParentDirectory).not.toHaveBeenCalled();

        mocks.renameError = null;
        let isFirstRename = true;
        const fileUtils = (await import('../../server/appProvider')).default
            .fileUtils as any;
        const rename = fileUtils.rename;
        fileUtils.rename = (
            oldPath: string,
            newPath: string,
            callback: (error: Error | null) => void,
        ) => {
            if (isFirstRename) {
                isFirstRename = false;
                callback(new Error('EBUSY'));
                return;
            }
            rename(oldPath, newPath, callback);
        };
        try {
            askForMove(DESKTOP_DIR);
            await runPendingDataDirMove();
        } finally {
            fileUtils.rename = rename;
        }
        expect(readResult()).toMatchObject({ isMoved: true, isCopied: true });
        expect(mocks.dirs.has(DESKTOP_DIR)).toBe(true);
        expect(mocks.files.get(`${TARGET_DIR}/images/a.png`)).toBe('png');
    });

    test('a failed copy changes nothing and leaves no staging folder', async () => {
        seedDataDir(ONE_DRIVE_DIR);
        askForMove(ONE_DRIVE_DIR);
        mocks.copyError = new Error('ENOSPC: no space left on device');
        await runPendingDataDirMove();

        expect(readResult()).toMatchObject({
            isMoved: false,
            fromDirPath: ONE_DRIVE_DIR,
            errorMessage: 'ENOSPC: no space left on device',
        });
        expect(mocks.setSelectedParentDirectory).not.toHaveBeenCalled();
        expect(mocks.dirs.has(TARGET_DIR)).toBe(false);
        expect(
            [...mocks.dirs].some((dirPath) => dirPath.includes('.moving-')),
        ).toBe(false);
        expect(await readDataDirMovedToFlag(ONE_DRIVE_DIR)).toBeNull();
        expect(mocks.handleError).toHaveBeenCalled();
    });

    test('a copy that is not whole is thrown away', async () => {
        seedDataDir(ONE_DRIVE_DIR);
        askForMove(ONE_DRIVE_DIR);
        mocks.copyDroppedFile = `${ONE_DRIVE_DIR}/images/a.png`;
        await runPendingDataDirMove();

        expect(readResult()).toMatchObject({
            isMoved: false,
            errorMessage:
                'The copy is not the same as the data folder, so it was not used.',
        });
        expect(mocks.dirs.has(TARGET_DIR)).toBe(false);
        expect(mocks.setSelectedParentDirectory).not.toHaveBeenCalled();
    });

    test('stops on a Mac when files are only in iCloud Drive', async () => {
        mocks.isMac = true;
        seedDataDir(DESKTOP_DIR);
        mocks.writeFile(`${DESKTOP_DIR}/videos/.big.mp4.icloud`, 'stub');
        askForMove(DESKTOP_DIR);
        await runPendingDataDirMove();

        expect(readResult()).toMatchObject({ isMoved: false });
        expect(readResult().errorMessage).toContain('iCloud Drive');
        // Not even renamed: the stub would leave iCloud's Desktop.
        expect(mocks.renameCalls).toEqual([]);
        expect(mocks.dirs.has(TARGET_DIR)).toBe(false);
        expect(mocks.handleError).not.toHaveBeenCalled();
    });

    test('takes over an empty target and names around a used one', async () => {
        seedDataDir(DESKTOP_DIR);
        mocks.makeDir(TARGET_DIR);
        askForMove(DESKTOP_DIR);
        await runPendingDataDirMove();
        expect(readResult().toDirPath).toBe(TARGET_DIR);

        const otherDir = '/home/Desktop/open-worship-data-2';
        seedDataDir(otherDir);
        askForMove(otherDir);
        await runPendingDataDirMove();
        expect(readResult().toDirPath).toBe(`${TARGET_DIR} (1)`);
        expect(mocks.files.get(`${TARGET_DIR}/images/a.png`)).toBe('png');
    });

    test('clears a staging folder left by a start that was cut short', async () => {
        mocks.writeFile('/home/.owa/.open-worship-data.moving-1/half', 'x');
        seedDataDir(DESKTOP_DIR);
        askForMove(DESKTOP_DIR);
        await runPendingDataDirMove();
        expect(mocks.dirs.has('/home/.owa/.open-worship-data.moving-1')).toBe(
            false,
        );
    });
});

describe('rewriteMovedDataDirLinks', () => {
    test('rewrites only the old folder, whole names only', async () => {
        mocks.writeFile(
            `${TARGET_DIR}/a.json`,
            [
                `${DESKTOP_DIR}/videos/a.mp4`,
                `${DESKTOP_DIR}-dev/videos/b.mp4`,
                '/elsewhere/c.mp4',
            ].join('\n'),
        );
        mocks.writeFile(`${TARGET_DIR}/b.json`, 'nothing to change');
        expect(await rewriteMovedDataDirLinks(TARGET_DIR, DESKTOP_DIR)).toBe(1);
        expect(mocks.files.get(`${TARGET_DIR}/a.json`)).toBe(
            [
                '$DATA_DIR_PATH/videos/a.mp4',
                `${DESKTOP_DIR}-dev/videos/b.mp4`,
                '/elsewhere/c.mp4',
            ].join('\n'),
        );
    });
});

describe('the flag files', () => {
    test('read the path and the date back', async () => {
        mocks.writeFile(
            `${TARGET_DIR}/migration-moved-from.txt`,
            'Moved here.\r\n\r\nmoved-at: 2026-10-17T00:00:00.000Z\r\n' +
                `moved-from: ${DESKTOP_DIR}\r\n`,
        );
        expect(await readDataDirMovedFromFlag(TARGET_DIR)).toEqual({
            dirPath: DESKTOP_DIR,
            movedAt: '2026-10-17T00:00:00.000Z',
        });
        expect(await readDataDirMovedToFlag(TARGET_DIR)).toBeNull();
        expect(await readDataDirMovedFromFlag('/nowhere')).toBeNull();
    });
});
