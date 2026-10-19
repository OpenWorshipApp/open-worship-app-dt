// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    saveBibleItemMock: vi.fn(),
    exportToWordDocumentMock: vi.fn(),
    handleSelectingMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
    insertBibleItemMock: vi.fn(),
    appProvider: {
        isPageAppDocumentEditor: false,
        isPagePresenter: false,
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../bible-list/bibleHelpers', () => ({
    saveBibleItem: h.saveBibleItemMock,
    exportToWordDocument: h.exportToWordDocumentMock,
}));
vi.mock('../_screen/managers/ScreenLongTextManager', () => ({
    default: { handleBibleItemSelecting: h.handleSelectingMock },
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToastMock,
}));
vi.mock('../server/appProvider', () => ({ default: h.appProvider }));
vi.mock('../context-menu/AppContextMenuComp', () => ({
    elementDivider: { __divider: true },
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: vi.fn(() => null),
}));
vi.mock('../slide-editor/canvas/canvasBibleItemHelpers', () => ({
    CanvasBibleItemEventListener: { insertBibleItem: h.insertBibleItemMock },
}));

import {
    addBibleItemAndPresent,
    genFoundBibleItemContextMenu,
    showAddingBibleItemFail,
} from './bibleActionHelpers';

describe('bible-lookup bibleActionHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        h.appProvider.isPageAppDocumentEditor = false;
        h.appProvider.isPagePresenter = false;
    });

    test('showAddingBibleItemFail toasts', () => {
        showAddingBibleItemFail();
        expect(h.showSimpleToastMock).toHaveBeenCalledWith(
            'Adding Bible Item',
            'Fail to add bible item',
        );
    });

    test('addBibleItemAndPresent presents when saved, warns otherwise', async () => {
        h.saveBibleItemMock.mockResolvedValue({ id: 1 });
        await addBibleItemAndPresent({}, { id: 1 } as any);
        expect(h.handleSelectingMock).toHaveBeenCalled();

        h.saveBibleItemMock.mockResolvedValue(null);
        await addBibleItemAndPresent({}, { id: 1 } as any);
        expect(h.showSimpleToastMock).toHaveBeenCalled();
    });

    function genController() {
        return {
            onLookupSaveBibleItem: vi.fn(),
            selectedVerseKey: '',
            openBibleSearch: vi.fn(),
            setIsAdvanceLookupOpened: vi.fn(),
        } as any;
    }

    test('genFoundBibleItemContextMenu base menu saves a bible item', async () => {
        const target = document.createElement('div');
        const ctl = genController();
        const bibleItem = { id: 1 } as any;
        const menu = genFoundBibleItemContextMenu(
            { target },
            ctl,
            bibleItem,
            true,
        );
        const save = menu.find((m) => m.menuElement === 'Save bible item')!;
        h.saveBibleItemMock.mockResolvedValue({ id: 1 });
        await save.onSelect!({} as any);
        expect(h.saveBibleItemMock).toHaveBeenCalled();

        h.saveBibleItemMock.mockResolvedValue(null);
        await save.onSelect!({} as any);
        expect(h.showSimpleToastMock).toHaveBeenCalled();
    });

    // Every other action on the header's hover strip is in the pane menu too;
    // Export was the one a narrow pane could only reach by scrolling.
    test('genFoundBibleItemContextMenu exports the passage to Word', () => {
        const bibleItem = { id: 1 } as any;
        const menu = genFoundBibleItemContextMenu(
            { target: document.createElement('div') },
            genController(),
            bibleItem,
        );
        const exportItem = menu.find(
            (m) => m.menuElement === 'Export to MS Word',
        )!;
        exportItem.onSelect!({} as any);
        expect(h.exportToWordDocumentMock).toHaveBeenCalledWith([bibleItem]);
    });

    test('genFoundBibleItemContextMenu adds cross reference when verse key present', () => {
        const target = document.createElement('div');
        target.dataset.verseKey = '(KJV) GEN 1:1';
        const ctl = genController();
        const menu = genFoundBibleItemContextMenu({ target }, ctl, {
            id: 1,
        } as any);
        const crossRef = menu.find(
            (m) => m.menuElement === 'Open in Cross Reference',
        )!;
        expect(crossRef).toBeDefined();
        // The key is the app's handle, not words: as a tooltip it was read
        // out as part of the item's name.
        expect(crossRef.title).toBeUndefined();
        crossRef.onSelect!({} as any);
        expect(ctl.selectedVerseKey).toBe('(KJV) GEN 1:1');
        expect(ctl.openBibleSearch).toHaveBeenCalledWith('c');
        expect(ctl.setIsAdvanceLookupOpened).toHaveBeenCalledWith(true);
    });

    test('genFoundBibleItemContextMenu reads verse key from parent element', () => {
        const parent = document.createElement('div');
        parent.dataset.verseKey = '(KJV) EXO 2:2';
        const target = document.createElement('span');
        parent.appendChild(target);
        const menu = genFoundBibleItemContextMenu({ target }, genController(), {
            id: 1,
        } as any);
        expect(
            menu.some((m) => m.menuElement === 'Open in Cross Reference'),
        ).toBe(true);
    });

    function findCrossRef(
        menu: ReturnType<typeof genFoundBibleItemContextMenu>,
    ) {
        return menu.find((m) => m.menuElement === 'Open in Cross Reference');
    }

    // CM-74: a decorated name ("Aaron" in Exodus 4:14) and the words of the
    // extra-verses / custom-HTML layouts sit two or more levels into a verse.
    test('genFoundBibleItemContextMenu finds the verse of a deeply nested target', () => {
        const verse = document.createElement('div');
        verse.dataset.verseKey = '(KJV) EXO 4:14';
        const detail = document.createElement('span');
        const name = document.createElement('span');
        name.textContent = 'Aaron';
        detail.appendChild(name);
        verse.appendChild(detail);
        const ctl = genController();
        const menu = genFoundBibleItemContextMenu({ target: name }, ctl, {
            id: 1,
        } as any);
        findCrossRef(menu)!.onSelect!({} as any);
        expect(ctl.selectedVerseKey).toBe('(KJV) EXO 4:14');

        // A text node (a dispatched event) resolves through its parent.
        const textMenu = genFoundBibleItemContextMenu(
            { target: name.firstChild },
            genController(),
            { id: 1 } as any,
        );
        expect(findCrossRef(textMenu)).toBeDefined();
    });

    test('genFoundBibleItemContextMenu falls back to a selection inside the same view', () => {
        const view = document.createElement('div');
        const header = document.createElement('button');
        const verse = document.createElement('div');
        verse.dataset.verseKey = '(KJV) JHN 3:16';
        verse.textContent = 'For God so loved the world';
        view.append(header, verse);
        const otherView = document.createElement('div');
        const otherVerse = document.createElement('div');
        otherVerse.dataset.verseKey = '(KJV) GEN 1:1';
        otherVerse.textContent = 'In the beginning';
        otherView.appendChild(otherVerse);
        document.body.append(view, otherView);
        try {
            // A keyboard-opened menu targets the focused control.
            globalThis.getSelection()!.collapse(verse.firstChild!, 4);
            const ctl = genController();
            const menu = genFoundBibleItemContextMenu(
                { target: header, currentTarget: view },
                ctl,
                { id: 1 } as any,
            );
            findCrossRef(menu)!.onSelect!({} as any);
            expect(ctl.selectedVerseKey).toBe('(KJV) JHN 3:16');

            // A selection left in another pane is not this menu's verse.
            globalThis.getSelection()!.collapse(otherVerse.firstChild!, 2);
            expect(
                findCrossRef(
                    genFoundBibleItemContextMenu(
                        { target: header, currentTarget: view },
                        genController(),
                        { id: 1 } as any,
                    ),
                ),
            ).toBeUndefined();

            // Nor is a selection outside every verse.
            globalThis.getSelection()!.removeAllRanges();
            expect(
                findCrossRef(
                    genFoundBibleItemContextMenu(
                        { target: header, currentTarget: view },
                        genController(),
                        { id: 1 } as any,
                    ),
                ),
            ).toBeUndefined();
        } finally {
            globalThis.getSelection()!.removeAllRanges();
            view.remove();
            otherView.remove();
        }
    });

    test('genFoundBibleItemContextMenu adds presenter options', async () => {
        h.appProvider.isPagePresenter = true;
        const ctl = genController();
        const bibleItem = { id: 1 } as any;
        const menu = genFoundBibleItemContextMenu(
            { target: document.createElement('div') },
            ctl,
            bibleItem,
            true,
        );
        const show = menu.find((m) => m.menuElement === 'Show bible item')!;
        show.onSelect!({} as any);
        expect(h.handleSelectingMock).toHaveBeenCalled();

        const saveShow = menu.find(
            (m) => m.menuElement === 'Save bible item and show on screen',
        )!;
        h.saveBibleItemMock.mockResolvedValue({ id: 1 });
        await saveShow.onSelect!({} as any);
        expect(h.saveBibleItemMock).toHaveBeenCalled();
    });

    test('genFoundBibleItemContextMenu adds insert option in slide editor', () => {
        h.appProvider.isPageAppDocumentEditor = true;
        const target = document.createElement('div');
        target.dataset.verseKey = 'x'; // ignored because editor page
        const menu = genFoundBibleItemContextMenu({ target }, genController(), {
            id: 1,
        } as any);
        // the verse-key item is suppressed on the editor page
        expect(
            menu.some((m) => m.menuElement === 'Open in Cross Reference'),
        ).toBe(false);
        const insert = menu.find((m) => m.menuElement === 'Insert bible item')!;
        insert.onSelect!({} as any);
        expect(h.insertBibleItemMock).toHaveBeenCalled();
    });

    test('genFoundBibleItemContextMenu handles a non-HTMLElement target', () => {
        const menu = genFoundBibleItemContextMenu(
            { target: null },
            genController(),
            { id: 1 } as any,
        );
        expect(Array.isArray(menu)).toBe(true);
        // No verse key, so the item that needs one is not offered.
        expect(
            menu.some((m) => m.menuElement === 'Open in Cross Reference'),
        ).toBe(false);
    });
});
