// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        appProvider: { isPagePresenter: false, isPageReader: true },
        handleBibleItemSelectingMock: vi.fn(),
        viewController: {
            isLookup: true,
            selectedBibleItem: { id: 9 },
            straightBibleItems: [] as unknown[],
            setLookupContentFromBibleItem: vi.fn(),
            addBibleItemRight: vi.fn(),
            addBibleItem: vi.fn(),
        },
    };
});

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('./Bible', () => ({
    default: { fromFilePath: vi.fn(async () => null) },
}));
vi.mock('../others/ItemReadErrorComp', () => ({ default: () => null }));
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceRefreshEvents: vi.fn(),
}));
vi.mock('../helper/dragHelpers', () => ({
    genRemovingAttachedBackgroundMenu: vi.fn(() => []),
    handleDragStart: vi.fn(),
    handleAttachBackgroundDrop: vi.fn(),
    extractDropData: vi.fn(),
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => null,
}));
vi.mock('../others/ItemColorNoteComp', () => ({ default: () => null }));
vi.mock('../bible-lookup/BibleKeySelectionComp', () => ({
    BibleKeySelectionMiniComp: () => null,
}));
vi.mock('../_screen/managers/ScreenBibleManager', () => ({
    default: { handleBibleItemSelecting: h.handleBibleItemSelectingMock },
}));
vi.mock('../others/commonButtons', () => ({
    useToggleBibleLookupPopupContext: () => null,
}));
vi.mock('../server/appProvider', () => ({ default: h.appProvider }));
vi.mock('../helper/DragInf', () => ({
    DragTypeEnum: { BIBLE_ITEM: 'bibleItem' },
}));
vi.mock('../helper/helpers', () => ({
    changeDragEventStyle: vi.fn(),
    stopDraggingState: vi.fn(),
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../bible-reader/BibleViewTitleEditorComp', () => ({
    default: () => 'Mark 4:39',
}));
vi.mock('../bible-reader/BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => h.viewController,
}));
vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: { getAttachedBackground: vi.fn(async () => null) },
}));
vi.mock('../others/AttachBackgroundIconComp', () => ({ default: () => null }));
vi.mock('./bibleHelpers', () => ({
    improveBibleItemTitleOnHover: vi.fn(),
    openBibleItemContextMenu: vi.fn(),
    useIsOnScreen: () => false,
}));
vi.mock('../helper/FileSource', () => ({
    default: { getInstance: () => ({ name: 'Default.owb' }) },
}));
vi.mock('../helper/appHooks', () => ({
    useAppCurrentRef: (value: unknown) => ({ current: value }),
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => undefined,
}));
vi.mock('../others/AppSuspenseComp', () => ({
    default: ({ children }: { children: unknown }) => children,
}));

import BibleItemRenderComp from './BibleItemRenderComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const bibleItem = {
    id: 1,
    bibleKey: 'KJV',
    isError: false,
    filePath: 'C:/data/bibles-read/Default.owb',
    toVerseFullKey: () => 'MRK 4:39',
    clone() {
        return this;
    },
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.clearAllMocks();
    h.appProvider.isPagePresenter = false;
    h.appProvider.isPageReader = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root.render(
            <BibleItemRenderComp
                index={0}
                bibleItem={bibleItem as any}
                filePath={bibleItem.filePath}
            />,
        );
    });
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
});

function getPassageControl() {
    const control = host.querySelector<HTMLElement>('[role="button"]');
    if (control === null) {
        throw new Error('The passage is not a button');
    }
    return control;
}

function press(key: string, shiftKey = false) {
    act(() => {
        getPassageControl().dispatchEvent(
            new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }),
        );
    });
}

// A saved passage opened on a double-click only, and nothing in its row was a
// named tab stop: a keyboard reached the colour dot and the ⋮, never the
// passage itself (F9 of robot run 20261001-1646).
describe('BibleItemRenderComp', () => {
    test('the passage is a named tab stop', () => {
        const control = getPassageControl();
        expect(control.tabIndex).toBe(0);
        const name = (control.getAttribute('aria-labelledby') ?? '')
            .split(' ')
            .map((id) => {
                return document.getElementById(id)?.textContent ?? '';
            })
            .join(' ');
        expect(name).toBe('Open (KJV) Mark 4:39');
    });

    test('Enter opens it in the Reader, Shift+Enter beside the reading', () => {
        press('Enter');
        expect(
            h.viewController.setLookupContentFromBibleItem,
        ).toHaveBeenCalledWith(bibleItem);

        press('Enter', true);
        expect(h.viewController.addBibleItemRight).toHaveBeenCalledWith(
            h.viewController.selectedBibleItem,
            bibleItem,
            true,
        );
    });

    test('Space does what a double-click does in the Presenter', () => {
        h.appProvider.isPagePresenter = true;
        press(' ');
        expect(h.handleBibleItemSelectingMock).toHaveBeenCalledTimes(1);
        expect(h.handleBibleItemSelectingMock.mock.calls[0][1]).toBe(bibleItem);
    });

    test('any other key leaves it alone', () => {
        press('a');
        press('Tab');
        expect(
            h.viewController.setLookupContentFromBibleItem,
        ).not.toHaveBeenCalled();
        expect(h.handleBibleItemSelectingMock).not.toHaveBeenCalled();
    });
});
