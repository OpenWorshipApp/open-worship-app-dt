// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    fileDataStore,
    fsInstanceStore,
    getInstanceMock,
    readFileDataMock,
    notifyElementHighlightMock,
    handleErrorMock,
    appErrorMock,
    getSettingMock,
    fsListFilesWithMimetypeMock,
    createNewFileDetailMock,
    getMimetypeExtensionsMock,
    showSimpleToastMock,
    editingHistoryGetInstanceMock,
    deleteMetaDataFileMock,
} = vi.hoisted(() => {
    const fileDataStore = new Map<string, string>();
    const fsInstanceStore = new Map<string, any>();
    const nameFromPath = (filePath: string) => {
        const base = filePath.split(/[\\/]/).at(-1) ?? '';
        const dot = base.lastIndexOf('.');
        return dot >= 0 ? base.substring(0, dot) : base;
    };
    return {
        fileDataStore,
        fsInstanceStore,
        notifyElementHighlightMock: vi.fn((cb?: () => any) => cb?.()),
        handleErrorMock: vi.fn(),
        appErrorMock: vi.fn(),
        getSettingMock: vi.fn(),
        fsListFilesWithMimetypeMock: vi.fn(),
        createNewFileDetailMock: vi.fn(),
        getMimetypeExtensionsMock: vi.fn(() => ['note']),
        showSimpleToastMock: vi.fn(),
        editingHistoryGetInstanceMock: vi.fn(() => ({ discard: vi.fn() })),
        deleteMetaDataFileMock: vi.fn(),
        readFileDataMock: vi.fn(async (filePath: string) => {
            return fileDataStore.has(filePath)
                ? fileDataStore.get(filePath)
                : null;
        }),
        getInstanceMock: vi.fn((filePath: string) => {
            if (!fsInstanceStore.has(filePath)) {
                fsInstanceStore.set(filePath, {
                    filePath,
                    name: nameFromPath(filePath),
                    extension: 'note',
                    writeFileData: vi.fn(async (data: string) => {
                        fileDataStore.set(filePath, data);
                        return true;
                    }),
                });
            }
            return fsInstanceStore.get(filePath);
        }),
    };
});

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: getInstanceMock,
        readFileData: readFileDataMock,
    },
}));

vi.mock('../../helper/helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
    toMaxId: (ids: number[]) => (ids.length === 0 ? 0 : Math.max(...ids)),
}));

vi.mock('../../helper/loggerHelpers', () => ({
    appError: appErrorMock,
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../../helper/domHelpers', () => ({
    notifyElementHighlight: notifyElementHighlightMock,
}));

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
}));

vi.mock('../../server/fileHelpers', () => ({
    fsListFilesWithMimetype: fsListFilesWithMimetypeMock,
    createNewFileDetail: createNewFileDetailMock,
    getMimetypeExtensions: getMimetypeExtensionsMock,
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../../editing-manager/EditingHistoryManager', () => ({
    default: { getInstance: editingHistoryGetInstanceMock },
}));

vi.mock('../../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: { deleteMetaDataFile: deleteMetaDataFileMock },
}));

import Note, { type NoteType } from './Note';
import NoteItem from './NoteItem';

function genMeta() {
    return {
        app: 'OpenWorship',
        fileVersion: 1,
        initDate: '2026-01-01T00:00:00.000Z',
    };
}

