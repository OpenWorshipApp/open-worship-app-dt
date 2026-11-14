// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    applyToTheTop: vi.fn(),
    pressElementLikeButton: vi.fn(),
}));

// What makes the arrow appear and scroll is `applyToTheTop`'s, tested in
// `scrollingHandlerHelpers.test.ts`; here, what is drawn and handed to it.
vi.mock('./scrollingHandlerHelpers', () => ({
    TO_THE_TOP_CLASSNAME: 'test-to-top',
    TO_THE_TOP_STYLE_STRING: '.test-to-top { opacity: 0; }',
    applyToTheTop: h.applyToTheTop,
}));
vi.mock('../helper/helpers', () => ({
    pressElementLikeButton: h.pressElementLikeButton,
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => `[${key}]`,
}));

import ScrollToTopComp from './ScrollToTopComp';

let root: Root;
let container: HTMLDivElement;

function arrow() {
    const element = container.querySelector<HTMLElement>('.test-to-top');
    expect(element).not.toBeNull();
    return element!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.applyToTheTop.mockReset();
    h.pressElementLikeButton.mockReset();
    container = document.createElement('div');
    container.className = 'scroller';
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('ScrollToTopComp', () => {
    test('draws the arrow with its sheet, named in the window language, where the host puts it', () => {
        act(() => {
            root.render(<ScrollToTopComp style={{ right: '12px' }} />);
        });
        expect(container.querySelector('style')?.textContent).toBe(
            '.test-to-top { opacity: 0; }',
        );
        const element = arrow();
        expect(element.className).toBe('test-to-top bi bi-arrow-up-circle');
        expect(element.getAttribute('role')).toBe('button');
        expect(element.tabIndex).toBe(0);
        expect(element.getAttribute('aria-label')).toBe('[Scroll to the top]');
        expect(element.style.width).toBe('45px');
        expect(element.style.height).toBe('45px');
        expect(element.style.right).toBe('12px');
        // Its parent is the box it scrolls when no selector names another.
        expect(element.parentElement).toBe(container);
        expect(h.applyToTheTop).toHaveBeenCalledWith(element, undefined);
    });

    test("takes a host's own class and the box it scrolls by selector", () => {
        act(() => {
            root.render(
                <ScrollToTopComp
                    className="app-low-hover-visible-1"
                    scrollingContainerSelector=".list-body"
                    style={{ bottom: '60px', width: '30px' }}
                />,
            );
        });
        const element = arrow();
        expect(element.className).toBe(
            'test-to-top bi bi-arrow-up-circle app-low-hover-visible-1',
        );
        // The host's size wins over the default one.
        expect(element.style.width).toBe('30px');
        expect(element.style.bottom).toBe('60px');
        expect(h.applyToTheTop).toHaveBeenLastCalledWith(element, '.list-body');
    });

    test('a key on it is pressed like a button', () => {
        act(() => {
            root.render(<ScrollToTopComp />);
        });
        act(() => {
            arrow().dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(h.pressElementLikeButton).toHaveBeenCalledTimes(1);
        expect(h.pressElementLikeButton.mock.calls[0][0].key).toBe('Enter');
    });
});
