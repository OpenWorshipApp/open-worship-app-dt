// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return { showSimpleToast: vi.fn() };
});

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToast,
}));
vi.mock('../../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));

import { showBibleTextColorChangedToast } from './bibleTextColorToastHelpers';
import { ToastCloseContext } from '../../toast/toastCloseContext';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function showToast(onUndo: () => void) {
    showBibleTextColorChangedToast(onUndo);
    const [title, message, timeout] = mocks.showSimpleToast.mock.calls.at(-1)!;
    return { title, message: message as ReactElement, timeout };
}

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

describe('showBibleTextColorChangedToast', () => {
    test('tells, with an Undo, for long enough to reach it', () => {
        const { title, timeout } = showToast(() => {});

        expect(title).toBe('Background and Color');
        expect(timeout).toBe(10e3);
    });

    test('Undo runs once, closes the toast and cannot be pressed again', async () => {
        const onUndo = vi.fn();
        const closeToast = vi.fn();
        const { message } = showToast(onUndo);
        await act(async () => {
            root.render(
                <ToastCloseContext value={closeToast}>
                    {message}
                </ToastCloseContext>,
            );
        });

        expect(container.querySelector('span')?.textContent).toBe(
            'The text color was changed so it stays visible on the new background color.',
        );
        const button = container.querySelector('button')!;
        expect(button.textContent).toBe('Undo');
        expect(button.disabled).toBe(false);

        await act(async () => {
            button.click();
        });
        expect(onUndo).toHaveBeenCalledTimes(1);
        expect(closeToast).toHaveBeenCalledTimes(1);
        expect(button.disabled).toBe(true);

        // A disabled button does not fire again.
        await act(async () => {
            button.click();
        });
        expect(onUndo).toHaveBeenCalledTimes(1);
    });

    test('outside a toast the Undo still works', async () => {
        const onUndo = vi.fn();
        const { message } = showToast(onUndo);
        await act(async () => {
            root.render(message);
        });

        await act(async () => {
            container.querySelector('button')!.click();
        });
        expect(onUndo).toHaveBeenCalledTimes(1);
    });
});
