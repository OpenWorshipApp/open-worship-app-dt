import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    settingStore,
    getSettingMock,
    setSettingMock,
    fsListFilesMock,
    fsCheckDirExistMock,
    fsCheckFileExistMock,
    getFileMetaDataMock,
    getAppMimetypeMock,
    fileSourceGetInstanceMock,
    unlockingMock,
    showSimpleToastMock,
    handleErrorMock,
    tranMock,
} = vi.hoisted(() => {
    return {
        settingStore: new Map<string, string>(),
        getSettingMock: vi.fn(),
        setSettingMock: vi.fn(),
        fsListFilesMock: vi.fn(),
        fsCheckDirExistMock: vi.fn(),
        fsCheckFileExistMock: vi.fn(),
        getFileMetaDataMock: vi.fn(),
        getAppMimetypeMock: vi.fn(),
        fileSourceGetInstanceMock: vi.fn(),
        unlockingMock: vi.fn(),
        showSimpleToastMock: vi.fn(),
        handleErrorMock: vi.fn(),
        tranMock: vi.fn(),
    };
});

function normalizePath(...parts: string[]) {
    let normalizedPath = parts
        .filter((part) => {
            return !!part;
        })
        .join('/')
        .replaceAll('\\', '/');
    while (normalizedPath.includes('//')) {
        normalizedPath = normalizedPath.replaceAll('//', '/');
    }
    if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
        normalizedPath = normalizedPath.slice(0, -1);
    }
    return normalizedPath;
}

vi.mock('./settingHelpers', () => ({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
}));

vi.mock('../server/fileHelpers', () => ({
    getFileMetaData: getFileMetaDataMock,
    getAppMimetype: getAppMimetypeMock,
    fsListFiles: fsListFilesMock,
    fsCheckDirExist: fsCheckDirExistMock,
    fsCheckFileExist: fsCheckFileExistMock,
    pathResolve: (...paths: string[]) => normalizePath(...paths),
    pathJoin: (...paths: string[]) => normalizePath(...paths),
}));

vi.mock('../server/unlockingHelpers', () => ({
    unlocking: unlockingMock,
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('./errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: tranMock,
}));

vi.mock('./FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstanceMock,
    },
}));

import DirSource from './DirSource';

let settingNameCounter = 0;

// The module keeps a process-wide instance cache keyed by
// `<settingName>-<dirPath>`; a fresh setting name per test keeps the cases
// isolated without exporting test-only reset hooks.
function genSettingName() {
    settingNameCounter += 1;
    return `dir-source-setting-${settingNameCounter}`;
}

