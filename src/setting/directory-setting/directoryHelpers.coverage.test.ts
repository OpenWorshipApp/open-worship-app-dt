import { beforeEach, describe, expect, test, vi } from 'vitest';

// Repair Links, the reset of the standard folders and the used-folder check:
// the parts of directoryHelpers its sibling test does not reach.

const h = vi.hoisted(() => ({
    // dirPath -> [name, 'file' | 'dir'][]
    tree: new Map<string, [string, 'file' | 'dir'][]>(),
    unreadableDirs: new Set<string>(),
    fileTexts: new Map<string, string>(),
    existingPaths: new Set<string>(),
    unreadablePaths: new Set<string>(),
    parentDir: '/data' as string | null,
    reloadMock: vi.fn(),
    setSettingMock: vi.fn(),
    handleErrorMock: vi.fn(),
    fsCheckFileExistMock: vi.fn(),
    fsCheckDirExistMock: vi.fn(),
    fsListDirectoriesMock: vi.fn(),
    fsWriteFileMock: vi.fn(),
    forgetCachedDataMock: vi.fn(),
    repairCalls: [] as { dataDirPath: string; childNames: string[] }[],
}));

vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: vi.fn(),
}));

vi.mock('../../server/appProvider', () => ({
    default: { reload: h.reloadMock },
}));

vi.mock('../../server/fileHelpers', () => ({
    checkIsHiddenName: (name: string) => name.startsWith('.'),
    ensureDirectory: vi.fn(),
    fsCheckDirExist: h.fsCheckDirExistMock,
    fsCheckFileExist: h.fsCheckFileExistMock,
    fsCreateDir: vi.fn(),
    fsExistSync: vi.fn(),
    fsGetFileSize: async () => 10,
    fsListDirectories: h.fsListDirectoriesMock,
    fsListDirents: async (dirPath: string) => {
        if (h.unreadableDirs.has(dirPath)) {
            throw new Error(`EACCES ${dirPath}`);
        }
        return (h.tree.get(dirPath) ?? []).map(([name, kind]) => {
            return {
                name,
                isFile: kind === 'file',
                isDirectory: kind === 'dir',
            };
        });
    },
    fsReadFile: async (filePath: string) => h.fileTexts.get(filePath) ?? '',
    fsWriteFile: h.fsWriteFileMock,
    getDefaultDataDirPath: () => '/home/open-worship-data',
    getFileDotExtension: (name: string) => name.slice(name.lastIndexOf('.')),
    pathJoin: (...parts: string[]) => parts.join('/'),
    pathResolve: (dirPath: string) => dirPath,
    // A stand-in for the real rewrite: every word starting `/old/` is a link
    // to an old place of the folder, moved over when nothing is there.
    repairDataDirLinksInText: async (
        text: string,
        dataDirPath: string,
        childNames: string[],
        checkIsThere: (filePath: string) => Promise<boolean>,
    ) => {
        h.repairCalls.push({ dataDirPath, childNames });
        let count = 0;
        const words: string[] = [];
        for (const word of text.split(' ')) {
            if (word.startsWith('/old/') && !(await checkIsThere(word))) {
                words.push(word.replace('/old', dataDirPath));
                count++;
            } else {
                words.push(word);
            }
        }
        return { count, text: words.join(' ') };
    },
    toPathCompareKey: (dirPath: string) => dirPath.toLowerCase(),
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
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
        BACKGROUND_VIDEO: 'videos',
    },
    dirSourceSettingNames: {
        APP_DOCUMENT: 'select-dir-app-document',
        BACKGROUND_VIDEO: 'select-dir-background-video',
    },
}));

vi.mock('../../helper/DirSource', () => ({ default: class {} }));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: h.handleErrorMock,
}));

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: vi.fn(),
    setSetting: h.setSettingMock,
}));

vi.mock('./appLocalStorage', () => ({
    LOCAL_STORAGE_FOLDER_NAME: 'local-storage',
    TMP_FILES_FOLDER_NAME: 'tmp-files',
    appLocalStorage: {
        getSelectedParentDirectory: async () => h.parentDir,
    },
}));

vi.mock('../../helper/FileSource', () => ({
    default: { forgetCachedData: h.forgetCachedDataMock },
}));

import {
    checkIsUsedDataDir,
    forEachDataDirTextFile,
    removePathForChildDir,
    repairDataDirLinks,
} from './directoryHelpers';

beforeEach(() => {
    h.tree.clear();
    h.unreadableDirs.clear();
    h.fileTexts.clear();
    h.existingPaths.clear();
    h.unreadablePaths.clear();
    h.repairCalls = [];
    h.parentDir = '/data';
    h.fsListDirectoriesMock.mockResolvedValue(['documents', 'videos']);
    h.fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
        if (h.unreadablePaths.has(filePath)) {
            throw new Error(`EPERM ${filePath}`);
        }
        return h.existingPaths.has(filePath);
    });
    h.fsCheckDirExistMock.mockResolvedValue(false);
    h.fsWriteFileMock.mockResolvedValue(undefined);
});

