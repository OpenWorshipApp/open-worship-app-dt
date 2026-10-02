import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    readFileDataMock: vi.fn(async (_filePath: string) => {
        return null as string | null;
    }),
    writeFileDataMock: vi.fn(async (_filePath: string, _data: string) => true),
    forgetCachedDataMock: vi.fn(),
    handleErrorMock: vi.fn(),
    appErrorMock: vi.fn(),
    notifyElementHighlightMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
    getSettingMock: vi.fn(),
    fsListFilesWithMimetypeMock: vi.fn(),
    createNewFileDetailMock: vi.fn(),
    getMimetypeExtensionsMock: vi.fn(() => ['own']),
    deleteMetaDataFileMock: vi.fn(),
    addHistoryMock: vi.fn(async (_dataText: string) => {}),
    getCurrentHistoryMock: vi.fn(async () => null as string | null),
    checkHasHistoriesMock: vi.fn(async () => false),
    undoMock: vi.fn(async () => true),
    redoMock: vi.fn(async () => true),
    discardMock: vi.fn(async () => true),
    historySaveMock: vi.fn(async () => true),
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            filePath,
            readFileData: () => h.readFileDataMock(filePath),
            writeFileData: (data: string) =>
                h.writeFileDataMock(filePath, data),
        }),
        readFileData: h.readFileDataMock,
        forgetCachedData: h.forgetCachedDataMock,
    },
}));
vi.mock('../../editing-manager/EditingHistoryManager', () => ({
    default: {
        getInstance: () => ({
            addHistory: h.addHistoryMock,
            getCurrentHistory: h.getCurrentHistoryMock,
            checkHasHistories: h.checkHasHistoriesMock,
            undo: h.undoMock,
            redo: h.redoMock,
            discard: h.discardMock,
            save: h.historySaveMock,
        }),
    },
}));
// the real module reaches `appProvider`, which has no provider under vitest
vi.mock('../../helper/helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
    toMaxId: (ids: number[]) => (ids.length === 0 ? 0 : Math.max(...ids)),
}));
vi.mock('../../helper/domHelpers', () => ({
    notifyElementHighlight: h.notifyElementHighlightMock,
}));
vi.mock('../../helper/errorHelpers', () => ({
    handleError: h.handleErrorMock,
}));
vi.mock('../../helper/loggerHelpers', () => ({ appError: h.appErrorMock }));
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToastMock,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../helper/settingHelpers', () => ({
    getSetting: h.getSettingMock,
}));
vi.mock('../../server/fileHelpers', () => ({
    fsListFilesWithMimetype: h.fsListFilesWithMimetypeMock,
    createNewFileDetail: h.createNewFileDetailMock,
    getMimetypeExtensions: h.getMimetypeExtensionsMock,
}));
vi.mock('../../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: { deleteMetaDataFile: h.deleteMetaDataFileMock },
}));

import Note from './Note';

const FILE_PATH = '/notes/Default.own';

function genNoteJson(items: any[] = []) {
    return {
        metadata: {
            app: 'OpenWorship',
            fileVersion: 1,
            initDate: '2026-01-01T00:00:00.000Z',
        },
        items,
    };
}

function genItem(id: number, content: string, extra: any = {}) {
    return {
        title: 'Item ' + id,
        content,
        metadata: {
            id,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        },
        ...extra,
    };
}

function genNote(items: any[]) {
    return Note.fromJson(FILE_PATH, genNoteJson(items)) as Note;
}

function readWrittenFile() {
    return h.writeFileDataMock.mock.calls[0][1];
}

function readAddedHistory() {
    return h.addHistoryMock.mock.calls[0][0];
}