describe('DirSource', () => {
    beforeEach(() => {
        settingStore.clear();
        vi.clearAllMocks();
        getSettingMock.mockImplementation((key: string) => {
            return settingStore.get(key) ?? null;
        });
        setSettingMock.mockImplementation((key: string, value: string) => {
            settingStore.set(key, value);
        });
        fsCheckDirExistMock.mockResolvedValue(true);
        fsCheckFileExistMock.mockResolvedValue(false);
        fsListFilesMock.mockResolvedValue([]);
        getAppMimetypeMock.mockReturnValue([]);
        getFileMetaDataMock.mockReturnValue(null);
        tranMock.mockImplementation((text: string) => {
            return `tran:${text}`;
        });
        unlockingMock.mockImplementation(
            async (_key: string, callback: () => unknown) => {
                return await callback();
            },
        );
        fileSourceGetInstanceMock.mockImplementation(
            (dirPath: string, fileFullName: string) => {
                return {
                    filePath: normalizePath(dirPath, fileFullName),
                    fireUpdateEvent: vi.fn(),
                };
            },
        );
    });

    test('rejects an empty setting name', () => {
        expect(() => {
            return new DirSource('');
        }).toThrow('Invalid setting name');
    });

    test('resolves the dir path from the setting store', () => {
        const settingName = genSettingName();
        const dirSource = new DirSource(settingName);

        expect(dirSource.dirPath).toBe('');
        expect(DirSource.getDirPathBySettingName(settingName)).toBeNull();

        settingStore.set(settingName, '/docs//');
        expect(DirSource.getDirPathBySettingName(settingName)).toBe('/docs');
        expect(dirSource.dirPath).toBe('/docs');
    });

    test('writes the dir path through the setter and fires a reload', async () => {
        const settingName = genSettingName();
        const dirSource = new DirSource(settingName);
        const reloaded: unknown[] = [];
        dirSource.registerEventListener(['reload'], () => {
            reloaded.push('reload');
        });

        // the default `setDirPath` is a no-op that must not throw
        dirSource.dirPath = '/docs';
        await Promise.resolve();

        expect(setSettingMock).toHaveBeenCalledWith(settingName, '/docs');
        expect(dirSource.dirPath).toBe('/docs');
        expect(reloaded).toEqual(['reload']);

        const setDirPathSpy = vi.fn();
        dirSource.setDirPath = setDirPathSpy;
        dirSource.dirPath = '/other';
        expect(setDirPathSpy).toHaveBeenCalledWith('/other');
    });

    test('builds a cache key from the setting name and its value', () => {
        const settingName = genSettingName();
        expect(DirSource.toCacheKey(settingName)).toBe(`${settingName}-`);

        settingStore.set(settingName, '/docs');
        expect(DirSource.toCacheKey(settingName)).toBe(`${settingName}-/docs`);
    });

    test('init skips validation without a dir path', async () => {
        const settingName = genSettingName();
        const dirSource = new DirSource(settingName);

        await dirSource.init();

        expect(fsCheckDirExistMock).not.toHaveBeenCalled();
        expect(dirSource.isDirPathValid).toBe('');
    });

    test('init records whether the dir path exists', async () => {
        const settingName = genSettingName();
        settingStore.set(settingName, '/docs');
        const dirSource = new DirSource(settingName);

        await dirSource.init();
        expect(dirSource.isDirPathValid).toBe(true);

        fsCheckDirExistMock.mockResolvedValue(false);
        await dirSource.init();
        expect(dirSource.isDirPathValid).toBe(false);
    });

    test('creates file sources relative to the dir path', () => {
        const settingName = genSettingName();
        settingStore.set(settingName, '/docs');
        const dirSource = new DirSource(settingName);

        const fileSource = dirSource.getFileSourceInstance('a.owa');

        expect(fileSourceGetInstanceMock).toHaveBeenCalledWith(
            '/docs',
            'a.owa',
        );
        expect(fileSource.filePath).toBe('/docs/a.owa');
    });

    test('clears the cached file paths when refreshing', async () => {
        const settingName = genSettingName();
        settingStore.set(settingName, '/docs');
        const dirSource = new DirSource(settingName);
        dirSource.filePathsMap = { appDocument: ['/docs/a.owa'] };
        const events: string[] = [];
        dirSource.registerEventListener(['refresh'], () => {
            events.push('refresh');
        });

        dirSource.fireRefreshEvent();
        await Promise.resolve();

        expect(dirSource.filePathsMap).toEqual({});
        expect(events).toEqual(['refresh']);
    });

    test('fires a file update event only when a dir path is set', () => {
        const settingName = genSettingName();
        const dirSource = new DirSource(settingName);

        dirSource.fireReloadFileEvent('a.owa');
        expect(fileSourceGetInstanceMock).not.toHaveBeenCalled();

        settingStore.set(settingName, '/docs');
        const fireUpdateEvent = vi.fn();
        fileSourceGetInstanceMock.mockReturnValue({ fireUpdateEvent });

        dirSource.fireReloadFileEvent('a.owa');
        expect(fireUpdateEvent).toHaveBeenCalledTimes(1);
    });

    test('generates a random file path that does not collide', async () => {
        const settingName = genSettingName();
        const dirSource = new DirSource(settingName);

        expect(await dirSource.genRandomFilePath('.owa')).toBeNull();

        settingStore.set(settingName, '/docs');
        fsCheckFileExistMock
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);

        const filePath = await dirSource.genRandomFilePath('.owa');

        expect(fsCheckFileExistMock).toHaveBeenCalledTimes(2);
        expect(filePath).toMatch(/^\/docs\/file-\d+\.owa$/);
    });

    test('compares dir paths after resolving them', () => {
        const settingName = genSettingName();
        const dirSource = new DirSource(settingName);

        expect(DirSource.checkIsSameDirPath('/docs/', '/docs')).toBe(true);
        expect(DirSource.checkIsSameDirPath('/docs', '/docs-2')).toBe(false);

        // without a dir path nothing can match
        expect(dirSource.checkIsSameDirPath('/docs')).toBe(false);

        settingStore.set(settingName, '/docs');
        expect(dirSource.checkIsSameDirPath('/docs//')).toBe(true);
        expect(dirSource.checkIsSameDirPath('/docs-2')).toBe(false);
    });

    test('lists every file full name in the directory', async () => {
        const settingName = genSettingName();
        settingStore.set(settingName, '/docs');
        const dirSource = new DirSource(settingName);
        fsListFilesMock.mockResolvedValue(['a.owa', 'b.owa']);

        expect(await dirSource.getAllFileFullNames()).toEqual([
            'a.owa',
            'b.owa',
        ]);
        expect(fsListFilesMock).toHaveBeenCalledWith('/docs');
    });

    test('getFilePathsQuick skips hidden files and honors checkExtraFile', async () => {
        const settingName = genSettingName();
        settingStore.set(settingName, '/docs');
        const dirSource = new DirSource(settingName);
        fsListFilesMock.mockResolvedValue([
            '._a.owa',
            'a.owa',
            'note.txt',
            'skip.bin',
        ]);
        getFileMetaDataMock.mockImplementation((fileFullName: string) => {
            if (fileFullName === 'a.owa') {
                return { fileFullName, appMimetype: {} };
            }
            return null;
        });

        // without `checkExtraFile` only the known mimetype survives
        expect(await dirSource.getFilePathsQuick('appDocument')).toEqual([
            '/docs/a.owa',
        ]);

        dirSource.checkExtraFile = (fileFullName: string) => {
            if (fileFullName === 'note.txt') {
                return { fileFullName, appMimetype: {} as any };
            }
            return null;
        };
        expect(await dirSource.getFilePathsQuick('appDocument')).toEqual([
            '/docs/a.owa',
            '/docs/note.txt',
        ]);

        // the extra-file hook can be bypassed
        expect(await dirSource.getFilePathsQuick('appDocument', true)).toEqual([
            '/docs/a.owa',
        ]);
    });

    test('getFilePaths returns nothing for a missing directory', async () => {
        const settingName = genSettingName();
        const dirSource = new DirSource(settingName);

        expect(await dirSource.getFilePaths('appDocument')).toEqual([]);

        settingStore.set(settingName, '/docs');
        fsCheckDirExistMock.mockResolvedValue(false);
        expect(await dirSource.getFilePaths('appDocument')).toEqual([]);
    });

    test('getFilePaths caches results until forced', async () => {
        const settingName = genSettingName();
        settingStore.set(settingName, '/docs');
        const dirSource = new DirSource(settingName);
        fsListFilesMock.mockResolvedValue(['a.owa']);
        getFileMetaDataMock.mockImplementation((fileFullName: string) => {
            return { fileFullName, appMimetype: {} };
        });

        expect(await dirSource.getFilePaths('appDocument')).toEqual([
            '/docs/a.owa',
        ]);
        expect(fsListFilesMock).toHaveBeenCalledTimes(1);
        expect(unlockingMock).toHaveBeenCalledWith(
            'get-file-paths-appDocument-/docs',
            expect.any(Function),
        );

        // second call is served from `filePathsMap`
        expect(await dirSource.getFilePaths('appDocument')).toEqual([
            '/docs/a.owa',
        ]);
        expect(fsListFilesMock).toHaveBeenCalledTimes(1);

        fsListFilesMock.mockResolvedValue(['a.owa', 'b.owa']);
        expect(await dirSource.getFilePaths('appDocument', true)).toEqual([
            '/docs/a.owa',
            '/docs/b.owa',
        ]);
        expect(fsListFilesMock).toHaveBeenCalledTimes(2);
    });

    test('getFilePaths reports listing errors and returns null', async () => {
        const settingName = genSettingName();
        settingStore.set(settingName, '/docs');
        const dirSource = new DirSource(settingName);
        const error = new Error('listing failed');
        fsListFilesMock.mockRejectedValue(error);

        expect(await dirSource.getFilePaths('appDocument')).toBeNull();

        expect(handleErrorMock).toHaveBeenCalledWith(error);
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'tran:Getting File List',
            'tran:Error occurred during listing file',
        );
    });

    test('getFilePaths keeps the previous list when a refresh fails', async () => {
        const settingName = genSettingName();
        settingStore.set(settingName, '/docs');
        const dirSource = new DirSource(settingName);
        dirSource.filePathsMap = { appDocument: ['/docs/a.owa'] };
        fsListFilesMock.mockRejectedValue(new Error('listing failed'));

        expect(await dirSource.getFilePaths('appDocument', true)).toEqual([
            '/docs/a.owa',
        ]);
    });

    test('getInstance caches one instance per setting name and value', async () => {
        const settingName = genSettingName();
        settingStore.set(settingName, '/docs');

        const [first, second] = await Promise.all([
            DirSource.getInstance(settingName),
            DirSource.getInstance(settingName),
        ]);

        // both concurrent callers share the instance whose listeners are live
        expect(first).toBe(second);
        expect(first.dirPath).toBe('/docs');

        const third = await DirSource.getInstance(settingName);
        expect(third).toBe(first);

        // a different dir path is a different cache key
        settingStore.set(settingName, '/docs-2');
        const fourth = await DirSource.getInstance(settingName);
        expect(fourth).not.toBe(first);
    });

    test('getInstanceByDirPath matches on the resolved path', async () => {
        const settingName = genSettingName();
        settingStore.set(settingName, '/docs/nested');
        const dirSource = await DirSource.getInstance(settingName);

        expect(DirSource.getInstanceByDirPath('/docs/nested/')).toBe(dirSource);
        // a substring of another dir path must not match
        expect(DirSource.getInstanceByDirPath('/docs/nes')).toBeNull();
    });
});
