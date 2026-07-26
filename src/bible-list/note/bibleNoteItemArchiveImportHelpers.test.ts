// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    ensureDirectoryMock,
    fsCheckFileExistMock,
    fsCopyFilePathToPathMock,
    fsDeleteDirMock,
    fsReadFileMock,
    noteItemFromJsonMock,
    pathBasenameMock,
    pathJoinMock,
    tarExtractMock,
    tarCreateMock,
    fsCloneFileMock,
    fsCreateFileMock,
    selectFilesMock,
    showFileOrDirExplorerMock,
} = vi.hoisted(() => ({
    ensureDirectoryMock: vi.fn(),
    fsCheckFileExistMock: vi.fn(),
    fsCopyFilePathToPathMock: vi.fn(),
    fsDeleteDirMock: vi.fn(),
    fsReadFileMock: vi.fn(),
    noteItemFromJsonMock: vi.fn(),
    pathBasenameMock: vi.fn((filePath: string) => {
        return filePath.split('/').pop() ?? filePath;
    }),
    pathJoinMock: vi.fn((...parts: string[]) => parts.join('/')),
    tarExtractMock: vi.fn(),
    tarCreateMock: vi.fn(),
    fsCloneFileMock: vi.fn(),
    fsCreateFileMock: vi.fn(),
    selectFilesMock: vi.fn(),
    showFileOrDirExplorerMock: vi.fn(),
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: vi.fn(),
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: vi.fn((filePath: string) => ({
            genNextFilePath: vi.fn(async () => filePath),
        })),
    },
}));

vi.mock('../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        tmpFilesDir: '/app-data/tmp-files',
    },
}));

vi.mock('../../server/appHelpers', () => ({
    showFileOrDirExplorer: showFileOrDirExplorerMock,
    tarCreate: tarCreateMock,
    tarExtract: tarExtractMock,
}));

vi.mock('../../server/fileHelpers', () => ({
    ensureDirectory: ensureDirectoryMock,
    fsCheckFileExist: fsCheckFileExistMock,
    fsCloneFile: fsCloneFileMock,
    fsCopyFilePathToPath: fsCopyFilePathToPathMock,
    fsCreateFile: fsCreateFileMock,
    fsDeleteDir: fsDeleteDirMock,
    fsReadFile: fsReadFileMock,
    getDownloadPath: vi.fn(() => '/downloads'),
    getTempPath: vi.fn(() => '/system-temp'),
    pathBasename: pathBasenameMock,
    pathJoin: pathJoinMock,
    selectFiles: selectFilesMock,
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: vi.fn(),
}));

vi.mock('./NoteItem', () => ({
    default: {
        fromJson: noteItemFromJsonMock,
    },
}));

async function loadModule() {
    vi.resetModules();
    return await import('./bibleNoteItemArchiveHelpers');
}

const IMPORTED_TRACE_FILE_NAME = 'bn-RGVmYXVsdC8xMC8xNzgwMDg2MjI4NTE4.png';
const IMPORTED_TRACE_FILE_PATH = `/app-data/tmp-files/${IMPORTED_TRACE_FILE_NAME}`;

