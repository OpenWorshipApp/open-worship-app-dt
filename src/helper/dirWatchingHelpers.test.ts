import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    dirSourceGetAllInstancesMock,
    dirSourceGetInstanceByDirPathMock,
    fileSourceGetInstanceMock,
    fsCheckDirExistMock,
    fsCheckFileExistMock,
    checkAreArraysEqualMock,
    watchMock,
    handleErrorMock,
    getSelectedParentDirectoryMock,
} = vi.hoisted(() => ({
    dirSourceGetAllInstancesMock: vi.fn(),
    dirSourceGetInstanceByDirPathMock: vi.fn(),
    fileSourceGetInstanceMock: vi.fn(),
    fsCheckDirExistMock: vi.fn(),
    fsCheckFileExistMock: vi.fn(),
    checkAreArraysEqualMock: vi.fn(
        (left: unknown, right: unknown) =>
            JSON.stringify(left) === JSON.stringify(right),
    ),
    watchMock: vi.fn(),
    handleErrorMock: vi.fn(),
    getSelectedParentDirectoryMock: vi.fn(),
}));

vi.mock('./DirSource', () => ({
    default: {
        getAllInstances: dirSourceGetAllInstancesMock,
        getInstanceByDirPath: dirSourceGetInstanceByDirPathMock,
    },
}));

vi.mock('./FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstanceMock,
    },
}));

vi.mock('../server/fileHelpers', () => ({
    fsCheckDirExist: fsCheckDirExistMock,
    fsCheckFileExist: fsCheckFileExistMock,
    pathJoin: (...paths: string[]) => paths.filter(Boolean).join('/'),
    pathDirname: (filePath: string) =>
        filePath.split('/').slice(0, -1).join('/'),
}));

vi.mock('../server/comparisonHelpers', () => ({
    checkAreArraysEqual: checkAreArraysEqualMock,
}));

vi.mock('../server/appProvider', () => ({
    default: {
        fileUtils: {
            watch: watchMock,
        },
    },
}));

vi.mock('./errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getSelectedParentDirectory: getSelectedParentDirectoryMock,
    },
}));

// `watchingState` and the pending sets are module state, so every test gets a
// fresh module.
async function importHelpers() {
    vi.resetModules();
    return await import('./dirWatchingHelpers');
}

async function startWatching() {
    let watchCallback: ((...args: unknown[]) => void) | undefined;
    watchMock.mockImplementation(
        (
            _dirPath: string,
            _options: { signal: AbortSignal },
            callback: (...args: unknown[]) => void,
        ) => {
            watchCallback = callback;
        },
    );
    const helpers = await importHelpers();
    await helpers.watchDataDir();
    return { helpers, getWatchCallback: () => watchCallback };
}

// The watch callback only ARMS the trailing pass; the filesystem work runs one
// debounce window later.
async function flushDebounce() {
    await vi.advanceTimersByTimeAsync(600);
    await vi.waitFor(() => {
        return Promise.resolve();
    });
}

function genDirSource(filePathsMap: Record<string, string[]> = {}) {
    return {
        filePathsMap,
        fireRefreshEvent: vi.fn(),
        getFilePathsQuick: vi.fn(),
    };
}

