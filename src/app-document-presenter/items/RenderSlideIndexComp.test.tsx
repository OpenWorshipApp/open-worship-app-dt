// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    notifyElementHighlightMock: vi.fn(),
    bringDomToCenterViewMock: vi.fn(),
}));

vi.mock('../../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../helper/domHelpers', () => ({
    notifyElementHighlight: mocks.notifyElementHighlightMock,
}));
vi.mock('../../helper/helpers', () => ({
    bringDomToCenterView: mocks.bringDomToCenterViewMock,
}));

import { APP_DOCUMENT_ITEM_CLASS } from './appDocumentConstants';
import RenderSlideIndexComp from './RenderSlideIndexComp';

let container: HTMLDivElement;
let root: Root;

async function render(node: ReactNode) {
    await act(async () => {
        root.render(node);
    });
}

function getBadge() {
    return container.querySelector<HTMLDivElement>('.badge')!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    // jsdom has no CSS.escape; this one escapes the quotes the key may hold.
    vi.stubGlobal('CSS', {
        escape: (text: string) => text.replaceAll('"', '\\"'),
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

describe('RenderSlideIndexComp', () => {
    test('a badge outside a slide shows the index, is pressable and is keyed by the card', async () => {
        await render(<RenderSlideIndexComp viewIndex={3} dataKey="a-3" />);

        const badge = getBadge();
        expect(badge.textContent).toBe('3');
        expect(badge.title).toBe('Index: 3');
        expect(badge.getAttribute('data-slide-badge-key')).toBe('a-3');
        expect(badge.classList.contains('app-caught-hover-pointer')).toBe(true);
    });

    test('a badge inside a slide is keyed apart and does not look pressable', async () => {
        await render(
            <RenderSlideIndexComp
                viewIndex={3}
                dataKey="a-3"
                isInSlide
                title="Slide 3 of 9"
            />,
        );

        const badge = getBadge();
        expect(badge.title).toBe('Slide 3 of 9');
        expect(badge.getAttribute('data-slide-badge-key')).toBe('slide-a-3');
        expect(badge.classList.contains('app-caught-hover-pointer')).toBe(
            false,
        );

        await act(async () => {
            badge.click();
        });
        expect(mocks.notifyElementHighlightMock).not.toHaveBeenCalled();
    });

    test('pressing a badge rings the card whose slide carries the same key', async () => {
        const card = document.createElement('div');
        card.className = APP_DOCUMENT_ITEM_CLASS;
        const slideBadge = document.createElement('div');
        slideBadge.setAttribute('data-slide-badge-key', 'slide-a-3');
        card.append(slideBadge);
        document.body.append(card);
        await render(<RenderSlideIndexComp viewIndex={3} dataKey="a-3" />);

        await act(async () => {
            getBadge().click();
        });

        expect(mocks.notifyElementHighlightMock).toHaveBeenCalledWith(
            expect.any(Function),
            { moveToView: mocks.bringDomToCenterViewMock, type: 'warning' },
        );
        const [getElement] = mocks.notifyElementHighlightMock.mock.lastCall as [
            () => HTMLElement | null,
        ];
        expect(getElement()).toBe(card);

        slideBadge.remove();
        expect(getElement()).toBeNull();
    });

    test('a badge whose slide is not in any card rings nothing', async () => {
        const loose = document.createElement('div');
        loose.setAttribute('data-slide-badge-key', 'slide-b"1');
        document.body.append(loose);
        await render(<RenderSlideIndexComp viewIndex={1} dataKey={'b"1'} />);

        await act(async () => {
            getBadge().click();
        });

        const [getElement] = mocks.notifyElementHighlightMock.mock.lastCall as [
            () => HTMLElement | null,
        ];
        expect(getElement()).toBeNull();
    });
});
