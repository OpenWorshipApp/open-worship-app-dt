import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    addFileMock,
    fsCreateFileMock,
    fsReadFileMock,
    ensureDirectoryMock,
    fireUpdateEventMock,
    handleErrorMock,
} = vi.hoisted(() => ({
    addFileMock: vi.fn(),
    fsCreateFileMock: vi.fn(),
    fsReadFileMock: vi.fn(),
    ensureDirectoryMock: vi.fn(),
    fireUpdateEventMock: vi.fn(),
    handleErrorMock: vi.fn(),
}));

vi.mock('../../server/fileHelpers', () => ({
    ensureDirectory: ensureDirectoryMock,
    fsCreateFile: fsCreateFileMock,
    fsReadFile: fsReadFileMock,
}));
vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: () => ({ fireUpdateEvent: fireUpdateEventMock }),
    },
}));
vi.mock('../../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));
vi.mock('../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { tmpFilesDir: '/data/tmp-files' },
}));
// Only the config feeds these; the generic flow itself is tested elsewhere and
// importing it for real drags the download/toast graph into a node-env test.
vi.mock('../../helper/singleItemArchiveHelpers', () => ({
    askAndImportSingleItemArchiveFromUrl: vi.fn(),
    checkIsSingleItemArchiveFileFullName: vi.fn(),
    createSingleItemArchive: vi.fn(),
    exportSingleItem: vi.fn(),
    importDroppedSingleItemArchive: vi.fn(),
    importSingleItemArchive: vi.fn(),
    selectAndImportSingleItemArchive: vi.fn(),
}));

const {
    applyImportedNoteEmbeddedFiles,
    collectNoteEmbeddedFiles,
    BIBLE_NOTE_ARCHIVE_DOT_EXTENSION,
} = await import('./bibleNoteArchiveHelpers');

function toLexicalContent(filePath: string) {
    return JSON.stringify({
        root: { children: [{ type: 'image', appFilePath: filePath }] },
    });
}

function toNoteFileText(items: any[]) {
    return JSON.stringify({ items, metadata: { isOpened: true } });
}

const collector = { addFile: addFileMock } as any;

describe('bible-list/note bibleNoteArchiveHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('the bundle keeps its own extension', () => {
        expect(BIBLE_NOTE_ARCHIVE_DOT_EXTENSION).toBe('.owanote.tar.gz');
    });

    describe('collectNoteEmbeddedFiles', () => {
        test('collects every item embedded file as a note asset', async () => {
            fsReadFileMock.mockResolvedValue(
                toNoteFileText([
                    { content: toLexicalContent('/a/one.png') },
                    { content: toLexicalContent('/a/two.png') },
                    // a verse item carries marks, never a file
                    { verseKey: '(KJV) GEN 1:1', highlights: [] },
                ]),
            );
            await collectNoteEmbeddedFiles(collector, '/notes/Default.own');
            expect(addFileMock.mock.calls).toEqual([
                ['/a/one.png', 'note-asset'],
                ['/a/two.png', 'note-asset'],
            ]);
        });

        test('an unreadable note collects nothing rather than throwing', async () => {
            fsReadFileMock.mockResolvedValue('not json at all');
            await collectNoteEmbeddedFiles(collector, '/notes/Default.own');
            expect(addFileMock).not.toHaveBeenCalled();
        });
    });

    describe('applyImportedNoteEmbeddedFiles', () => {
        test('re-points items and leaves every other field alone', async () => {
            const verseItem = {
                verseKey: '(KJV) GEN 1:1',
                highlights: [{ id: 'h1', colorKey: 'yellow' }],
                unknownFutureField: 42,
            };
            fsReadFileMock.mockResolvedValue(
                toNoteFileText([
                    { title: 'a', content: toLexicalContent('/old/one.png') },
                    verseItem,
                ]),
            );
            await applyImportedNoteEmbeddedFiles(
                '/notes/Imported.own',
                new Map([['/old/one.png', '/data/tmp-files/one.png']]),
            );
            expect(fsCreateFileMock).toHaveBeenCalledTimes(1);
            const [writtenPath, writtenText, isOverwrite] =
                fsCreateFileMock.mock.calls[0];
            expect(writtenPath).toBe('/notes/Imported.own');
            expect(isOverwrite).toBe(true);
            const writtenJson = JSON.parse(writtenText);
            expect(writtenJson.items[0].content).toContain(
                '/data/tmp-files/one.png',
            );
            expect(writtenJson.items[0].title).toBe('a');
            // the verse item, and the field neither class knows about, survive
            expect(writtenJson.items[1]).toEqual(verseItem);
            expect(writtenJson.metadata).toEqual({ isOpened: true });
            expect(fireUpdateEventMock).toHaveBeenCalledTimes(1);
        });

        test('writes nothing when no path changed', async () => {
            fsReadFileMock.mockResolvedValue(
                toNoteFileText([
                    { content: toLexicalContent('/kept/one.png') },
                ]),
            );
            await applyImportedNoteEmbeddedFiles(
                '/notes/Imported.own',
                new Map([['/other/two.png', '/data/tmp-files/two.png']]),
            );
            expect(fsCreateFileMock).not.toHaveBeenCalled();
            expect(fireUpdateEventMock).not.toHaveBeenCalled();
        });
    });
});
