import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    appProviderMock,
    dirSourceCheckIsSameDirPathMock,
    dirSourceGetDirPathBySettingNameMock,
    ensureDirectoryMock,
    fileSourceGetInstanceMock,
    fsCheckDirExistMock,
    fsCreateDirMock,
    fsExistSyncMock,
    getDefaultDataDirPathMock,
    getSelectedParentDirectoryMock,
    getSettingMock,
    handleErrorMock,
    pathJoinMock,
    setSettingMock,
    showAppConfirmMock,
    showSimpleToastMock,
    tree,
} = vi.hoisted(() => ({
    // dirPath -> [name, size | 'dir'][]
    tree: new Map<string, [string, number | 'dir'][]>(),
    appProviderMock: {
        pathUtils: {
            join: vi.fn((...parts: string[]) => parts.join('/')),
        },
        reload: vi.fn(),
    },
    dirSourceCheckIsSameDirPathMock: vi.fn(),
    dirSourceGetDirPathBySettingNameMock: vi.fn(),
    ensureDirectoryMock: vi.fn(),
    fileSourceGetInstanceMock: vi.fn(),
    fsCheckDirExistMock: vi.fn(),
    fsCreateDirMock: vi.fn(),
    fsExistSyncMock: vi.fn(),
    getDefaultDataDirPathMock: vi.fn(() => '/home/.owa/open-worship-data'),
    getSelectedParentDirectoryMock: vi.fn(),
    getSettingMock: vi.fn(),
    handleErrorMock: vi.fn(),
    pathJoinMock: vi.fn((...parts: string[]) => parts.join('/')),
    setSettingMock: vi.fn(),
    showAppConfirmMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
}));

vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: showAppConfirmMock,
}));

vi.mock('../../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('../../server/fileHelpers', () => ({
    ensureDirectory: ensureDirectoryMock,
    fsCheckDirExist: fsCheckDirExistMock,
    fsCreateDir: fsCreateDirMock,
    fsExistSync: fsExistSyncMock,
    getDefaultDataDirPath: getDefaultDataDirPathMock,
    pathJoin: pathJoinMock,
    pathResolve: (dirPath: string) => dirPath,
    toPathCompareKey: (dirPath: string) => dirPath.toLowerCase(),
    checkIsHiddenName: (name: string) => name.startsWith('.'),
    getFileDotExtension: (name: string) => name.slice(name.lastIndexOf('.')),
    fsListDirents: async (dirPath: string) => {
        return (tree.get(dirPath) ?? []).map(([name, size]) => {
            return {
                name,
                isFile: size !== 'dir',
                isDirectory: size === 'dir',
            };
        });
    },
    fsGetFileSize: async (filePath: string) => {
        const slashIndex = filePath.lastIndexOf('/');
        const entry = tree
            .get(filePath.slice(0, slashIndex))
            ?.find(([name]) => name === filePath.slice(slashIndex + 1));
        return entry?.[1];
    },
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (value: string) => `translated:${value}`,
}));

vi.mock('../../helper/constants', () => ({
    appManagedDataDirNames: {
        EXTRA_BIN: 'extra-bin',
        BIBLE_DATA: 'bibles-data',
        LOOKUP_DATA: 'lookup-data',
        AGENT_BACKUP: 'agent-backups',
    },
    defaultDataDirNames: {
        APP_DOCUMENT: 'documents',
        LYRIC: 'lyrics',
    },
    dirSourceSettingNames: {
        APP_DOCUMENT: 'dir-app-document',
        LYRIC: 'dir-lyric',
    },
}));

vi.mock('../../helper/DirSource', () => ({
    default: class MockDirSource {
        public static readonly getDirPathBySettingName =
            dirSourceGetDirPathBySettingNameMock;
        public static readonly checkIsSameDirPath =
            dirSourceCheckIsSameDirPathMock;
    },
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
}));

vi.mock('./appLocalStorage', () => ({
    LOCAL_STORAGE_FOLDER_NAME: 'local-storage',
    TMP_FILES_FOLDER_NAME: 'tmp-files',
    appLocalStorage: {
        getSelectedParentDirectory: getSelectedParentDirectoryMock,
    },
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstanceMock,
    },
}));

import {
    BaseDirFileSource,
    checkShouldSelectChildDir,
    ensureDataDirectory,
    forEachDataDirTextFile,
    getDefaultDataDir,
    selectDefaultDataDirName,
    selectPathForChildDir,
    selectPathForChildDirIfNeeded,
} from './directoryHelpers';

