// @vitest-environment jsdom

import { act, Suspense, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type Note from './Note';

const h = vi.hoisted(() => ({
    fromFilePath: vi.fn(),
    setIsOpened: vi.fn(),
    addAndSave: vi.fn(),
    moveFrom: vi.fn(),
    empty: vi.fn(),
    save: vi.fn(),
    copy: vi.fn(),
    moveTo: vi.fn(),
    exportNote: vi.fn(),
    importItem: vi.fn(),
    confirm: vi.fn(async () => true),
    stopDragging: vi.fn(),
    attachDrop: vi.fn(),
    onFileUpdate: null as null | (() => Promise<void>),
    dropped: null as null | {
        item: { filePath?: string; metadata?: { id: number } };
    },
    hasBackground: false,
}));

vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('./Note', () => ({ default: { fromFilePath: h.fromFilePath } }));
vi.mock('./NoteItem', () => ({
    default: class NoteItemMock {
        static genNewJsonData() {
            return { metadata: { id: 0 } };
        }
        metadata: { id: number };
        constructor(json: { metadata: { id: number } }) {
            this.metadata = json.metadata;
        }
    },
}));
vi.mock('../../helper/FileSource', () => ({
    default: { getInstance: () => ({ name: 'Default' }) },
}));
vi.mock('../../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffectAsync: (
            callback: (context: {
                setData: (note: Note | null) => void;
            }) => Promise<void>,
            deps: unknown[],
            context: { setData: (note: Note | null) => void },
        ) =>
            useEffect(() => {
                void callback(context);
            }, deps),
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (_events: string[], callback: () => Promise<void>) => {
        h.onFileUpdate = callback;
    },
}));
vi.mock('../../helper/dragHelpers', () => ({
    useAttachedBackgroundData: () => (h.hasBackground ? {} : null),
    extractDropDataOfType: () => h.dropped,
    handleAttachBackgroundDrop: h.attachDrop,
    genRemovingAttachedBackgroundMenu: () => [
        { menuElement: 'Remove background', onSelect: vi.fn() },
    ],
}));
vi.mock('../../helper/helpers', () => ({ stopDraggingState: h.stopDragging }));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => name,
}));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: h.confirm,
}));
vi.mock('../../server/appHelpers', () => ({ copyToClipboard: h.copy }));
vi.mock('./bibleNoteArchiveHelpers', () => ({ exportBibleNote: h.exportNote }));
vi.mock('./bibleNoteItemArchiveHelpers', () => ({
    selectAndImportBibleNoteItemArchive: h.importItem,
}));
vi.mock('./noteHelpers', () => ({ moveNoteItemTo: h.moveTo }));
vi.mock('../../others/AppSuspenseComp', () => ({
    default: ({ children }: { children: ReactNode }) => (
        <Suspense fallback={<span>Loading items</span>}>{children}</Suspense>
    ),
}));
vi.mock('./RenderNoteItemsComp', () => ({
    default: ({ note }: { note: Note }) => (
        <ul data-note-items>
            {note.items.map((item, index) => (
                <li key={index}>{item.content}</li>
            ))}
        </ul>
    ),
}));
vi.mock('../../others/AttachBackgroundIconComp', () => ({
    default: () => null,
}));
vi.mock('../../others/FileItemHandlerComp', () => ({
    default: ({
        fileData,
        renderChild,
        contextMenuItems,
        onDrop,
        reload,
    }: {
        fileData?: Note | null;
        renderChild: (note: Note) => React.ReactNode;
        contextMenuItems: {
            menuElement: string;
            onSelect: (event: Event) => void;
        }[];
        onDrop: (event: Event) => void;
        reload: () => void;
    }) => (
        <div>
            {fileData ? renderChild(fileData) : <span>Loading note</span>}
            {contextMenuItems.map((item) => (
                <button
                    key={item.menuElement}
                    type="button"
                    onClick={(event) => item.onSelect(event.nativeEvent)}
                >
                    {item.menuElement}
                </button>
            ))}
            <button
                type="button"
                onClick={(event) => onDrop(event.nativeEvent)}
            >
                Drop
            </button>
            <button type="button" onClick={reload}>
                Reload
            </button>
        </div>
    ),
}));

import NoteFileComp from './NoteFileComp';

