// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    ensureDirectoryMock,
    fsCheckFileExistMock,
    downloadsFileExistMock,
    fsCloneFileMock,
    fsCopyFilePathToPathMock,
    fsCreateFileMock,
    fsDeleteDirMock,
    fsReadFileMock,
    fsGetFileSizeMock,
    getFileMD5Mock,
    genNextFilePathMock,
    tarCreateMock,
    tarExtractMock,
    getDirPathBySettingNameMock,
    fireUpdateEventMock,
    getColorNoteFilePathSettingsMock,
    setColorNoteFilePathSettingsMock,
} = vi.hoisted(() => ({
    ensureDirectoryMock: vi.fn(),
    fsCheckFileExistMock: vi.fn(),
    downloadsFileExistMock: vi.fn(),
    fsCloneFileMock: vi.fn(),
    fsCopyFilePathToPathMock: vi.fn(),
    fsCreateFileMock: vi.fn(),
    fsDeleteDirMock: vi.fn(),
    fsReadFileMock: vi.fn(),
    fsGetFileSizeMock: vi.fn(),
    getFileMD5Mock: vi.fn(),
    genNextFilePathMock: vi.fn(),
    tarCreateMock: vi.fn(),
    tarExtractMock: vi.fn(),
    getDirPathBySettingNameMock: vi.fn(),
    fireUpdateEventMock: vi.fn(),
    getColorNoteFilePathSettingsMock: vi.fn(),
    setColorNoteFilePathSettingsMock: vi.fn(),
}));

const pathJoinMock = (...parts: string[]) => parts.join('/');
const pathBasenameMock = (filePath: string) => {
    return filePath.split('/').pop() ?? filePath;
};

vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: vi.fn(),
    hideProgressBar: vi.fn(),
}));
vi.mock('../helper/bible-helpers/downloadHelpers', () => ({
    initHttpRequest: vi.fn(),
}));
vi.mock('../background/downloadHelper', () => ({
    askForURL: vi.fn(),
    messageCallback: vi.fn(),
    streamDownloadFile: vi.fn(),
}));
vi.mock('../helper/localFileHelpers', () => ({
    getAppFilePathFromFile: vi.fn(() => null),
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: vi.fn((filePath: string) => ({
            filePath,
            fullName: pathBasenameMock(filePath),
            name: pathBasenameMock(filePath).replace(/\.[^.]*$/, ''),
            genNextFilePath: () => genNextFilePathMock(filePath),
            fireUpdateEvent: () => fireUpdateEventMock(filePath),
        })),
    },
}));

vi.mock('../helper/DirSource', () => ({
    default: { getDirPathBySettingName: getDirPathBySettingNameMock },
}));

vi.mock('../helper/FileSourceMetaManager', () => ({
    getColorNoteFilePathSettings: getColorNoteFilePathSettingsMock,
    setColorNoteFilePathSettings: setColorNoteFilePathSettingsMock,
}));

vi.mock('../setting/directory-setting/directoryHelpers', () => ({
    BaseDirFileSource: class {
        constructor(
            readonly settingName: string,
            readonly value: string,
        ) {}
        get fileSource() {
            return { filePath: `/data/backgrounds/${this.value}` };
        }
        get fileFullNameOrFilePath() {
            return pathBasenameMock(this.value);
        }
    },
}));

vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: vi.fn(),
    tarCreate: tarCreateMock,
    tarExtract: tarExtractMock,
}));

// The Downloads folder answers separately, and empty by default. Tests here
// say "everything exists" to describe the DATA folders, but the export's own
// destination is read with the same call: `genNextArchiveFilePath` counts up
// until it finds a free name, so one blanket `true` would never terminate.
const fsCheckFileExistSplitMock = (filePath: string) => {
    if (String(filePath).startsWith('/downloads/')) {
        return Promise.resolve(downloadsFileExistMock(filePath) === true);
    }
    return fsCheckFileExistMock(filePath);
};

vi.mock('../server/fileHelpers', () => ({
    ensureDirectory: ensureDirectoryMock,
    fsCheckFileExist: fsCheckFileExistSplitMock,
    fsCloneFile: fsCloneFileMock,
    fsCopyFilePathToPath: fsCopyFilePathToPathMock,
    fsCreateFile: fsCreateFileMock,
    fsDeleteDir: fsDeleteDirMock,
    fsReadFile: fsReadFileMock,
    getDownloadPath: () => '/downloads',
    fsGetFileSize: fsGetFileSizeMock,
    getFileMD5: getFileMD5Mock,
    getTempPath: () => '/system-temp',
    pathBasename: pathBasenameMock,
    pathJoin: pathJoinMock,
    selectFiles: vi.fn(),
}));

