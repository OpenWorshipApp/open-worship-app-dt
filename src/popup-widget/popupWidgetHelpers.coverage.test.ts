// @vitest-environment jsdom
import {
    afterAll,
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';

// The sibling `popupWidgetHelpers.test.ts` covers focus hand-back. This file
// covers the popup slot lock, `showAppInput`, the no-host answers, and the
// dev-only `tryPopup` walk -- registered at load only when `isDev` is true,
// which is why this file mocks the provider as dev.

vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: true } },
}));

import {
    attemptLocking,
    popupWidgetManager,
    showAppAlert,
    showAppConfirm,
    showAppInput,
} from './popupWidgetHelpers';

function trackPromise<T>(promise: Promise<T>) {
    const tracked = { isDone: false, value: undefined as T | undefined };
    promise.then((value) => {
        tracked.isDone = true;
        tracked.value = value;
    });
    return tracked;
}

beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
});

afterEach(() => {
    popupWidgetManager.openConfirm = null;
    popupWidgetManager.openInput = null;
    popupWidgetManager.openAlert = null;
    vi.useRealTimers();
});

afterAll(() => {
    delete (globalThis as any).tryPopup;
});

describe('the popup slot lock', () => {
    test('a second popup waits for the first one to close', async () => {
        await attemptLocking('confirm', false);
        const second = trackPromise(attemptLocking('alert', false));
        await vi.advanceTimersByTimeAsync(3000);
        expect(second.isDone).toBe(false);

        // Closing the confirm frees the slot; the alert takes it next tick.
        await attemptLocking('confirm', true);
        await vi.advanceTimersByTimeAsync(1000);
        expect(second.isDone).toBe(true);

        // Release the alert so the next test starts with a free slot.
        await attemptLocking('alert', true);
    });

    test('closing a popup that does not hold the slot waits, then gives up once free', async () => {
        await attemptLocking('input', false);
        const strayClose = trackPromise(attemptLocking('alert', true));
        await vi.advanceTimersByTimeAsync(2000);
        expect(strayClose.isDone).toBe(false);
        await attemptLocking('input', true);
        await vi.advanceTimersByTimeAsync(1000);
        expect(strayClose.isDone).toBe(true);
        // The slot is free: a new popup locks at once.
        const next = trackPromise(attemptLocking('confirm', false));
        await vi.advanceTimersByTimeAsync(0);
        expect(next.isDone).toBe(true);
        await attemptLocking('confirm', true);
    });

    test('closing with nothing open returns at once', async () => {
        const close = trackPromise(attemptLocking('alert', true));
        await vi.advanceTimersByTimeAsync(0);
        expect(close.isDone).toBe(true);
    });
});

describe('showAppInput', () => {
    test('opens the input host with the body and options, answering its OK', async () => {
        let opened: any = null;
        popupWidgetManager.openInput = (data) => {
            opened = data;
        };
        const canConfirm = () => true;
        const answer = showAppInput('Rename', 'BODY' as any, {
            canConfirm,
            escToCancel: true,
        });
        expect(opened.title).toBe('Rename');
        expect(opened.body).toBe('BODY');
        expect(opened.canConfirm).toBe(canConfirm);
        expect(opened.escToCancel).toBe(true);
        opened.onConfirm(true);
        await expect(answer).resolves.toBe(true);
    });

    test('answers false with no input host mounted', async () => {
        await expect(showAppInput('Rename', 'BODY' as any)).resolves.toBe(
            false,
        );
    });
});

describe('popups opened from nowhere in particular', () => {
    test('an alert with no host resolves at once', async () => {
        await expect(showAppAlert('Title', 'Message')).resolves.toBeUndefined();
    });

    test('with the page body focused, nothing is refocused afterwards', async () => {
        const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
        popupWidgetManager.openConfirm = (data) => {
            data!.onConfirm(false);
        };
        await expect(showAppConfirm('Title', 'Body')).resolves.toBe(false);
        await vi.runAllTimersAsync();
        expect(focusSpy).not.toHaveBeenCalled();
    });

    test('a control removed while the popup was open is not refocused', async () => {
        document.body.innerHTML = '<button id="gone">x</button>';
        const button = document.getElementById('gone') as HTMLButtonElement;
        button.focus();
        const focusSpy = vi.spyOn(button, 'focus');
        let close: (() => void) | null = null;
        popupWidgetManager.openAlert = (data) => {
            close = data!.onClose;
        };
        const closed = showAppAlert('Title', 'Message');
        button.remove();
        close!();
        await closed;
        await vi.runAllTimersAsync();
        expect(focusSpy).not.toHaveBeenCalled();
    });
});

describe('the dev tryPopup walk', () => {
    test('shows a confirm, two alerts, a confirm and an alert, in order', async () => {
        const seen: string[] = [];
        popupWidgetManager.openConfirm = (data) => {
            seen.push(`confirm:${data!.title}:${data!.confirmButtonLabel}`);
            data!.onConfirm(true);
        };
        popupWidgetManager.openAlert = (data) => {
            seen.push(`alert:${data!.title}`);
            data!.onClose();
        };
        const tryPopup = (globalThis as any).tryPopup as () => Promise<void>;
        expect(typeof tryPopup).toBe('function');
        await tryPopup();
        expect(seen).toEqual([
            'confirm:1: Confirm Title:Yes, proceed',
            'alert:2: Alert Title',
            'alert:3: Alert Title',
            'confirm:4: Confirm Title:Yes, proceed',
            'alert:5: Alert Title',
        ]);
    });
});
