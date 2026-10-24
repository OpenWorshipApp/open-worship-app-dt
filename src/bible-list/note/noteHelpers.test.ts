import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    filePaths: [] as string[],
    notes: new Map<string, object>(),
    getDir: vi.fn(),
    menu: vi.fn(),
    toast: vi.fn(),
    confirm: vi.fn(),
}));

vi.mock('../../helper/DirSource', () => ({
    default: { getInstance: state.getDir },
}));
vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: (first: string, second?: string) => {
            const filePath = second ? `${first}/${second}` : first;
            const filename = filePath.split('/').at(-1)!;
            return {
                filePath,
                name: filename.replace(/\.note$/, ''),
                baseDirPath: filePath.slice(0, -filename.length - 1),
                dotExtension: '.note',
            };
        },
    },
}));
vi.mock('./Note', () => ({
    default: {
        fromFilePath: async (filePath: string) =>
            state.notes.get(filePath) ?? null,
        checkIsDefault: (filePath: string) =>
            filePath.endsWith('/Default.note'),
    },
}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: state.menu,
}));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: state.confirm,
}));
vi.mock('../../server/fileHelpers', () => ({
    addExtension: (name: string, extension: string) => `${name}${extension}`,
}));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: state.toast }));

import {
    moveNoteItemTo,
    openNoteItemContextMenu,
    sortNoteFilePaths,
} from './noteHelpers';

type MenuItem = { menuElement: string; onSelect: (event?: object) => void };

function latestMenu(): MenuItem[] {
    return state.menu.mock.lastCall![1] as MenuItem[];
}

beforeEach(() => {
    state.filePaths = [];
    state.notes.clear();
    state.getDir.mockReset();
    state.getDir.mockResolvedValue({
        getFilePaths: async () => state.filePaths,
    });
    state.menu.mockReset();
    state.toast.mockReset();
    state.confirm.mockReset();
});

describe('note item context actions', () => {
    it('uses the note directory setting and explains when no other notes exist', async () => {
        state.filePaths = ['/notes/Current.note'];
        await moveNoteItemTo({}, { filePath: '/notes/Current.note' } as never);

        expect(state.getDir).toHaveBeenCalledWith('select-dir-bible-notes');
        expect(state.menu).not.toHaveBeenCalled();
        expect(state.toast).toHaveBeenCalledWith(
            'Move Note Item',
            'No other notes found',
        );
    });

    it('moves an item to the selected target and reports a disappeared target', async () => {
        const source = { filePath: '/notes/Current.note' };
        const item = { id: 7 };
        const moveItemFrom = vi.fn();
        state.filePaths = [source.filePath, '/notes/Next.note'];
        state.notes.set('/notes/Next.note', { moveItemFrom });

        await moveNoteItemTo({}, source as never, item as never);
        expect(latestMenu().map((entry) => entry.menuElement)).toEqual([
            'Next',
        ]);
        await latestMenu()[0].onSelect();
        expect(moveItemFrom).toHaveBeenCalledWith(source.filePath, item);

        state.notes.delete('/notes/Next.note');
        await latestMenu()[0].onSelect();
        expect(state.toast).toHaveBeenCalledWith(
            'Move Note Item',
            'Target note not found',
        );
    });

    it('offers duplicate, move, discard, delete, and reorder actions with confirmation', async () => {
        const note = {
            filePath: '/notes/Current.note',
            itemsLength: 3,
            editingHistoryManager: {
                checkCanDiscard: vi.fn().mockResolvedValue(true),
            },
            duplicate: vi.fn(),
            save: vi.fn(),
            historyDiscard: vi.fn(),
            deleteNoteItem: vi.fn(),
            swapItems: vi.fn(),
        };
        const item = { filePath: note.filePath, id: 7 };
        state.notes.set(note.filePath, note);
        state.confirm.mockResolvedValue(false);
        state.filePaths = [note.filePath, '/notes/Next.note'];
        const extra = { menuElement: 'Extra', onSelect: vi.fn() };

        await openNoteItemContextMenu({}, item as never, 1, [extra] as never);
        const menu = latestMenu();
        expect(
            note.editingHistoryManager.checkCanDiscard,
        ).toHaveBeenCalledOnce();
        expect(menu.map((entry) => entry.menuElement)).toEqual([
            'Extra',
            'Duplicate',
            'Move To',
            'Discard Change',
            'Delete',
            'Move up',
            'Move down',
        ]);
        menu[1].onSelect();
        expect(note.duplicate).toHaveBeenCalledWith(1);
        expect(note.save).toHaveBeenCalledOnce();
        menu[2].onSelect({});
        await vi.waitFor(() =>
            expect(latestMenu()[0].menuElement).toBe('Next'),
        );
        await menu[3].onSelect();
        await menu[4].onSelect();
        expect(note.historyDiscard).not.toHaveBeenCalled();
        expect(note.deleteNoteItem).not.toHaveBeenCalled();

        state.confirm.mockResolvedValue(true);
        await menu[3].onSelect();
        await menu[4].onSelect();
        expect(note.historyDiscard).toHaveBeenCalledOnce();
        expect(note.deleteNoteItem).toHaveBeenCalledWith(item);
        menu[5].onSelect();
        menu[6].onSelect();
        expect(note.swapItems.mock.calls).toEqual([
            [1, 0],
            [1, 2],
        ]);
        expect(note.save).toHaveBeenCalledTimes(3);
    });

    it('omits unavailable actions and reports a missing note', async () => {
        const item = { filePath: '/notes/Current.note' };
        await openNoteItemContextMenu({}, item as never, 0, []);
        expect(state.toast).toHaveBeenCalledWith(
            'Open Note Item Context Menu',
            'Unable to get note',
        );

        state.notes.set(item.filePath, {
            filePath: item.filePath,
            itemsLength: 1,
            editingHistoryManager: { checkCanDiscard: async () => false },
        });
        await openNoteItemContextMenu({}, item as never, 0, []);
        expect(latestMenu().map((entry) => entry.menuElement)).toEqual([
            'Duplicate',
            'Move To',
            'Delete',
        ]);
    });

    it('sorts the default note first without changing its caller-owned list', () => {
        const input = ['/notes/Z.note', '/notes/Default.note', '/notes/A.note'];
        expect(sortNoteFilePaths(input)).toEqual([
            '/notes/Default.note',
            '/notes/Z.note',
            '/notes/A.note',
        ]);
        expect(input).toEqual([
            '/notes/Z.note',
            '/notes/Default.note',
            '/notes/A.note',
        ]);
    });
});
