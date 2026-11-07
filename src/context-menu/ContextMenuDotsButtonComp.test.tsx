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

test('with no menu of its own it asks its host with a real right-click at the press', async () => {
    // Vitest's jsdom makes `window` the Node global, which jsdom's own
    // MouseEvent refuses as a `view`; in a page `window` is the Window.
    vi.stubGlobal('window', (globalThis as any).jsdom.window);
    const hostMenu = vi.fn();
    const hostClick = vi.fn();
    await act(async () =>
        root.render(
            <div
                onClick={hostClick}
                onContextMenu={(event) => {
                    hostMenu(event.nativeEvent);
                }}
            >
                <ContextMenuDotsButtonComp isHorizontal />
            </div>,
        ),
    );
    const button = host.querySelector('button') as HTMLButtonElement;
    expect(button.title).toBe('More Options');
    expect(button.querySelector('i')?.className).toBe('bi bi-three-dots');
    await act(async () => {
        button.dispatchEvent(
            new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: 25,
                clientY: 35,
            }),
        );
    });
    expect(hostClick).not.toHaveBeenCalled();
    expect(hostMenu).toHaveBeenCalledOnce();
    const asked = hostMenu.mock.calls[0][0] as MouseEvent;
    expect(asked.type).toBe('contextmenu');
    expect([asked.clientX, asked.clientY]).toEqual([25, 35]);
    expect(asked.target).toBe(button.parentElement);

    // Right-clicking the button itself asks the host once, not twice.
    await act(async () => {
        button.dispatchEvent(
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
        );
    });
    expect(hostMenu).toHaveBeenCalledTimes(2);
});

test('with no host element to ask it does nothing', async () => {
    const shadowHost = document.createElement('div');
    document.body.append(shadowHost);
    const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
    const shadowReactRoot = createRoot(shadowRoot);
    const hostMenu = vi.fn();
    shadowHost.addEventListener('contextmenu', hostMenu);
    try {
        await act(async () =>
            shadowReactRoot.render(<ContextMenuDotsButtonComp />),
        );
        const button = shadowRoot.querySelector('button') as HTMLButtonElement;
        expect(button.parentElement).toBeNull();
        const click = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            composed: true,
        });
        await act(async () => {
            button.dispatchEvent(click);
        });
        expect(click.defaultPrevented).toBe(true);
        expect(hostMenu).not.toHaveBeenCalled();
    } finally {
        act(() => shadowReactRoot.unmount());
        shadowHost.remove();
    }
});

test('a press that starts on it never starts the host drag or selection', async () => {
    const hostMouseDown = vi.fn();
    const hostPointerDown = vi.fn();
    await act(async () =>
        root.render(
            <div onMouseDown={hostMouseDown} onPointerDown={hostPointerDown}>
                <ContextMenuDotsButtonComp onOpening={vi.fn()} />
            </div>,
        ),
    );
    const button = host.querySelector('button') as HTMLButtonElement;
    await act(async () => {
        button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    expect(hostMouseDown).not.toHaveBeenCalled();
    expect(hostPointerDown).not.toHaveBeenCalled();
});