describe('removePathForChildDir', () => {
    test('clears every standard folder setting, then reloads', async () => {
        await removePathForChildDir();

        expect(h.setSettingMock.mock.calls).toEqual([
            ['select-dir-app-document', ''],
            ['select-dir-background-video', ''],
        ]);
        expect(h.reloadMock).toHaveBeenCalledOnce();
    });
});

describe('checkIsUsedDataDir', () => {
    test('a folder is a used data folder when it holds its settings folder', async () => {
        h.fsCheckDirExistMock.mockResolvedValueOnce(true);

        await expect(checkIsUsedDataDir('/stick/data')).resolves.toBe(true);

        expect(h.fsCheckDirExistMock).toHaveBeenCalledWith(
            '/stick/data/local-storage',
        );
    });
});

describe('forEachDataDirTextFile', () => {
    test('an unreadable folder is reported and skipped, not the end of the walk', async () => {
        h.tree.set('/data', [
            ['locked', 'dir'],
            ['documents', 'dir'],
        ]);
        h.tree.set('/data/documents', [['song.ows', 'file']]);
        h.unreadableDirs.add('/data/locked');
        const seen: string[] = [];

        await forEachDataDirTextFile('/data', async (filePath) => {
            seen.push(filePath);
        });

        expect(seen).toEqual(['/data/documents/song.ows']);
        expect(h.handleErrorMock).toHaveBeenCalledWith(
            new Error('EACCES /data/locked'),
        );
    });
});

describe('repairDataDirLinks', () => {
    test('does nothing without a data folder', async () => {
        h.parentDir = null;

        await expect(repairDataDirLinks()).resolves.toBeNull();

        expect(h.fsListDirectoriesMock).not.toHaveBeenCalled();
        expect(h.fsWriteFileMock).not.toHaveBeenCalled();
    });

    test('rewrites only the files holding links to nothing, and counts them', async () => {
        h.tree.set('/data', [
            ['documents', 'dir'],
            ['local-storage', 'dir'],
        ]);
        h.tree.set('/data/documents', [
            ['a.ows', 'file'],
            ['b.ows', 'file'],
            ['c.ows', 'file'],
        ]);
        h.tree.set('/data/local-storage', [['select-dir-x', 'file']]);
        h.fileTexts.set(
            '/data/documents/a.ows',
            'bg /old/videos/a.mp4 and /old/videos/b.mp4',
        );
        // Still points at something: left alone.
        h.fileTexts.set('/data/documents/b.ows', 'bg /old/kept.png');
        h.existingPaths.add('/old/kept.png');
        h.fileTexts.set('/data/documents/c.ows', 'no links here');
        h.fileTexts.set(
            '/data/local-storage/select-dir-x',
            '/old/videos/a.mp4',
        );

        const result = await repairDataDirLinks();

        expect(result).toEqual({ linkCount: 3, fileCount: 2 });
        expect(h.fsWriteFileMock.mock.calls.sort()).toEqual([
            [
                '/data/documents/a.ows',
                'bg /data/videos/a.mp4 and /data/videos/b.mp4',
            ],
            ['/data/local-storage/select-dir-x', '/data/videos/a.mp4'],
        ]);
        expect(h.forgetCachedDataMock.mock.calls.sort()).toEqual([
            ['/data/documents/a.ows'],
            ['/data/local-storage/select-dir-x'],
        ]);
        // Every file is handed the folder and the names in it.
        expect(h.repairCalls).toHaveLength(4);
        expect(h.repairCalls[0]).toEqual({
            dataDirPath: '/data',
            childNames: ['documents', 'videos'],
        });
        // A path is looked up once, however many files link to it.
        const lookedUp = h.fsCheckFileExistMock.mock.calls.map(([filePath]) => {
            return filePath;
        });
        expect(
            lookedUp.filter((filePath) => filePath === '/old/videos/a.mp4'),
        ).toHaveLength(1);
    });

    test('a folder found as a folder, or one that cannot be read, is not moved', async () => {
        h.tree.set('/data', [['notes.own', 'file']]);
        h.fileTexts.set('/data/notes.own', '/old/photos /old/secret');
        h.fsCheckDirExistMock.mockImplementation(async (filePath: string) => {
            return filePath === '/old/photos';
        });
        h.unreadablePaths.add('/old/secret');

        const result = await repairDataDirLinks();

        expect(result).toEqual({ linkCount: 0, fileCount: 0 });
        expect(h.fsWriteFileMock).not.toHaveBeenCalled();
        expect(h.forgetCachedDataMock).not.toHaveBeenCalled();
    });
});
