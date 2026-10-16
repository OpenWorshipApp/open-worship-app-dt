// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    history: [] as string[],
    saveHistory: vi.fn(),
    extract: vi.fn(),
    menu: vi.fn(),
    drag: vi.fn(),
    saveBibleItem: vi.fn(),
    append: vi.fn(),
    setLookupContent: vi.fn(),
    openPanel: vi.fn(),
    handleError: vi.fn(),
    historyStore: { addBibleItemHistory: (_text: string) => {} },
}));

vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/SettingManager', () => ({
    genStringListSettingManager: () => ({
        getSetting: () => h.history,
        setSetting: (value: string[]) => {
            h.history = value;
            h.saveHistory(value);
        },
    }),
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    extractBibleTitle: h.extract,
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    useLookupBibleItemControllerContext: () => controller,
}));
vi.mock('../bible-reader/BibleItemsViewController', () => ({
    bibleHistoryStore: h.historyStore,
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ onOpening }: { onOpening: (event: MouseEvent) => void }) =>
        createElement('button', {
            type: 'button',
            'aria-label': 'History menu',
            onClick: onOpening,
        }),
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.menu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../helper/dragHelpers', () => ({ handleDragStart: h.drag }));
vi.mock('../bible-list/bibleItemHelpers', () => ({
    genBibleItemCopyingContextMenu: () => [
        { menuElement: 'Copy passage', onSelect: vi.fn() },
    ],
}));
vi.mock('../bible-list/bibleHelpers', () => ({
    saveBibleItem: h.saveBibleItem,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => 'Test Serif',
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../location-name-lookup/detailPanelHelpers', () => ({
    openBibleItemDetailPanel: h.openPanel,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));

import BibleLookupInputHistoryComp from './BibleLookupInputHistoryComp';

const bibleItem = { bibleKey: 'en', target: { verseStart: 1, verseEnd: 2 } };
const controller = {
    selectedBibleItem: bibleItem,
    appendBibleItem: h.append,
    setLookupContentFromBibleItem: h.setLookupContent,
};
let root: Root;
let container: HTMLDivElement;

async function render(maxHistoryCount = 20) {
    await act(async () =>
        root.render(
            createElement(BibleLookupInputHistoryComp, { maxHistoryCount }),
        ),
    );
}

function rows() {
    return Array.from(
        container.querySelectorAll<HTMLElement>('[draggable="true"]'),
    );
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.history = ['(en) John 3:16', '(en) Psalm 23'];
    h.saveHistory.mockClear();
    h.extract.mockReset().mockResolvedValue({ result: { bibleItem } });
    h.menu.mockClear();
    h.drag.mockClear();
    h.saveBibleItem.mockClear();
    h.append.mockClear();
    h.setLookupContent.mockClear();
    h.openPanel.mockReset().mockResolvedValue(undefined);
    h.handleError.mockClear();
    h.historyStore.addBibleItemHistory = () => {};
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('Bible lookup input history', () => {
    it('adds unique entries first, caps the list, and persists it', async () => {
        await render(2);
        expect(rows()).toHaveLength(2);
        await act(async () =>
            h.historyStore.addBibleItemHistory('(en) Mark 1:1'),
        );
        expect(rows().map((row) => row.textContent)).toEqual([
            '(en) Mark 1:1',
            '(en) John 3:16',
        ]);
        expect(h.saveHistory).toHaveBeenLastCalledWith([
            '(en) Mark 1:1',
            '(en) John 3:16',
        ]);
        await act(async () =>
            h.historyStore.addBibleItemHistory('(en) Mark 1:1'),
        );
        expect(h.saveHistory).toHaveBeenCalledTimes(1);
    });

    it('removes one history entry without reopening it', async () => {
        await render();
        await act(async () =>
            rows()[0]
                .querySelector<HTMLButtonElement>('[aria-label="Remove"]')!
                .click(),
        );
        expect(rows()).toHaveLength(1);
        expect(h.history).toEqual(['(en) Psalm 23']);
        expect(h.setLookupContent).not.toHaveBeenCalled();
    });

    // A press reads the passage in a floating panel; the passage being
    // edited stays as it is, Shift or not.
    it('opens a passage in the verse panel by click or keyboard', async () => {
        await render();
        expect(rows()[0].title).toBe('Click to open the verse');
        await act(async () =>
            rows()[0]
                .querySelector<HTMLButtonElement>('button.text-reset')!
                .click(),
        );
        expect(h.extract).toHaveBeenCalledWith('en', 'John 3:16');
        expect(h.openPanel).toHaveBeenCalledWith(bibleItem);
        await act(async () =>
            rows()[1]
                .querySelector<HTMLButtonElement>('button.text-reset')!
                .dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: 'Enter',
                        bubbles: true,
                        cancelable: true,
                        shiftKey: true,
                    }),
                ),
        );
        expect(h.extract).toHaveBeenLastCalledWith('en', 'Psalm 23');
        await act(async () =>
            rows()[0].dispatchEvent(
                new MouseEvent('click', { bubbles: true, shiftKey: true }),
            ),
        );
        expect(h.openPanel).toHaveBeenCalledTimes(3);
        expect(h.setLookupContent).not.toHaveBeenCalled();
        expect(h.append).not.toHaveBeenCalled();
    });

    it('reports a panel that fails to open', async () => {
        const error = new Error('no bible');
        h.openPanel.mockRejectedValueOnce(error);
        await render();
        await act(async () =>
            rows()[0]
                .querySelector<HTMLButtonElement>('button.text-reset')!
                .click(),
        );
        expect(h.handleError).toHaveBeenCalledWith(error);
    });

    it('opens nothing from its own remove button', async () => {
        await render();
        await act(async () =>
            rows()[1]
                .querySelector<HTMLButtonElement>('[aria-label="Remove"]')!
                .click(),
        );
        expect(h.extract).not.toHaveBeenCalled();
        expect(h.openPanel).not.toHaveBeenCalled();
    });

    it('offers open, open beside, set, copy, save and remove for a valid passage', async () => {
        await render();
        await act(async () =>
            rows()[0].dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            ),
        );
        const items = h.menu.mock.calls.at(-1)![1];
        expect(
            items.map((item: { menuElement: string }) => item.menuElement),
        ).toEqual([
            'Open',
            'Open beside the current verse',
            'Set to current editing',
            'Copy passage',
            'Save bible item',
            'Remove',
        ]);
        await act(async () => items[0].onSelect());
        expect(h.openPanel).toHaveBeenCalledWith(bibleItem);
        expect(h.append).not.toHaveBeenCalled();
        expect(h.setLookupContent).not.toHaveBeenCalled();
        await act(async () => items[1].onSelect());
        expect(h.append).toHaveBeenCalledWith(bibleItem);
        expect(h.setLookupContent).not.toHaveBeenCalled();
        // What a press on the entry did before: the editing passage becomes
        // this one, and no pane is added beside it.
        await act(async () => items[2].onSelect());
        expect(h.setLookupContent).toHaveBeenCalledWith(bibleItem);
        expect(h.append).toHaveBeenCalledTimes(1);
        await act(async () => items[4].onSelect());
        expect(h.saveBibleItem).toHaveBeenCalledWith(bibleItem);
        await act(async () => items[5].onSelect());
        expect(h.history).toEqual(['(en) Psalm 23']);
        expect(h.openPanel).toHaveBeenCalledTimes(1);
    });

    it('keeps an unparseable history entry removable but never drags or opens it', async () => {
        h.history = ['obsolete'];
        await render();
        await act(async () =>
            rows()[0].dispatchEvent(new Event('dragstart', { bubbles: true })),
        );
        expect(h.drag).not.toHaveBeenCalled();
        await act(async () =>
            rows()[0].dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                }),
            ),
        );
        expect(h.menu.mock.calls.at(-1)![1]).toHaveLength(1);
        expect(h.menu.mock.calls.at(-1)![1][0].menuElement).toBe('Remove');
        await act(async () =>
            rows()[0].dispatchEvent(new MouseEvent('click', { bubbles: true })),
        );
        expect(h.openPanel).not.toHaveBeenCalled();
    });
});
