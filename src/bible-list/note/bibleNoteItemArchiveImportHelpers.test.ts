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
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: vi.fn(),
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: vi.fn(() => ({
            genNextFilePath: vi.fn(),
        })),
    },
}));

vi.mock('../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        tmpFilesDir: '/app-data/tmp-files',
    },
}));

vi.mock('../../server/appHelpers', () => ({
    showFileOrDirExplorer: vi.fn(),
    tarCreate: vi.fn(),
    tarExtract: tarExtractMock,
}));

vi.mock('../../server/fileHelpers', () => ({
    ensureDirectory: ensureDirectoryMock,
    fsCheckFileExist: fsCheckFileExistMock,
    fsCloneFile: vi.fn(),
    fsCopyFilePathToPath: fsCopyFilePathToPathMock,
    fsCreateFile: vi.fn(),
    fsDeleteDir: fsDeleteDirMock,
    fsReadFile: fsReadFileMock,
    getDownloadPath: vi.fn(() => '/downloads'),
    getTempPath: vi.fn(() => '/system-temp'),
    pathBasename: pathBasenameMock,
    pathJoin: pathJoinMock,
    selectFiles: vi.fn(),
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

        await importBibleNoteItemArchive(note as any, '/downloads/item.owabn.tar.gz');

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
        expect(JSON.parse(noteItemFromJsonMock.mock.calls[0][0].content)).toEqual({
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
});
