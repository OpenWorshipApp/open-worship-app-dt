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
    getFileMD5Mock,
    genNextFilePathMock,
    tarCreateMock,
    tarExtractMock,
    getDirPathBySettingNameMock,
    fireUpdateEventMock,
    getDirSourceSettingNameMock,
} = vi.hoisted(() => ({
    ensureDirectoryMock: vi.fn(),
    fsCheckFileExistMock: vi.fn(),
    downloadsFileExistMock: vi.fn(),
    fsCloneFileMock: vi.fn(),
    fsCopyFilePathToPathMock: vi.fn(),
    fsCreateFileMock: vi.fn(),
    fsDeleteDirMock: vi.fn(),
    fsReadFileMock: vi.fn(),
    getFileMD5Mock: vi.fn(),
    genNextFilePathMock: vi.fn(),
    tarCreateMock: vi.fn(),
    tarExtractMock: vi.fn(),
    getDirPathBySettingNameMock: vi.fn(),
    fireUpdateEventMock: vi.fn(),
    getDirSourceSettingNameMock: vi.fn(),
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
vi.mock('../helper/FileSourceMetaManager', () => ({
    getColorNoteFilePathSettings: vi.fn(() => ({})),
    setColorNoteFilePathSettings: vi.fn(),
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

// Only the folder rule matters here, and the real class drags the whole bible
// item graph in behind it.
vi.mock('./Bible', () => ({
    default: { getDirSourceSettingName: getDirSourceSettingNameMock },
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
    getFileMD5: getFileMD5Mock,
    getTempPath: () => '/system-temp',
    pathBasename: pathBasenameMock,
    pathJoin: pathJoinMock,
    selectFiles: vi.fn(),
}));

async function loadModule() {
    vi.resetModules();
    return await import('./bibleArchiveHelpers');
}

const EXTRACT_DIR = '/system-temp/owbible-import-run-id';
const BIBLE_PATH = '/other/bibles/Sunday.owb';
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
    // The reader page keeps its own bible-list folder, so the destination comes
    // from `Bible.getDirSourceSettingName()` rather than a constant.
    getDirSourceSettingNameMock.mockReturnValue('bible-read-dir');
    getDirPathBySettingNameMock.mockImplementation((settingName: string) => {
        return settingName === 'bible-read-dir'
            ? '/data/reader-bibles'
            : '/data/backgrounds';
    });
    genNextFilePathMock.mockImplementation(async (filePath: string) => {
        return filePath;
    });
    fsCopyFilePathToPathMock.mockImplementation(
        async (_source: string, dirPath: string, fileFullName: string) => {
            return `${dirPath}/${fileFullName}`;
        },
    );
    fsCheckFileExistMock.mockResolvedValue(true);
});

describe('bibleArchiveHelpers export', () => {
    test('bundles the bible list and the background attached to it', async () => {
        fsReadFileMock.mockImplementation((filePath: string) => {
            if (filePath.endsWith('.bg.json')) {
                return Promise.resolve(JSON.stringify(BACKGROUND_META));
            }
            return Promise.resolve('{}');
        });

        const { createBibleArchive } = await loadModule();
        const archiveFilePath = await createBibleArchive(BIBLE_PATH);

        expect(archiveFilePath).toBe('/downloads/Sunday.owbible.tar.gz');
        const manifest = readWrittenJson('manifest.json');
        expect(manifest.itemKind).toBe('bible');
        expect(manifest.item).toBe(BIBLE_PATH);
        expect(manifest.files).toEqual([
            expect.objectContaining({
                originalPath: BIBLE_PATH,
                kind: 'bible',
            }),
            expect.objectContaining({
                originalPath: '/data/backgrounds/sunset.png',
                kind: 'image',
            }),
        ]);
        expect(manifest.backgroundMetas).toHaveLength(1);
    });

    test('never walks a bible list for canvas media', async () => {
        // `.owb` is not a canvas document, so its JSON must not even be read
        // looking for video boxes.
        fsReadFileMock.mockResolvedValue('{}');
        fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
            return !filePath.endsWith('.bg.json');
        });

        const { createBibleArchive } = await loadModule();
        await createBibleArchive(BIBLE_PATH);

        expect(fsReadFileMock).not.toHaveBeenCalledWith(BIBLE_PATH);
        expect(readWrittenJson('manifest.json').files).toHaveLength(1);
    });
});

describe('bibleArchiveHelpers import', () => {
    const FILES = [
        {
            originalPath: BIBLE_PATH,
            archivePath: 'files/001-Sunday.owb',
            kind: 'bible',
        },
    ];

    function mockArchive(extraManifest: object = {}) {
        fsReadFileMock.mockImplementation((filePath: string) => {
            if (filePath.endsWith('manifest.json')) {
                return Promise.resolve(
                    JSON.stringify({
                        version: 1,
                        itemKind: 'bible',
                        item: BIBLE_PATH,
                        files: FILES,
                        backgroundMetas: [],
                        colorNotes: {},
                        ...extraManifest,
                    }),
                );
            }
            return Promise.resolve('{}');
        });
    }

    test('writes the list into the page’s own bibles folder', async () => {
        mockArchive();
        fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
            return filePath.startsWith(EXTRACT_DIR);
        });

        const { importBibleArchive } = await loadModule();

        await expect(
            importBibleArchive('/downloads/Sunday.owbible.tar.gz'),
        ).resolves.toBe('/data/reader-bibles/Sunday.owb');
        expect(getDirSourceSettingNameMock).toHaveBeenCalled();
    });

    test('fails before writing anything when no bibles folder is chosen', async () => {
        mockArchive();
        getDirPathBySettingNameMock.mockReturnValue('');

        const { importBibleArchive } = await loadModule();

        await expect(
            importBibleArchive('/downloads/Sunday.owbible.tar.gz'),
        ).rejects.toThrowError(/No "bible list" folder is selected yet/);
        expect(fsCopyFilePathToPathMock).not.toHaveBeenCalled();
    });

    test('refuses a document bundle', async () => {
        mockArchive({ itemKind: 'document' });

        const { importBibleArchive } = await loadModule();

        await expect(
            importBibleArchive('/downloads/Sunday.owbible.tar.gz'),
        ).rejects.toThrowError(/holds a "document", not a bible list/);
    });
});

