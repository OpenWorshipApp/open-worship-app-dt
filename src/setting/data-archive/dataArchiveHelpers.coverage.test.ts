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
        // Folders that cannot be listed, and the editing heads per file.
        listErrors: new Set<string>(),
        heads: new Map<string, string>(),
        saved: new Map<string, string>(),
        brokenHeads: new Set<string>(),
    },
    mocks: {
        tarCreate: vi.fn(),
        tarAppend: vi.fn(),
        reveal: vi.fn(),
        protect: vi.fn(),
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
    protectArchiveFile: mocks.protect,
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
    default: {
        getInstance: (filePath: string) => ({
            getCurrentHistory: async () => {
                if (state.brokenHeads.has(filePath)) {
                    throw new Error(`unreadable head: ${filePath}`);
                }
                return state.heads.get(filePath) ?? null;
            },
            getOriginalData: async () => state.saved.get(filePath) ?? null,
        }),
    },
    sanitizeForUpdatingComparison: (value: unknown) => value,
}));
vi.mock('../../helper/errorHelpers', () => ({ handleError: mocks.error }));
vi.mock('../../server/appHelpers', () => ({
    showFileOrDirExplorer: mocks.reveal,
    tarAppend: mocks.tarAppend,
    tarCreate: mocks.tarCreate,
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
    fsList: async (path: string) => {
        if (state.listErrors.has(path)) {
            throw new Error(`cannot list ${path}`);
        }
        return state.entries.get(path) ?? [];
    },
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
    collectUnsavedDataEntries,
    createDataArchive,
    exportData,
    getDataDirectoryPath,
    getExportableDataFolders,
    importDataArchive,
    readDataArchiveManifest,
    reportDataArchiveError,
} from './dataArchiveHelpers';
import { dataDirectories } from '../directory-setting/dataDirectories';

const [documentsDirectory, biblesDirectory] = dataDirectories;

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
    state.listErrors.clear();
    state.heads.clear();
    state.saved.clear();
    state.brokenHeads.clear();
    mocks.tarCreate.mockResolvedValue(undefined);
    mocks.tarAppend.mockResolvedValue(undefined);
    mocks.protect.mockResolvedValue('/downloads/protected.owadata.enc');
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

    test('leaves out a folder with no path chosen, and one that is gone', async () => {
        state.paths.documents = '';
        state.existing.add('/data/bibles');
        state.entries.set('/data/bibles', [file('KJV.xml')]);
        expect(await getExportableDataFolders()).toMatchObject([
            { dirPath: '/data/bibles', fileNames: ['KJV.xml'] },
        ]);
        // Chosen, but not there any more.
        state.paths.documents = '/data/documents';
        expect(
            (await getExportableDataFolders()).map((folder) => folder.dirPath),
        ).toEqual(['/data/bibles']);
    });
});

