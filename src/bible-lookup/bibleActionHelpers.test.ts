// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    saveBibleItemMock: vi.fn(),
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
}));
vi.mock('../_screen/managers/ScreenBibleManager', () => ({
    default: { handleBibleItemSelecting: h.handleSelectingMock },
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToastMock,
}));
vi.mock('../server/appProvider', () => ({ default: h.appProvider }));
vi.mock('../context-menu/AppContextMenuComp', () => ({
    elementDivider: { __divider: true },
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
            bibleCrossReferenceVerseKey: '',
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
        crossRef.onSelect!({} as any);
        expect(ctl.bibleCrossReferenceVerseKey).toBe('(KJV) GEN 1:1');
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
        // cross reference is suppressed on the editor page
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
    });
});