describe('bibleNoteItemArchive import', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('crypto', {
            randomUUID: vi.fn(() => 'import-id'),
        });
        vi.spyOn(Date, 'now').mockReturnValue(1780086228518);
        fsCheckFileExistMock.mockResolvedValue(true);
        fsCopyFilePathToPathMock.mockResolvedValue(IMPORTED_TRACE_FILE_PATH);
        fsReadFileMock.mockImplementation((filePath: string) => {
            if (filePath.endsWith('/manifest.json')) {
                return Promise.resolve(
                    JSON.stringify({
                        version: 1,
                        noteItem: 'note-item.json',
                        files: [
                            {
                                originalPath: '/old-media/alpha.png',
                                archivePath: 'files/001-alpha.png',
                            },
                        ],
                    }),
                );
            }
            return Promise.resolve(
                JSON.stringify({
                    title: 'Imported Note',
                    content: JSON.stringify({
                        root: {
                            children: [
                                { appFilePath: '/old-media/alpha.png' },
                                { src: '/old-media/alpha.png' },
                            ],
                        },
                    }),
                    metadata: {
                        id: 9,
                        createdAt: '2026-05-29T00:00:00.000Z',
                        updatedAt: '2026-05-29T00:00:00.000Z',
                    },
                }),
            );
        });
        noteItemFromJsonMock.mockImplementation((json) => ({
            title: json.title,
            json,
        }));
    });

    test('extracts the archive under tmp-files and imports embedded files there', async () => {
        const { importBibleNoteItemArchive } = await loadModule();
        const note = {
            fileSource: { name: 'Default' },
            maxItemId: 9,
            addAndSaveNoteItem: vi.fn(async () => true),
        };

        await importBibleNoteItemArchive(
            note as any,
            '/downloads/item.owabn.tar.gz',
        );

        const extractDir = '/app-data/tmp-files/owabn-import-import-id';
        expect(ensureDirectoryMock).toHaveBeenCalledWith(extractDir);
        expect(tarExtractMock).toHaveBeenCalledWith(
            '/downloads/item.owabn.tar.gz',
            extractDir,
        );
        expect(fsCopyFilePathToPathMock).toHaveBeenCalledWith(
            `${extractDir}/files/001-alpha.png`,
            '/app-data/tmp-files',
            IMPORTED_TRACE_FILE_NAME,
        );
        expect(
            JSON.parse(noteItemFromJsonMock.mock.calls[0][0].content),
        ).toEqual({
            root: {
                children: [
                    { appFilePath: IMPORTED_TRACE_FILE_PATH },
                    { src: IMPORTED_TRACE_FILE_PATH },
                ],
            },
        });
        expect(noteItemFromJsonMock.mock.calls[0][0].metadata.id).toBe(10);
        expect(note.addAndSaveNoteItem).toHaveBeenCalledWith({
            title: 'Imported Note',
            json: noteItemFromJsonMock.mock.calls[0][0],
        });
        expect(fsDeleteDirMock).toHaveBeenCalledWith(extractDir);
    });
    test('exporting stages the note item, its files, and a manifest', async () => {
        const { createBibleNoteItemArchive, exportBibleNoteItem } =
            await loadModule();
        const noteItem = {
            title: 'My Note',
            content: JSON.stringify({
                root: { children: [{ appFilePath: '/media/alpha.png' }] },
            }),
            toJson: () => ({ title: 'My Note' }),
        } as any;

        const archiveFilePath = await createBibleNoteItemArchive(noteItem);

        expect(archiveFilePath).toContain('/downloads/');
        // the note item, the manifest, and the embedded files folder
        const [, , archiveEntries] = tarCreateMock.mock.calls[0];
        expect(archiveEntries).toEqual([
            'manifest.json',
            'note-item.json',
            'files',
        ]);
        expect(fsCloneFileMock).toHaveBeenCalledWith(
            '/media/alpha.png',
            expect.stringContaining('001-alpha.png'),
        );
        expect(fsDeleteDirMock).toHaveBeenCalled();

        await expect(exportBibleNoteItem(noteItem)).resolves.toBe(
            archiveFilePath,
        );
        expect(showFileOrDirExplorerMock).toHaveBeenCalledWith(archiveFilePath);

        // a missing embedded file aborts the export instead of shipping a
        // broken archive
        fsCheckFileExistMock.mockResolvedValueOnce(false);
        await expect(exportBibleNoteItem(noteItem)).resolves.toBeNull();
    });

    test('importing is cancelled when no archive is picked', async () => {
        const { selectAndImportBibleNoteItemArchive } = await loadModule();
        const note = { filePath: '/notes/note.owan' } as any;

        selectFilesMock.mockResolvedValue([]);
        await expect(
            selectAndImportBibleNoteItemArchive(note),
        ).resolves.toBeNull();

        selectFilesMock.mockRejectedValue(new Error('dialog failed'));
        await expect(
            selectAndImportBibleNoteItemArchive(note),
        ).resolves.toBeNull();
    });
});
