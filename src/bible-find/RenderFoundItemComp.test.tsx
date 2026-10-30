// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    viewController: { id: 'lookup' },
    breakItem: vi.fn(),
    openContextMenu: vi.fn(),
    openFoundBibleItem: vi.fn(),
    handleDragStart: vi.fn(),
    pressElementLikeButton: vi.fn(),
}));

vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ onOpening }: { onOpening: (event: any) => void }) => (
        <button type="button" className="dots" onClick={onOpening}>
            More Options
        </button>
    ),
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    useLookupBibleItemControllerContext: () => h.viewController,
}));
vi.mock('../bible-reader/view-extra/BibleDirectViewTitleComp', () => ({
    BibleDirectViewTitleComp: ({ bibleItem }: { bibleItem: any }) => (
        <span className="verse-title">{bibleItem.title}</span>
    ),
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef, useState } = await import('react');
    return {
        useAppStateAsync: (callee: () => unknown, deps: unknown[] = []) => {
            const [value, setValue] = useState<unknown>(undefined);
            useEffect(() => {
                Promise.resolve(callee()).then(setValue);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue];
        },
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/dragHelpers', () => ({
    handleDragStart: h.handleDragStart,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('./BibleFindController', () => ({
    useBibleFindController: () => ({ locale: 'en-US' }),
}));
vi.mock('./bibleFindHelpers', () => ({
    breakItem: h.breakItem,
    openContextMenu: h.openContextMenu,
    openFoundBibleItem: h.openFoundBibleItem,
}));
vi.mock('../helper/helpers', () => ({
    pressElementLikeButton: h.pressElementLikeButton,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) =>
        bibleKey === 'KJV' ? 'serif' : 'monospace',
}));

import RenderFoundItemComp from './RenderFoundItemComp';

const bibleItem = { title: 'Genesis 2:7' };

let host: HTMLDivElement;
let root: Root;

async function renderItem() {
    await act(async () => {
        root.render(
            <RenderFoundItemComp
                findText="dust"
                text="GEN.2:7:formed man of the dust"
                bibleKey="KJV"
            />,
        );
    });
}

function getRow() {
    return host.querySelector<HTMLElement>('[role="button"]')!;
}

async function fire(element: Element, event: Event) {
    await act(async () => {
        element.dispatchEvent(event);
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.breakItem.mockResolvedValue({
        newItem:
            'formed man of the <span class="app-found-highlight">dust</span>' +
            '<img src="x" onerror="alert(1)"><script>alert(2)</script>',
        bibleItem,
        kjvVerseKey: 'GEN 2:7',
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('a found verse', () => {
    test('is broken into its reference and highlighted words', async () => {
        await renderItem();
        expect(h.breakItem).toHaveBeenCalledWith(
            'en-US',
            'dust',
            'GEN.2:7:formed man of the dust',
            'KJV',
        );
        const row = getRow();
        expect(row.tabIndex).toBe(0);
        expect(row.draggable).toBe(true);
        expect(row.title).toBe('Click to open the verse');
        expect(row.querySelector('.verse-title')!.textContent).toBe(
            'Genesis 2:7',
        );
        const text = row.querySelector<HTMLElement>('.app-find-text')!;
        expect(text.style.fontFamily).toBe('serif');
        expect(text.querySelector('.app-found-highlight')!.textContent).toBe(
            'dust',
        );
        // The verse is HTML from a file: nothing in it may run.
        expect(text.querySelector('script')).toBeNull();
        expect(text.innerHTML).not.toContain('onerror');
    });

    test('is named by its own reference and words, not its menu button', async () => {
        await renderItem();
        const names = getRow()
            .getAttribute('aria-labelledby')!
            .split(' ')
            .map((id) => document.getElementById(id)!.textContent);
        expect(names[0]).toBe('Genesis 2:7');
        expect(names[1]).toContain('formed man of the dust');
        expect(names.join(' ')).not.toContain('More Options');
    });

    test('says it is loading, and when the verse cannot be read', async () => {
        h.breakItem.mockReturnValue(new Promise(() => {}));
        await renderItem();
        expect(host.textContent).toBe('Loading...');
        h.breakItem.mockResolvedValue(null);
        await act(async () => {
            root.render(
                <RenderFoundItemComp
                    findText="dust"
                    text="GEN.3:19:unto dust shalt thou return"
                    bibleKey="KJV"
                />,
            );
        });
        expect(host.textContent).toBe('Fail to get data');
    });

    test('a press opens the verse in its panel', async () => {
        await renderItem();
        await act(async () => getRow().click());
        expect(h.openFoundBibleItem).toHaveBeenCalledWith(bibleItem);
    });

    test('its menu opens from a right-click and from its dots button', async () => {
        await renderItem();
        await fire(
            getRow(),
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
        );
        expect(h.openContextMenu).toHaveBeenCalledTimes(1);
        expect(h.openContextMenu.mock.calls[0][1]).toEqual({
            viewController: h.viewController,
            bibleItem,
        });
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.dots')!.click(),
        );
        expect(h.openContextMenu).toHaveBeenCalledTimes(2);
        expect(h.openContextMenu.mock.calls[1][1].bibleItem).toBe(bibleItem);
    });

    test('dragging it carries the verse', async () => {
        await renderItem();
        await fire(getRow(), new Event('dragstart', { bubbles: true }));
        expect(h.handleDragStart).toHaveBeenCalledTimes(1);
        expect(h.handleDragStart.mock.calls[0][1]).toBe(bibleItem);
    });

    test('a key on the row presses it; a key meant for its dots button does not', async () => {
        await renderItem();
        await fire(
            getRow(),
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
        );
        expect(h.pressElementLikeButton).toHaveBeenCalledTimes(1);
        expect(h.pressElementLikeButton.mock.calls[0][0].key).toBe('Enter');
        await fire(
            host.querySelector('.dots')!,
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
        );
        expect(h.pressElementLikeButton).toHaveBeenCalledTimes(1);
    });
});
