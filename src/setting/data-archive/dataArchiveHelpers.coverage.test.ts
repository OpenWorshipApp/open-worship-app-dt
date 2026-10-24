import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        paths: { documents: '/data/documents', bibles: '/data/bibles' },
        existing: new Set<string>(),
        entries: new Map<
            string,
            { name: string; isFile: boolean; isDirectory: boolean }[]
        >(),
        manifest: null as unknown,
        size: 100,
    },
    mocks: {
        tarExtract: vi.fn(),
        clone: vi.fn(),
        cleanup: vi.fn(),
        afterImport: vi.fn(),
        findExisting: vi.fn(),
        nextPath: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../helper/appArchiveHelpers', () => ({
    ARCHIVE_VERSION: 1,
    BIBLE_XML_ARCHIVE_ITEM_KIND: 'bible-xml',
    MANIFEST_FILE_NAME: 'manifest.json',
    createWorkDir: async () => '/tmp/extract',
    findExistingLocalFile: mocks.findExisting,
    genNextArchiveFilePath: async (_dir: string, name: string) =>
        `/downloads/${name}`,
    getImportCollisionPolicy: () => 'rename',
    readArchiveManifest: async () => state.manifest,
    safeDeleteDir: mocks.cleanup,
    toArchiveDotExtension: (extension: string) => extension,
    toArchiveFileName: (name: string, extension: string) =>
        `${name}${extension}`,
    toExtractedArchivePath: (root: string, entry: string) => {
        if (!entry || entry.includes('..') || entry.includes('\\'))
            throw new Error('Invalid archive file path');
        return `${root}/${entry}`.replace(/\/+/g, '/');
    },
    writeArchiveManifest: async () => {},
}));
vi.mock('../../helper/archivePasswordHelpers', () => ({
    protectArchiveFile: async () => '/downloads/protected.owadata.enc',
}));
vi.mock('../../helper/DirSource', () => ({
    default: { getDirPathBySettingName: async () => state.paths.documents },
}));
vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: (path: string) => ({
            genNextFilePath: async () => mocks.nextPath(path),
        }),
    },
}));
vi.mock('../../editing-manager/EditingHistoryManager', () => ({
    default: { getInstance: () => ({ getCurrentHistory: async () => null }) },
    sanitizeForUpdatingComparison: (value: unknown) => value,
}));
vi.mock('../../helper/errorHelpers', () => ({ handleError: mocks.error }));
vi.mock('../../server/appHelpers', () => ({
    showFileOrDirExplorer: vi.fn(),
    tarAppend: vi.fn(),
    tarCreate: vi.fn(),
    tarExtract: mocks.tarExtract,
}));
vi.mock('../../server/fileHelpers', () => ({
    checkIsHiddenName: (name: string) => name.startsWith('.'),
    ensureDirectory: async () => true,
    fsCheckDirExist: async (path: string) => state.existing.has(path),
    fsCloneFile: mocks.clone,
    fsCreateFile: vi.fn(),
    fsDeleteFile: vi.fn(),
    fsGetFileSize: async () => state.size,
    fsList: async (path: string) => state.entries.get(path) ?? [],
    getDownloadPath: () => '/downloads',
    pathJoin: (...parts: string[]) => parts.join('/').replace(/\/+/g, '/'),
    pathSeparator: '/',
    splitPathRoot: (path: string) => ({
        root: '/',
        segments: path.split('/').filter(Boolean),
    }),
    toPathCompareKey: (path: string) => path,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../directory-setting/dataDirectories', () => {
    const documents = {
        settingName: 'documents-dir',
        title: 'Documents',
        getDirPath: async () => state.paths.documents,
        afterImport: mocks.afterImport,
    };
    const bibles = {
        settingName: 'bible-dir',
        title: 'Bible Data',
        fileNamePattern: /\.xml$/i,
        getDirPath: async () => state.paths.bibles,
    };
    const dataDirectories = [documents, bibles];
    return {
        dataDirectories,
        getDataDirectoryBySettingName: (name: string) =>
            dataDirectories.find((one) => one.settingName === name) ?? null,
    };
});

import {
    getDataDirectoryPath,
    getExportableDataFolders,
    importDataArchive,
    readDataArchiveManifest,
    reportDataArchiveError,
} from './dataArchiveHelpers';

const docs = { settingName: 'documents-dir', entry: 'documents' };
const bibles = { settingName: 'bible-dir', entry: 'bibles' };

function file(name: string) {
    return { name, isFile: true, isDirectory: false };
}

function dir(name: string) {
    return { name, isFile: false, isDirectory: true };
}

beforeEach(() => {
    state.paths = { documents: '/data/documents', bibles: '/data/bibles' };
    state.existing.clear();
    state.entries.clear();
    state.manifest = null;
    state.size = 100;
    mocks.tarExtract.mockResolvedValue(undefined);
    mocks.clone.mockResolvedValue(true);
    mocks.cleanup.mockResolvedValue(undefined);
    mocks.afterImport.mockResolvedValue(undefined);
    mocks.findExisting.mockResolvedValue(null);
    mocks.nextPath.mockImplementation(async (path: string) => path);
});

describe('whole-data archive directory selection', () => {
    test('uses a directory-owned path or the selected path setting', async () => {
        expect(
            await getDataDirectoryPath({
                getDirPath: async () => '/own',
            } as any),
        ).toBe('/own');
        expect(
            await getDataDirectoryPath({ settingName: 'documents-dir' } as any),
        ).toBe('/data/documents');
    });

    test('offers only existing folders, and only XML files from a filtered Bible folder', async () => {
        state.existing.add('/data/documents');
        state.existing.add('/data/bibles');
        state.entries.set('/data/bibles', [
            file('KJV.xml'),
            file('.hidden.xml'),
            file('database.sqlite'),
            dir('subfolder'),
        ]);
        expect(await getExportableDataFolders()).toMatchObject([
            { dirPath: '/data/documents' },
            { dirPath: '/data/bibles', fileNames: ['KJV.xml'] },
        ]);
        state.entries.set('/data/bibles', [file('database.sqlite')]);
        expect(await getExportableDataFolders()).toHaveLength(1);
    });
});

describe('whole-data archive manifest and restore', () => {
    test('explains an empty archive before asking tar to read it', async () => {
        state.size = 0;
        await expect(
            readDataArchiveManifest('/downloads/empty.tar'),
        ).rejects.toThrow('This archive is empty');
        expect(mocks.tarExtract).not.toHaveBeenCalled();
    });

    test('reads only the manifest and recognizes a Bible Data bundle', async () => {
        state.manifest = { itemKind: 'bible-xml' };
        expect(await readDataArchiveManifest('/downloads/bible.tar')).toEqual({
            kind: 'bible-xml',
        });
        expect(mocks.tarExtract).toHaveBeenCalledWith(
            '/downloads/bible.tar',
            '/tmp/extract',
            ['manifest.json'],
        );
        expect(mocks.cleanup).toHaveBeenCalledWith('/tmp/extract');
    });

    test('filters unknown and unsafe folder entries from a valid manifest', async () => {
        state.manifest = {
            version: 1,
            kind: 'app-data',
            folders: [
                docs,
                bibles,
                { settingName: 'newer-app-dir', entry: 'newer' },
                { ...docs, entry: '../outside' },
            ],
        };
        expect(await readDataArchiveManifest('/archive')).toEqual({
            version: 1,
            kind: 'app-data',
            folders: [docs, bibles],
        });
    });

    test('rejects a manifest with no known safe folder and still cleans extraction', async () => {
        state.manifest = {
            version: 1,
            kind: 'app-data',
            folders: [{ ...docs, entry: '../outside' }],
        };
        await expect(readDataArchiveManifest('/archive')).rejects.toThrow(
            'no known data folder',
        );
        expect(mocks.cleanup).toHaveBeenCalledWith('/tmp/extract');
    });

    test('checks every destination before extracting and refuses a missing path', async () => {
        state.paths.bibles = '';
        await expect(
            importDataArchive('/archive', [docs, bibles]),
        ).rejects.toThrow('Bible Data');
        expect(mocks.tarExtract).not.toHaveBeenCalled();
    });

    test('restores visible files and nested folders, reusing only confirmed duplicates', async () => {
        state.existing.add('/tmp/extract/documents');
        state.existing.add('/tmp/extract/documents/sub');
        state.entries.set('/tmp/extract/documents', [
            file('service.ows'),
            file('same.ows'),
            file('._junk.ows'),
            dir('sub'),
            dir('.hidden'),
        ]);
        state.entries.set('/tmp/extract/documents/sub', [file('notes.ows')]);
        mocks.findExisting.mockImplementation(
            async (_policy: string, source: string) =>
                source.endsWith('same.ows') ? '/data/documents/same.ows' : null,
        );
        const counts = await importDataArchive('/archive', [docs]);
        expect(counts).toEqual({ copied: 2, reused: 1 });
        expect(mocks.clone.mock.calls).toEqual([
            [
                '/tmp/extract/documents/service.ows',
                '/data/documents/service.ows',
            ],
            [
                '/tmp/extract/documents/sub/notes.ows',
                '/data/documents/sub/notes.ows',
            ],
        ]);
        expect(mocks.afterImport).toHaveBeenCalledWith(
            '/data/documents',
            '/tmp/extract/documents',
        );
        expect(mocks.cleanup).toHaveBeenCalledWith('/tmp/extract');
    });

    test('skips unknown folders and missing extracted folders', async () => {
        expect(
            await importDataArchive('/archive', [
                { settingName: 'unknown', entry: 'unknown' },
                docs,
            ]),
        ).toEqual({
            copied: 0,
            reused: 0,
        });
        expect(mocks.tarExtract).toHaveBeenCalledWith(
            '/archive',
            '/tmp/extract',
            ['documents'],
        );
    });

    test('reports a concrete error message and records the failure', () => {
        const error = new Error('disk full');
        expect(reportDataArchiveError('Export Data', error)).toBe('disk full');
        expect(mocks.error).toHaveBeenCalledWith(error);
    });
});
