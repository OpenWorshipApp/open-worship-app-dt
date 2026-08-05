// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import ToastEventListener from '../event/ToastEventListener';
import ToastComp, { MAX_STACKED_TOAST_COUNT } from './ToastComp';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

// hops a real macrotask, or an equivalent fake-timer tick when the test drives
// the toast timers with fake timers
async function wait(time: number) {
    await act(async () => {
        if (vi.isFakeTimers()) {
            await vi.advanceTimersByTimeAsync(time);
            return;
        }
        await new Promise((resolve) => {
            setTimeout(resolve, time);
        });
    });
}

async function flush() {
    await wait(0);
}

async function showToast(title: string, timeout?: number) {
    await act(async () => {
        ToastEventListener.showSimpleToast({
            title,
            message: `message of ${title}`,
            timeout,
        });
    });
    await flush();
}

function getToastTitles() {
    const elements = container?.querySelectorAll(
        '.app-toast-stack .toast .toast-header strong',
    );
    return Array.from(elements ?? []).map((element) => {
        return element.textContent;
    });
}

describe('ToastComp', () => {
    beforeEach(async () => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(<ToastComp />);
        });
    });

    afterEach(async () => {
        await act(async () => {
            root?.unmount();
        });
        container?.remove();
        container = null;
        root = null;
    });

    test('renders nothing until a toast is shown', () => {
        expect(container?.querySelector('.app-toast-stack')).toBeNull();
    });

    test('stacks toasts instead of replacing each other', async () => {
        await showToast('1');
        await showToast('2');
        await showToast('3');

        expect(getToastTitles()).toEqual(['1', '2', '3']);
    });

    test('closing one toast keeps the rest of the stack', async () => {
        await showToast('1');
        await showToast('2');
        await showToast('3');

        const closeButtons = container?.querySelectorAll<HTMLButtonElement>(
            '.app-toast-stack .toast .btn-close',
        );
        await act(async () => {
            closeButtons?.[1].click();
        });
        await flush();

        expect(getToastTitles()).toEqual(['1', '3']);
    });

    test('drops the oldest toasts past the stack limit', async () => {
        const count = MAX_STACKED_TOAST_COUNT + 2;
        for (let i = 1; i <= count; i++) {
            await showToast(`${i}`);
        }

        expect(getToastTitles()).toEqual(
            Array.from({ length: MAX_STACKED_TOAST_COUNT }, (_, index) => {
                return `${count - MAX_STACKED_TOAST_COUNT + index + 1}`;
            }),
        );
    });

    test('auto-dismisses each toast on its own timer', async () => {
        // fake timers, otherwise a loaded whole-suite run can burn through the
        // 100ms lifetime before the first assertion and flake
        vi.useFakeTimers();
        try {
            await showToast('1', 100);
            await showToast('2', 400);
            expect(getToastTitles()).toEqual(['1', '2']);

            await wait(200);
            expect(getToastTitles()).toEqual(['2']);

            await wait(300);
            expect(container?.querySelector('.app-toast-stack')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });
});
