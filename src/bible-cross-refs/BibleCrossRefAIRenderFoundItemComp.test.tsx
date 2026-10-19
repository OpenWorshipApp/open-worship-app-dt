// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    breakItem: vi.fn(),
    openFoundBibleItem: vi.fn(),
}));

vi.mock('./bibleCrossRefsHelpers', () => ({
    breakItem: h.breakItem,
}));
vi.mock('../bible-find/bibleFindHelpers', () => ({
    openContextMenu: vi.fn(),
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
                let active = true;
                void load().then((result) => {
                    if (active) setValue(result);
                });
                return () => {
                    active = false;
                };
            }, deps);
            return [value, setValue] as const;
        },
    };
});
vi.mock('../helper/ai/bibleCrossRefHelpers', () => ({
    useBibleKeyContext: () => 'KJV',
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => undefined,
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));
vi.mock('../helper/sanitizeHelpers', () => ({
    sanitizeHtml: (html: string) => html,
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    useLookupBibleItemControllerContext: () => null,
}));
vi.mock('../helper/dragHelpers', () => ({
    handleDragStart: vi.fn(),
}));
vi.mock('../bible-reader/view-extra/BibleDirectViewTitleComp', () => ({
    BibleDirectViewTitleComp: ({ bibleItem }: { bibleItem: any }) => (
        <span className="title">{bibleItem.title}</span>
    ),
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => null,
}));

import BibleCrossRefAIRenderFoundItemComp from './BibleCrossRefAIRenderFoundItemComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    h.breakItem.mockReset();
    h.openFoundBibleItem.mockReset();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
});

async function render(bibleVersesKey: string) {
    await act(async () => {
        root.render(
            <BibleCrossRefAIRenderFoundItemComp
                bibleVersesKey={bibleVersesKey}
            />,
        );
    });
}

describe('BibleCrossRefAIRenderFoundItemComp', () => {
    // RD-51: a target the data spells wrongly (`PSA 119:ющ`) names no passage.
    // It used to be a row titled `Psalm 119:` that opened "Record not found".
    test('a reference that names no passage leaves no row behind', async () => {
        h.breakItem.mockResolvedValue(null);
        await render('PSA 119:ющ');
        expect(h.breakItem).toHaveBeenCalledWith('KJV', 'PSA 119:ющ');
        expect(host.innerHTML).toBe('');
        expect(host.querySelector('[role="button"]')).toBeNull();
    });

    test('a readable reference is a row that opens its verse', async () => {
        const bibleItem = { bibleKey: 'KJV', title: 'Psalm 56:1' };
        h.breakItem.mockResolvedValue({
            htmlText: 'Be merciful unto me, O God',
            bibleText: 'Be merciful unto me, O God',
            bibleItem,
        });
        await render('PSA 56:title');
        const row = host.querySelector<HTMLElement>('[role="button"]')!;
        expect(row).not.toBeNull();
        expect(row.textContent).toContain('Psalm 56:1');
        expect(row.textContent).toContain('Be merciful unto me, O God');
        await act(async () => {
            row.click();
        });
        expect(h.openFoundBibleItem).toHaveBeenCalledWith(bibleItem);
    });
});
