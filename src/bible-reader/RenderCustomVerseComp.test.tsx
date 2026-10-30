// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    viewController: { id: 'view-controller' },
    reformCustomTitle: vi.fn(),
}));

vi.mock('../helper/bible-helpers/bibleLogicHelpers3', () => ({
    reformCustomTitle: h.reformCustomTitle,
}));
vi.mock('./BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => h.viewController,
}));

// The real sanitizer: what is drawn here is HTML out of a bible file.
import RenderCustomVerseComp from './RenderCustomVerseComp';

const BIBLE_ITEM = { id: 1, bibleKey: 'KJV' } as any;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
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

describe('RenderCustomVerseComp', () => {
    test('draws the verse html, cleaned, and lets the titles be reformed', async () => {
        await act(async () => {
            root.render(
                <RenderCustomVerseComp
                    bibleItem={BIBLE_ITEM}
                    customHtml={
                        '<span class="woc">Jesus wept.</span>' +
                        '<img src="x" onerror="alert(1)">' +
                        '<script>alert(2)</script>'
                    }
                />,
            );
        });
        const span = host.firstElementChild as HTMLSpanElement;
        expect(span.querySelector('.woc')!.textContent).toBe('Jesus wept.');
        expect(span.querySelector('script')).toBeNull();
        expect(span.innerHTML).not.toContain('onerror');
        expect(h.reformCustomTitle).toHaveBeenCalledWith(
            h.viewController,
            BIBLE_ITEM,
            span,
        );
    });

    test('a caller decorates the text once it is in the page', async () => {
        const decorateElement = vi.fn((element: HTMLSpanElement) => {
            // The injected text is already there to be read.
            expect(element.textContent).toBe('In the beginning');
        });
        await act(async () => {
            root.render(
                <RenderCustomVerseComp
                    bibleItem={BIBLE_ITEM}
                    customHtml="<i>In the beginning</i>"
                    decorateElement={decorateElement}
                />,
            );
        });
        expect(decorateElement).toHaveBeenCalledWith(host.firstElementChild);
        expect(h.reformCustomTitle.mock.invocationCallOrder[0]).toBeLessThan(
            decorateElement.mock.invocationCallOrder[0],
        );
    });

    test('an unmounted verse reforms nothing', async () => {
        await act(async () => {
            root.render(
                <RenderCustomVerseComp bibleItem={BIBLE_ITEM} customHtml="x" />,
            );
        });
        h.reformCustomTitle.mockClear();
        act(() => {
            root.unmount();
        });
        root = createRoot(host);
        expect(h.reformCustomTitle).not.toHaveBeenCalled();
    });
});
