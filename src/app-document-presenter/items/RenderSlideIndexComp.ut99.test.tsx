// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The index badge of a slide. Outside a slide (a stage's "next" list, a
// presenting flow row) a press finds the slide's own card in the previewer by
// the badge that card carries, and highlights it; inside the card it is only a
// label.

const { mocks } = vi.hoisted(() => ({
    mocks: {
        highlight: vi.fn(),
        center: vi.fn(),
    },
}));

vi.mock('../../helper/domHelpers', () => ({
    notifyElementHighlight: mocks.highlight,
}));
vi.mock('../../helper/helpers', () => ({
    bringDomToCenterView: mocks.center,
}));
vi.mock('../../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));

import RenderSlideIndexComp from './RenderSlideIndexComp';
import { APP_DOCUMENT_ITEM_CLASS } from './appDocumentConstants';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const extraElements: HTMLElement[] = [];

beforeEach(() => {
    // jsdom has no `CSS.escape`; quoting is all a quoted attribute needs.
    vi.stubGlobal('CSS', {
        escape: (value: string) => value.replace(/["\\]/g, '\\$&'),
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    for (const element of extraElements.splice(0)) {
        element.remove();
    }
    vi.unstubAllGlobals();
});

function addToPage(html: string) {
    const element = document.createElement('div');
    element.innerHTML = html;
    document.body.appendChild(element);
    extraElements.push(element);
    return element;
}

function badge() {
    return container.firstElementChild as HTMLElement;
}

describe('RenderSlideIndexComp', () => {
    test('a badge outside a slide highlights that slide card in the previewer', async () => {
        const dataKey = '/docs/a "b".ows<id>3';
        await act(async () => {
            root.render(
                <RenderSlideIndexComp viewIndex={3} dataKey={dataKey} />,
            );
        });
        expect(badge().textContent).toBe('3');
        expect(badge().title).toBe('Index: 3');
        expect(badge().className).toContain('app-caught-hover-pointer');
        expect(badge().dataset.slideBadgeKey).toBe(dataKey);

        await act(async () => badge().click());
        expect(mocks.highlight).toHaveBeenCalledExactlyOnceWith(
            expect.any(Function),
            { moveToView: mocks.center, type: 'warning' },
        );
        const getElement = mocks.highlight.mock.calls[0][0] as () => unknown;
        // Its card is not drawn: nothing to highlight.
        expect(getElement()).toBeNull();

        // A badge with that key but outside any card is not the card.
        const loose = addToPage('<span></span>');
        loose.firstElementChild!.setAttribute(
            'data-slide-badge-key',
            `slide-${dataKey}`,
        );
        expect(getElement()).toBeNull();
        loose.remove();

        const page = addToPage(
            `<div class="${APP_DOCUMENT_ITEM_CLASS}"><span></span></div>`,
        );
        const card = page.firstElementChild!;
        card.firstElementChild!.setAttribute(
            'data-slide-badge-key',
            `slide-${dataKey}`,
        );
        expect(getElement()).toBe(card);
    });

    test('the badge on the slide card itself is only a label', async () => {
        await act(async () => {
            root.render(
                <RenderSlideIndexComp
                    viewIndex={2}
                    dataKey="/docs/a.ows<id>2"
                    isInSlide
                    title="Second slide"
                />,
            );
        });
        expect(badge().title).toBe('Second slide');
        expect(badge().className).not.toContain('app-caught-hover-pointer');
        expect(badge().dataset.slideBadgeKey).toBe('slide-/docs/a.ows<id>2');
        await act(async () => badge().click());
        expect(mocks.highlight).not.toHaveBeenCalled();
    });
});
