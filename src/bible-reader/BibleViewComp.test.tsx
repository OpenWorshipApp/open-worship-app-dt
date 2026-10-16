// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        controller: null as any,
        editingResult: null as any,
        movedCheck: null as any,
    },
    mocks: {
        applyDropped: vi.fn(),
        removeDraggingClass: vi.fn(),
        showMenu: vi.fn(),
        getSelectedText: vi.fn(),
        setRecentSearch: vi.fn(),
        bringToView: vi.fn(),
        register: vi.fn(),
        unregister: vi.fn(),
        followFrame: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('./BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => state.controller,
}));
vi.mock('./readBibleHelpers', () => ({
    applyDropped: mocks.applyDropped,
    genDraggingClass: () => 'test-dragging',
    removeDraggingClass: mocks.removeDraggingClass,
}));
vi.mock('../bible-list/bibleItemHelpers', () => ({
    genBibleItemCopyingContextMenu: () => [{ menuElement: 'Copy passage' }],
}));
vi.mock('../scrolling/ScrollingHandlerComp', () => ({
    default: ({ onAutoScrollFrame, movedCheck }: any) => {
        state.movedCheck = movedCheck;
        return (
            <button type="button" onClick={onAutoScrollFrame}>
                Follow scroll
            </button>
        );
    },
}));
vi.mock('../bible-lookup/RenderBibleLookupBodyComp', () => ({
    default: () => <div>Lookup choices</div>,
}));
vi.mock('./LookupBibleItemController', () => ({
    default: class LookupBibleItemController {
        isLookup = true;
        genNoPassageContextMenu = vi.fn(() => [{ menuElement: 'Split view' }]);
        genContextMenu = vi.fn(async () => [{ menuElement: 'View option' }]);
        openBibleSearch = vi.fn();
        setIsAdvanceLookupOpened = vi.fn();
        getColorNote = vi.fn(() => null);
        getIsGroupScrollSynced = vi.fn(() => false);
        getVerseElements = vi.fn(() => []);
        getBibleItemsByColorNote = vi.fn(() => []);
        groupScrollSync = {
            register: mocks.register,
            followFrame: mocks.followFrame,
        };
    },
    useEditingResult: () => state.editingResult,
}));
vi.mock('../helper/bibleViewHelpers', () => ({
    useBibleViewFontSizeContext: () => 24,
}));
vi.mock('../helper/helpers', () => ({
    bringDomToNearestView: mocks.bringToView,
    checkIsVerticalPartialVisible: () => true,
    HIGHLIGHT_SELECTED_CLASSNAME: 'selected-view',
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showMenu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../helper/textSelectionHelpers', () => ({
    getSelectedText: mocks.getSelectedText,
}));
vi.mock('../bible-find/BibleFindHeaderComp', () => ({
    setBibleFindRecentSearch: mocks.setRecentSearch,
}));
vi.mock('./view-extra/BibleViewTextComp', () => ({
    default: ({ bibleItem }: any) => <div>Passage {bibleItem.id}</div>,
}));
vi.mock('./view-extra/BibleViewHeaderComp', () => ({
    default: ({ bibleItem }: any) => <div>Header {bibleItem.id}</div>,
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

import LookupBibleItemController from './LookupBibleItemController';
import BibleViewComp from './BibleViewComp';

let host: HTMLDivElement;
let root: Root;
const bibleItem = { id: 'first' } as any;

function makeController() {
    return {
        isLookup: false,
        getColorNote: vi.fn(() => 'red'),
        getIsGroupScrollSynced: vi.fn(() => false),
        getVerseElements: vi.fn(() => []),
        getBibleItemsByColorNote: vi.fn(() => []),
        genContextMenu: vi.fn(async () => [{ menuElement: 'View option' }]),
        groupScrollSync: {
            register: mocks.register,
            followFrame: mocks.followFrame,
        },
    };
}

function card() {
    return host.querySelector<HTMLDivElement>('.bible-view')!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.clearAllMocks();
    state.controller = makeController();
    state.editingResult = null;
    state.movedCheck = null;
    mocks.register.mockReturnValue(mocks.unregister);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('Bible view', () => {
    test('keeps its id stable and registers synchronized scrolling before paint', async () => {
        state.controller.getIsGroupScrollSynced.mockReturnValue(true);
        await act(async () =>
            root.render(<BibleViewComp bibleItem={bibleItem} />),
        );
        const firstId = card().id;
        expect(firstId).toMatch(/^uuid-/);
        expect(host.textContent).toContain('Passage first');
        expect(mocks.register).toHaveBeenCalledWith(
            card().querySelector('.card-body'),
            'red',
        );
        await act(async () =>
            root.render(<BibleViewComp bibleItem={bibleItem} />),
        );
        expect(card().id).toBe(firstId);
        await act(async () =>
            [...host.querySelectorAll('button')]
                .find((button) => button.textContent === 'Follow scroll')!
                .click(),
        );
        expect(mocks.followFrame).toHaveBeenCalledWith(
            card().querySelector('.card-body'),
        );
        await act(async () => root.unmount());
        expect(mocks.unregister).toHaveBeenCalledOnce();
        root = createRoot(host);
    });

    test('marks an allowed drag target and applies a drop to its current passage', async () => {
        await act(async () =>
            root.render(<BibleViewComp bibleItem={bibleItem} />),
        );
        const view = card();
        const dragOver = new Event('dragover', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => view.dispatchEvent(dragOver));
        expect(dragOver.defaultPrevented).toBe(true);
        expect(view.classList.contains('test-dragging')).toBe(true);
        expect(mocks.removeDraggingClass).toHaveBeenCalled();

        view.dataset.doNotAllowDrop = '1';
        mocks.removeDraggingClass.mockClear();
        const refused = new Event('dragover', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => view.dispatchEvent(refused));
        expect(refused.defaultPrevented).toBe(false);
        expect(mocks.removeDraggingClass).not.toHaveBeenCalled();
        view.dataset.doNotAllowDrop = '0';

        await act(async () =>
            view.dispatchEvent(new Event('drop', { bubbles: true })),
        );
        expect(mocks.applyDropped).toHaveBeenCalledWith(
            expect.anything(),
            state.controller,
            bibleItem,
        );
        await act(async () =>
            view.dispatchEvent(new Event('dragleave', { bubbles: true })),
        );
        expect(mocks.removeDraggingClass).toHaveBeenCalled();
    });

    test('offers selected-text search from a lookup passage context menu', async () => {
        const controller = new LookupBibleItemController() as any;
        state.controller = controller;
        mocks.getSelectedText.mockReturnValue('grace');
        await act(async () =>
            root.render(<BibleViewComp bibleItem={bibleItem} />),
        );
        await act(async () =>
            card().dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            ),
        );
        const [, items, options] = mocks.showMenu.mock.calls.at(-1)!;
        expect(items.map((item: any) => item.menuElement)).toEqual([
            'Copy passage',
            'View option',
        ]);
        expect(options.shouldHandleSelectedText).toBe(true);
        await act(async () =>
            options.extraSelectedTextContextMenuItems[0].onSelect(),
        );
        expect(mocks.setRecentSearch).toHaveBeenCalledWith('grace');
        expect(controller.openBibleSearch).toHaveBeenCalledWith('s');
        expect(controller.setIsAdvanceLookupOpened).toHaveBeenCalledWith(true);
    });

    test('offers the no-passage menu while editing book selection', async () => {
        const controller = new LookupBibleItemController() as any;
        state.controller = controller;
        state.editingResult = { result: { bibleItem: null, bookKey: 'GEN' } };
        await act(async () =>
            root.render(<BibleViewComp bibleItem={bibleItem} isEditing />),
        );
        expect(card().classList.contains('selected-view')).toBe(true);
        expect(host.textContent).toContain('Lookup choices');
        expect(host.textContent).not.toContain('Passage first');
        await act(async () =>
            card().dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            ),
        );
        expect(controller.genNoPassageContextMenu).toHaveBeenCalledWith(
            'GEN',
            expect.any(String),
        );
        expect(mocks.showMenu.mock.calls.at(-1)?.[1]).toEqual([
            { menuElement: 'Split view' },
        ]);
    });

    test('follows matching verses in other panes but leaves a playing pane alone', async () => {
        const currentVerse = document.createElement('span');
        currentVerse.dataset.kjvVerseKey = 'GEN.1.1';
        const playingView = document.createElement('div');
        playingView.className = 'bible-view';
        const playingVerse = document.createElement('span');
        const playButton = document.createElement('i');
        playButton.className = 'play-to-bottom';
        playButton.dataset.speed = '1';
        playingView.append(playButton, playingVerse);
        document.body.append(playingView);
        const otherView = document.createElement('div');
        otherView.className = 'bible-view';
        const otherVerse = document.createElement('span');
        otherView.append(otherVerse);
        document.body.append(otherView);
        try {
            state.controller.getVerseElements.mockImplementation(
                (id: string) =>
                    id === 'first'
                        ? [currentVerse]
                        : [playingVerse, otherVerse],
            );
            state.controller.getBibleItemsByColorNote.mockReturnValue([
                bibleItem,
                { id: 'second' },
            ]);
            await act(async () =>
                root.render(<BibleViewComp bibleItem={bibleItem} />),
            );
            state.movedCheck.check(card().querySelector('.card-body'));
            expect(mocks.bringToView).toHaveBeenCalledOnce();
            expect(mocks.bringToView).toHaveBeenCalledWith(otherVerse);

            state.controller.getIsGroupScrollSynced.mockReturnValue(true);
            state.movedCheck.check(card().querySelector('.card-body'));
            expect(mocks.bringToView).toHaveBeenCalledOnce();
        } finally {
            playingView.remove();
            otherView.remove();
        }
    });
});
