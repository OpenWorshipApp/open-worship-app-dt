// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The real label and strip helpers (`keyboardScreencastHelpers`) — the
// component is the listener and the timer around them.
const { providerMock } = vi.hoisted(() => ({
    providerMock: {
        systemUtils: {
            isDev: false,
            isWindows: true,
            isMac: false,
            isLinux: false,
        },
    },
}));

vi.mock('../server/appProvider', () => ({ default: providerMock }));
vi.mock('../helper/helpers', () => ({
    cloneJson: <T,>(value: T) => structuredClone(value),
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

import KeyboardScreencastComp from './KeyboardScreencastComp';
import { KEYSTROKE_HIDE_DELAY_MS } from './keyboardScreencastHelpers';

let container: HTMLDivElement;
let root: Root;

async function press(init: KeyboardEventInit, target?: Element) {
    await act(async () => {
        (target ?? document.body).dispatchEvent(
            new KeyboardEvent('keydown', { bubbles: true, ...init }),
        );
    });
}

function readPills() {
    return Array.from(
        container.querySelectorAll('.keyboard-screencast-key'),
    ).map((pill) => pill.textContent);
}

beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
        root.render(createElement(KeyboardScreencastComp));
    });
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('KeyboardScreencastComp', () => {
    test('puts nothing in the DOM until a key is pressed', () => {
        expect(container.innerHTML).toBe('');
    });

    test('shows each press, collapsing a repeat into a count', async () => {
        await press({ key: 'b', code: 'KeyB', ctrlKey: true });
        await press({ key: 'ArrowDown' });
        await press({ key: 'ArrowDown' });

        const strip = container.querySelector('#keyboard-screencast')!;
        expect(strip.getAttribute('aria-hidden')).toBe('true');
        expect(readPills()).toEqual(['Ctrl+B', '↓×2']);
        expect(
            container.querySelector('.keyboard-screencast-count')!.textContent,
        ).toBe('×2');
    });

    test('ignores auto-repeat and keys with nothing to show', async () => {
        await press({ key: 'a', repeat: true });
        await press({ key: 'Process' });
        expect(container.innerHTML).toBe('');
    });

    test('still shows a key a component swallowed', async () => {
        const field = document.createElement('input');
        field.addEventListener('keydown', (event) => {
            event.stopPropagation();
        });
        document.body.append(field);
        await press({ key: 'Enter' }, field);
        expect(readPills()).toEqual(['Enter']);
        field.remove();
    });

    test('clears itself a moment after the LAST key', async () => {
        await press({ key: 'F5' });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(KEYSTROKE_HIDE_DELAY_MS - 600);
        });
        await press({ key: 'F6' });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(KEYSTROKE_HIDE_DELAY_MS - 1);
        });
        // The second key restarted the clock.
        expect(readPills()).toEqual(['F5', 'F6']);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        expect(container.innerHTML).toBe('');
    });

    test('unmounting stops listening and leaves no timer behind', async () => {
        await press({ key: 'F7' });
        expect(vi.getTimerCount()).toBe(1);
        act(() => {
            root.unmount();
        });
        root = createRoot(container);
        expect(vi.getTimerCount()).toBe(0);
        await press({ key: 'F8' });
        expect(container.innerHTML).toBe('');
    });
});
