// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    appProvider: { isPagePresenter: false, isPageReader: true },
    fromFilePath: vi.fn(),
    useFileSourceRefreshEvents: vi.fn(),
    genRemovingAttachedBackgroundMenu: vi.fn(),
    handleDragStart: vi.fn(),
    handleAttachBackgroundDrop: vi.fn(),
    extractDropData: vi.fn(),
    handleBibleItemSelecting: vi.fn(),
    changeDragEventStyle: vi.fn(),
    stopDraggingState: vi.fn(),
    getAttachedBackground: vi.fn(),
    improveBibleItemTitleOnHover: vi.fn(),
    openBibleItemContextMenu: vi.fn(),
    isOnScreen: false,
    showBibleLookupPopup: null as null | (() => void),
    viewController: null as any,
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('./Bible', () => ({ default: { fromFilePath: h.fromFilePath } }));
vi.mock('../others/ItemReadErrorComp', () => ({
    default: ({ onContextMenu }: { onContextMenu: (event: any) => void }) => (
        <div className="read-error" onContextMenu={onContextMenu}>
            Unreadable
        </div>
    ),
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceRefreshEvents: h.useFileSourceRefreshEvents,
}));
vi.mock('../helper/dragHelpers', () => ({
    genRemovingAttachedBackgroundMenu: h.genRemovingAttachedBackgroundMenu,
    handleDragStart: h.handleDragStart,
    handleAttachBackgroundDrop: h.handleAttachBackgroundDrop,
    extractDropData: h.extractDropData,
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ onOpening }: { onOpening: (event: any) => void }) => (
        <button type="button" className="dots" onClick={onOpening}>
            More
        </button>
    ),
}));
vi.mock('../others/ItemColorNoteComp', () => ({ default: () => null }));
vi.mock('../bible-lookup/BibleKeySelectionComp', () => ({
    BibleKeySelectionMiniComp: ({
        bibleKey,
        onBibleKeyChange,
    }: {
        bibleKey: string;
        onBibleKeyChange: (
            isContextMenu: boolean,
            oldBibleKey: string,
            newBibleKey: string,
        ) => void;
    }) => (
        <button
            type="button"
            className="bible-key"
            onClick={() => onBibleKeyChange(false, bibleKey, 'NIV')}
        >
            {bibleKey}
        </button>
    ),
}));
vi.mock('../_screen/managers/ScreenLongTextManager', () => ({
    default: { handleBibleItemSelecting: h.handleBibleItemSelecting },
}));
vi.mock('../others/commonButtons', () => ({
    useToggleBibleLookupPopupContext: () => h.showBibleLookupPopup,
}));
vi.mock('../server/appProvider', () => ({ default: h.appProvider }));
vi.mock('../helper/DragInf', () => ({
    DragTypeEnum: { BIBLE_ITEM: 'bibleItem', BACKGROUND_COLOR: 'color' },
}));
vi.mock('../helper/helpers', () => ({
    changeDragEventStyle: h.changeDragEventStyle,
    stopDraggingState: h.stopDraggingState,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../bible-reader/BibleViewTitleEditorComp', () => ({
    default: ({
        onTargetChange,
    }: {
        onTargetChange: (target: unknown) => Promise<void>;
    }) => (
        <button
            type="button"
            className="title-editor"
            onClick={() =>
                onTargetChange({
                    bookKey: 'MRK',
                    chapter: 5,
                    verseStart: 1,
                    verseEnd: 2,
                })
            }
        >
            Mark 4:39
        </button>
    ),
}));
vi.mock('../bible-reader/BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => h.viewController,
}));
vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: { getAttachedBackground: h.getAttachedBackground },
}));
vi.mock('../others/AttachBackgroundIconComp', () => ({ default: () => null }));
vi.mock('./bibleHelpers', () => ({
    improveBibleItemTitleOnHover: h.improveBibleItemTitleOnHover,
    openBibleItemContextMenu: h.openBibleItemContextMenu,
    useIsOnScreen: () => h.isOnScreen,
}));
vi.mock('../helper/FileSource', () => ({
    default: { getInstance: () => ({ name: 'Default' }) },
}));
vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => 'serif',
}));
vi.mock('../others/AppSuspenseComp', async () => {
    const { Suspense } = await import('react');
    return {
        default: ({ children }: { children: any }) => (
            <Suspense fallback={<span>Loading slides</span>}>
                {children}
            </Suspense>
        ),
    };
});
vi.mock('../helper/ai/bibleItemChatbotMenuHelpers', () => ({
    genOpenInChatbotContextMenu: () => [],
}));
vi.mock('./BibleSlidesPopupComp', () => ({
    default: ({
        bibleItem,
        onClose,
    }: {
        bibleItem: { id: number };
        onClose: () => void;
    }) => (
        <div className="slides-popup">
            {`Slides for ${bibleItem.id}`}
            <button type="button" onClick={onClose}>
                Close slides
            </button>
        </div>
    ),
}));

