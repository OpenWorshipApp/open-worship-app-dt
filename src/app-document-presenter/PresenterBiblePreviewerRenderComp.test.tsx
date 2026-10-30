// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../others/AppSuspenseComp', async () => {
    const { Suspense } = await import('react');
    return {
        default: ({ children }: { children: ReactNode }) => (
            <Suspense fallback={<div className="loading" />}>
                {children}
            </Suspense>
        ),
    };
});
vi.mock('../bible-reader/BiblePreviewerRenderComp', () => ({
    default: ({ footerExtra }: { footerExtra: ReactNode }) => (
        <div className="bible-previewer">
            <footer>{footerExtra}</footer>
        </div>
    ),
}));
vi.mock('../screen-setting/BibleCustomStyleFloatingToggleComp', () => ({
    default: () => <button type="button">Bible Style</button>,
}));

import PresenterBiblePreviewerRenderComp from './PresenterBiblePreviewerRenderComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
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

describe('PresenterBiblePreviewerRenderComp', () => {
    test('loads the Bible previewer lazily, full size, with the style toggle in its footer', async () => {
        await act(async () => {
            root.render(<PresenterBiblePreviewerRenderComp />);
        });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        const wrapper = container.firstElementChild!;
        expect(wrapper.className).toBe('w-100 h-100');
        expect(container.querySelector('.loading')).toBeNull();
        expect(
            wrapper.querySelector('.bible-previewer footer button')
                ?.textContent,
        ).toBe('Bible Style');
    });
});
