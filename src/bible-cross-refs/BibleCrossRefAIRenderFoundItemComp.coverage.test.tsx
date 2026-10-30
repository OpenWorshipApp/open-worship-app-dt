// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    viewController: { id: 'lookup-controller' },
    breakItem: vi.fn(),
    openContextMenu: vi.fn(),
    openFoundBibleItem: vi.fn(),
    handleDragStart: vi.fn(),
}));

vi.mock('./bibleCrossRefsHelpers', () => ({ breakItem: h.breakItem }));
vi.mock('../bible-find/bibleFindHelpers', () => ({
    openContextMenu: h.openContextMenu,
    openFoundBibleItem: h.openFoundBibleItem,
}));
vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
        useAppStateAsync: <T,>(load: () => Promise<T>, deps: unknown[]) => {
            const [value, setValue] = react.useState<T | undefined>();
            react.useEffect(() => {
                void load().then(setValue);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue] as const;
        },
    };
});
vi.mock('../helper/ai/bibleCrossRefHelpers', () => ({
    useBibleKeyContext: () => 'KJV',
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => `${bibleKey} Font`,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    useLookupBibleItemControllerContext: () => h.viewController,
}));
vi.mock('../helper/dragHelpers', () => ({
    handleDragStart: h.handleDragStart,
}));
vi.mock('../bible-reader/view-extra/BibleDirectViewTitleComp', () => ({
    BibleDirectViewTitleComp: () => <span className="test-title" />,
}));

import BibleCrossRefAIRenderFoundItemComp from './BibleCrossRefAIRenderFoundItemComp';

const BIBLE_ITEM = { bibleKey: 'KHM', title: 'Romans 5:8' };

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.breakItem.mockResolvedValue({
        htmlText: 'But God commendeth his love',
        bibleText: 'But God commendeth his love toward us',
        bibleItem: BIBLE_ITEM,
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
});

async function render() {
    await act(async () => {
        root.render(
            <BibleCrossRefAIRenderFoundItemComp bibleVersesKey="ROM 5:8" />,
        );
    });
    return host.querySelector<HTMLDivElement>('[role="button"]');
}

function keyDown(row: HTMLElement, key: string) {
    const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
    });
    row.dispatchEvent(event);
    return event;
}

describe('BibleCrossRefAIRenderFoundItemComp', () => {
    test('says it is loading until the reference is read', async () => {
        h.breakItem.mockReturnValue(new Promise(() => {}));
        await render();
        expect(host.querySelector('.app-xref-status')!.textContent).toBe(
            'Loading...',
        );
    });

    test("the preview is in the verse's own bible face", async () => {
        const row = (await render())!;
        const text = row.querySelector<HTMLSpanElement>('.app-xref-text')!;
        expect(text.title).toBe('But God commendeth his love toward us');
        expect(text.style.fontFamily).toBe('KHM Font');
        expect(row.tabIndex).toBe(0);
        expect(row.title).toBe('Click to open the verse');
    });

    test('Enter and Space open the verse, other keys do not', async () => {
        const row = (await render())!;
        let event!: KeyboardEvent;
        await act(async () => {
            event = keyDown(row, 'Enter');
        });
        expect(event.defaultPrevented).toBe(true);
        expect(h.openFoundBibleItem).toHaveBeenCalledWith(BIBLE_ITEM);
        await act(async () => {
            keyDown(row, ' ');
        });
        expect(h.openFoundBibleItem).toHaveBeenCalledTimes(2);
        await act(async () => {
            event = keyDown(row, 'a');
        });
        expect(event.defaultPrevented).toBe(false);
        expect(h.openFoundBibleItem).toHaveBeenCalledTimes(2);
    });

    test('a right-click or the menu button opens the row menu', async () => {
        const row = (await render())!;
        await act(async () => {
            row.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(h.openContextMenu).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'contextmenu' }),
            { viewController: h.viewController, bibleItem: BIBLE_ITEM },
        );
        await act(async () => {
            row.querySelector<HTMLButtonElement>(
                '.app-context-menu-dots',
            )!.click();
        });
        expect(h.openContextMenu).toHaveBeenCalledTimes(2);
        expect(h.openFoundBibleItem).not.toHaveBeenCalled();
    });

    test('dragging the row carries its verse', async () => {
        const row = (await render())!;
        expect(row.draggable).toBe(true);
        await act(async () => {
            row.dispatchEvent(new Event('dragstart', { bubbles: true }));
        });
        expect(h.handleDragStart).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'dragstart' }),
            BIBLE_ITEM,
        );
    });
});