function genNoteItemJson(id: number, overrides: any = {}) {
    return {
        title: `Title ${id}`,
        content: `Content ${id}`,
        metadata: {
            id,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
        ...overrides,
    };
}

function genNote(filePath: string, ids: number[] = [1, 2]): Note {
    const json: NoteType = {
        metadata: genMeta(),
        items: ids.map((id) => genNoteItemJson(id)),
    };
    return Note.fromJson(filePath, json);
}

describe('bible-list/note Note', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fileDataStore.clear();
        fsInstanceStore.clear();
        getSettingMock.mockReturnValue(null);
        getMimetypeExtensionsMock.mockReturnValue(['note']);
    });

    test('fromJson validates metadata and exposes items + metadata', () => {
        const note = genNote('/notes/a.note', [1, 2]);
        expect(note.metadata).toEqual(genMeta());
        expect(note.itemsLength).toBe(2);
        const items = note.items;
        expect(items).toHaveLength(2);
        expect(items[0]).toBeInstanceOf(NoteItem);
        expect(items[0].note).toBe(note);
    });

    test('items getter reports invalid item json through a toast', () => {
        const json: NoteType = {
            metadata: genMeta(),
            items: [genNoteItemJson(1), { bad: true } as any],
        };
        const note = Note.fromJson('/notes/a.note', json);
        const items = note.items;
        expect(items[1].isError).toBe(true);
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Instantiating Note Item',
            expect.any(String),
        );
    });

    test('items setter serializes back into json', () => {
        const note = genNote('/notes/a.note', [1]);
        const replacement = NoteItem.fromJson(genNoteItemJson(5));
        note.items = [replacement];
        expect(note.itemsLength).toBe(1);
        expect(note.items[0].id).toBe(5);
    });

    test('getItemById / setItemById find and replace items', () => {
        const note = genNote('/notes/a.note', [1, 2]);
        expect(note.getItemById(2)?.id).toBe(2);
        expect(note.getItemById(99)).toBeNull();

        const replacement = NoteItem.fromJson(
            genNoteItemJson(2, { title: 'X' }),
        );
        note.setItemById(2, replacement);
        expect(note.getItemById(2)?.title).toBe('X');
    });

    test('maxItemId reflects the largest id or zero', () => {
        expect(genNote('/notes/a.note', [3, 7, 5]).maxItemId).toBe(7);
        expect(genNote('/notes/a.note', []).maxItemId).toBe(0);
    });

    test('checkIsDefault / isDefault rely on the file name', () => {
        expect(Note.checkIsDefault('/notes/Default.note')).toBe(true);
        expect(Note.checkIsDefault('/notes/Other.note')).toBe(false);
        expect(genNote('/notes/Default.note').isDefault).toBe(true);
        expect(genNote('/notes/Other.note').isDefault).toBe(false);
    });

    test('isOpened reads metadata; setIsOpened persists', async () => {
        const note = genNote('/notes/a.note');
        expect(note.isOpened).toBe(false);
        const ok = await note.setIsOpened(true);
        expect(ok).toBe(true);
        expect(note.isOpened).toBe(true);
        expect(getInstanceMock).toHaveBeenCalledWith('/notes/a.note');
    });

    test('duplicate inserts a copy after the index with a fresh id', () => {
        const note = genNote('/notes/a.note', [1, 2]);
        note.duplicate(0);
        expect(note.itemsLength).toBe(3);
        // new id is maxItemId + 1 = 3
        expect(note.items.map((item) => item.id)).toContain(3);
    });

    test('deleteItemAtIndex and deleteItem remove items', () => {
        const note = genNote('/notes/a.note', [1, 2, 3]);
        const removed = note.deleteItemAtIndex(1);
        expect(removed?.id).toBe(2);
        expect(note.itemsLength).toBe(2);

        const target = note.getItemById(3)!;
        note.deleteItem(target);
        expect(note.getItemById(3)).toBeNull();

        // deleting a non-existent item is a no-op
        note.deleteItem(NoteItem.fromJson(genNoteItemJson(999)));
        expect(note.itemsLength).toBe(1);
    });

    test('deleteItemAtIndex returns null for empty splice', () => {
        const note = genNote('/notes/a.note', [1]);
        expect(note.deleteItemAtIndex(5)).toBeNull();
    });

    test('addNoteItem appends with a fresh id and notifies', () => {
        const note = genNote('/notes/a.note', [1, 2]);
        note.addNoteItem(NoteItem.fromJson(genNoteItemJson(1)));
        expect(note.itemsLength).toBe(3);
        expect(note.items.at(-1)?.id).toBe(3);
        expect(notifyElementHighlightMock).toHaveBeenCalled();
    });

    test('updateNoteItem replaces a matching item and bumps updatedAt', () => {
        const note = genNote('/notes/a.note', [1, 2]);
        const updated = NoteItem.fromJson(genNoteItemJson(2, { title: 'Y' }));
        note.updateNoteItem(updated);
        expect(note.getItemById(2)?.title).toBe('Y');
        expect(notifyElementHighlightMock).toHaveBeenCalled();

        // isSilent suppresses notification and missing item is a no-op
        notifyElementHighlightMock.mockClear();
        note.updateNoteItem(
            NoteItem.fromJson(genNoteItemJson(2, { title: 'Z' })),
            true,
        );
        expect(note.getItemById(2)?.title).toBe('Z');
        expect(notifyElementHighlightMock).not.toHaveBeenCalled();

        note.updateNoteItem(NoteItem.fromJson(genNoteItemJson(999)));
        expect(note.itemsLength).toBe(2);
    });

    test('swapItems swaps valid indexes and ignores out-of-range', () => {
        const note = genNote('/notes/a.note', [1, 2, 3]);
        note.swapItems(0, 2);
        expect(note.items.map((item) => item.id)).toEqual([3, 2, 1]);
        note.swapItems(-1, 0);
        note.swapItems(0, 10);
        expect(note.items.map((item) => item.id)).toEqual([3, 2, 1]);
    });

    test('getItemIndex and moveItemToIndex reorder items', () => {
        const note = genNote('/notes/a.note', [1, 2, 3]);
        const item3 = note.getItemById(3)!;
        expect(note.getItemIndex(item3)).toBe(2);
        note.moveItemToIndex(item3, 0);
        expect(note.items.map((item) => item.id)).toEqual([3, 1, 2]);

        // out-of-range, unknown item, and no-op same index
        note.moveItemToIndex(item3, 10);
        note.moveItemToIndex(NoteItem.fromJson(genNoteItemJson(999)), 1);
        note.moveItemToIndex(note.getItemById(3)!, 0);
        expect(note.items.map((item) => item.id)).toEqual([3, 1, 2]);
    });

    test('add/update/delete-and-save persist via file source', async () => {
        const note = genNote('/notes/a.note', [1]);
        expect(
            await note.addAndSaveNoteItem(
                NoteItem.fromJson(genNoteItemJson(1)),
            ),
        ).toBe(true);
        expect(
            await note.updateAndSaveNoteItem(note.getItemById(2)!, true),
        ).toBe(true);
        expect(await note.deleteNoteItem(note.getItemById(2)!)).toBe(true);
    });

    test('toJson / clone / empty / save', async () => {
        const note = genNote('/notes/a.note', [1, 2]);
        expect(note.toJson().items).toHaveLength(2);
        const cloned = note.clone();
        expect(cloned).toBeInstanceOf(Note);
        expect(cloned.itemsLength).toBe(2);
        note.empty();
        expect(note.itemsLength).toBe(0);
        expect(await note.save()).toBe(true);
    });

    test('create returns a file source or null', async () => {
        createNewFileDetailMock.mockResolvedValueOnce('/notes/new.note');
        const created = await Note.create('/notes', 'new');
        expect(created?.filePath).toBe('/notes/new.note');

        createNewFileDetailMock.mockResolvedValueOnce(null);
        expect(await Note.create('/notes', 'fail')).toBeNull();
    });

    test('fromFilePath reads, parses and validates', async () => {
        expect(await Note.fromFilePath('/notes/missing.note')).toBeNull();

        fileDataStore.set(
            '/notes/good.note',
            JSON.stringify({ metadata: genMeta(), items: [] }),
        );
        const note = await Note.fromFilePath('/notes/good.note');
        expect(note).toBeInstanceOf(Note);

        fileDataStore.set('/notes/bad.note', '{not-json');
        expect(await Note.fromFilePath('/notes/bad.note')).toBeNull();
        expect(handleErrorMock).toHaveBeenCalled();
    });

    test('reload replaces the json when a fresh note loads', async () => {
        const note = genNote('/notes/a.note', [1]);
        fileDataStore.set(
            '/notes/a.note',
            JSON.stringify({
                metadata: genMeta(),
                items: [genNoteItemJson(42)],
            }),
        );
        await note.reload();
        expect(note.getItemById(42)?.id).toBe(42);

        // when reload cannot load, keep current data
        fileDataStore.delete('/notes/a.note');
        await note.reload();
        expect(note.getItemById(42)?.id).toBe(42);
    });

    test('addNoteItemToDefault delegates to the default note', async () => {
        const defaultNote = genNote('/notes/Default.note', []);
        const spy = vi.spyOn(Note, 'getDefault').mockResolvedValue(defaultNote);
        const noteItem = NoteItem.fromJson(genNoteItemJson(1));
        const result = await Note.addNoteItemToDefault(noteItem);
        expect(result).toBe(noteItem);
        expect(defaultNote.itemsLength).toBe(1);
        spy.mockRestore();
    });

    test('addNoteItemToDefault returns null when there is no default', async () => {
        const spy = vi.spyOn(Note, 'getDefault').mockResolvedValue(null);
        expect(
            await Note.addNoteItemToDefault(
                NoteItem.fromJson(genNoteItemJson(1)),
            ),
        ).toBeNull();
        spy.mockRestore();
    });

    describe('getDefault', () => {
        test('returns null when the notes directory is unset', async () => {
            getSettingMock.mockReturnValue(null);
            expect(await Note.getDefault()).toBeNull();
        });

        test('returns the existing default note when present', async () => {
            getSettingMock.mockReturnValue('/notes');
            fsListFilesWithMimetypeMock.mockResolvedValue([
                '/notes/Other.note',
                '/notes/Default.note',
            ]);
            fileDataStore.set(
                '/notes/Default.note',
                JSON.stringify({
                    metadata: genMeta(),
                    items: [genNoteItemJson(1)],
                }),
            );
            const note = await Note.getDefault();
            expect(note).toBeInstanceOf(Note);
            expect(note?.isDefault).toBe(true);
        });

        test('creates a default note and seeds a first item', async () => {
            getSettingMock.mockReturnValue('/notes');
            fsListFilesWithMimetypeMock.mockResolvedValue([]);
            createNewFileDetailMock.mockImplementation(
                async (dir: string, name: string, data: string) => {
                    const filePath = `${dir}/${name}.note`;
                    fileDataStore.set(filePath, data);
                    return filePath;
                },
            );
            const note = await Note.getDefault();
            expect(note).toBeInstanceOf(Note);
            expect(note?.isOpened).toBe(true);
            expect(note?.itemsLength).toBe(1);
        });

        test('returns null and warns when default file cannot be created', async () => {
            getSettingMock.mockReturnValue('/notes');
            fsListFilesWithMimetypeMock.mockResolvedValue([]);
            createNewFileDetailMock.mockResolvedValue(null);
            expect(await Note.getDefault()).toBeNull();
            expect(showSimpleToastMock).toHaveBeenCalledWith(
                'Getting Default Note File',
                expect.any(String),
            );
        });
    });

    describe('moveItemFrom', () => {
        test('no-ops when source path matches destination', async () => {
            const note = genNote('/notes/a.note', [1]);
            await note.moveItemFrom('/notes/a.note');
            expect(showSimpleToastMock).not.toHaveBeenCalled();
        });

        test('warns when the source note cannot be loaded', async () => {
            const note = genNote('/notes/a.note', [1]);
            await note.moveItemFrom('/notes/missing.note');
            expect(showSimpleToastMock).toHaveBeenCalledWith(
                'Moving Note Item',
                'Cannot source Note',
            );
        });

        test('moves a single specified item to this note', async () => {
            const dest = genNote('/notes/dest.note', []);
            fileDataStore.set(
                '/notes/src.note',
                JSON.stringify({
                    metadata: genMeta(),
                    items: [genNoteItemJson(11), genNoteItemJson(12)],
                }),
            );
            const src = await Note.fromFilePath('/notes/src.note');
            const target = src!.getItemById(11)!;
            await dest.moveItemFrom('/notes/src.note', target);
            expect(dest.itemsLength).toBe(1);
        });

        test('warns when the specified item is missing in the source', async () => {
            const dest = genNote('/notes/dest.note', []);
            fileDataStore.set(
                '/notes/src.note',
                JSON.stringify({
                    metadata: genMeta(),
                    items: [genNoteItemJson(11)],
                }),
            );
            await dest.moveItemFrom(
                '/notes/src.note',
                NoteItem.fromJson(genNoteItemJson(999)),
            );
            expect(showSimpleToastMock).toHaveBeenCalledWith(
                'Moving Note Item',
                'Cannot find Note Item',
            );
        });

        test('catches and reports errors raised while moving', async () => {
            const dest = genNote('/notes/dest.note', []);
            // make persisting to the destination throw
            const destInstance = getInstanceMock('/notes/dest.note');
            destInstance.writeFileData = vi.fn(async () => {
                throw new Error('disk full');
            });
            fileDataStore.set(
                '/notes/src.note',
                JSON.stringify({
                    metadata: genMeta(),
                    items: [genNoteItemJson(11)],
                }),
            );
            await dest.moveItemFrom('/notes/src.note');
            expect(showSimpleToastMock).toHaveBeenCalledWith(
                'Moving Note Item',
                'disk full',
            );
        });

        test('moves all items when no item is specified', async () => {
            const dest = genNote('/notes/dest.note', []);
            fileDataStore.set(
                '/notes/src.note',
                JSON.stringify({
                    metadata: genMeta(),
                    items: [genNoteItemJson(11), genNoteItemJson(12)],
                }),
            );
            await dest.moveItemFrom('/notes/src.note');
            expect(dest.itemsLength).toBe(2);
        });
    });
});