describe('dirWatchingHelpers', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        getSelectedParentDirectoryMock.mockResolvedValue('/data');
        fsCheckDirExistMock.mockResolvedValue(true);
        fsCheckFileExistMock.mockResolvedValue(false);
        fileSourceGetInstanceMock.mockReturnValue({
            fireUpdateEvent: vi.fn(),
        });
        dirSourceGetInstanceByDirPathMock.mockReturnValue(null);
        dirSourceGetAllInstancesMock.mockReturnValue([]);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('watches the data dir recursively, once per dir', async () => {
        const { helpers } = await startWatching();

        expect(watchMock).toHaveBeenCalledWith(
            '/data',
            expect.objectContaining({
                signal: expect.any(AbortSignal),
                recursive: true,
            }),
            expect.any(Function),
        );

        // A second caller must not install a second watch on the same dir.
        await helpers.watchDataDir();
        expect(watchMock).toHaveBeenCalledTimes(1);
    });

    test('a burst of registrations resolves the directory once', async () => {
        watchMock.mockImplementation(() => {});
        const helpers = await importHelpers();

        await Promise.all(
            Array.from({ length: 25 }, () => {
                return helpers.watchDataDir();
            }),
        );

        // The whole point of the memo: 25 listener registrations, one lookup
        // and one watch — NOT 25 of each behind a polling lock.
        expect(getSelectedParentDirectoryMock).toHaveBeenCalledTimes(1);
        expect(watchMock).toHaveBeenCalledTimes(1);

        // ...and the settled call does no async work at all.
        getSelectedParentDirectoryMock.mockClear();
        await helpers.watchDataDir();
        expect(getSelectedParentDirectoryMock).not.toHaveBeenCalled();
    });

    test('skips watching without a selected dir, or when it is gone', async () => {
        getSelectedParentDirectoryMock.mockResolvedValue(null);
        const helpers = await importHelpers();
        await helpers.watchDataDir();
        expect(watchMock).not.toHaveBeenCalled();

        fsCheckDirExistMock.mockResolvedValue(false);
        getSelectedParentDirectoryMock.mockResolvedValue('/data');
        await helpers.watchDataDir();
        expect(watchMock).not.toHaveBeenCalled();

        // Neither failure latches: once a directory IS selectable, the next
        // caller starts the watch.
        fsCheckDirExistMock.mockResolvedValue(true);
        await helpers.watchDataDir();
        expect(watchMock).toHaveBeenCalledTimes(1);
    });

    test('reports a failing watch setup instead of throwing', async () => {
        watchMock.mockImplementation(() => {
            throw new Error('watch failed');
        });
        const helpers = await importHelpers();
        await helpers.watchDataDir();

        expect(handleErrorMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'watch failed' }),
        );
    });

    test('unwatching aborts the watch and lets a later one start', async () => {
        const { helpers } = await startWatching();
        const signal: AbortSignal = watchMock.mock.calls[0][1].signal;
        expect(signal.aborted).toBe(false);

        helpers.unwatchDataDir();
        expect(signal.aborted).toBe(true);

        await helpers.watchDataDir();
        expect(watchMock).toHaveBeenCalledTimes(2);

        // Unwatching a dir that is not watched is a no-op.
        helpers.unwatchDataDir();
        helpers.unwatchDataDir();
    });

    test('unwatching releases the dir it STARTED on, not the current one', async () => {
        const { helpers } = await startWatching();
        const signal: AbortSignal = watchMock.mock.calls[0][1].signal;

        // The setting has already moved on by the time the watch is released.
        getSelectedParentDirectoryMock.mockResolvedValue('/new-data');
        helpers.unwatchDataDir();

        expect(signal.aborted).toBe(true);

        await helpers.watchDataDir();
        expect(watchMock).toHaveBeenLastCalledWith(
            '/new-data',
            expect.anything(),
            expect.any(Function),
        );
    });

    test('does no filesystem work until the burst settles', async () => {
        const { getWatchCallback } = await startWatching();

        // A media download writes its file in many chunks; each one is an event.
        for (let i = 0; i < 200; i++) {
            getWatchCallback()?.('change', 'videos/big.mp4');
        }
        expect(fileSourceGetInstanceMock).not.toHaveBeenCalled();
        expect(dirSourceGetInstanceByDirPathMock).not.toHaveBeenCalled();

        await flushDebounce();

        // 200 events, ONE update and ONE directory reconcile.
        expect(fileSourceGetInstanceMock).toHaveBeenCalledTimes(1);
        expect(dirSourceGetInstanceByDirPathMock).toHaveBeenCalledTimes(1);
    });

    test('tells the changed file itself', async () => {
        const firedPaths: string[] = [];
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => ({
            fireUpdateEvent: () => {
                firedPaths.push(filePath);
            },
        }));
        const { getWatchCallback } = await startWatching();

        // fs.watch reports names relative to the watched directory.
        getWatchCallback()?.('change', 'docs/a.owa');
        await flushDebounce();

        // An ordinary file is not a sidecar of anything, so nothing else is
        // told about it.
        expect(firedPaths).toEqual(['/data/docs/a.owa']);
    });

    test('collapses a burst without losing a second directory', async () => {
        const firedPaths: string[] = [];
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => ({
            fireUpdateEvent: () => {
                firedPaths.push(filePath);
            },
        }));
        const docsDirSource = genDirSource();
        const videosDirSource = genDirSource();
        dirSourceGetInstanceByDirPathMock.mockImplementation(
            (dirPath: string) => {
                return dirPath === '/data/docs'
                    ? docsDirSource
                    : videosDirSource;
            },
        );
        const { getWatchCallback } = await startWatching();

        getWatchCallback()?.('change', 'docs/a.owa');
        getWatchCallback()?.('rename', 'videos/b.mp4');
        await flushDebounce();

        // A plain debounce would have kept only the last event.
        expect(firedPaths).toEqual(['/data/docs/a.owa', '/data/videos/b.mp4']);
        expect(docsDirSource.fireRefreshEvent).toHaveBeenCalledTimes(1);
        expect(videosDirSource.fireRefreshEvent).toHaveBeenCalledTimes(1);
    });

    test('blames the file a history folder belongs to', async () => {
        const firedPaths: string[] = [];
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => ({
            fireUpdateEvent: () => {
                firedPaths.push(filePath);
            },
        }));
        fsCheckFileExistMock.mockResolvedValue(true);
        const { getWatchCallback } = await startWatching();

        // The revision that was written, then the document it is a revision OF.
        getWatchCallback()?.('rename', 'docs/a.owa.histories/12');
        await flushDebounce();

        expect(fsCheckFileExistMock).toHaveBeenCalledWith('/data/docs/a.owa');
        expect(firedPaths).toEqual([
            '/data/docs/a.owa.histories/12',
            '/data/docs/a.owa',
        ]);

        // A history folder whose document is gone names nothing extra.
        firedPaths.length = 0;
        fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
            return !filePath.endsWith('b.owa');
        });
        getWatchCallback()?.('change', 'docs/b.owa.histories/3');
        await flushDebounce();

        expect(firedPaths).toEqual(['/data/docs/b.owa.histories/3']);
    });

    test('a sidecar write costs no directory listing', async () => {
        const { getWatchCallback } = await startWatching();

        getWatchCallback()?.('change', 'docs/a.owa.histories/12');
        await flushDebounce();

        // The history folder owns no `DirSource`, so the readdir diff — the
        // expensive half — never runs for an editing-history write.
        expect(dirSourceGetInstanceByDirPathMock).toHaveBeenCalledWith(
            '/data/docs/a.owa.histories',
        );
        expect(dirSourceGetAllInstancesMock).not.toHaveBeenCalled();
    });

    test('refreshes the dir source that OWNS the changed file', async () => {
        const dirSource = genDirSource({ appDocument: ['/data/docs/a.owa'] });
        dirSource.getFilePathsQuick.mockResolvedValue(['/data/docs/b.owa']);
        dirSourceGetInstanceByDirPathMock.mockReturnValue(dirSource);
        const { getWatchCallback } = await startWatching();

        getWatchCallback()?.('rename', 'docs/b.owa');
        await flushDebounce();

        // Keyed by the changed file's own directory — NOT by the watch root,
        // which is the data PARENT dir and owns no list of its own.
        expect(dirSourceGetInstanceByDirPathMock).toHaveBeenCalledWith(
            '/data/docs',
        );
        expect(dirSource.fireRefreshEvent).toHaveBeenCalledTimes(1);

        // An unchanged listing must not fire anything.
        dirSource.fireRefreshEvent.mockClear();
        dirSource.getFilePathsQuick.mockResolvedValue(['/data/docs/a.owa']);
        getWatchCallback()?.('rename', 'docs/b.owa');
        await flushDebounce();
        expect(dirSource.fireRefreshEvent).not.toHaveBeenCalled();
    });

    test('a DELETED file still refreshes its list', async () => {
        const dirSource = genDirSource({ appDocument: ['/data/docs/a.owa'] });
        dirSource.getFilePathsQuick.mockResolvedValue([]);
        dirSourceGetInstanceByDirPathMock.mockReturnValue(dirSource);
        const { getWatchCallback } = await startWatching();
        // The path is gone by the time the event is handled. Set AFTER the
        // watch is installed — `watchDir` checks the root dir with these too.
        fsCheckFileExistMock.mockResolvedValue(false);
        fsCheckDirExistMock.mockResolvedValue(false);

        getWatchCallback()?.('rename', 'docs/a.owa');
        await flushDebounce();

        expect(dirSource.fireRefreshEvent).toHaveBeenCalledTimes(1);
    });

    test('an unnamed change reconciles every mounted list', async () => {
        const first = genDirSource();
        const second = genDirSource();
        dirSourceGetAllInstancesMock.mockReturnValue([first, second]);
        const { getWatchCallback } = await startWatching();

        // `fs.watch` may report a change without naming it.
        getWatchCallback()?.('change', null);
        await flushDebounce();

        expect(first.fireRefreshEvent).toHaveBeenCalledTimes(1);
        expect(second.fireRefreshEvent).toHaveBeenCalledTimes(1);
    });

    test('refreshes an empty or failing dir source unconditionally', async () => {
        const dirSource = genDirSource();
        dirSourceGetInstanceByDirPathMock.mockReturnValue(dirSource);
        const { getWatchCallback } = await startWatching();

        getWatchCallback()?.('change', 'docs/a.owa');
        await flushDebounce();
        expect(dirSource.fireRefreshEvent).toHaveBeenCalledTimes(1);

        dirSource.fireRefreshEvent.mockClear();
        dirSource.filePathsMap = { appDocument: ['/data/docs/a.owa'] };
        dirSource.getFilePathsQuick.mockRejectedValue(new Error('read'));
        getWatchCallback()?.('change', 'docs/a.owa');
        await flushDebounce();
        expect(dirSource.fireRefreshEvent).toHaveBeenCalledTimes(1);
    });
});