describe('bible-list/note Note editing history', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        h.writeFileDataMock.mockResolvedValue(true);
        h.checkHasHistoriesMock.mockResolvedValue(false);
        h.getCurrentHistoryMock.mockResolvedValue(null);
    });

    test('the saved file is indented so a history patch stays small', async () => {
        const note = genNote([genItem(1, 'a')]);
        await note.save();
        const written = readWrittenFile();
        // One line per key is what gives the history diff something to work
        // with; written as one line, a note file diffs as "replace it all".
        expect(written.split('\n').length).toBeGreaterThan(5);
        expect(JSON.parse(written).items).toHaveLength(1);
    });

    test('the editor writes the history and never the file', async () => {
        const note = genNote([genItem(1, 'a')]);
        await note.addEditingHistory();
        expect(h.addHistoryMock).toHaveBeenCalledTimes(1);
        expect(h.writeFileDataMock).not.toHaveBeenCalled();
        expect(JSON.parse(readAddedHistory()).items).toHaveLength(1);
    });

    test('fromFilePathEditing reads the head, fromFilePath the file', async () => {
        h.getCurrentHistoryMock.mockResolvedValue(
            JSON.stringify(genNoteJson([genItem(1, 'from head')])),
        );
        h.readFileDataMock.mockResolvedValue(
            JSON.stringify(genNoteJson([genItem(1, 'from file')])),
        );
        const headNote = await Note.fromFilePathEditing(FILE_PATH);
        const fileNote = await Note.fromFilePath(FILE_PATH);
        expect(headNote?.items[0].content).toBe('from head');
        expect(fileNote?.items[0].content).toBe('from file');
    });

    test('a list save with no history touches no history', async () => {
        const note = genNote([genItem(1, 'a')]);
        await note.save();
        expect(h.checkHasHistoriesMock).toHaveBeenCalledTimes(1);
        expect(h.getCurrentHistoryMock).not.toHaveBeenCalled();
        expect(h.addHistoryMock).not.toHaveBeenCalled();
    });

    // The head carries the file as it was when a note window last wrote to it.
    // Without the rebase, a Save pressed in that window puts a deleted item
    // back and drops one added since.
    test('a list save rebases the head, keeping unsaved item text', async () => {
        h.checkHasHistoriesMock.mockResolvedValue(true);
        h.getCurrentHistoryMock.mockResolvedValue(
            JSON.stringify(
                genNoteJson([
                    genItem(1, 'unsaved text'),
                    genItem(2, 'about to be deleted'),
                ]),
            ),
        );
        // The list has just removed item 2 and added item 3.
        const note = genNote([
            genItem(1, 'saved text'),
            genItem(3, 'brand new'),
        ]);
        await note.save();
        expect(h.addHistoryMock).toHaveBeenCalledTimes(1);
        const rebased = JSON.parse(readAddedHistory());
        expect(
            rebased.items.map((item: any) => {
                return item.metadata.id;
            }),
        ).toEqual([1, 3]);
        // the window's own unsaved text survived the structural change
        expect(rebased.items[0].content).toBe('unsaved text');
        expect(rebased.items[1].content).toBe('brand new');
    });

    test('a verse item keeps its own reference, never the head text', async () => {
        h.checkHasHistoriesMock.mockResolvedValue(true);
        h.getCurrentHistoryMock.mockResolvedValue(
            JSON.stringify(
                genNoteJson([
                    genItem(5, 'STALE', { verseKey: '(KJV) GEN 1:1' }),
                ]),
            ),
        );
        const note = genNote([
            genItem(5, 'GEN 1:1', { verseKey: '(KJV) GEN 1:1' }),
        ]);
        await note.save();
        const rebased = JSON.parse(readAddedHistory());
        expect(rebased.items[0].content).toBe('GEN 1:1');
    });

    test('a head already in step is left alone', async () => {
        const note = genNote([genItem(1, 'a')]);
        h.checkHasHistoriesMock.mockResolvedValue(true);
        h.getCurrentHistoryMock.mockImplementation(async () => {
            return readWrittenFile();
        });
        await note.save();
        // Appending here would light the window's Save button over nothing.
        expect(h.addHistoryMock).not.toHaveBeenCalled();
    });

    // A SECOND note window on the same file writes into the same history, and
    // its own copy of the note is as old as the moment it opened.
    test('an item write is rebased onto the head', async () => {
        h.getCurrentHistoryMock.mockResolvedValue(
            JSON.stringify(
                genNoteJson([
                    genItem(1, 'typed in the other window'),
                    genItem(2, 'mine, stale'),
                ]),
            ),
        );
        // this window opened before the other one typed anything
        const note = genNote([genItem(1, 'old'), genItem(2, 'mine, stale')]);
        const myItem = note.getItemById(2)!;
        myItem.content = 'mine, new';
        await note.addItemEditingHistory(myItem);
        const written = JSON.parse(readAddedHistory());
        expect(written.items[0].content).toBe('typed in the other window');
        expect(written.items[1].content).toBe('mine, new');
        // and this instance moved on, so the next write starts from there
        expect(note.getItemById(1)?.content).toBe('typed in the other window');
    });

    // The head is the last readable copy of a note file that has been damaged.
    test('an unreadable file falls back to the editing head', async () => {
        h.readFileDataMock.mockResolvedValue('{ this is not json');
        h.getCurrentHistoryMock.mockResolvedValue(
            JSON.stringify(genNoteJson([genItem(1, 'rescued')])),
        );
        const note = await Note.fromFilePath(FILE_PATH);
        expect(note?.items[0].content).toBe('rescued');
    });

    test('a readable file never reaches the head', async () => {
        h.readFileDataMock.mockResolvedValue(
            JSON.stringify(genNoteJson([genItem(1, 'from file')])),
        );
        const note = await Note.fromFilePath(FILE_PATH);
        expect(note?.items[0].content).toBe('from file');
        expect(h.getCurrentHistoryMock).not.toHaveBeenCalled();
    });

    test('the history controls reach the manager', async () => {
        const note = genNote([genItem(1, 'a')]);
        await note.historyUndo();
        await note.historyRedo();
        await note.historyDiscard();
        await note.saveEditingHistory();
        expect(h.undoMock).toHaveBeenCalled();
        expect(h.redoMock).toHaveBeenCalled();
        expect(h.discardMock).toHaveBeenCalled();
        expect(h.historySaveMock).toHaveBeenCalled();
    });

    // RD found the copy (id 10) carrying the source's (id 9) dates to the
    // millisecond, as if it had been written at the same moment.
    test('a duplicate is dated when it is made, its source left alone', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-01T12:00:00.000Z'));
        try {
            const note = genNote([genItem(9, 'source text')]);

            note.duplicate(0);

            const [source, copy] = note.items;
            expect(copy.id).toBe(10);
            expect(copy.content).toBe('source text');
            expect(copy.metadata.createdAt.toISOString()).toBe(
                '2026-10-01T12:00:00.000Z',
            );
            expect(copy.metadata.updatedAt.toISOString()).toBe(
                '2026-10-01T12:00:00.000Z',
            );
            expect(source.id).toBe(9);
            expect(source.metadata.createdAt.toISOString()).toBe(
                '2026-01-01T00:00:00.000Z',
            );
            expect(source.metadata.updatedAt.toISOString()).toBe(
                '2026-01-01T00:00:00.000Z',
            );
        } finally {
            vi.useRealTimers();
        }
    });

    test('reloadEditing takes the head, reload takes the file', async () => {
        const note = genNote([genItem(1, 'start')]);
        h.getCurrentHistoryMock.mockResolvedValue(
            JSON.stringify(genNoteJson([genItem(1, 'head text')])),
        );
        await note.reloadEditing();
        expect(note.items[0].content).toBe('head text');
        h.readFileDataMock.mockResolvedValue(
            JSON.stringify(genNoteJson([genItem(1, 'file text')])),
        );
        await note.reload();
        expect(note.items[0].content).toBe('file text');
    });
});