async function loadModule() {
    vi.resetModules();
    return await import('./appDocumentArchiveHelpers');
}

const EXTRACT_DIR = '/system-temp/owadoc-import-run-id';
const DOCUMENT_PATH = '/other/docs/a.ows';

const CANVAS_DOCUMENT = {
    items: [
        {
            id: 0,
            canvasItems: [
                { type: 'text', text: 'hi' },
                { type: 'video', filePath: '/other/videos/clip.mp4' },
            ],
        },
    ],
};

const BACKGROUND_META = {
    self: { type: 'bg-image', item: 'sunset.png' },
};

function readWrittenJson(fileNameSuffix: string) {
    const call = fsCreateFileMock.mock.calls.find((call) => {
        return String(call[0]).endsWith(fileNameSuffix);
    });
    return call === undefined ? null : JSON.parse(String(call[1]));
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('crypto', { randomUUID: () => 'run-id' });
    getDirPathBySettingNameMock.mockReturnValue('/data/documents');
    getColorNoteFilePathSettingsMock.mockReturnValue({});
    genNextFilePathMock.mockImplementation(async (filePath: string) => {
        return filePath;
    });
    fsCopyFilePathToPathMock.mockImplementation(
        async (_source: string, dirPath: string, fileFullName: string) => {
            return `${dirPath}/${fileFullName}`;
        },
    );
    fsCheckFileExistMock.mockResolvedValue(true);
    // Size is the free first half of the same-contents check, so an identical
    // size is the default and MD5 decides in the tests that care.
    fsGetFileSizeMock.mockResolvedValue(1024);
});

describe('appDocumentArchiveHelpers export', () => {
    test('bundles the document, its attached background and canvas media', async () => {
        fsReadFileMock.mockImplementation((filePath: string) => {
            if (filePath.endsWith('.bg.json')) {
                return Promise.resolve(JSON.stringify(BACKGROUND_META));
            }
            return Promise.resolve(JSON.stringify(CANVAS_DOCUMENT));
        });
        getColorNoteFilePathSettingsMock.mockReturnValue({
            self: 'red',
            '3': 'blue',
        });

        const { createAppDocumentArchive } = await loadModule();
        const archiveFilePath = await createAppDocumentArchive(DOCUMENT_PATH);

        expect(archiveFilePath).toBe('/downloads/a.owadoc.tar.gz');
        const manifest = readWrittenJson('manifest.json');
        expect(manifest.item).toBe(DOCUMENT_PATH);
        expect(manifest.itemKind).toBe('document');
        expect(manifest.files).toEqual([
            expect.objectContaining({
                originalPath: DOCUMENT_PATH,
                kind: 'document',
            }),
            // Reached through the `.bg.json` sidecar, which is rewritten to
            // hold absolute paths and staged as its own archive entry.
            expect.objectContaining({
                originalPath: '/data/backgrounds/sunset.png',
                kind: 'image',
            }),
            expect.objectContaining({
                originalPath: '/other/videos/clip.mp4',
                kind: 'video',
            }),
        ]);
        expect(manifest.backgroundMetas).toHaveLength(1);
        expect(manifest.colorNotes).toEqual({ self: 'red', '3': 'blue' });
    });

    test('fails rather than writing an archive with no document in it', async () => {
        fsCheckFileExistMock.mockResolvedValue(false);

        const { createAppDocumentArchive } = await loadModule();

        await expect(
            createAppDocumentArchive(DOCUMENT_PATH),
        ).rejects.toThrowError(/Unable to read the document/);
        expect(tarCreateMock).not.toHaveBeenCalled();
    });
});

