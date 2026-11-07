// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterAll,
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/sanitizeHelpers', () => ({
    sanitizeHtml: (html: string) => html,
}));
vi.mock('./DailyTipComp', () => ({ default: () => null }));
vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: true } },
}));

import ToastEventListener from '../event/ToastEventListener';
import ToastComp, { MAX_STACKED_TOAST_COUNT } from './ToastComp';
import {
    DEFAULT_TOAST_TIMEOUT,
    MOUSE_LEAVING_TOAST_TIMEOUT,
} from './SimpleToastComp';
import { createSimpleToastUpdater, showSimpleToast } from './toastHelpers';
import { useToastClose } from './toastCloseContext';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
        root.render(<ToastComp />);
    });
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('ToastComp', () => {
    test('replaces a stale progress toast even while it remains open', async () => {
        const replacementKey = Symbol('download');
        await act(async () => {
            ToastEventListener.showSimpleToast({
                title: 'Download From URL',
                message: 'Downloading audio, please wait...',
                replacementKey,
            });
            await Promise.resolve();
        });

        const progressToast = container.querySelector('[role="alert"]');
        expect(progressToast?.textContent).toContain('please wait');

        await act(async () => {
            ToastEventListener.showSimpleToast({
                title: 'Download From URL',
                message: 'Audio downloaded successfully',
                replacementKey,
            });
            await Promise.resolve();
        });

        const toasts = container.querySelectorAll('[role="alert"]');
        expect(toasts).toHaveLength(1);
        expect(toasts[0]?.textContent).toContain(
            'Audio downloaded successfully',
        );
        expect(toasts[0]?.textContent).not.toContain('please wait');
    });
});

describe('toasts from showSimpleToast', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        act(() => {
            vi.runOnlyPendingTimers();
        });
        vi.useRealTimers();
    });

    afterAll(() => {
        delete (globalThis as any).testSimpleToasts;
    });

    async function flush() {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
    }

    function wait(ms: number) {
        act(() => {
            vi.advanceTimersByTime(ms);
        });
    }

    function titles() {
        return [
            ...container.querySelectorAll(
                '[role="alert"] .toast-header strong',
            ),
        ].map((element) => element.textContent);
    }

    function bodies() {
        return [
            ...container.querySelectorAll('[role="alert"] .toast-body'),
        ].map((element) => element.textContent);
    }

    test('a toast closes itself after four seconds, or after the time it asked for', async () => {
        showSimpleToast('Saved', 'Your slide was saved');
        showSimpleToast('Deleted', 'Undo?', 10_000);
        await flush();
        expect(titles()).toEqual(['Saved', 'Deleted']);
        expect(bodies()).toEqual(['Your slide was saved', 'Undo?']);
        wait(DEFAULT_TOAST_TIMEOUT - 1);
        expect(titles()).toEqual(['Saved', 'Deleted']);
        wait(1);
        expect(titles()).toEqual(['Deleted']);
        wait(10_000 - DEFAULT_TOAST_TIMEOUT - 1);
        expect(titles()).toEqual(['Deleted']);
        wait(1);
        expect(titles()).toEqual([]);
    });

    test('a hover holds a toast open, and leaving gives it two more seconds', async () => {
        showSimpleToast('Hold me', 'Reading this');
        await flush();
        const toast = container.querySelector('[role="alert"]')!;
        act(() => {
            toast.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        });
        wait(60_000);
        expect(titles()).toEqual(['Hold me']);
        act(() => {
            toast.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        });
        wait(MOUSE_LEAVING_TOAST_TIMEOUT - 1);
        expect(titles()).toEqual(['Hold me']);
        wait(1);
        expect(titles()).toEqual([]);
    });

    test('the close button takes off only its own toast', async () => {
        showSimpleToast('First', 'one');
        showSimpleToast('Second', 'two');
        await flush();
        const close = container.querySelector<HTMLButtonElement>(
            '[role="alert"] .btn-close',
        )!;
        expect(close.getAttribute('aria-label')).toBe('Close');
        act(() => {
            close.click();
        });
        expect(titles()).toEqual(['Second']);
    });

    test('a burst keeps only the newest five', async () => {
        for (let i = 1; i <= MAX_STACKED_TOAST_COUNT + 2; i++) {
            showSimpleToast(`Toast ${i}`, 'burst');
        }
        await flush();
        expect(titles()).toEqual([
            'Toast 3',
            'Toast 4',
            'Toast 5',
            'Toast 6',
            'Toast 7',
        ]);
    });

    test('each updater replaces only its own last toast, with the time it asks for', async () => {
        const download = createSimpleToastUpdater();
        const upload = createSimpleToastUpdater();
        download('Download', 'Downloading...');
        upload('Upload', 'Uploading...');
        await flush();
        download('Download', 'Downloaded', 8000);
        await flush();
        expect(bodies()).toEqual(['Uploading...', 'Downloaded']);
        wait(DEFAULT_TOAST_TIMEOUT);
        expect(bodies()).toEqual(['Downloaded']);
        wait(8000 - DEFAULT_TOAST_TIMEOUT);
        expect(bodies()).toEqual([]);
    });

    test('an action in a message closes its own toast; outside a toast it closes nothing', async () => {
        function UndoComp() {
            const close = useToastClose();
            return (
                <button type="button" className="undo" onClick={close}>
                    Undo
                </button>
            );
        }
        showSimpleToast('Text colour changed', <UndoComp />);
        showSimpleToast('Other', 'stays');
        await flush();
        act(() => {
            container.querySelector<HTMLButtonElement>('.undo')!.click();
        });
        expect(titles()).toEqual(['Other']);

        const loose = document.createElement('div');
        document.body.appendChild(loose);
        const looseRoot = createRoot(loose);
        act(() => {
            looseRoot.render(<UndoComp />);
        });
        act(() => {
            loose.querySelector<HTMLButtonElement>('.undo')!.click();
        });
        expect(loose.textContent).toBe('Undo');
        expect(titles()).toEqual(['Other']);
        act(() => {
            looseRoot.unmount();
        });
        loose.remove();
    });

    test('the dev testSimpleToasts shows three toasts half a second apart', async () => {
        const testSimpleToasts = (globalThis as any)
            .testSimpleToasts as () => Promise<void>;
        expect(typeof testSimpleToasts).toBe('function');
        const done = testSimpleToasts();
        await flush();
        expect(titles()).toEqual(['1: Test Title']);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        expect(titles()).toEqual(['1: Test Title', '2: Another Test Title']);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
            await done;
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(titles()).toEqual([
            '1: Test Title',
            '2: Another Test Title',
            '3: Yet Another Test Title',
        ]);
    });
});
