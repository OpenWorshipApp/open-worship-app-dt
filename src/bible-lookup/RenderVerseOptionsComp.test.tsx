// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    genVerseList: vi.fn(),
    getVersesCount: vi.fn(),
    applyTarget: vi.fn(),
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
        useAppStateAsync: <T,>(load: () => T | Promise<T>, deps: unknown[]) => {
            const [value, setValue] = react.useState<T | undefined>();
            react.useEffect(() => {
                let active = true;
                void Promise.resolve(load()).then((result) => {
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
vi.mock('../bible-reader/BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => ({
        applyTargetOrBibleKey: h.applyTarget,
    }),
}));
vi.mock('../bible-list/bibleHelpers', () => ({
    genVerseList: h.genVerseList,
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    getVersesCount: h.getVersesCount,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => 'Test Serif',
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));

import RenderVerseOptionsComp from './RenderVerseOptionsComp';

let root: Root;
let container: HTMLDivElement;
let bibleItem: {
    bibleKey: string;
    target: {
        bookKey: string;
        chapter: number;
        verseStart: number;
        verseEnd: number;
    };
};
let originalElementFromPoint: typeof document.elementFromPoint | undefined;

async function render() {
    await act(async () =>
        root.render(
            createElement(RenderVerseOptionsComp, {
                bibleItem: bibleItem as any,
            }),
        ),
    );
}

function verse(number: number) {
    const element = container.querySelector<HTMLElement>(
        `[data-verse-index="${number}"]`,
    );
    expect(element).not.toBeNull();
    return element!;
}

function touchEvent(type: string, number: number) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', {
        value: type === 'touchend' ? [] : [{ clientX: number, clientY: 5 }],
    });
    return event;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.genVerseList.mockReset().mockResolvedValue([
        [1, 'One'],
        [2, 'Two'],
        [3, 'Three'],
        [4, 'Four'],
        [5, 'Five'],
    ]);
    h.getVersesCount.mockReset().mockResolvedValue(5);
    h.applyTarget.mockClear();
    bibleItem = {
        bibleKey: 'en',
        target: {
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 2,
            verseEnd: 3,
        },
    };
    originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = (x) => verse(x);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    if (originalElementFromPoint) {
        document.elementFromPoint = originalElementFromPoint;
    } else {
        delete (document as any).elementFromPoint;
    }
    vi.unstubAllGlobals();
});

describe('Bible lookup verse options', () => {
    it('shows the selected passage and applies the whole chapter', async () => {
        await render();
        expect(h.genVerseList).toHaveBeenCalledWith({
            bibleKey: 'en',
            bookKey: 'GEN',
            chapter: 1,
        });
        expect(verse(2).className).toContain('selected-start');
        expect(verse(3).className).toContain('selected-end');
        expect(
            container.querySelector('.render-found')?.getAttribute('style'),
        ).toContain('font-family: Test Serif');
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>(
                    '[aria-label="Show all verses"]',
                )!
                .click(),
        );
        expect(h.applyTarget.mock.calls[0][1].target).toEqual({
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 1,
            verseEnd: 5,
        });
    });

    it('selects a mouse-dragged range and applies it on mouseup', async () => {
        await render();
        await act(async () =>
            verse(4).dispatchEvent(
                new MouseEvent('mousedown', { bubbles: true }),
            ),
        );
        await act(async () =>
            verse(2).dispatchEvent(
                new MouseEvent('mouseover', { bubbles: true }),
            ),
        );
        expect(verse(2).className).toContain('selected-start');
        expect(verse(4).className).toContain('selected-end');
        await act(async () =>
            document.body.dispatchEvent(
                new MouseEvent('mouseup', { bubbles: true }),
            ),
        );
        expect(h.applyTarget.mock.calls.at(-1)![1].target).toMatchObject({
            verseStart: 2,
            verseEnd: 4,
        });
    });

    it('extends a range with Shift and accepts Enter on a verse', async () => {
        await render();
        await act(async () =>
            verse(5).dispatchEvent(
                new MouseEvent('mousedown', {
                    bubbles: true,
                    shiftKey: true,
                }),
            ),
        );
        expect(h.applyTarget.mock.calls.at(-1)![1].target).toMatchObject({
            verseStart: 2,
            verseEnd: 5,
        });
        await act(async () =>
            verse(1).dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    bubbles: true,
                    cancelable: true,
                }),
            ),
        );
        expect(h.applyTarget.mock.calls.at(-1)![1].target).toMatchObject({
            verseStart: 1,
            verseEnd: 1,
        });
        expect(verse(1).getAttribute('role')).toBe('button');
    });

    it('selects the range under a touch drag', async () => {
        await render();
        const grid = container.querySelector<HTMLElement>('.verse-select')!;
        await act(async () => grid.dispatchEvent(touchEvent('touchstart', 2)));
        await act(async () => grid.dispatchEvent(touchEvent('touchmove', 4)));
        await act(async () => grid.dispatchEvent(touchEvent('touchend', 4)));
        expect(h.applyTarget.mock.calls.at(-1)![1].target).toMatchObject({
            verseStart: 2,
            verseEnd: 4,
        });
    });

    it('follows a changed target and hides the all-verses action when full', async () => {
        await render();
        bibleItem = {
            ...bibleItem,
            target: {
                ...bibleItem.target,
                verseStart: 1,
                verseEnd: 5,
            },
        };
        await render();
        expect(verse(1).className).toContain('selected-start');
        expect(verse(5).className).toContain('selected-end');
        expect(
            container.querySelector('[aria-label="Show all verses"]'),
        ).toBeNull();
    });
});
