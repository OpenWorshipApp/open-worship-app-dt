// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
    type Mock,
} from 'vitest';

const h = vi.hoisted(() => ({
    bringDomToTopView: vi.fn(),
}));

vi.mock('./BibleFindRenderPerPageComp', () => ({
    APP_FOUND_PAGE_CLASS: 'app-found-page',
}));
vi.mock('../helper/helpers', () => ({
    bringDomToTopView: h.bringDomToTopView,
}));
vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import RenderPageNumberComp from './RenderPageNumberComp';

let host: HTMLDivElement;
let root: Root;
let handleFinding: Mock<(page: string) => void>;

async function renderPage(pageNumber: string, isLoaded: boolean) {
    await act(async () => {
        root.render(
            <RenderPageNumberComp
                pageNumber={pageNumber}
                isLoaded={isLoaded}
                handleFinding={handleFinding}
            />,
        );
    });
    return host.querySelector<HTMLButtonElement>('button')!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    handleFinding = vi.fn<(page: string) => void>();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('a chunk number in the Find footer', () => {
    test('a loaded chunk whose results are no longer on screen does nothing', async () => {
        const button = await renderPage('7', true);
        expect(button.textContent).toBe('7');
        await act(async () => button.click());
        expect(h.bringDomToTopView).not.toHaveBeenCalled();
        expect(handleFinding).not.toHaveBeenCalled();
    });

    test('the press follows the props of the latest render', async () => {
        let button = await renderPage('7', false);
        await act(async () => button.click());
        expect(handleFinding).toHaveBeenLastCalledWith('7');

        const divider = document.createElement('div');
        divider.className = 'app-found-page-8';
        document.body.append(divider);
        button = await renderPage('8', true);
        expect(button.classList.contains('is-loaded')).toBe(true);
        await act(async () => button.click());
        expect(h.bringDomToTopView).toHaveBeenCalledWith(divider);
        expect(handleFinding).toHaveBeenCalledTimes(1);
        divider.remove();
    });
});
