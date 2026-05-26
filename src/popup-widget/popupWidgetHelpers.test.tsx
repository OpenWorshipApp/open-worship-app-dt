import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

import {
    closeAlert,
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

    test('closes all open popup types through the manager', () => {
        const openConfirmMock = vi.fn();
        const openInputMock = vi.fn();
        const openAlertMock = vi.fn();
        popupWidgetManager.openConfirm = openConfirmMock;
        popupWidgetManager.openInput = openInputMock;
        popupWidgetManager.openAlert = openAlertMock;

        closeAlert();

        expect(openConfirmMock).toHaveBeenCalledWith(null);
        expect(openInputMock).toHaveBeenCalledWith(null);
        expect(openAlertMock).toHaveBeenCalledWith(null);
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
});
