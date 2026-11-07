// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readLangPackageDictionaries } from '../test-setup/langPackageDirs';

const { state } = vi.hoisted(() => ({
    state: { dictionaries: [] as Record<string, string>[] },
}));

// English back for the queries, both real dictionaries checked on the way.
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => {
        for (const dictionary of state.dictionaries) {
            if (dictionary[key.trim().toLowerCase()] === undefined) {
                throw new Error(`Missing translation: ${key}`);
            }
        }
        return key;
    },
}));

import ScreensRendererComp from './ScreensRendererComp';
import { genColorFromScreenId } from '../_screen/preview/screenIdColorHelpers';

type ItemType = { id: string; title?: string };

const dictionaries = readLangPackageDictionaries();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    state.dictionaries = dictionaries;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
});

async function render(
    list: [number, ItemType][],
    handleForegroundHiding: (screenId: number, data: ItemType) => void,
    extra: { isMini?: boolean; title?: string; withTitle?: boolean } = {},
) {
    const { withTitle = true, ...rest } = extra;
    await act(async () => {
        root.render(
            <ScreensRendererComp<ItemType>
                showingScreenIdDataList={list}
                buttonText="Hide Messages"
                handleForegroundHiding={handleForegroundHiding}
                genTitle={
                    withTitle
                        ? (data) => {
                              return data.title ?? '';
                          }
                        : undefined
                }
                {...rest}
            />,
        );
    });
}

function getChips() {
    return Array.from(
        container.querySelectorAll<HTMLButtonElement>('.fg-hide'),
    );
}

describe('the on-screen chips', () => {
    test('draws nothing while nothing is on a screen', async () => {
        await render([], vi.fn());
        expect(container.innerHTML).toBe('');
    });

    test('one chip per screen keeps the widget words and takes its own item off', async () => {
        const onHide = vi.fn();
        const first = { id: 'a', title: 'Welcome' };
        const second = { id: 'b', title: 'Offering' };
        await render(
            [
                [1, first],
                [2, second],
            ],
            onHide,
            { title: 'On screens' },
        );
        expect(
            container.querySelector('.fg-onscreen')!.getAttribute('title'),
        ).toBe('On screens');
        const chips = getChips();
        expect(
            chips.map((chip) => {
                return chip.getAttribute('aria-label');
            }),
        ).toEqual(['Hide Messages 1', 'Hide Messages 2']);
        // The words are on the chip itself, not only in a tooltip.
        expect(chips[0].textContent).toContain('Hide Messages');
        expect(chips[0].title).toBe('Welcome');
        const icon = chips[1].querySelector('[data-screen-id="2"]')!;
        expect(icon.getAttribute('title')).toBe('Remove from screen 2');
        expect(
            (chips[1].querySelector('[data-screen-icon-id="2"]') as HTMLElement)
                .style.color,
        ).not.toBe('');

        await act(async () => {
            chips[1].click();
        });
        expect(onHide).toHaveBeenCalledTimes(1);
        // Bound to its own screen and item (the click event rides after).
        expect(onHide.mock.calls[0].slice(0, 2)).toEqual([2, second]);
        // The icon inside has no press of its own: one click, one hide.
        await act(async () => {
            (icon as HTMLElement).click();
        });
        expect(onHide).toHaveBeenCalledTimes(2);
        expect(onHide.mock.calls[1].slice(0, 2)).toEqual([2, second]);
    });

    test('two things on one screen are told apart by their own words', async () => {
        const longTitle =
            'A   very long announcement\nabout the car park and the coffee after';
        await render(
            [
                [0, { id: 'a', title: longTitle }],
                [0, { id: 'b', title: '   ' }],
                [0, { id: 'c', title: 'Short' }],
                [4, { id: 'd', title: 'Alone' }],
            ],
            vi.fn(),
        );
        expect(
            getChips().map((chip) => {
                return chip.getAttribute('aria-label');
            }),
        ).toEqual([
            // Collapsed whitespace, cut at 40 characters with an ellipsis.
            'Hide Messages 0: A very long announcement about the car p…',
            // Nothing usable to name it by: its place among the three.
            'Hide Messages 0: 2',
            'Hide Messages 0: Short',
            // Alone on its screen, it needs no second name.
            'Hide Messages 4',
        ]);
    });

    test('with no title maker the chips carry no title and count instead', async () => {
        await render(
            [
                [3, { id: 'a', title: 'Ignored' }],
                [3, { id: 'b', title: 'Ignored too' }],
            ],
            vi.fn(),
            { withTitle: false },
        );
        const chips = getChips();
        expect(chips[0].hasAttribute('title')).toBe(false);
        expect(
            chips.map((chip) => {
                return chip.getAttribute('aria-label');
            }),
        ).toEqual(['Hide Messages 3: 1', 'Hide Messages 3: 2']);
    });

    test('the mini form is a row of screen icons that each take their item off', async () => {
        const onHide = vi.fn();
        const item = { id: 'x', title: 'Mini' };
        await render(
            [
                [5, item],
                [6, { id: 'y' }],
            ],
            onHide,
            { isMini: true },
        );
        expect(getChips()).toHaveLength(0);
        const icon = container.querySelector<HTMLElement>(
            '[data-screen-id="5"]',
        )!;
        expect(icon.title).toBe('Remove from screen 5');
        expect(icon.className).toContain('app-caught-hover-pointer');
        expect(
            (icon.querySelector('[data-screen-icon-id="5"]') as HTMLElement)
                .style.color,
        ).toBe(
            (() => {
                const probe = document.createElement('i');
                probe.style.color = genColorFromScreenId(5);
                return probe.style.color;
            })(),
        );
        await act(async () => {
            icon.click();
        });
        expect(onHide).toHaveBeenCalledTimes(1);
        // Bound to its own screen and item; the icon's event is passed after.
        expect(onHide.mock.calls[0][0]).toBe(5);
        expect(onHide.mock.calls[0][1]).toBe(item);
    });
});
