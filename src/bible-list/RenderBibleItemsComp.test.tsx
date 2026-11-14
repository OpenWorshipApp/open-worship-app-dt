// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    showBibleLookupPopup: null as null | (() => void),
    genDuplicatedMessage: vi.fn(),
    isAIEnabled: false,
    showAppContextMenu: vi.fn(),
    openChatbotForBibleListPaste: vi.fn(async () => true),
}));

vi.mock('./BibleItemRenderComp', () => ({
    default: ({
        index,
        warningMessage,
        bibleItem,
        filePath,
    }: {
        index: number;
        warningMessage?: string;
        bibleItem: { id: number };
        filePath: string;
    }) => (
        <li
            className="bible-item"
            data-index={index}
            data-file={filePath}
            title={warningMessage}
        >
            {bibleItem.id}
        </li>
    ),
}));
vi.mock('./bibleItemHelpers', () => ({
    genDuplicatedMessage: h.genDuplicatedMessage,
}));
vi.mock('../others/commonButtons', () => ({
    useToggleBibleLookupPopupContext: () => h.showBibleLookupPopup,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../helper/ai/aiHelpers', () => ({
    getIsAIEnabled: () => h.isAIEnabled,
}));
vi.mock('../helper/ai/chatbotHandoffHelpers', () => ({
    openChatbotForBibleListPaste: h.openChatbotForBibleListPaste,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
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

import RenderBibleItemsComp from './RenderBibleItemsComp';

let host: HTMLDivElement;
let root: Root;

function genBible(isDefault: boolean) {
    return {
        filePath: '/bibles/Default.owb',
        isDefault,
        items: [{ id: 1 }, { id: 2 }, { id: 3 }],
    } as any;
}

async function renderItems(bible: any) {
    await act(async () => {
        root.render(<RenderBibleItemsComp bible={bible} />);
    });
}

function getAddButton() {
    return host.querySelector<HTMLButtonElement>('button');
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.showBibleLookupPopup = null;
    h.isAIEnabled = false;
    h.showAppContextMenu.mockClear();
    h.openChatbotForBibleListPaste.mockClear();
    h.genDuplicatedMessage.mockImplementation(
        (_items: unknown[], item: { id: number }) =>
            item.id === 2 ? 'Duplicated with item 1' : '',
    );
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('the passages of one bible list', () => {
    test('one row per passage, with a warning on a duplicate', async () => {
        const bible = genBible(false);
        await renderItems(bible);
        const rows = [...host.querySelectorAll<HTMLElement>('.bible-item')];
        expect(
            rows.map((row) => [row.dataset.index, row.textContent, row.title]),
        ).toEqual([
            ['0', '1', ''],
            ['1', '2', 'Duplicated with item 1'],
            ['2', '3', ''],
        ]);
        expect(rows[0].dataset.file).toBe('/bibles/Default.owb');
        expect(h.genDuplicatedMessage).toHaveBeenCalledWith(
            bible.items,
            bible.items[1],
            1,
        );
        expect(getAddButton()).toBeNull();
    });

    test('with AI off, the default list adds a passage through the lookup at once', async () => {
        const showLookup = vi.fn();
        h.showBibleLookupPopup = showLookup;
        await renderItems(genBible(true));
        const add = getAddButton()!;
        expect(add.textContent).toBe(' Add Bible Item');
        await act(async () => add.click());
        expect(showLookup).toHaveBeenCalledTimes(1);
        expect(h.showAppContextMenu).not.toHaveBeenCalled();
    });

    // EC-760: the lookup, or the chatbot to read the passages out of a text.
    test('with AI on, it asks how: the lookup or the chatbot, under the button', async () => {
        h.isAIEnabled = true;
        const showLookup = vi.fn();
        h.showBibleLookupPopup = showLookup;
        await renderItems(genBible(true));
        const add = getAddButton()!;
        add.getBoundingClientRect = () => {
            return { left: 40, bottom: 120 } as DOMRect;
        };
        await act(async () => add.click());
        expect(showLookup).not.toHaveBeenCalled();
        expect(h.showAppContextMenu).toHaveBeenCalledTimes(1);
        const [, items, options] = h.showAppContextMenu.mock.calls[0];
        expect(
            items.map((item: any) => {
                return item.menuElement;
            }),
        ).toEqual(['Bible Lookup', 'Open in Chatbot']);
        expect(options).toEqual({ coord: { x: 40, y: 120 } });
        items[0].onSelect({});
        expect(showLookup).toHaveBeenCalledTimes(1);
        items[1].onSelect({});
        await vi.waitFor(() => {
            expect(h.openChatbotForBibleListPaste).toHaveBeenCalledTimes(1);
        });
    });

    test('no lookup to open, no add button', async () => {
        await renderItems(genBible(true));
        expect(getAddButton()).toBeNull();
    });
});
