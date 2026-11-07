import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    addFileMock,
    fsCreateFileMock,
    fsReadFileMock,
    ensureDirectoryMock,
    fireUpdateEventMock,
    handleErrorMock,
    checkHasHistoriesMock,
    getCurrentHistoryMock,
} = vi.hoisted(() => ({
    addFileMock: vi.fn(),
    fsCreateFileMock: vi.fn(),
    fsReadFileMock: vi.fn(),
    ensureDirectoryMock: vi.fn(),
    fireUpdateEventMock: vi.fn(),
    handleErrorMock: vi.fn(),
    checkHasHistoriesMock: vi.fn(),
    getCurrentHistoryMock: vi.fn(),
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
// Mocked, not imported: the real one reaches `FileSource` and through it
// `appProvider`, which touches `document` while this node-env file loads.
vi.mock('../../editing-manager/EditingHistoryManager', () => ({
    default: {
        getInstance: () => ({
            checkHasHistories: checkHasHistoriesMock,
            getCurrentHistory: getCurrentHistoryMock,
        }),
    },
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
    askAndImportBibleNoteArchiveFromUrl,
    checkIsBibleNoteArchiveFileFullName,
    collectNoteEmbeddedFiles,
    createBibleNoteArchive,
    exportBibleNote,
    importBibleNoteArchive,
    importDroppedBibleNoteArchive,
    readLiveNoteContent,
    selectAndImportBibleNoteArchive,
    BIBLE_NOTE_ARCHIVE_DOT_EXTENSION,
} = await import('./bibleNoteArchiveHelpers');
// The mocked bundle flow, to read what each door hands it.
const singleItemArchive = await import('../../helper/singleItemArchiveHelpers');

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

        test('walks the content being EXPORTED, not the file', async () => {
            fsReadFileMock.mockResolvedValue(
                toNoteFileText([
                    { content: toLexicalContent('/saved/old.png') },
                ]),
            );
            await collectNoteEmbeddedFiles(
                collector,
                '/notes/Default.own',
                toNoteFileText([
                    { content: toLexicalContent('/unsaved/new.png') },
                ]),
            );
            // the picture the unsaved text points at, never the saved one
            expect(addFileMock.mock.calls).toEqual([
                ['/unsaved/new.png', 'note-asset'],
            ]);
            expect(fsReadFileMock).not.toHaveBeenCalled();
        });
    });

    // The note editor writes into the editing history and the human presses
    // Save, so the file on disk is behind whenever a note window has unsaved
    // text -- and an export is the note leaving the machine.
    describe('readLiveNoteContent', () => {
        test('is the file when no history was ever written beside it', async () => {
            checkHasHistoriesMock.mockResolvedValue(false);
            expect(await readLiveNoteContent('/notes/Default.own')).toBe(null);
            expect(getCurrentHistoryMock).not.toHaveBeenCalled();
        });

        test('is the unsaved head when it differs from the file', async () => {
            const headText = toNoteFileText([{ content: 'typed just now' }]);
            checkHasHistoriesMock.mockResolvedValue(true);
            getCurrentHistoryMock.mockResolvedValue(headText);
            fsReadFileMock.mockResolvedValue(
                toNoteFileText([{ content: 'saved this morning' }]),
            );
            expect(await readLiveNoteContent('/notes/Default.own')).toBe(
                headText,
            );
        });

        test('is the file when the head reads exactly the same', async () => {
            const sameText = toNoteFileText([{ content: 'nothing pending' }]);
            checkHasHistoriesMock.mockResolvedValue(true);
            getCurrentHistoryMock.mockResolvedValue(sameText);
            fsReadFileMock.mockResolvedValue(sameText);
            expect(await readLiveNoteContent('/notes/Default.own')).toBe(null);
        });

        test('a head that is not a readable note never leaves', async () => {
            checkHasHistoriesMock.mockResolvedValue(true);
            getCurrentHistoryMock.mockResolvedValue('half-written garbage');
            fsReadFileMock.mockResolvedValue(
                toNoteFileText([{ content: 'the good copy' }]),
            );
            expect(await readLiveNoteContent('/notes/Default.own')).toBe(null);
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

        test('an imported file that cannot be read, or is no note list, is never written', async () => {
            const readError = new Error('ENOENT: no such file');
            fsReadFileMock.mockRejectedValueOnce(readError);
            await applyImportedNoteEmbeddedFiles(
                '/notes/Imported.own',
                new Map([['/old/one.png', '/data/tmp-files/one.png']]),
            );
            expect(handleErrorMock).toHaveBeenCalledWith(readError);

            fsReadFileMock.mockResolvedValueOnce('{"items":"not a list"}');
            await applyImportedNoteEmbeddedFiles(
                '/notes/Imported.own',
                new Map([['/old/one.png', '/data/tmp-files/one.png']]),
            );
            expect(fsCreateFileMock).not.toHaveBeenCalled();
            expect(fireUpdateEventMock).not.toHaveBeenCalled();
        });
    });

    describe('when the disk refuses', () => {
        test('a note file that cannot be read exports with no pictures, the failure reported', async () => {
            const readError = new Error('EACCES: permission denied');
            fsReadFileMock.mockRejectedValueOnce(readError);
            await collectNoteEmbeddedFiles(collector, '/notes/Locked.own');
            expect(handleErrorMock).toHaveBeenCalledWith(readError);
            expect(addFileMock).not.toHaveBeenCalled();
        });

        test('a history that cannot be checked leaves the file on disk as the truth', async () => {
            const statError = new Error('EBUSY');
            checkHasHistoriesMock.mockRejectedValueOnce(statError);
            expect(await readLiveNoteContent('/notes/Default.own')).toBeNull();
            expect(handleErrorMock).toHaveBeenCalledWith(statError);
            expect(getCurrentHistoryMock).not.toHaveBeenCalled();
        });
    });

    describe('the bundle config and its doors', () => {
        function readConfig() {
            checkIsBibleNoteArchiveFileFullName('probe');
            return vi.mocked(
                singleItemArchive.checkIsSingleItemArchiveFileFullName,
            ).mock.lastCall![1] as any;
        }

        test('names a bible note bundle and carries the live note with its pictures', async () => {
            const config = readConfig();
            expect(config).toMatchObject({
                itemKind: 'note',
                dotExtension: '.owanote.tar.gz',
                fallbackName: 'Bible Note',
                workDirPrefix: 'owanote',
                exportTitle: 'Export Bible Note',
                importTitle: 'Import Bible Note',
                urlLabel: 'Bible Note Archive URL:',
                itemLabel: 'bible note',
            });
            expect(config.readItemContent).toBe(readLiveNoteContent);
            expect(config.collectExtraFiles).toBe(collectNoteEmbeddedFiles);
            expect(config.applyImportedExtraFiles).toBe(
                applyImportedNoteEmbeddedFiles,
            );
            // Pictures land in the temp-files folder, made first if need be.
            expect(ensureDirectoryMock).not.toHaveBeenCalled();
            const dirPaths = await config.getExtraPresetDirPaths();
            expect(ensureDirectoryMock).toHaveBeenCalledWith('/data/tmp-files');
            expect([...dirPaths]).toEqual([['note-asset', '/data/tmp-files']]);
        });

        test('every door hands its arguments and the one config through', async () => {
            const config = readConfig();
            const mocked = vi.mocked(singleItemArchive);
            mocked.checkIsSingleItemArchiveFileFullName.mockReturnValueOnce(
                true,
            );
            mocked.createSingleItemArchive.mockResolvedValue('/tmp/a.tar.gz');
            mocked.exportSingleItem.mockResolvedValue(null);
            mocked.importSingleItemArchive.mockResolvedValue(
                '/notes/Imported.own' as any,
            );
            mocked.selectAndImportSingleItemArchive.mockResolvedValue(
                null as any,
            );
            mocked.askAndImportSingleItemArchiveFromUrl.mockResolvedValue(
                '/notes/From URL.own' as any,
            );
            mocked.importDroppedSingleItemArchive.mockResolvedValue(
                '/notes/Dropped.own' as any,
            );

            expect(
                checkIsBibleNoteArchiveFileFullName('GEN.1.owanote.tar.gz'),
            ).toBe(true);
            expect(
                mocked.checkIsSingleItemArchiveFileFullName,
            ).toHaveBeenLastCalledWith('GEN.1.owanote.tar.gz', config);

            expect(await createBibleNoteArchive('/notes/Default.own')).toBe(
                '/tmp/a.tar.gz',
            );
            expect(mocked.createSingleItemArchive).toHaveBeenLastCalledWith(
                '/notes/Default.own',
                config,
                null,
            );
            await createBibleNoteArchive('/notes/Default.own', 'secret');
            expect(mocked.createSingleItemArchive).toHaveBeenLastCalledWith(
                '/notes/Default.own',
                config,
                'secret',
            );

            await exportBibleNote('/notes/Default.own');
            expect(mocked.exportSingleItem).toHaveBeenCalledWith(
                '/notes/Default.own',
                config,
            );
            expect(await importBibleNoteArchive('/in/a.owanote.tar.gz')).toBe(
                '/notes/Imported.own',
            );
            expect(mocked.importSingleItemArchive).toHaveBeenCalledWith(
                '/in/a.owanote.tar.gz',
                config,
            );
            expect(await selectAndImportBibleNoteArchive()).toBeNull();
            expect(
                mocked.selectAndImportSingleItemArchive,
            ).toHaveBeenCalledWith(config);
            expect(await askAndImportBibleNoteArchiveFromUrl()).toBe(
                '/notes/From URL.own',
            );
            expect(
                mocked.askAndImportSingleItemArchiveFromUrl,
            ).toHaveBeenCalledWith(config);
            const droppedFile = { name: 'a.owanote.tar.gz' } as any;
            expect(await importDroppedBibleNoteArchive(droppedFile)).toBe(
                '/notes/Dropped.own',
            );
            expect(mocked.importDroppedSingleItemArchive).toHaveBeenCalledWith(
                droppedFile,
                config,
            );
        });
    });
});