import BibleItemRenderComp from './BibleItemRenderComp';

const FILE_PATH = 'C:/data/bibles/Default.owb';

let host: HTMLDivElement;
let root: Root;
let bibleItem: any;
let bible: any;

function genBibleItem(extra: object = {}) {
    const item: any = {
        id: 1,
        bibleKey: 'KJV',
        isError: false,
        filePath: FILE_PATH,
        target: { bookKey: 'MRK', chapter: 4, verseStart: 39, verseEnd: 39 },
        toVerseFullKey: () => 'MRK 4:39',
        save: vi.fn(),
        ...extra,
    };
    item.clone = () => ({ ...item, id: 101 });
    return item;
}

async function renderRow(warningMessage?: string) {
    await act(async () => {
        root.render(
            <BibleItemRenderComp
                index={2}
                bibleItem={bibleItem}
                warningMessage={warningMessage}
                filePath={FILE_PATH}
            />,
        );
    });
}

function getRow() {
    return host.querySelector<HTMLLIElement>('li')!;
}

async function fire(element: Element, type: string) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    await act(async () => {
        element.dispatchEvent(event);
    });
    return event;
}

async function openMenu() {
    await fire(getRow(), 'contextmenu');
    expect(h.openBibleItemContextMenu).toHaveBeenCalledTimes(1);
    return h.openBibleItemContextMenu.mock.calls[0];
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.appProvider.isPagePresenter = false;
    h.appProvider.isPageReader = true;
    h.isOnScreen = false;
    h.showBibleLookupPopup = null;
    h.viewController = {
        isLookup: false,
        straightBibleItems: [] as unknown[],
        selectedBibleItem: { id: 9 },
        addBibleItem: vi.fn(),
        addBibleItemRight: vi.fn(),
        setLookupContentFromBibleItem: vi.fn(),
    };
    bible = {
        getItemIndex: vi.fn(() => 4),
        moveItemToIndex: vi.fn(),
        save: vi.fn(),
    };
    bibleItem = genBibleItem();
    h.fromFilePath.mockResolvedValue(bible);
    h.getAttachedBackground.mockResolvedValue(null);
    h.genRemovingAttachedBackgroundMenu.mockReturnValue([
        { menuElement: 'Remove Background' },
    ]);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('a saved passage row', () => {
    test('is keyed by its file and id, refreshed on select, and marked when on air', async () => {
        h.isOnScreen = true;
        await renderRow('Duplicated with item 1');
        const row = getRow();
        expect(row.dataset.bibleItemId).toBe('Default-1');
        expect(row.dataset.index).toBe('3');
        expect(row.classList.contains('app-cue-on-air')).toBe(true);
        expect(row.querySelector('.app-on-screen')).not.toBeNull();
        expect(h.useFileSourceRefreshEvents).toHaveBeenCalledWith(
            ['select'],
            FILE_PATH,
        );
        expect(h.improveBibleItemTitleOnHover).toHaveBeenCalledWith(
            'KJV',
            'MRK 4:39',
            row,
        );
        const warning = row.querySelector<HTMLElement>('.float-end')!;
        expect(warning.title).toBe('Duplicated with item 1');
    });

    test('an unreadable item still has its menu', async () => {
        bibleItem = genBibleItem({ isError: true });
        await renderRow();
        expect(getRow()).toBeNull();
        await fire(host.querySelector('.read-error')!, 'contextmenu');
        expect(h.openBibleItemContextMenu).toHaveBeenCalledTimes(1);
        expect(h.openBibleItemContextMenu.mock.calls[0][1]).toBe(bibleItem);
    });

    test('a double-click in the Reader opens it as the first passage when none is open', async () => {
        await renderRow();
        await fire(getRow(), 'dblclick');
        expect(h.viewController.addBibleItem).toHaveBeenCalledWith(
            null,
            bibleItem,
            false,
            false,
            false,
        );
        expect(h.viewController.addBibleItemRight).not.toHaveBeenCalled();
    });

    test('a double-click in the Reader opens it beside the last passage', async () => {
        const last = { id: 'last' };
        h.viewController.straightBibleItems = [{ id: 'first' }, last];
        await renderRow();
        await fire(getRow(), 'dblclick');
        expect(h.viewController.addBibleItemRight).toHaveBeenCalledWith(
            last,
            bibleItem,
            true,
        );
        expect(h.viewController.addBibleItem).not.toHaveBeenCalled();
    });

    test('a double-click on a page that is neither does nothing', async () => {
        h.appProvider.isPageReader = false;
        await renderRow();
        await fire(getRow(), 'dblclick');
        expect(h.viewController.addBibleItem).not.toHaveBeenCalled();
        expect(h.handleBibleItemSelecting).not.toHaveBeenCalled();
    });

    test('its menu opens it, and lists a background to remove when one is attached', async () => {
        h.getAttachedBackground.mockResolvedValue({ src: 'bg.png' });
        const showLookup = vi.fn();
        h.showBibleLookupPopup = showLookup;
        await renderRow();
        const [, item, index, showBibleLookupPopup, menuItems] =
            await openMenu();
        expect(item).toBe(bibleItem);
        expect(index).toBe(2);
        expect(showBibleLookupPopup).toBe(showLookup);
        expect(h.getAttachedBackground).toHaveBeenCalledWith(FILE_PATH, 1);
        expect(h.genRemovingAttachedBackgroundMenu).toHaveBeenCalledWith(
            FILE_PATH,
            1,
        );
        expect(menuItems.map((menuItem: any) => menuItem.menuElement)).toEqual([
            'Open',
            'Remove Background',
        ]);
        menuItems[0].onSelect({ shiftKey: false });
        expect(h.viewController.addBibleItem).toHaveBeenCalledWith(
            null,
            bibleItem,
            false,
            false,
            false,
        );
    });

    test('in the Presenter its menu generates slides from a copy, in a popup that closes', async () => {
        h.appProvider.isPagePresenter = true;
        await renderRow();
        const [, , , , menuItems] = await openMenu();
        expect(menuItems.map((menuItem: any) => menuItem.menuElement)).toEqual([
            'Open',
            'Generate Slides',
        ]);
        await act(async () => menuItems[1].onSelect());
        await vi.waitFor(() => {
            expect(host.querySelector('.slides-popup')).not.toBeNull();
        });
        expect(host.querySelector('.slides-popup')!.textContent).toContain(
            'Slides for 101',
        );
        const close = [...host.querySelectorAll('button')].find(
            (button) => button.textContent === 'Close slides',
        )!;
        await act(async () => close.click());
        expect(host.querySelector('.slides-popup')).toBeNull();

        menuItems[0].onSelect({ shiftKey: false });
        expect(h.handleBibleItemSelecting).toHaveBeenCalledWith(
            { shiftKey: false },
            bibleItem,
        );
    });

    test('changing its Bible saves the item into its list', async () => {
        await renderRow();
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.bible-key')!.click(),
        );
        await vi.waitFor(() => expect(bibleItem.save).toHaveBeenCalled());
        expect(h.fromFilePath).toHaveBeenCalledWith(FILE_PATH);
        expect(bibleItem.bibleKey).toBe('NIV');
        expect(bibleItem.save).toHaveBeenCalledWith(bible);
    });

    test('changing its passage saves the new target into its list', async () => {
        await renderRow();
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.title-editor')!.click(),
        );
        await vi.waitFor(() => expect(bibleItem.save).toHaveBeenCalled());
        expect(bibleItem.target).toEqual({
            bookKey: 'MRK',
            chapter: 5,
            verseStart: 1,
            verseEnd: 2,
        });
        expect(bibleItem.save).toHaveBeenCalledWith(bible);
    });

    test('an item with no list, or a list that cannot be read, is not changed', async () => {
        bibleItem = genBibleItem({ filePath: undefined });
        await renderRow();
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.bible-key')!.click(),
        );
        expect(h.fromFilePath).not.toHaveBeenCalled();
        expect(bibleItem.bibleKey).toBe('KJV');

        bibleItem = genBibleItem();
        h.fromFilePath.mockResolvedValue(null);
        await renderRow();
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.title-editor')!.click(),
        );
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.bible-key')!.click(),
        );
        expect(h.fromFilePath).toHaveBeenCalledTimes(2);
        expect(bibleItem.save).not.toHaveBeenCalled();
        expect(bibleItem.bibleKey).toBe('KJV');
        expect(bibleItem.target.chapter).toBe(4);
    });

    test('dragging it carries the item, and a hover over it dims it', async () => {
        await renderRow();
        const row = getRow();
        await fire(row, 'dragstart');
        expect(h.handleDragStart).toHaveBeenCalledTimes(1);
        expect(h.handleDragStart.mock.calls[0][1]).toBe(bibleItem);

        const over = await fire(row, 'dragover');
        expect(over.defaultPrevented).toBe(true);
        expect(h.changeDragEventStyle.mock.calls[0].slice(1)).toEqual([
            'opacity',
            '0.5',
        ]);
        const leave = await fire(row, 'dragleave');
        expect(leave.defaultPrevented).toBe(true);
        expect(h.changeDragEventStyle.mock.calls[1].slice(1)).toEqual([
            'opacity',
            '1',
        ]);
    });

    test('a passage dropped from the same list moves to this row', async () => {
        const dropped = { id: 3, filePath: FILE_PATH };
        h.extractDropData.mockReturnValue({ type: 'bibleItem', item: dropped });
        await renderRow();
        await fire(getRow(), 'drop');
        await vi.waitFor(() => expect(bible.save).toHaveBeenCalled());
        expect(h.stopDraggingState).toHaveBeenCalledTimes(1);
        expect(bible.getItemIndex).toHaveBeenCalledWith(bibleItem);
        expect(bible.moveItemToIndex).toHaveBeenCalledWith(dropped, 4);
        expect(h.handleAttachBackgroundDrop).not.toHaveBeenCalled();
    });

    test('a passage from elsewhere is left to the file row, and an unreadable list moves nothing', async () => {
        h.extractDropData.mockReturnValue({
            type: 'bibleItem',
            item: { id: 3, filePath: 'C:/data/bibles/Other.owb' },
        });
        await renderRow();
        await fire(getRow(), 'drop');
        h.extractDropData.mockReturnValue({
            type: 'bibleItem',
            item: { id: 4, filePath: undefined },
        });
        await fire(getRow(), 'drop');
        expect(h.stopDraggingState).not.toHaveBeenCalled();
        expect(h.fromFilePath).not.toHaveBeenCalled();

        h.fromFilePath.mockResolvedValue(null);
        h.extractDropData.mockReturnValue({
            type: 'bibleItem',
            item: { id: 5, filePath: FILE_PATH },
        });
        await fire(getRow(), 'drop');
        expect(h.stopDraggingState).toHaveBeenCalledTimes(1);
        expect(h.fromFilePath).toHaveBeenCalledWith(FILE_PATH);
        expect(bible.moveItemToIndex).not.toHaveBeenCalled();
    });

    test('anything else dropped on it is attached as its background', async () => {
        h.extractDropData.mockReturnValue({ type: 'color', item: '#fff' });
        await renderRow();
        await fire(getRow(), 'drop');
        expect(h.handleAttachBackgroundDrop).toHaveBeenCalledTimes(1);
        expect(h.handleAttachBackgroundDrop.mock.calls[0][1]).toEqual({
            filePath: FILE_PATH,
            id: 1,
        });
        expect(h.changeDragEventStyle.mock.calls[0].slice(1)).toEqual([
            'opacity',
            '1',
        ]);
    });
});
