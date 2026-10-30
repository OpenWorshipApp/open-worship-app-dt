// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    showMenu: vi.fn(),
    confirm: vi.fn(),
    dragStart: vi.fn(),
    addDragPayload: vi.fn(),
    toVerseBibleItem: vi.fn(),
    saveBibleItem: vi.fn(),
    moveNoteItemTo: vi.fn(),
}));

vi.mock('./VerseNoteItemRenderComp.scss', () => ({}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showMenu,
}));
vi.mock('../../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ onOpening }: { onOpening: (event: unknown) => void }) => (
        <button type="button" onClick={(event) => onOpening(event)}>
            More verse actions
        </button>
    ),
}));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../../helper/FileSource', () => ({
    default: { getInstance: () => ({ name: 'Default' }) },
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
vi.mock('../../helper/dragHelpers', () => ({
    addDragPayload: mocks.addDragPayload,
    handleDragStart: mocks.dragStart,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.confirm,
}));
vi.mock('../../bible-reader/verseAnnotationActionHelpers', () => ({
    toVerseBibleItem: mocks.toVerseBibleItem,
}));
vi.mock('../../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => '',
}));
vi.mock('../bibleHelpers', () => ({ saveBibleItem: mocks.saveBibleItem }));
vi.mock('./noteItemHelpers', () => ({ toVerseBibleKey: () => null }));
vi.mock('./noteHelpers', () => ({ moveNoteItemTo: mocks.moveNoteItemTo }));
vi.mock('./RenderVerseAnnotationComp', () => ({
    default: ({ annotation }: { annotation: { id: string } }) => (
        <li>{`Mark ${annotation.id}`}</li>
    ),
}));

import VerseNoteItemRenderComp from './VerseNoteItemRenderComp';

let host: HTMLDivElement;
let root: Root;
let note: any;
let noteItem: any;

async function renderRow() {
    await act(async () =>
        root.render(
            <VerseNoteItemRenderComp
                index={0}
                noteItem={noteItem}
                filePath="/notes/Default.own"
                note={note}
            />,
        ),
    );
}

function getHeader() {
    return host.querySelector<HTMLElement>('[aria-label="John 3:16"]')!;
}

function pressOn(element: HTMLElement, key: string) {
    const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
    });
    act(() => {
        element.dispatchEvent(event);
    });
    return event;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.clearAllMocks();
    noteItem = {
        id: 3,
        title: 'John 3:16',
        verseKey: 'KJV) John 3:16',
        isOpened: false,
        highlights: [{ id: 'h1', color: 'yellow' }],
        comments: [],
        annotationCount: 1,
    };
    note = { updateAndSaveNoteItem: vi.fn() };
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('marked verse row header', () => {
    // It was a bare div: Tab never reached it and nothing said it opened.
    test('is a named, focusable button that says whether it is open', async () => {
        await renderRow();
        const header = getHeader();
        expect(header.getAttribute('role')).toBe('button');
        expect(header.tabIndex).toBe(0);
        expect(header.getAttribute('aria-expanded')).toBe('false');
        expect(host.textContent).not.toContain('Mark h1');
        await act(async () => header.click());
        expect(header.getAttribute('aria-expanded')).toBe('true');
        expect(host.textContent).toContain('Mark h1');
    });

    test('Enter and Space fold the marks open and shut, silently saved', async () => {
        await renderRow();
        const header = getHeader();
        const enter = pressOn(header, 'Enter');
        expect(header.getAttribute('aria-expanded')).toBe('true');
        expect(enter.defaultPrevented).toBe(true);
        expect(noteItem.isOpened).toBe(true);
        expect(note.updateAndSaveNoteItem).toHaveBeenLastCalledWith(
            noteItem,
            true,
        );
        const space = pressOn(header, ' ');
        expect(header.getAttribute('aria-expanded')).toBe('false');
        // Space would otherwise scroll the panel out from under it.
        expect(space.defaultPrevented).toBe(true);
        expect(noteItem.isOpened).toBe(false);
        pressOn(header, 'Escape');
        expect(header.getAttribute('aria-expanded')).toBe('false');
    });

    test('a key pressed on something inside the header is left alone', async () => {
        await renderRow();
        const header = getHeader();
        const title = [...header.querySelectorAll('div')].find(
            (element) => element.textContent === 'John 3:16',
        )!;
        const enter = pressOn(title, 'Enter');
        expect(header.getAttribute('aria-expanded')).toBe('false');
        expect(enter.defaultPrevented).toBe(false);
        expect(note.updateAndSaveNoteItem).not.toHaveBeenCalled();
    });
});

