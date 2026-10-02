// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        showAppContextMenu: vi.fn((_event: any, _items: any[]) => {
            return {
                promiseDone: new Promise<void>(() => {}),
                closeMenu: () => {},
            };
        }),
    };
});

vi.mock('../helper/appHooks', () => ({
    // No title yet: the parts fall back to the target's own keys.
    useAppStateAsync: () => [undefined],
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: async () => ({
        keyBookMap: { GEN: 'Genesis', EXO: 'Exodus' },
        booksAvailable: ['GEN', 'EXO'],
    }),
    getVerses: async () => ({}),
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers1', () => ({
    getModelChapterCount: () => 50,
    getModelKeyBookMap: () => ({ GEN: 'Genesis', EXO: 'Exodus' }),
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    getVersesCount: async () => 31,
    toLocaleNumBible: async (_bibleKey: string, n: number) => `${n}`,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showAppContextMenu,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: async () => null,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import BibleViewTitleEditorComp from './BibleViewTitleEditorComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const bibleItem = {
    bibleKey: 'KJV',
    target: { bookKey: 'GEN', chapter: 1, verseStart: 1, verseEnd: 3 },
    toTitle: async () => '',
} as any;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    mocks.showAppContextMenu.mockClear();
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

describe('BibleViewTitleEditorComp keyboard', () => {
    // RD-33: the book, chapter and verses of a pane's title answered a
    // right-click only, so a keyboard could not change the passage from them.
    test("a pane title's parts are buttons a keyboard can press", async () => {
        act(() => {
            root.render(
                <BibleViewTitleEditorComp
                    bibleItem={bibleItem}
                    onTargetChange={() => {}}
                />,
            );
        });
        const partList = Array.from(host.querySelectorAll('[role="button"]'));

        expect(partList.map((part) => part.getAttribute('aria-label'))).toEqual(
            ['Book: GEN', 'Chapter: 1', 'Verse Start: 1', 'Verse End: 3'],
        );
        expect(partList.every((part) => part.getAttribute('tabindex'))).toBe(
            true,
        );

        await act(async () => {
            partList[0].dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(mocks.showAppContextMenu).toHaveBeenCalledTimes(1);
        const [event, itemList] = mocks.showAppContextMenu.mock.calls[0];
        expect(event.type).toBe('contextmenu');
        // The picker's header row is translated now, like its parts.
        expect(itemList[0].menuElement).toBe('Book');
        expect(itemList.map((item: any) => item.menuElement)).toContain(
            'Genesis',
        );
    });

    // In a Bibles list row the parts need Ctrl+right-click, and a tab stop
    // per part would bury the list.
    test('a list row title stays out of the tab order', () => {
        act(() => {
            root.render(
                <BibleViewTitleEditorComp
                    bibleItem={bibleItem}
                    withCtrl
                    onTargetChange={() => {}}
                />,
            );
        });

        expect(host.querySelector('[role="button"]')).toBeNull();
        expect(host.querySelector('[tabindex]')).toBeNull();
    });
});