describe('building the whole-data archive', () => {
    const documentsFolder = {
        dataDirectory: documentsDirectory,
        dirPath: '/data/documents',
    };

    test('nothing chosen is nothing to export', async () => {
        await expect(createDataArchive([])).rejects.toThrow(
            'No folder to export',
        );
        expect(mocks.tarCreate).not.toHaveBeenCalled();
    });

    test('a filtered folder goes in file by file, a whole one by its name', async () => {
        const archiveFilePath = await createDataArchive([
            documentsFolder,
            {
                dataDirectory: biblesDirectory,
                dirPath: '/data/bibles',
                fileNames: ['KJV.xml', 'MadeUp.xml'],
            },
        ]);
        expect(archiveFilePath).toBe(
            '/downloads/open-worship-data.owadata.tar',
        );
        expect(mocks.tarCreate.mock.calls[0].slice(0, 3)).toEqual([
            '/data',
            '/downloads/open-worship-data.owadata.tar',
            ['documents', 'bibles/KJV.xml', 'bibles/MadeUp.xml'],
        ]);
        expect(mocks.tarAppend).toHaveBeenCalledWith(
            '/downloads/open-worship-data.owadata.tar',
            '/tmp/extract',
            ['manifest.json'],
        );
        expect(mocks.protect).not.toHaveBeenCalled();
    });

    test('a filtered folder whose files were never listed adds nothing', async () => {
        await createDataArchive([
            documentsFolder,
            { dataDirectory: biblesDirectory, dirPath: '/data/bibles' },
        ]);
        expect(mocks.tarCreate.mock.calls[0][2]).toEqual(['documents']);
    });

    test('a password wraps the plain archive, written beside it', async () => {
        const archiveFilePath = await createDataArchive(
            [documentsFolder],
            'church-secret',
        );
        const plainFilePath =
            '/downloads/open-worship-data.owadata.tar.plain.part';
        expect(mocks.tarCreate.mock.calls[0][1]).toBe(plainFilePath);
        expect(mocks.protect).toHaveBeenCalledExactlyOnceWith(
            plainFilePath,
            '/downloads/open-worship-data.owadata.tar',
            'church-secret',
        );
        expect(archiveFilePath).toBe('/downloads/protected.owadata.enc');
    });

    test('Export Data shows the archive it made in its folder', async () => {
        const archiveFilePath = await exportData([documentsFolder]);
        expect(archiveFilePath).toBe(
            '/downloads/open-worship-data.owadata.tar',
        );
        expect(mocks.reveal).toHaveBeenCalledExactlyOnceWith(archiveFilePath);
    });

    test('an unsaved head is carried; an unlistable folder or unreadable head is passed over', async () => {
        state.listErrors.add('/data/documents');
        state.entries.set('/data/notes', [
            dir('typed.own.histories'),
            dir('untouched.own.histories'),
            dir('same.own.histories'),
            dir('broken.own.histories'),
            file('typed.own'),
            dir('pictures'),
        ]);
        state.heads.set('/data/notes/typed.own', 'typed text');
        state.saved.set('/data/notes/typed.own', 'saved text');
        state.heads.set('/data/notes/same.own', 'saved text');
        state.saved.set('/data/notes/same.own', 'saved text');
        state.brokenHeads.add('/data/notes/broken.own');
        const unsavedEntries = await collectUnsavedDataEntries(
            [
                documentsFolder,
                { dataDirectory: documentsDirectory, dirPath: '/data/notes' },
            ],
            ['documents', 'notes'],
        );
        expect(unsavedEntries).toEqual([
            { entryPath: 'notes/typed.own', text: 'typed text' },
        ]);
        expect(mocks.error.mock.calls).toEqual([
            [new Error('cannot list /data/documents')],
            [new Error('unreadable head: /data/notes/broken.own')],
        ]);
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

    test.each([
        [null],
        [{ version: 2, kind: 'app-data', folders: [docs] }],
        [{ version: 1, kind: 'settings', folders: [docs] }],
        [{ version: 1, kind: 'app-data', folders: 'documents' }],
    ])('refuses manifest %j as no data archive', async (manifest) => {
        state.manifest = manifest;
        await expect(readDataArchiveManifest('/archive')).rejects.toThrow(
            'Invalid data archive manifest',
        );
        expect(mocks.cleanup).toHaveBeenCalledWith('/tmp/extract');
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

    test('nothing chosen, or nothing this build knows, is not imported', async () => {
        await expect(importDataArchive('/archive', [])).rejects.toThrow(
            'No folder to import',
        );
        await expect(
            importDataArchive('/archive', [
                { settingName: 'newer-app-dir', entry: 'newer' },
            ]),
        ).rejects.toThrow('No known data folder to import');
        expect(mocks.tarExtract).not.toHaveBeenCalled();
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

describe('whole-data archive export and refusals', () => {
    const documentsFolder = {
        dataDirectory: { settingName: 'documents-dir' },
        dirPath: '/data/documents',
    } as any;
    const biblesFolder = {
        dataDirectory: { settingName: 'bible-dir', fileNamePattern: /\.xml$/i },
        dirPath: '/data/bibles',
        fileNames: ['KJV.xml', 'KSV.xml'],
    } as any;

    test('a folder whose path is gone is not offered', async () => {
        state.existing.add('/data/bibles');
        state.entries.set('/data/bibles', [file('KJV.xml')]);
        expect(await getExportableDataFolders()).toMatchObject([
            { dirPath: '/data/bibles', fileNames: ['KJV.xml'] },
        ]);
        state.paths.documents = '';
        state.existing.add('/data/documents');
        expect(await getExportableDataFolders()).toHaveLength(1);
    });

    test('a filtered folder goes in file by file, one never listed not at all', async () => {
        const { createDataArchive } = await import('./dataArchiveHelpers');
        const { tarCreate } = await import('../../server/appHelpers');
        const unlistedFolder = {
            dataDirectory: {
                settingName: 'bible-dir',
                fileNamePattern: /\.xml$/i,
            },
            dirPath: '/data/other',
        } as any;

        await expect(
            createDataArchive([documentsFolder, biblesFolder, unlistedFolder]),
        ).resolves.toBe('/downloads/open-worship-data.owadata.tar');

        const [ancestorDir, , files] = vi.mocked(tarCreate).mock.calls[0];
        expect(ancestorDir).toBe('/data');
        expect(files).toEqual([
            'documents',
            'bibles/KJV.xml',
            'bibles/KSV.xml',
        ]);
    });

    test('a protected export wraps the plain archive built beside it', async () => {
        const { createDataArchive } = await import('./dataArchiveHelpers');
        const { tarCreate } = await import('../../server/appHelpers');

        await expect(
            createDataArchive([documentsFolder], 'secret'),
        ).resolves.toBe('/downloads/protected.owadata.enc');

        expect(vi.mocked(tarCreate).mock.calls[0][1]).toBe(
            '/downloads/open-worship-data.owadata.tar.plain.part',
        );
    });

    test('Export Data reveals the archive it wrote', async () => {
        const { exportData } = await import('./dataArchiveHelpers');
        const { showFileOrDirExplorer } =
            await import('../../server/appHelpers');

        const archiveFilePath = await exportData([documentsFolder]);

        expect(archiveFilePath).toBe(
            '/downloads/open-worship-data.owadata.tar',
        );
        expect(showFileOrDirExplorer).toHaveBeenCalledWith(archiveFilePath);
    });

    test('an export of nothing is refused before tar runs', async () => {
        const { createDataArchive } = await import('./dataArchiveHelpers');
        const { tarCreate } = await import('../../server/appHelpers');

        await expect(createDataArchive([])).rejects.toThrow(
            'No folder to export',
        );
        expect(tarCreate).not.toHaveBeenCalled();
    });

    test('an unlistable folder and an unreadable history are passed over', async () => {
        const { collectUnsavedDataEntries } =
            await import('./dataArchiveHelpers');
        const { default: EditingHistoryManager } =
            await import('../../editing-manager/EditingHistoryManager');
        const notesFolder = {
            dataDirectory: { settingName: 'notes-dir' },
            dirPath: '/data/notes',
        } as any;
        state.entries.set('/data/documents', [
            dir('locked.ows.histories'),
            dir('empty.ows.histories'),
            file('plain.ows'),
        ]);
        const listError = new Error('EACCES');
        const readError = new Error('history locked');
        const getEntries = state.entries.get.bind(state.entries);
        vi.spyOn(state.entries, 'get').mockImplementation((dirPath) => {
            if (dirPath === '/data/notes') {
                throw listError;
            }
            return getEntries(dirPath);
        });
        vi.spyOn(EditingHistoryManager, 'getInstance').mockImplementationOnce(
            () => {
                throw readError;
            },
        );

        await expect(
            collectUnsavedDataEntries(
                [notesFolder, documentsFolder],
                ['notes', 'documents'],
            ),
        ).resolves.toEqual([]);

        expect(mocks.error.mock.calls).toEqual([[listError], [readError]]);
    });

    test('a manifest of another kind or version is refused', async () => {
        for (const manifest of [
            null,
            'text',
            { version: 2, kind: 'app-data', folders: [docs] },
            { version: 1, kind: 'other', folders: [docs] },
            { version: 1, kind: 'app-data', folders: 'documents' },
        ]) {
            state.manifest = manifest;
            await expect(readDataArchiveManifest('/archive')).rejects.toThrow(
                'Invalid data archive manifest',
            );
        }
        expect(mocks.cleanup).toHaveBeenCalledTimes(5);
    });

    test('an import of nothing, or of only unknown folders, is refused at once', async () => {
        await expect(importDataArchive('/archive', [])).rejects.toThrow(
            'No folder to import',
        );
        await expect(
            importDataArchive('/archive', [
                { settingName: 'newer-app-dir', entry: 'newer' },
            ]),
        ).rejects.toThrow('No known data folder to import');
        expect(mocks.tarExtract).not.toHaveBeenCalled();
    });
});
