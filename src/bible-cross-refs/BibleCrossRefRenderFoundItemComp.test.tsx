// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    viewController: { id: 'lookup-controller' },
    breakItem: vi.fn(),
    openContextMenu: vi.fn(),
    openInBibleLookup: vi.fn(),
    handleDragStart: vi.fn(),
}));

vi.mock('./bibleCrossRefsHelpers', () => ({ breakItem: h.breakItem }));
vi.mock('../bible-find/bibleFindHelpers', () => ({
    openContextMenu: h.openContextMenu,
    openInBibleLookup: h.openInBibleLookup,
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
                let isActive = true;
                void load().then((result) => {
                    if (isActive) setValue(result);
                });
                return () => {
                    isActive = false;
                };
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
    BibleDirectViewTitleComp: ({ bibleItem }: { bibleItem: any }) => (
        <span className="test-title">{bibleItem.title}</span>
    ),
}));

import BibleCrossRefRenderFoundItemComp from './BibleCrossRefRenderFoundItemComp';

const BIBLE_ITEM = { bibleKey: 'KJV', title: 'Genesis 1:3' };
const NO_MARKERS = {
    text: 'GEN 1:3',
    isS: false,
    isFN: false,
    isStar: false,
    isTitle: false,
    isLXXDSS: false,
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.breakItem.mockResolvedValue({
        htmlText: 'And God said, Let there be <i>light</i>',
        bibleText: 'And God said, Let there be light',
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

async function render(itemInfo = NO_MARKERS) {
    await act(async () => {
        root.render(
            <BibleCrossRefRenderFoundItemComp
                bibleVersesKey="GEN 1:3"
                itemInfo={itemInfo}
            />,
        );
    });
    return host.querySelector<HTMLDivElement>('[draggable="true"]');
}

describe('BibleCrossRefRenderFoundItemComp', () => {
    test('says it is loading until the reference is read', async () => {
        h.breakItem.mockReturnValue(new Promise(() => {}));
        await render();
        expect(host.textContent).toBe('Loading...');
        expect(h.breakItem).toHaveBeenCalledWith('KJV', 'GEN 1:3');
    });

    test('a reference that names no passage leaves no row behind', async () => {
        h.breakItem.mockResolvedValue(null);
        expect(await render()).toBeNull();
        expect(host.innerHTML).toBe('');
    });

    test('a readable reference shows its title and verse preview', async () => {
        const row = (await render())!;
        expect(row.title).toBe('shift + click to append');
        expect(row.querySelector('.test-title')!.textContent).toBe(
            'Genesis 1:3',
        );
        const preview = row.querySelector<HTMLSpanElement>('span[title]')!;
        expect(preview.title).toBe('And God said, Let there be light');
        expect(preview.style.fontFamily).toBe('KJV Font');
        expect(preview.querySelector('i')!.textContent).toBe('light');
        // No marker in the data: every badge is empty.
        for (const badge of row.querySelectorAll('.badge')) {
            expect(badge.textContent).toBe('');
        }
    });

    test('each marker copied from the data gets its badge', async () => {
        const row = (await render({
            ...NO_MARKERS,
            isS: true,
            isFN: true,
            isStar: true,
            isTitle: true,
            isLXXDSS: true,
        }))!;
        expect(
            Array.from(row.querySelectorAll('.badge')).map((badge) => {
                return badge.textContent;
            }),
        ).toEqual(['S ', 'FN ', '★ ', 'T ', 'LXXDSS ']);
    });

    test('a click opens the passage in the lookup', async () => {
        const row = (await render())!;
        await act(async () => {
            row.click();
        });
        expect(h.openInBibleLookup).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'click' }),
            h.viewController,
            BIBLE_ITEM,
            true,
        );
    });

    test('a right-click and the menu button open the same menu', async () => {
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
        // The menu button's press does not also open the passage.
        expect(h.openInBibleLookup).not.toHaveBeenCalled();
    });

    test('dragging the row carries its bible item', async () => {
        const row = (await render())!;
        await act(async () => {
            row.dispatchEvent(new Event('dragstart', { bubbles: true }));
        });
        expect(h.handleDragStart).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'dragstart' }),
            BIBLE_ITEM,
        );
    });
});
