// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../media-sessions/folderSessionHelpers', () => ({
    FOLDER_SESSION_BASE_NAMES: [],
    SESSION_URL_PARAM_NAME: 'session',
    getActiveDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingNameFromParam: (settingName: string) => {
        return settingName;
    },
}));
vi.mock('../../media-sessions/folderSessionPathHelpers', () => ({
    findSessionIdByFilePath: () => null,
    findNonDefaultSessionIdByFilePath: () => null,
}));

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
// Escape first: the row's first button while its title is being edited.
vi.mock('./NoteEditorComp', () => ({
    NoteTitleEditorComp: ({
        onEscape,
        onEnter,
        onBlur,
    }: {
        onEscape: () => void;
        onEnter: () => void;
        onBlur: () => void;
    }) => (
        <>
            <button type="button" onClick={onEscape}>
                Cancel title
            </button>
            <button type="button" onClick={onEnter}>
                Confirm title
            </button>
            <button type="button" onClick={onBlur}>
                Leave title
            </button>
        </>
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

    function getOpener() {
        return host.querySelector<HTMLElement>('[role="button"]')!;
    }

    async function openRowMenu() {
        await act(async () =>
            host.querySelector('li')!.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            ),
        );
        return mocks.openItemMenu.mock.lastCall!;
    }

    test('the menu’s Open opens this note’s own window', async () => {
        await renderRow();
        const [, menuNoteItem, menuIndex, menuItems] = await openRowMenu();
        expect(menuNoteItem).toBe(noteItem);
        expect(menuIndex).toBe(2);
        await act(async () => menuItems[0].onSelect());
        expect(mocks.openPopup).toHaveBeenCalledWith(
            '/bible-note?file=Study.own&id=4',
            expect.stringContaining('Study.own-4_'),
            expect.any(String),
            { width: 870 },
        );
    });

    test('the title field closes on Enter and on leaving it, and holds the row still meanwhile', async () => {
        await renderRow();
        for (const closingLabel of ['Confirm title', 'Leave title']) {
            const [, , , menuItems] = await openRowMenu();
            const menuCallCount = mocks.openItemMenu.mock.calls.length;
            await act(async () => menuItems[1].onSelect());
            expect(host.querySelector('li')!.draggable).toBe(false);
            // No menu and no opening while the title is being typed.
            await openRowMenu();
            expect(mocks.openItemMenu).toHaveBeenCalledTimes(menuCallCount);
            await act(async () =>
                host
                    .querySelector('li')!
                    .dispatchEvent(
                        new MouseEvent('dblclick', { bubbles: true }),
                    ),
            );
            expect(mocks.openPopup).not.toHaveBeenCalled();

            const closingButton = [...host.querySelectorAll('button')].find(
                (button) => button.textContent?.trim() === closingLabel,
            )!;
            await act(async () => closingButton.click());
            expect(host.querySelector('li')!.draggable).toBe(true);
            expect(host.textContent).toContain('Mercy');
            expect(host.textContent).not.toContain(closingLabel);
        }
        expect(note.save).not.toHaveBeenCalled();
    });

    test('a note dragged in from another file is the file row’s; a vanished file reorders nothing', async () => {
        await renderRow();
        const row = host.querySelector('li')!;
        for (const item of [
            { id: 9, filePath: '/notes/Other.own' },
            { id: 10 },
        ]) {
            mocks.extractDropData.mockReturnValueOnce({ item });
            await act(async () =>
                row.dispatchEvent(new Event('drop', { bubbles: true })),
            );
        }
        expect(mocks.stopDragging).not.toHaveBeenCalled();
        expect(mocks.fromFilePath).not.toHaveBeenCalled();
        expect(mocks.attachBackgroundDrop).not.toHaveBeenCalled();

        mocks.fromFilePath.mockResolvedValueOnce(null);
        mocks.extractDropData.mockReturnValueOnce({
            item: { id: 5, filePath: '/notes/Study.own' },
        });
        await act(async () =>
            row.dispatchEvent(new Event('drop', { bubbles: true })),
        );
        expect(mocks.stopDragging).toHaveBeenCalledOnce();
        expect(mocks.fromFilePath).toHaveBeenCalledWith('/notes/Study.own');
        expect(note.moveItemToIndex).not.toHaveBeenCalled();
        expect(note.save).not.toHaveBeenCalled();
    });

    test('dragging the row starts with this item, and a drag over it dims it until it leaves', async () => {
        await renderRow();
        const row = host.querySelector('li')!;
        await act(async () =>
            row.dispatchEvent(new MouseEvent('dragstart', { bubbles: true })),
        );
        expect(mocks.dragStart).toHaveBeenCalledWith(
            expect.anything(),
            noteItem,
        );
        const over = new MouseEvent('dragover', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => row.dispatchEvent(over));
        expect(over.defaultPrevented).toBe(true);
        expect(mocks.changeDragStyle).toHaveBeenLastCalledWith(
            expect.anything(),
            'opacity',
            '0.5',
        );
        const leave = new MouseEvent('dragleave', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => row.dispatchEvent(leave));
        expect(leave.defaultPrevented).toBe(true);
        expect(mocks.changeDragStyle).toHaveBeenLastCalledWith(
            expect.anything(),
            'opacity',
            '1',
        );
    });

    test('any other key on the opener opens nothing', async () => {
        await renderRow();
        for (const key of ['a', 'Escape', 'Tab']) {
            const event = new KeyboardEvent('keydown', {
                key,
                bubbles: true,
                cancelable: true,
            });
            await act(async () => getOpener().dispatchEvent(event));
            expect(event.defaultPrevented).toBe(false);
        }
        expect(mocks.openPopup).not.toHaveBeenCalled();
    });

    test('a note with no title says so, on the row and on its opener', async () => {
        await renderRow({ ...noteItem, title: '' });
        expect(host.textContent).toContain('No title');
        expect(getOpener().getAttribute('aria-label')).toBe(
            'Open BibleNote: No title',
        );
    });
});

describe('Bible note row: menu, drags and title editing', () => {
    function getRow() {
        return host.querySelector('li')!;
    }

    function clickButton(text: string) {
        const button = [...host.querySelectorAll('button')].find(
            (element) => element.textContent === text,
        )!;
        return act(async () => button.click());
    }

    async function openMenu() {
        await clickButton('More note actions');
        return mocks.openItemMenu.mock.calls.at(-1)![3] as any[];
    }

    async function fire(type: string) {
        const event = new Event(type, { bubbles: true, cancelable: true });
        await act(async () => {
            getRow().dispatchEvent(event);
        });
        return event;
    }

    test('its menu opens the note window on this item', async () => {
        await renderRow();
        const menuItems = await openMenu();
        expect(mocks.openItemMenu.mock.calls[0][1]).toBe(noteItem);
        expect(mocks.openItemMenu.mock.calls[0][2]).toBe(2);
        menuItems[0].onSelect();
        expect(mocks.openPopup).toHaveBeenCalledWith(
            '/bible-note?file=Study.own&id=4',
            expect.stringContaining('Study.own-4_'),
            expect.any(String),
            { width: 870 },
        );
    });

    test('an item without a live copy exports as listed', async () => {
        note.getEditingItemById.mockResolvedValue(null);
        await renderRow();
        const menuItems = await openMenu();
        await act(async () => menuItems[2].onSelect());
        expect(mocks.exportItem).toHaveBeenCalledWith(noteItem);
    });

    test('a note item from another file is left to that file row', async () => {
        await renderRow();
        mocks.extractDropData.mockReturnValueOnce({
            item: { id: 5, filePath: '/notes/Other.own' },
        });
        await fire('drop');
        mocks.extractDropData.mockReturnValueOnce({
            item: { id: 6, filePath: undefined },
        });
        await fire('drop');
        expect(mocks.stopDragging).not.toHaveBeenCalled();
        expect(mocks.fromFilePath).not.toHaveBeenCalled();
        expect(mocks.attachBackgroundDrop).not.toHaveBeenCalled();
    });

    test('a reorder in a file that cannot be read moves nothing', async () => {
        mocks.fromFilePath.mockResolvedValue(null);
        await renderRow();
        mocks.extractDropData.mockReturnValueOnce({
            item: { id: 5, filePath: '/notes/Study.own' },
        });
        await fire('drop');
        expect(mocks.stopDragging).toHaveBeenCalledOnce();
        expect(mocks.fromFilePath).toHaveBeenCalledWith('/notes/Study.own');
        expect(note.moveItemToIndex).not.toHaveBeenCalled();
        expect(note.save).not.toHaveBeenCalled();
    });

    test('dragging carries the item, and a drag over it dims the row', async () => {
        await renderRow();
        await fire('dragstart');
        expect(mocks.dragStart).toHaveBeenCalledOnce();
        expect(mocks.dragStart.mock.calls[0][1]).toBe(noteItem);
        const over = await fire('dragover');
        expect(over.defaultPrevented).toBe(true);
        expect(mocks.changeDragStyle.mock.calls.at(-1)!.slice(1)).toEqual([
            'opacity',
            '0.5',
        ]);
        const leave = await fire('dragleave');
        expect(leave.defaultPrevented).toBe(true);
        expect(mocks.changeDragStyle.mock.calls.at(-1)!.slice(1)).toEqual([
            'opacity',
            '1',
        ]);
    });

    test('a key other than Enter or Space on the opener does nothing', async () => {
        await renderRow();
        const opener = host.querySelector<HTMLElement>('[role="button"]')!;
        const event = new KeyboardEvent('keydown', {
            key: 'a',
            bubbles: true,
            cancelable: true,
        });
        await act(async () => {
            opener.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(false);
        expect(mocks.openPopup).not.toHaveBeenCalled();
    });

    test('Enter in the title editor, or leaving it, ends the editing', async () => {
        await renderRow();
        await act(async () => (await openMenu())[1].onSelect());
        expect(getRow().draggable).toBe(false);
        await clickButton('Confirm title');
        expect(getRow().draggable).toBe(true);
        expect(host.textContent).toContain('Mercy');

        await act(async () => (await openMenu())[1].onSelect());
        expect(getRow().draggable).toBe(false);
        await clickButton('Leave title');
        expect(getRow().draggable).toBe(true);
        expect(note.save).not.toHaveBeenCalled();
    });

    test('a note with no title says so', async () => {
        await renderRow({ ...noteItem, title: '' });
        expect(host.querySelector('.fst-italic')!.textContent).toBe('No title');
        expect(
            host.querySelector('[role="button"]')!.getAttribute('aria-label'),
        ).toBe('Open BibleNote: No title');
    });
});
