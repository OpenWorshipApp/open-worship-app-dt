// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
import ContextMenuDotsButtonComp from './ContextMenuDotsButtonComp';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => {
    vi.stubGlobal('MouseEvent', window.MouseEvent);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});
afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

test('opens its supplied menu without leaking the press to its clickable host', async () => {
    const opening = vi.fn();
    const hostClick = vi.fn();
    await act(async () =>
        root.render(
            <div onClick={hostClick}>
                <ContextMenuDotsButtonComp
                    onOpening={opening}
                    isCorner
                    label="Item actions"
                />
            </div>,
        ),
    );
    const button = host.querySelector('button') as HTMLButtonElement;
    await act(async () => button.click());
    expect(opening).toHaveBeenCalledOnce();
    expect(hostClick).not.toHaveBeenCalled();
    expect(button.title).toBe('Item actions');
    expect(button.className).toContain('--corner');
});
