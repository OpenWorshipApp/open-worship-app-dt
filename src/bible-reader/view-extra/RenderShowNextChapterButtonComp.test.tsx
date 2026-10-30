// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));

import RenderShowNextChapterButtonComp from './RenderShowNextChapterButtonComp';

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

async function render(onClick: () => void, isLoading?: boolean) {
    await act(async () => {
        root.render(
            <RenderShowNextChapterButtonComp
                onClick={onClick}
                isLoading={isLoading}
            />,
        );
    });
    return host.querySelector('button')!;
}

describe('RenderShowNextChapterButtonComp', () => {
    test('a named "..." that reads one more chapter', async () => {
        const onClick = vi.fn();
        const button = await render(onClick);
        expect(button.textContent).toBe('...');
        expect(button.getAttribute('aria-label')).toBe('Show the next chapter');
        expect(button.title).toBe('Show the next chapter');
        expect(button.disabled).toBe(false);
        await act(async () => {
            button.click();
        });
        expect(onClick).toHaveBeenCalledOnce();
    });

    test('cannot be pressed again while that chapter loads', async () => {
        const onClick = vi.fn();
        const button = await render(onClick, true);
        expect(button.disabled).toBe(true);
        await act(async () => {
            button.click();
        });
        expect(onClick).not.toHaveBeenCalled();
    });
});