describe('NoteFileComp', () => {
    let container: HTMLDivElement;
    let root: Root;
    let note: Note;
    const filePath = '/notes/Default.own';

    async function renderFile() {
        await act(async () =>
            root.render(<NoteFileComp index={0} filePath={filePath} />),
        );
    }

    async function click(label: string) {
        const button = [...container.querySelectorAll('button')].find(
            (element) => element.textContent === label,
        );
        if (!button) throw new Error(`Missing button: ${label}`);
        await act(async () => button.click());
    }

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        vi.clearAllMocks();
        h.confirm.mockResolvedValue(true);
        h.dropped = null;
        h.hasBackground = false;
        h.onFileUpdate = null;
        note = {
            filePath,
            isOpened: false,
            maxItemId: 5,
            items: [{ content: 'one' }, { content: 'two' }],
            setIsOpened: h.setIsOpened,
            addAndSaveNoteItem: h.addAndSave,
            moveItemFrom: h.moveFrom,
            empty: h.empty,
            save: h.save,
        } as unknown as Note;
        h.fromFilePath.mockResolvedValue(note);
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    test('loads a note and opens its row by click or keyboard', async () => {
        await renderFile();
        expect(h.fromFilePath).toHaveBeenCalledWith(filePath);
        const row = container.querySelector<HTMLElement>(
            '[aria-label="Default"]',
        )!;
        expect(row.getAttribute('aria-expanded')).toBe('false');
        await act(async () => row.click());
        expect(h.setIsOpened).toHaveBeenCalledWith(true);
        await act(async () =>
            row.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            ),
        );
        expect(h.setIsOpened).toHaveBeenCalledTimes(2);
        await act(async () =>
            row.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
            ),
        );
        expect(h.setIsOpened).toHaveBeenCalledTimes(2);
    });

    test('file menu copies, moves, imports, exports, and confirms before emptying', async () => {
        await renderFile();
        await click('Copy All Items');
        expect(h.copy).toHaveBeenCalledWith('one\n\ntwo');
        await click('Move All Items To');
        expect(h.moveTo).toHaveBeenCalledWith(expect.any(Event), note);
        await click('Import');
        expect(h.importItem).toHaveBeenCalledWith(note);
        await click('Export');
        expect(h.exportNote).toHaveBeenCalledWith(filePath);
        h.confirm.mockResolvedValueOnce(false);
        await click('Empty');
        expect(h.empty).not.toHaveBeenCalled();
        await click('Empty');
        expect(h.empty).toHaveBeenCalledOnce();
        expect(h.save).toHaveBeenCalledOnce();
    });

    test('new item and typed drops take different document paths', async () => {
        await renderFile();
        await click('New Note Item');
        expect(h.addAndSave.mock.lastCall?.[0].metadata.id).toBe(6);
        h.dropped = { item: { metadata: { id: 8 } } };
        await click('Drop');
        expect(h.stopDragging).toHaveBeenCalledOnce();
        expect(h.addAndSave).toHaveBeenCalledTimes(2);
        h.dropped = {
            item: { filePath: '/notes/Other.own', metadata: { id: 9 } },
        };
        await click('Drop');
        expect(h.moveFrom).toHaveBeenCalledWith(
            '/notes/Other.own',
            h.dropped.item,
        );
        h.dropped = null;
        await click('Drop');
        expect(h.attachDrop).toHaveBeenCalledWith(expect.any(Event), {
            filePath,
        });
    });

    test('an opened note offers an add shortcut and background removal', async () => {
        (note as unknown as { isOpened: boolean }).isOpened = true;
        h.hasBackground = true;
        await renderFile();
        expect(
            container.querySelector('[aria-expanded="true"]'),
        ).not.toBeNull();
        expect(container.textContent).toContain('Remove background');
        const add = container.querySelector<HTMLElement>(
            '[aria-label="New Note Item"]',
        )!;
        await act(async () => add.click());
        expect(h.addAndSave).toHaveBeenCalledOnce();
    });

    function pressKey(element: HTMLElement, key: string) {
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

    async function waitFor(check: () => boolean, what: string) {
        const deadline = performance.now() + 5_000;
        while (!check()) {
            if (performance.now() > deadline) {
                throw new Error(`Timed out waiting for ${what}`);
            }
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
            });
        }
    }

    test('an opened note lists its items once the list has loaded', async () => {
        (note as unknown as { isOpened: boolean }).isOpened = true;
        await renderFile();
        await waitFor(
            () => container.querySelector('[data-note-items]') !== null,
            'the note items',
        );
        expect(
            [...container.querySelectorAll('[data-note-items] li')].map(
                (row) => row.textContent,
            ),
        ).toEqual(['one', 'two']);
    });

    test('the add shortcut answers Enter and Space only, and keeps them off the header', async () => {
        (note as unknown as { isOpened: boolean }).isOpened = true;
        await renderFile();
        const add = container.querySelector<HTMLElement>(
            '[aria-label="New Note Item"]',
        )!;
        const other = pressKey(add, 'a');
        expect(other.defaultPrevented).toBe(false);
        expect(h.addAndSave).not.toHaveBeenCalled();
        const enter = pressKey(add, 'Enter');
        expect(enter.defaultPrevented).toBe(true);
        expect(h.addAndSave).toHaveBeenCalledOnce();
        expect(h.addAndSave.mock.lastCall?.[0].metadata.id).toBe(6);
        const space = pressKey(add, ' ');
        expect(space.defaultPrevented).toBe(true);
        expect(h.addAndSave).toHaveBeenCalledTimes(2);
        // Had either key reached the header, it would have folded the note
        // shut on the item just added.
        expect(h.setIsOpened).not.toHaveBeenCalled();
    });

    test('Reload drops the note and shows the file as read again', async () => {
        await renderFile();
        expect(container.textContent).toContain('Copy All Items');
        let finishReading: (value: Note) => void = () => undefined;
        h.fromFilePath.mockReturnValueOnce(
            new Promise<Note>((resolve) => {
                finishReading = resolve;
            }),
        );
        await click('Reload');
        expect(container.textContent).toContain('Loading note');
        expect(h.fromFilePath).toHaveBeenCalledTimes(2);
        expect(h.fromFilePath).toHaveBeenLastCalledWith(filePath);
        const emptied = { ...note, items: [] } as unknown as Note;
        await act(async () => finishReading(emptied));
        expect(container.textContent).not.toContain('Loading note');
        // Read again, the note holds nothing, so nothing is offered to copy.
        expect(container.textContent).not.toContain('Copy All Items');
        expect(container.textContent).toContain('New Note Item');
    });

    test('a file update shows the note as it now reads on disk', async () => {
        await renderFile();
        const updated = {
            ...note,
            items: [{ content: 'three' }],
        } as unknown as Note;
        h.fromFilePath.mockResolvedValueOnce(updated);
        await act(async () => h.onFileUpdate!());
        expect(h.fromFilePath).toHaveBeenCalledTimes(2);
        expect(h.fromFilePath).toHaveBeenLastCalledWith(filePath);
        await click('Copy All Items');
        expect(h.copy).toHaveBeenCalledWith('three');
    });
});
