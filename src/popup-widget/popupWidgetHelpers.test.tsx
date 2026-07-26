// @vitest-environment jsdom

import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

import {
    attemptLocking,
    popupWidgetManager,
    showAppAlert,
    showAppConfirm,
    showAppInput,
} from './popupWidgetHelpers';

describe('popupWidgetHelpers', () => {
    beforeEach(() => {
        popupWidgetManager.openConfirm = null;
        popupWidgetManager.openInput = null;
        popupWidgetManager.openAlert = null;
    });

    afterEach(() => {
        popupWidgetManager.openConfirm = null;
        popupWidgetManager.openInput = null;
        popupWidgetManager.openAlert = null;
    });

    test('returns false when no confirm or input popup opener is registered', async () => {
        await expect(showAppConfirm('Delete', 'Continue?')).resolves.toBe(
            false,
        );
        await expect(showAppInput('Rename', <div>body</div>)).resolves.toBe(
            false,
        );
    });

    test('opens confirm popups with options and resolves from the callback', async () => {
        let confirmPayload: any;
        popupWidgetManager.openConfirm = vi.fn((data) => {
            confirmPayload = data;
        });

        const promise = showAppConfirm('Delete', 'Continue?', {
            escToCancel: true,
            enterToOk: false,
            extraStyles: { width: '320px' },
            confirmButtonLabel: 'Delete',
        });

        expect(confirmPayload).toMatchObject({
            title: 'Delete',
            body: 'Continue?',
            escToCancel: true,
            enterToOk: false,
            extraStyles: { width: '320px' },
            confirmButtonLabel: 'Delete',
        });

        confirmPayload.onConfirm(true);

        await expect(promise).resolves.toBe(true);
    });

    test('opens input popups and resolves from the callback', async () => {
        let inputPayload: any;
        popupWidgetManager.openInput = vi.fn((data) => {
            inputPayload = data;
        });

        const body = <div className="rename-body">Rename body</div>;
        const promise = showAppInput('Rename', body, {
            escToCancel: false,
            enterToOk: true,
            extraStyles: { minHeight: '120px' },
        });

        expect(inputPayload).toMatchObject({
            title: 'Rename',
            body,
            escToCancel: false,
            enterToOk: true,
            extraStyles: { minHeight: '120px' },
        });

        inputPayload.onConfirm(false);

        await expect(promise).resolves.toBe(false);
    });

    test('returns immediately when no alert opener is registered and resolves after close otherwise', async () => {
        await expect(
            showAppAlert('Alert', 'Immediate'),
        ).resolves.toBeUndefined();

        let alertPayload: any;
        popupWidgetManager.openAlert = vi.fn((data) => {
            alertPayload = data;
        });

        const promise = showAppAlert('Notice', 'Done');

        expect(alertPayload).toMatchObject({
            title: 'Notice',
            message: 'Done',
        });

        alertPayload.onClose();

        await expect(promise).resolves.toBeUndefined();
    });
    test('only one locking popup is open at a time', async () => {
        vi.useFakeTimers();
        try {
            await attemptLocking('confirm', false);

            // a second popup waits for the first to release the lock
            let isSecondLocked = false;
            const secondLocking = attemptLocking('input', false).then(() => {
                isSecondLocked = true;
            });
            await vi.advanceTimersByTimeAsync(1000);
            expect(isSecondLocked).toBe(false);

            const unlocking = attemptLocking('confirm', true);
            await vi.advanceTimersByTimeAsync(1000);
            await unlocking;
            await vi.advanceTimersByTimeAsync(1000);
            await secondLocking;
            expect(isSecondLocked).toBe(true);

            await attemptLocking('input', true);
            // unlocking an already-free lock returns straight away
            await attemptLocking('input', true);
        } finally {
            vi.useRealTimers();
        }
    });

    test('the dev-only popup probe walks the confirm and input popups', async () => {
        const tryPopup = (globalThis as any).tryPopup;
        expect(tryPopup).toBeTypeOf('function');

        popupWidgetManager.openConfirm = vi.fn((data: any) => {
            data.onConfirm(true);
        });
        popupWidgetManager.openInput = vi.fn((data: any) => {
            data.onConfirm('typed');
        });
        popupWidgetManager.openAlert = vi.fn((data: any) => {
            data.onClose();
        });

        await expect(tryPopup()).resolves.toBeUndefined();
        expect(popupWidgetManager.openConfirm).toHaveBeenCalled();
    });
});