describe('appDocumentArchiveHelpers import', () => {
    function mockArchive(
        files: any[],
        colorNotes: { [key: string]: string } = {},
        extraManifest: object = {},
    ) {
        fsReadFileMock.mockImplementation((filePath: string) => {
            if (filePath.endsWith('manifest.json')) {
                return Promise.resolve(
                    JSON.stringify({
                        version: 1,
                        itemKind: 'document',
                        item: DOCUMENT_PATH,
                        files,
                        backgroundMetas: [],
                        colorNotes,
                        ...extraManifest,
                    }),
                );
            }
            return Promise.resolve(JSON.stringify(CANVAS_DOCUMENT));
        });
    }

    const DOCUMENT_AND_VIDEO = [
        {
            originalPath: DOCUMENT_PATH,
            archivePath: 'files/001-a.ows',
            kind: 'document',
        },
        {
            originalPath: '/other/videos/clip.mp4',
            archivePath: 'files/002-clip.mp4',
            kind: 'video',
        },
    ];

    test('writes the document and re-points its canvas media plus color notes', async () => {
        mockArchive(DOCUMENT_AND_VIDEO, { self: 'red', '3': 'blue' });
        // Nothing local collides, so both files are written fresh.
        fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
            return filePath.startsWith(EXTRACT_DIR);
        });

        const { importAppDocumentArchive } = await loadModule();
        const documentFilePath = await importAppDocumentArchive(
            '/downloads/a.owadoc.tar.gz',
        );

        expect(documentFilePath).toBe('/data/documents/a.ows');
        expect(readWrittenJson('a.ows')).toEqual({
            items: [
                {
                    id: 0,
                    canvasItems: [
                        { type: 'text', text: 'hi' },
                        {
                            type: 'video',
                            filePath: '/data/documents/clip.mp4',
                        },
                    ],
                },
            ],
        });
        expect(setColorNoteFilePathSettingsMock).toHaveBeenCalledWith(
            '/data/documents/a.ows',
            { self: 'red', '3': 'blue' },
        );
    });

    test('writes a NEW document even when an identical one is there', async () => {
        mockArchive(DOCUMENT_AND_VIDEO, { self: 'red' });
        getFileMD5Mock.mockResolvedValue('identical');
        genNextFilePathMock.mockImplementation(async (filePath: string) => {
            return filePath.endsWith('a.ows')
                ? '/data/documents/a (1).ows'
                : filePath;
        });
        fsCopyFilePathToPathMock.mockImplementation(
            async (_source: string, dirPath: string, fileFullName: string) => {
                return fileFullName === 'a.ows'
                    ? '/data/documents/a (1).ows'
                    : `${dirPath}/${fileFullName}`;
            },
        );

        const { importAppDocumentArchive } = await loadModule();
        const itemFilePath = await importAppDocumentArchive(
            '/downloads/a.owadoc.tar.gz',
        );

        // The document is the operator's own work, so a namesake is never
        // folded into or silently skipped — it lands beside it...
        expect(itemFilePath).toBe('/data/documents/a (1).ows');
        expect(fsCopyFilePathToPathMock).toHaveBeenCalledWith(
            `${EXTRACT_DIR}/files/001-a.ows`,
            '/data/documents',
            'a.ows',
        );
        // ...and because it IS newly written, its bundled color notes apply.
        expect(setColorNoteFilePathSettingsMock).toHaveBeenCalledWith(
            '/data/documents/a (1).ows',
            { self: 'red' },
        );
        // The video beside it still dedupes on identical contents.
        expect(fsCopyFilePathToPathMock).not.toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            'clip.mp4',
        );
    });

    test('rejects an archive whose manifest names no document', async () => {
        fsReadFileMock.mockResolvedValue(
            JSON.stringify({ version: 1, files: [] }),
        );

        const { importAppDocumentArchive } = await loadModule();

        await expect(
            importAppDocumentArchive('/downloads/a.owadoc.tar.gz'),
        ).rejects.toThrowError(/Invalid document archive manifest/);
    });

    test('refuses a bundle of another kind picked through the file dialog', async () => {
        mockArchive(DOCUMENT_AND_VIDEO, {}, { itemKind: 'bible' });

        const { importAppDocumentArchive } = await loadModule();

        await expect(
            importAppDocumentArchive('/downloads/a.owadoc.tar.gz'),
        ).rejects.toThrowError(/holds a "bible", not a document/);
    });

    test('still reads the pre-`item` manifest field', async () => {
        // Archives written before bible lists shared this format named the
        // field `document` and had no `itemKind`.
        fsReadFileMock.mockImplementation((filePath: string) => {
            if (filePath.endsWith('manifest.json')) {
                return Promise.resolve(
                    JSON.stringify({
                        version: 1,
                        document: DOCUMENT_PATH,
                        files: DOCUMENT_AND_VIDEO,
                        backgroundMetas: [],
                    }),
                );
            }
            return Promise.resolve(JSON.stringify(CANVAS_DOCUMENT));
        });
        fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
            return filePath.startsWith(EXTRACT_DIR);
        });

        const { importAppDocumentArchive } = await loadModule();

        await expect(
            importAppDocumentArchive('/downloads/a.owadoc.tar.gz'),
        ).resolves.toBe('/data/documents/a.ows');
    });

    test('rejects an archive path that escapes the extract folder', async () => {
        mockArchive([
            {
                originalPath: DOCUMENT_PATH,
                archivePath: '../../evil.ows',
                kind: 'document',
            },
        ]);

        const { importAppDocumentArchive } = await loadModule();

        await expect(
            importAppDocumentArchive('/downloads/a.owadoc.tar.gz'),
        ).rejects.toThrowError(/Invalid archive file path/);
    });
});
