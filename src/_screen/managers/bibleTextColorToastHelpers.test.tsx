// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    showSimpleToast: vi.fn(),
    closeToast: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../../toast/toastCloseContext', () => ({
    useToastClose: () => h.closeToast,
}));

import { showBibleTextColorChangedToast } from './bibleTextColorToastHelpers';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('showBibleTextColorChangedToast', () => {
    test('tells, without asking, for ten seconds', () => {
        showBibleTextColorChangedToast(vi.fn());
        expect(h.showSimpleToast).toHaveBeenCalledTimes(1);
        const [title, , timeout] = h.showSimpleToast.mock.calls[0];
        expect(title).toBe('Background and Color');
        expect(timeout).toBe(10e3);
    });

    test('Undo runs once, disables itself and closes the toast', async () => {
        const onUndo = vi.fn();
        showBibleTextColorChangedToast(onUndo);
        const body = h.showSimpleToast.mock.calls[0][1] as ReactElement;
        await act(async () => {
            root.render(body);
        });
        expect(container.textContent).toContain(
            'The text color was changed so it stays visible on the new background color.',
        );
        const undo = container.querySelector('button')!;
        expect(undo.textContent).toBe('Undo');
        expect(undo.disabled).toBe(false);

        await act(async () => {
            undo.click();
        });
        expect(onUndo).toHaveBeenCalledTimes(1);
        expect(h.closeToast).toHaveBeenCalledTimes(1);
        expect(undo.disabled).toBe(true);

        // A second press on a disabled button does nothing.
        await act(async () => {
            undo.click();
        });
        expect(onUndo).toHaveBeenCalledTimes(1);
    });
});