describe('bibleArchiveHelpers import — merging into an existing list', () => {
    const LOCAL_BIBLE_PATH = '/data/reader-bibles/Sunday.owb';
    const EXTRACTED_BIBLE_PATH = `${EXTRACT_DIR}/files/001-Sunday.owb`;

    function genBibleItem(verseStart: number, extra: object = {}) {
        return {
            id: verseStart,
            bibleKey: 'KJV',
            target: {
                bookKey: 'JHN',
                chapter: 3,
                verseStart,
                verseEnd: verseStart,
            },
            metadata: {},
            ...extra,
        };
    }

    /** Mocks the manifest plus the two bible lists the merge reads. */
    function mockLists(localJson: unknown, archivedJson: unknown) {
        fsReadFileMock.mockImplementation((filePath: string) => {
            if (filePath.endsWith('manifest.json')) {
                return Promise.resolve(
                    JSON.stringify({
                        version: 1,
                        itemKind: 'bible',
                        item: BIBLE_PATH,
                        files: [
                            {
                                originalPath: BIBLE_PATH,
                                archivePath: 'files/001-Sunday.owb',
                                kind: 'bible',
                            },
                        ],
                        backgroundMetas: [],
                        colorNotes: { self: 'red' },
                    }),
                );
            }
            if (filePath === LOCAL_BIBLE_PATH) {
                return Promise.resolve(JSON.stringify(localJson));
            }
            if (filePath === EXTRACTED_BIBLE_PATH) {
                return Promise.resolve(JSON.stringify(archivedJson));
            }
            return Promise.resolve('{}');
        });
    }

    test('appends only the verses the local list is missing', async () => {
        mockLists(
            {
                items: [genBibleItem(16, { metadata: { colorNote: 'red' } })],
                metadata: { keep: true },
            },
            { items: [genBibleItem(16), genBibleItem(17)] },
        );

        const { importBibleArchive } = await loadModule();
        const itemFilePath = await importBibleArchive(
            '/downloads/Sunday.owbible.tar.gz',
        );

        // Merged INTO the operator's list rather than landing beside it.
        expect(itemFilePath).toBe(LOCAL_BIBLE_PATH);
        expect(fsCopyFilePathToPathMock).not.toHaveBeenCalled();
        const written = readWrittenJson('Sunday.owb');
        expect(written.items).toHaveLength(2);
        // The verse already there keeps its own colour note untouched...
        expect(written.items[0].metadata).toEqual({ colorNote: 'red' });
        // ...and the new one is appended past the highest id in use.
        expect(written.items[1].target.verseStart).toBe(17);
        expect(written.items[1].id).toBe(17);
        expect(written.metadata).toEqual({ keep: true });
        expect(fireUpdateEventMock).toHaveBeenCalledWith(LOCAL_BIBLE_PATH);
    });

    test('a repeated import of the same list changes nothing', async () => {
        mockLists({ items: [genBibleItem(16)] }, { items: [genBibleItem(16)] });

        const { importBibleArchive } = await loadModule();
        await importBibleArchive('/downloads/Sunday.owbible.tar.gz');

        expect(readWrittenJson('Sunday.owb')).toBeNull();
        expect(fsCopyFilePathToPathMock).not.toHaveBeenCalled();
    });

    test('the same verse in another translation is its own entry', async () => {
        mockLists(
            { items: [genBibleItem(16)] },
            { items: [genBibleItem(16, { bibleKey: 'NIV' })] },
        );

        const { importBibleArchive } = await loadModule();
        await importBibleArchive('/downloads/Sunday.owbible.tar.gz');

        const written = readWrittenJson('Sunday.owb');
        expect(written.items).toHaveLength(2);
        expect(written.items[1].bibleKey).toBe('NIV');
    });

    test('leaves the merged list’s own colour notes alone', async () => {
        mockLists({ items: [] }, { items: [genBibleItem(16)] });

        const { importBibleArchive } = await loadModule();
        await importBibleArchive('/downloads/Sunday.owbible.tar.gz');

        // The file is the operator's, exactly as an existing `.bg.json` is.
        const { setColorNoteFilePathSettings } =
            await import('../helper/FileSourceMetaManager');
        expect(setColorNoteFilePathSettings).not.toHaveBeenCalled();
    });

    test('writes a new list when the local file is not a bible list', async () => {
        mockLists({ notALIst: true }, { items: [genBibleItem(16)] });
        genNextFilePathMock.mockResolvedValue(
            '/data/reader-bibles/Sunday (1).owb',
        );
        fsCopyFilePathToPathMock.mockResolvedValue(
            '/data/reader-bibles/Sunday (1).owb',
        );

        const { importBibleArchive } = await loadModule();
        const itemFilePath = await importBibleArchive(
            '/downloads/Sunday.owbible.tar.gz',
        );

        // An unreadable namesake must not swallow the import.
        expect(itemFilePath).toBe('/data/reader-bibles/Sunday (1).owb');
        expect(fsCopyFilePathToPathMock).toHaveBeenCalled();
    });
});
