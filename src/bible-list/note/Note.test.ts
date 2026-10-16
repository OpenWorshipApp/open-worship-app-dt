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
            name:
                filePath
                    .split('/')
                    .pop()
                    ?.replace(/\.own$/, '') ?? '',
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

    test('item edits preserve order and write only the requested item', () => {
        const note = genNote([genItem(2, 'two'), genItem(5, 'five')]);
        const ids = () => note.items.map((item) => item.id);
        expect(note.itemsLength).toBe(2);
        expect(note.maxItemId).toBe(5);
        expect(note.getItemById(5)?.note).toBe(note);
        expect(note.getItemById(99)).toBeNull();

        const added = genNote([genItem(20, 'new')]).items[0];
        note.addNoteItem(added);
        expect(ids()).toEqual([2, 5, 6]);
        expect(h.notifyElementHighlightMock).toHaveBeenCalledOnce();

        const edited = note.getItemById(5)!;
        edited.content = 'edited five';
        note.updateNoteItem(edited, true);
        expect(note.getItemById(5)?.content).toBe('edited five');
        expect(h.notifyElementHighlightMock).toHaveBeenCalledOnce();
        note.updateNoteItem(edited);
        expect(h.notifyElementHighlightMock).toHaveBeenCalledTimes(2);

        note.swapItems(0, 2);
        expect(ids()).toEqual([6, 5, 2]);
        note.moveItemToIndex(note.getItemById(2)!, 1);
        expect(ids()).toEqual([6, 2, 5]);
        note.setItemById(2, genNote([genItem(2, 'replacement')]).items[0]);
        expect(note.getItemById(2)?.content).toBe('replacement');
        note.deleteItem(edited);
        expect(ids()).toEqual([6, 2]);
        expect(note.deleteItemAtIndex(50)).toBeNull();
        note.empty();
        expect(note.itemsLength).toBe(0);
        expect(note.maxItemId).toBe(0);
    });

    test('invalid reorder requests and unknown items leave the document alone', () => {
        const note = genNote([genItem(2, 'two'), genItem(5, 'five')]);
        const missing = genNote([genItem(90, 'other')]).items[0];
        note.swapItems(-1, 1);
        note.swapItems(0, 9);
        note.moveItemToIndex(missing, 0);
        note.moveItemToIndex(note.items[0], 9);
        note.moveItemToIndex(note.items[0], 0);
        note.deleteItem(missing);
        note.updateNoteItem(missing);
        expect(note.items.map((item) => item.id)).toEqual([2, 5]);
        expect(h.notifyElementHighlightMock).not.toHaveBeenCalled();
    });

    test('convenience operations save the resulting file and keep open state', async () => {
        const note = genNote([genItem(1, 'one')]);
        await note.setIsOpened(true);
        expect(note.isOpened).toBe(true);
        expect(
            JSON.parse(h.writeFileDataMock.mock.lastCall![1]).metadata.isOpened,
        ).toBe(true);
        await note.addAndSaveNoteItem(genNote([genItem(8, 'eight')]).items[0]);
        expect(note.items.map((item) => item.id)).toEqual([1, 2]);
        const edited = note.getItemById(2)!;
        edited.content = 'changed';
        await note.updateAndSaveNoteItem(edited);
        expect(
            JSON.parse(h.writeFileDataMock.mock.lastCall![1]).items[1].content,
        ).toBe('changed');
        await note.deleteNoteItem(edited);
        expect(
            JSON.parse(h.writeFileDataMock.mock.lastCall![1]).items,
        ).toHaveLength(1);
        expect(h.writeFileDataMock).toHaveBeenCalledTimes(4);
    });

    test('moving a chosen item writes it to the destination before deleting it from the source', async () => {
        const sourcePath = '/notes/Source.own';
        h.readFileDataMock.mockImplementation(async (filePath: string) =>
            filePath === sourcePath
                ? JSON.stringify(
                      genNoteJson([genItem(3, 'keep'), genItem(4, 'move')]),
                  )
                : null,
        );
        const target = genNote([genItem(1, 'already here')]);
        await target.moveItemFrom(
            sourcePath,
            genNote([genItem(4, 'move')]).items[0],
        );
        expect(target.items.map((item) => item.content)).toEqual([
            'already here',
            'move',
        ]);
        expect(h.writeFileDataMock.mock.calls.map(([path]) => path)).toEqual([
            FILE_PATH,
            sourcePath,
        ]);
        expect(
            JSON.parse(h.writeFileDataMock.mock.calls[1][1]).items.map(
                (item: { metadata: { id: number } }) => item.metadata.id,
            ),
        ).toEqual([3]);
    });

    test('move refuses a missing source or item and does not touch its own file', async () => {
        const target = genNote([]);
        await target.moveItemFrom(FILE_PATH);
        expect(h.readFileDataMock).not.toHaveBeenCalled();
        await target.moveItemFrom('/notes/Missing.own');
        expect(h.showSimpleToastMock).toHaveBeenLastCalledWith(
            'Moving Note Item',
            'Cannot source Note',
        );
        h.readFileDataMock.mockResolvedValue(
            JSON.stringify(genNoteJson([genItem(1, 'one')])),
        );
        await target.moveItemFrom(
            '/notes/Source.own',
            genNote([genItem(99, 'absent')]).items[0],
        );
        expect(h.showSimpleToastMock).toHaveBeenLastCalledWith(
            'Moving Note Item',
            'Cannot find Note Item',
        );
        expect(h.writeFileDataMock).not.toHaveBeenCalled();
    });

    test('default note loads an existing file or creates and opens one', async () => {
        h.getSettingMock.mockReturnValue('/notes');
        h.fsListFilesWithMimetypeMock.mockResolvedValue([FILE_PATH]);
        h.readFileDataMock.mockResolvedValue(
            JSON.stringify(genNoteJson([genItem(1, 'existing')])),
        );
        expect((await Note.getDefault())?.items[0].content).toBe('existing');
        expect(h.createNewFileDetailMock).not.toHaveBeenCalled();

        h.fsListFilesWithMimetypeMock.mockResolvedValue([]);
        h.createNewFileDetailMock.mockResolvedValue(FILE_PATH);
        h.readFileDataMock.mockResolvedValue(JSON.stringify(genNoteJson([])));
        const created = await Note.getDefault();
        expect(created?.isOpened).toBe(true);
        expect(created?.items).toHaveLength(1);
        expect(h.createNewFileDetailMock).toHaveBeenCalledWith(
            '/notes',
            'Default',
            expect.any(String),
            'note',
        );
        expect(h.writeFileDataMock).toHaveBeenCalledTimes(2);
    });

    test('default note handles absent directory and failed creation', async () => {
        h.getSettingMock.mockReturnValue(null);
        expect(await Note.getDefault()).toBeNull();
        h.getSettingMock.mockReturnValue('/notes');
        h.fsListFilesWithMimetypeMock.mockResolvedValue([]);
        h.createNewFileDetailMock.mockResolvedValue(null);
        expect(await Note.getDefault()).toBeNull();
        expect(h.showSimpleToastMock).toHaveBeenLastCalledWith(
            'Getting Default Note File',
            'Fail to get default note file',
        );
    });

    test('editing-head synchronization runs only when a head exists', async () => {
        const note = genNote([genItem(1, 'file')]);
        const edited = note.getItemById(1)!;
        edited.content = 'agent edit';
        await note.syncItemEditingHistory(edited);
        expect(h.addHistoryMock).not.toHaveBeenCalled();
        h.checkHasHistoriesMock.mockResolvedValue(true);
        h.getCurrentHistoryMock.mockResolvedValue(
            JSON.stringify(genNoteJson([genItem(1, 'old head')])),
        );
        await note.syncItemEditingHistory(edited);
        expect(JSON.parse(readAddedHistory()).items[0].content).toBe(
            'agent edit',
        );
    });
});
