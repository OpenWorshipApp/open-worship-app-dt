// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('./PathPreviewerComp', () => ({
    PathPreviewerComp: ({ dirOrFilePath }: { dirOrFilePath: string }) => (
        <span className="path-previewer">{dirOrFilePath}</span>
    ),
}));

import RenderPathTitleComp from './RenderPathTitleComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('RenderPathTitleComp', () => {
    test('shows the folder path followed by the extra controls', async () => {
        await act(async () =>
            root.render(
                <RenderPathTitleComp
                    dirSource={{ dirPath: '/data/Songs' } as any}
                    extraElements={<button type="button">Sort</button>}
                />,
            ),
        );
        expect(host.querySelector('.path-previewer')!.textContent).toBe(
            '/data/Songs',
        );
        expect(host.lastElementChild!.textContent).toBe('Sort');
    });

    test('a list with no folder chosen shows no title at all', async () => {
        await act(async () =>
            root.render(
                <RenderPathTitleComp
                    dirSource={{ dirPath: '' } as any}
                    extraElements={<button type="button">Sort</button>}
                />,
            ),
        );
        expect(host.innerHTML).toBe('');
    });
});
