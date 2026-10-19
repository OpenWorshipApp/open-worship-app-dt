// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getAttachedBackground: vi.fn(),
    genRemovingMenu: vi.fn(),
    extractDropData: vi.fn(),
    attachBackgroundDrop: vi.fn(),
    dragStart: vi.fn(),
    changeDragStyle: vi.fn(),
    stopDragging: vi.fn(),
    openItemMenu: vi.fn(),
    openPopup: vi.fn(),
    exportItem: vi.fn(),
    fromFilePath: vi.fn(),
}));

vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../../helper/dirSourceHelpers', () => ({
    useFileSourceRefreshEvents: () => undefined,
}));
vi.mock('../../helper/dragHelpers', () => ({
    genRemovingAttachedBackgroundMenu: mocks.genRemovingMenu,
    extractDropDataOfType: mocks.extractDropData,
    handleAttachBackgroundDrop: mocks.attachBackgroundDrop,
    handleDragStart: mocks.dragStart,
}));
vi.mock('../../helper/DragInf', () => ({
    DragTypeEnum: { NOTE_ITEM: 'note-item' },
}));
vi.mock('../../helper/FileSource', () => ({
    default: { getInstance: () => ({ name: 'Study' }) },
}));
vi.mock('../../helper/helpers', () => ({
    changeDragEventStyle: mocks.changeDragStyle,
    stopDraggingState: mocks.stopDragging,
}));
vi.mock('../../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: {
        getAttachedBackground: mocks.getAttachedBackground,
    },
}));
vi.mock('../../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ onOpening }: { onOpening: (event: unknown) => void }) => (
        <button type="button" onClick={(event) => onOpening(event)}>
            More note actions
        </button>
    ),
}));
vi.mock('../../others/ItemColorNoteComp', () => ({
    default: () => <span>Color</span>,
}));
vi.mock('../../others/ItemReadErrorComp', () => ({
    default: ({
        onContextMenu,
    }: {
        onContextMenu: (event: unknown) => void;
    }) => (
        <div onContextMenu={(event) => onContextMenu(event)}>
            Unreadable note
        </div>
    ),
}));
vi.mock('./Note', () => ({
    default: { fromFilePath: mocks.fromFilePath },
}));
vi.mock('./noteHelpers', () => ({
    openNoteItemContextMenu: mocks.openItemMenu,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../server/appProvider', () => ({
    default: { bibleNoteHomePage: '/bible-note' },
}));
vi.mock('../../helper/domHelpers', () => ({
    openPopupWindow: mocks.openPopup,
    setParamFileFullName: (page: string, fullName: string) =>
        `${page}?file=${fullName}`,
    setParamIdNum: (page: string, id: number) => `${page}&id=${id}`,
}));
vi.mock('./NoteEditorComp', () => ({
    NoteTitleEditorComp: ({ onEscape }: { onEscape: () => void }) => (
        <button type="button" onClick={onEscape}>
            Cancel title
        </button>
    ),
}));
vi.mock('./bibleNoteItemArchiveHelpers', () => ({
    exportBibleNoteItem: mocks.exportItem,
}));
vi.mock('../../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

import BibleNoteItemRenderComp, {
    handleOpening,
} from './BibleNoteItemRenderComp';

let host: HTMLDivElement;
let root: Root;
let note: any;
let noteItem: any;

function renderRow(item = noteItem) {
    return act(async () =>
        root.render(
            <BibleNoteItemRenderComp
                index={2}
                filePath="/notes/Study.own"
                note={note}
                noteItem={item}
            />,
        ),
    );
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.clearAllMocks();
    noteItem = { id: 4, title: 'Mercy', filePath: '/notes/Study.own' };
    note = {
        fileSource: { fullName: 'Study.own' },
        getEditingItemById: vi.fn(async () => ({
            ...noteItem,
            title: 'Live title',
        })),
        getItemIndex: vi.fn(() => 2),
        moveItemToIndex: vi.fn(),
        save: vi.fn(),
    };
    mocks.getAttachedBackground.mockResolvedValue(null);
    mocks.fromFilePath.mockResolvedValue(note);
    mocks.genRemovingMenu.mockReturnValue([
        { menuElement: 'Remove background' },
    ]);
    mocks.extractDropData.mockReturnValue(null);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('Bible note row', () => {
    test('opens the named note by click, keyboard and the shared opener', async () => {
        await renderRow();
        const row = host.querySelector('li')!;
        expect(row.dataset.noteItemId).toBe('Study-4');
        expect(row.dataset.index).toBe('3');
        expect(row.draggable).toBe(true);
        const opener = host.querySelector<HTMLElement>(
            '[aria-label="Open BibleNote: Mercy"]',
        )!;
        await act(async () => opener.click());
        expect(mocks.openPopup).toHaveBeenCalledWith(
            '/bible-note?file=Study.own&id=4',
            expect.stringContaining('Study.own-4_'),
            expect.any(String),
            { width: 870 },
        );
        await act(async () =>
            opener.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            ),
        );
        expect(mocks.openPopup).toHaveBeenCalledTimes(2);
        handleOpening(note, noteItem);
        expect(mocks.openPopup).toHaveBeenCalledTimes(3);
    });

    // RD-12: a double-click on the icon is click, click and a dblclick that
    // bubbles to the row's own opener -- three windows for one gesture.
    test('opens ONE window per double-click, on the icon or on the row', async () => {
        await renderRow();
        const opener = host.querySelector<HTMLElement>(
            '[aria-label="Open BibleNote: Mercy"]',
        )!;
        await act(async () => {
            opener.dispatchEvent(
                new MouseEvent('click', { bubbles: true, detail: 1 }),
            );
            opener.dispatchEvent(
                new MouseEvent('click', { bubbles: true, detail: 2 }),
            );
            opener.dispatchEvent(
                new MouseEvent('dblclick', { bubbles: true, detail: 2 }),
            );
        });
        expect(mocks.openPopup).toHaveBeenCalledOnce();

        // The row's double-click, on its title, still opens -- once.
        mocks.openPopup.mockClear();
        const title = [...host.querySelectorAll('div')].find(
            (element) => element.textContent === 'Mercy',
        )!;
        await act(async () =>
            title.dispatchEvent(
                new MouseEvent('dblclick', { bubbles: true, detail: 2 }),
            ),
        );
        expect(mocks.openPopup).toHaveBeenCalledOnce();

        // And the keyboard path: one Enter, one window.
        mocks.openPopup.mockClear();
        await act(async () =>
            opener.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            ),
        );
        expect(mocks.openPopup).toHaveBeenCalledOnce();
    });

    test('exports the live editing head and closes title editing without saving', async () => {
        await renderRow();
        mocks.getAttachedBackground.mockResolvedValueOnce({ type: 'image' });
        await act(async () =>
            host.querySelector<HTMLButtonElement>('button')!.click(),
        );
        const menuItems = mocks.openItemMenu.mock.calls.at(-1)?.[3];
        expect(menuItems.map((item: any) => item.menuElement)).toEqual([
            'Open',
            'Edit Title',
            'Export',
            'Remove background',
        ]);
        await act(async () => menuItems[2].onSelect());
        expect(note.getEditingItemById).toHaveBeenCalledWith(4);
        expect(mocks.exportItem).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Live title' }),
        );
        await act(async () => menuItems[1].onSelect());
        expect(host.querySelector('li')!.draggable).toBe(false);
        expect(host.textContent).toContain('Cancel title');
        await act(async () =>
            host.querySelector<HTMLButtonElement>('button')!.click(),
        );
        expect(host.querySelector('li')!.draggable).toBe(true);
        expect(note.save).not.toHaveBeenCalled();
    });

    test('reorders a typed note-item drop and delegates other drops to backgrounds', async () => {
        await renderRow();
        const droppedItem = { id: 5, filePath: '/notes/Study.own' };
        mocks.extractDropData.mockReturnValueOnce({ item: droppedItem });
        await act(async () =>
            host
                .querySelector('li')!
                .dispatchEvent(new Event('drop', { bubbles: true })),
        );
        expect(mocks.extractDropData).toHaveBeenCalledWith(
            expect.anything(),
            'note-item',
        );
        expect(note.moveItemToIndex).toHaveBeenCalledWith(droppedItem, 2);
        expect(mocks.stopDragging).toHaveBeenCalledOnce();
        expect(note.save).toHaveBeenCalledOnce();

        await act(async () =>
            host
                .querySelector('li')!
                .dispatchEvent(new Event('drop', { bubbles: true })),
        );
        expect(mocks.attachBackgroundDrop).toHaveBeenCalledWith(
            expect.anything(),
            { filePath: '/notes/Study.own', id: 4 },
        );
    });

    test('renders an unreadable note without the normal draggable row', async () => {
        await renderRow({ ...noteItem, isError: true });
        expect(host.textContent).toContain('Unreadable note');
        expect(host.querySelector('li')).toBeNull();
        expect(mocks.openPopup).not.toHaveBeenCalled();
    });
});