describe('directoryHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        showAppConfirmMock.mockResolvedValue(true);
        fsCreateDirMock.mockResolvedValue(undefined);
        fsCheckDirExistMock.mockResolvedValue(true);
        getSelectedParentDirectoryMock.mockResolvedValue('/parent');
        dirSourceGetDirPathBySettingNameMock.mockReturnValue('/base-dir');
        dirSourceCheckIsSameDirPathMock.mockReturnValue(true);
    });

    test('walks the text files of the app and nothing it rebuilds by itself', async () => {
        tree.clear();
        tree.set('/data', [
            ['.owa-data-folder.json', 10],
            ['notes.txt', 10],
            ['big.json', 6 * 1024 * 1024],
            ['local-storage', 'dir'],
            ['documents', 'dir'],
            ['extra-bin', 'dir'],
            ['.hidden', 'dir'],
        ]);
        tree.set('/data/local-storage', [['select-dir-app-document', 10]]);
        tree.set('/data/documents', [
            ['song.ows', 10],
            ['picture.png', 10],
            ['song.ows.histories', 'dir'],
            ['extra-bin', 'dir'],
        ]);
        tree.set('/data/documents/song.ows.histories', [['1', 10]]);
        tree.set('/data/documents/extra-bin', [['kept.json', 10]]);
        tree.set('/data/extra-bin', [['skipped.json', 10]]);
        tree.set('/data/.hidden', [['skipped.json', 10]]);
        const seen: string[] = [];
        await forEachDataDirTextFile('/data', async (filePath) => {
            seen.push(filePath);
            if (filePath.endsWith('song.ows')) {
                throw new Error('unreadable');
            }
        });
        expect(seen.sort()).toEqual([
            '/data/documents/extra-bin/kept.json',
            '/data/documents/song.ows',
            '/data/documents/song.ows.histories/1',
            '/data/local-storage/select-dir-app-document',
        ]);
        // One failing file is reported, not the end of the walk.
        expect(handleErrorMock).toHaveBeenCalledOnce();
    });

    test('builds the default data directory path off the Desktop', () => {
        expect(getDefaultDataDir()).toBe('/home/.owa/open-worship-data');
        expect(getDefaultDataDirPathMock).toHaveBeenCalledOnce();
    });

    test('returns early when selecting child directories is cancelled', async () => {
        showAppConfirmMock.mockResolvedValueOnce(false);

        await selectPathForChildDir('/parent');

        expect(fsCreateDirMock).not.toHaveBeenCalled();
        expect(appProviderMock.reload).not.toHaveBeenCalled();
    });

    test('creates child directories, persists valid ones, and warns about invalid ones', async () => {
        fsCheckDirExistMock
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);

        await selectPathForChildDir('/parent');

        expect(fsCreateDirMock).toHaveBeenCalledWith('/parent/documents');
        expect(fsCreateDirMock).toHaveBeenCalledWith('/parent/lyrics');
        expect(setSettingMock).toHaveBeenCalledWith(
            'dir-app-document',
            '/parent/documents',
        );
        expect(setSettingMock).not.toHaveBeenCalledWith(
            'dir-lyric',
            '/parent/lyrics',
        );
        expect(showAppConfirmMock).toHaveBeenLastCalledWith(
            'translated:Creating Default Folder',
            'translated:Fail to create folder "/parent/lyrics"',
        );
        expect(appProviderMock.reload).toHaveBeenCalledTimes(1);
    });

    test('toasts on existing-directory create failures without reporting them as errors', async () => {
        showAppConfirmMock.mockResolvedValueOnce(true);
        fsCreateDirMock.mockRejectedValueOnce(new Error('file already exists'));

        await selectPathForChildDir('/parent');

        expect(handleErrorMock).not.toHaveBeenCalled();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'translated:Creating Default Folder',
            'translated:Fail to create folder "/parent"',
        );
    });

    test('reports unexpected child-directory creation failures', async () => {
        const error = new Error('boom');
        showAppConfirmMock.mockResolvedValueOnce(true);
        fsCreateDirMock.mockRejectedValueOnce(error);

        await selectPathForChildDir('/parent');

        expect(handleErrorMock).toHaveBeenCalledWith(error);
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'translated:Creating Default Folder',
            'translated:Fail to create folder "/parent"',
        );
    });

    test('asks about the standard folders once per data folder, whatever the answer', async () => {
        // None of the child folders is there.
        fsCheckDirExistMock.mockResolvedValue(false);
        showAppConfirmMock.mockResolvedValue(false);
        // Choosing the folder asks; the page that renders on it next, and
        // React's second mount in development, must not ask again.
        await selectPathForChildDir('/Fresh-A');
        await selectPathForChildDirIfNeeded('/fresh-a');
        await Promise.all([
            selectPathForChildDirIfNeeded('/fresh-b'),
            selectPathForChildDirIfNeeded('/fresh-b'),
        ]);
        expect(showAppConfirmMock).toHaveBeenCalledTimes(2);
        expect(showAppConfirmMock.mock.calls[0][1]).toContain('/Fresh-A');
        expect(showAppConfirmMock.mock.calls[1][1]).toContain('/fresh-b');
        // A folder that already has its child folders is not asked about.
        fsCheckDirExistMock.mockResolvedValue(true);
        await selectPathForChildDirIfNeeded('/fresh-c');
        expect(showAppConfirmMock).toHaveBeenCalledTimes(2);
    });

    test('checks whether any child directory has already been selected', async () => {
        getSettingMock
            .mockReturnValueOnce('/docs')
            .mockReturnValueOnce('/lyrics')
            .mockReturnValueOnce('/docs')
            .mockReturnValueOnce('/lyrics')
            .mockReturnValueOnce(undefined)
            .mockReturnValueOnce('/lyrics');
        fsCheckDirExistMock
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(false);

        await expect(checkShouldSelectChildDir()).resolves.toBe(true);
        await expect(checkShouldSelectChildDir()).resolves.toBe(false);
        await expect(checkShouldSelectChildDir()).resolves.toBe(true);
        expect(fsCheckDirExistMock).toHaveBeenCalledWith('none');
    });

    test('warns when no parent directory is available for default folder selection', async () => {
        getSelectedParentDirectoryMock.mockResolvedValueOnce(null);

        await selectDefaultDataDirName({ dirPath: '' } as any, 'documents');

        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'translated:No Parent Directory Selected',
            'translated:There is no parent directory selected',
        );
    });

    test('returns early when the default folder selection is cancelled', async () => {
        showAppConfirmMock.mockResolvedValueOnce(false);
        const dirSource = { dirPath: '' };

        await selectDefaultDataDirName(dirSource as any, 'documents');

        expect(fsCreateDirMock).not.toHaveBeenCalled();
        expect(dirSource.dirPath).toBe('');
    });

    test('creates and assigns the selected default data directory', async () => {
        const dirSource = { dirPath: '' };

        await selectDefaultDataDirName(dirSource as any, 'documents');

        expect(fsCreateDirMock).toHaveBeenCalledWith('/parent/documents');
        expect(dirSource.dirPath).toBe('/parent/documents');
    });

    test('handles default-directory creation failures with and without duplicate-folder errors', async () => {
        const duplicateError = new Error('file already exists');
        const dirSource = { dirPath: '' };
        fsCreateDirMock.mockRejectedValueOnce(duplicateError);

        await selectDefaultDataDirName(dirSource as any, 'documents');

        expect(handleErrorMock).not.toHaveBeenCalled();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'translated:Creating Default Folder',
            'translated:Fail to create folder "/parent/documents"',
        );

        const error = new Error('mkdir failed');
        fsCreateDirMock.mockRejectedValueOnce(error);

        await selectDefaultDataDirName(dirSource as any, 'lyrics');

        expect(handleErrorMock).toHaveBeenCalledWith(error);
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'translated:Creating Default Folder',
            'translated:Fail to create folder "/parent/lyrics"',
        );
    });

    test('tracks base-directory files by either full path or file name', () => {
        fsExistSyncMock
            .mockReturnValueOnce(true)
            .mockReturnValueOnce(true)
            .mockReturnValueOnce(false);
        fileSourceGetInstanceMock
            .mockReturnValueOnce({
                baseDirPath: '/base-dir',
                fullName: 'song.txt',
                filePath: '/base-dir/song.txt',
            })
            .mockReturnValueOnce({
                baseDirPath: '/other-dir',
                fullName: 'song.txt',
                filePath: '/other-dir/song.txt',
            })
            .mockReturnValueOnce({
                filePath: '/base-dir/lyric.txt',
                fullName: 'lyric.txt',
            });

        const sameDir = new BaseDirFileSource(
            'dir-app-document',
            '/base-dir/song.txt',
        );
        expect(sameDir.fileFullNameOrFilePath).toBe('song.txt');
        expect(sameDir.fileSource).toEqual(
            expect.objectContaining({ filePath: '/base-dir/song.txt' }),
        );

        dirSourceCheckIsSameDirPathMock.mockReturnValueOnce(false);
        const otherDir = new BaseDirFileSource(
            'dir-app-document',
            '/other-dir/song.txt',
        );
        expect(otherDir.fileFullNameOrFilePath).toBe('/other-dir/song.txt');

        const byName = new BaseDirFileSource('dir-app-document', 'lyric.txt');
        expect(byName.fileFullNameOrFilePath).toBe('lyric.txt');
        expect(byName.fileSource).toEqual(
            expect.objectContaining({ filePath: '/base-dir/lyric.txt' }),
        );

        dirSourceGetDirPathBySettingNameMock.mockReturnValueOnce(null);
        const withoutBase = new BaseDirFileSource(
            'dir-app-document',
            'orphan.txt',
        );
        expect(withoutBase.fileSource).toBeNull();
    });

    test('ensures data directories when a parent directory is available', async () => {
        getSelectedParentDirectoryMock
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce('/parent');

        await expect(ensureDataDirectory('documents')).resolves.toBeNull();
        await expect(ensureDataDirectory('documents')).resolves.toBe(
            '/parent/documents',
        );
        expect(ensureDirectoryMock).toHaveBeenCalledWith('/parent/documents');
    });
});