describe('marked verse row actions', () => {
    const verseBibleItem = { id: -1, bibleKey: 'KJV' };

    async function openMenu() {
        await renderRow();
        const dots = [...host.querySelectorAll('button')].find(
            (button) => button.textContent === 'More verse actions',
        )!;
        await act(async () => dots.click());
        expect(mocks.showMenu).toHaveBeenCalledTimes(1);
        return mocks.showMenu.mock.calls[0][1] as any[];
    }

    function dragRow() {
        const event = new Event('dragstart', {
            bubbles: true,
            cancelable: true,
        });
        act(() => {
            host.querySelector('li')!.dispatchEvent(event);
        });
        return event;
    }

    beforeEach(() => {
        note.deleteNoteItem = vi.fn(async () => {});
        mocks.toVerseBibleItem.mockReturnValue(verseBibleItem);
        mocks.saveBibleItem.mockResolvedValue(undefined);
    });

    test('its menu adds the verse to the Bible list, moves it, or deletes its marks', async () => {
        const items = await openMenu();
        expect(items.map((item) => item.menuElement)).toEqual([
            'Add to Bible List',
            'Move To',
            'Delete',
        ]);
        await items[0].onSelect();
        expect(mocks.toVerseBibleItem).toHaveBeenCalledWith('KJV) John 3:16');
        expect(mocks.saveBibleItem).toHaveBeenCalledWith(verseBibleItem);

        const moveEvent = { type: 'click' };
        items[1].onSelect(moveEvent);
        expect(mocks.moveNoteItemTo).toHaveBeenCalledWith(
            moveEvent,
            note,
            noteItem,
        );
    });

    test('a right-click opens the same menu', async () => {
        await renderRow();
        act(() => {
            host.querySelector('li')!.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(mocks.showMenu).toHaveBeenCalledTimes(1);
        expect(mocks.showMenu.mock.calls[0][1]).toHaveLength(3);
    });

    test('a verse that names no verse is not added to the Bible list', async () => {
        noteItem.verseKey = undefined;
        mocks.toVerseBibleItem.mockReturnValue(null);
        const items = await openMenu();
        await items[0].onSelect();
        expect(mocks.toVerseBibleItem).toHaveBeenCalledWith('');
        expect(mocks.saveBibleItem).not.toHaveBeenCalled();
    });

    test('Delete removes every mark on the verse, only once confirmed', async () => {
        const items = await openMenu();
        mocks.confirm.mockResolvedValueOnce(false);
        await items[2].onSelect();
        expect(mocks.confirm).toHaveBeenCalledWith(
            'Delete Verse Marks',
            'Are you sure to delete all marks on this verse?',
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        expect(note.deleteNoteItem).not.toHaveBeenCalled();
        mocks.confirm.mockResolvedValueOnce(true);
        await items[2].onSelect();
        expect(note.deleteNoteItem).toHaveBeenCalledWith(noteItem);
    });

    test('dragging carries the verse for the Bible list and the item for a note file', async () => {
        await renderRow();
        const event = dragRow();
        expect(event.defaultPrevented).toBe(false);
        expect(mocks.dragStart).toHaveBeenCalledTimes(1);
        expect(mocks.dragStart.mock.calls[0][1]).toBe(verseBibleItem);
        expect(mocks.addDragPayload).toHaveBeenCalledTimes(1);
        expect(mocks.addDragPayload.mock.calls[0][1]).toBe(noteItem);
    });

    test('a verse that cannot be resolved cannot be dragged', async () => {
        mocks.toVerseBibleItem.mockReturnValue(null);
        await renderRow();
        const event = dragRow();
        expect(event.defaultPrevented).toBe(true);
        expect(mocks.dragStart).not.toHaveBeenCalled();
        expect(mocks.addDragPayload).not.toHaveBeenCalled();
    });

    test('opened, it lists the comments after the highlights', async () => {
        noteItem.isOpened = true;
        noteItem.comments = [{ id: 'c1', comment: 'Love' }];
        noteItem.annotationCount = 2;
        await renderRow();
        expect(
            [...host.querySelectorAll('.app-verse-annotation-list li')].map(
                (item) => item.textContent,
            ),
        ).toEqual(['Mark h1', 'Mark c1']);
        // Open, the marks are their own count.
        expect(host.querySelector('.app-verse-note-item__count')).toBeNull();
    });
});
