// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The presenter's Bibles tab: the Bible previewer is a lazy chunk, loaded
// behind a suspense fallback, with the custom-style toggle in its footer.

vi.mock('../others/AppSuspenseComp', async () => {
    const { Suspense } = await import('react');
    return {
        default: ({ children }: any) => (
            <Suspense fallback={<span data-testid="loading">Loading</span>}>
                {children}
            </Suspense>
        ),
    };
});
vi.mock('../screen-setting/BibleCustomStyleFloatingToggleComp', () => ({
    default: () => <button type="button">Custom style</button>,
}));
vi.mock('../bible-reader/BiblePreviewerRenderComp', () => ({
    default: ({ footerExtra }: any) => (
        <div data-testid="bible-previewer">
            <footer>{footerExtra}</footer>
        </div>
    ),
}));

import PresenterBiblePreviewerRenderComp from './PresenterBiblePreviewerRenderComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

describe('PresenterBiblePreviewerRenderComp', () => {
    test('loads the Bible previewer lazily with the style toggle in its footer', async () => {
        await act(async () => {
            root.render(<PresenterBiblePreviewerRenderComp />);
            // The previewer is a lazy chunk: let it resolve inside act.
            await new Promise((resolve) => setTimeout(resolve, 20));
        });
        const frame = container.firstElementChild as HTMLElement;
        expect(frame.className).toBe('w-100 h-100');
        expect(container.querySelector('[data-testid="loading"]')).toBeNull();
        const previewer = frame.querySelector(
            '[data-testid="bible-previewer"]',
        );
        expect(previewer?.querySelector('footer')?.textContent).toBe(
            'Custom style',
        );
    });
});
