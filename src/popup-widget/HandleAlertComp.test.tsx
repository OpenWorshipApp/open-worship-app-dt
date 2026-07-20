// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import AlertPopupComp from './AlertPopupComp';
import ConfirmPopupComp from './ConfirmPopupComp';
import InputPopupComp from './InputPopupComp';
import HandleAlertComp from './HandleAlertComp';
import {
    popupWidgetManager,
    showAppAlert,
    showAppConfirm,
    type ConfirmDataType,
    type InputDataType,
    type PopupAlertDataType,
} from './popupWidgetHelpers';

function clickButton(container: HTMLElement, selector: string) {
    const button = container.querySelector(selector);
    expect(button).not.toBeNull();
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

async function waitForElement(
    container: HTMLElement,
    selector: string,
    timeoutMs = 2000,
) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const element = container.querySelector(selector);
        if (element !== null) {
            return element;
        }
        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 10);
            });
        });
    }
    throw new Error(`Timed out waiting for element: ${selector}`);
}

async function waitForText(
    container: HTMLElement,
    selector: string,
    text: string,
    timeoutMs = 2000,
) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const element = container.querySelector(selector);
        if (element && element.textContent?.includes(text)) {
            return element;
        }
        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 10);
            });
        });
    }
    throw new Error(`Timed out waiting for text "${text}" in ${selector}`);
}

describe('popup close isolation', () => {
    let container: HTMLDivElement;
    let root: Root;
    let openConfirmMock: Mock<(data: ConfirmDataType | null) => void>;
    let openInputMock: Mock<(data: InputDataType | null) => void>;
    let openAlertMock: Mock<(data: PopupAlertDataType | null) => void>;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        openConfirmMock = vi.fn<(data: ConfirmDataType | null) => void>();
        openInputMock = vi.fn<(data: InputDataType | null) => void>();
        openAlertMock = vi.fn<(data: PopupAlertDataType | null) => void>();
        popupWidgetManager.openConfirm = openConfirmMock;
        popupWidgetManager.openInput = openInputMock;
        popupWidgetManager.openAlert = openAlertMock;
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        container.remove();
        popupWidgetManager.openConfirm = null;
        popupWidgetManager.openInput = null;
        popupWidgetManager.openAlert = null;
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('closing an alert dismisses only the alert popup', async () => {
        const onClose = vi.fn();
        await act(async () => {
            root.render(
                <AlertPopupComp
                    alertData={{ title: 'A', message: 'msg', onClose }}
                />,
            );
        });

        await act(async () => {
            clickButton(container, '#app-alert-popup button.btn-info');
        });

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(openAlertMock).toHaveBeenCalledWith(null);
        // The alert must not tear down sibling popup types.
        expect(openConfirmMock).not.toHaveBeenCalled();
        expect(openInputMock).not.toHaveBeenCalled();
    });

    test('closing a confirm dismisses only the confirm popup', async () => {
        const onConfirm = vi.fn();
        await act(async () => {
            root.render(
                <ConfirmPopupComp
                    confirmData={{
                        title: 'C',
                        body: <div>body</div>,
                        onConfirm,
                    }}
                />,
            );
        });

        await act(async () => {
            clickButton(
                container,
                '#app-confirm-popup button.btn:not(.btn-info)',
            );
        });

        expect(onConfirm).toHaveBeenCalledWith(false);
        expect(openConfirmMock).toHaveBeenCalledWith(null);
        expect(openAlertMock).not.toHaveBeenCalled();
        expect(openInputMock).not.toHaveBeenCalled();
    });

    test('closing an input dismisses only the input popup', async () => {
        const onConfirm = vi.fn();
        await act(async () => {
            root.render(
                <InputPopupComp
                    inputData={{
                        title: 'I',
                        body: <div>body</div>,
                        onConfirm,
                    }}
                />,
            );
        });

        await act(async () => {
            clickButton(
                container,
                '#app-input-popup button.btn:not(.btn-info)',
            );
        });

        expect(onConfirm).toHaveBeenCalledWith(false);
        expect(openInputMock).toHaveBeenCalledWith(null);
        expect(openConfirmMock).not.toHaveBeenCalled();
        expect(openAlertMock).not.toHaveBeenCalled();
    });
});

describe('popup sequencing regression', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        // Drive every opener to null so the module-level popup lock is released
        // before the next test (attemptLocking would otherwise block).
        await act(async () => {
            popupWidgetManager.openAlert?.(null);
            popupWidgetManager.openConfirm?.(null);
            popupWidgetManager.openInput?.(null);
            await new Promise((resolve) => {
                setTimeout(resolve, 10);
            });
        });
        await act(async () => {
            root.unmount();
        });
        container.remove();
        popupWidgetManager.openConfirm = null;
        popupWidgetManager.openInput = null;
        popupWidgetManager.openAlert = null;
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    // Reproduces the original bug: a second popup opened from the first popup's
    // confirm callback used to be closed by the first popup's own (async) close,
    // because the shared closeAlert() nulled every popup type at once.
    test('a popup opened from a closing popup callback is not dismissed', async () => {
        await act(async () => {
            root.render(<HandleAlertComp />);
        });

        const confirmPromise = showAppConfirm('Confirm', 'Proceed?');
        confirmPromise.then((isOk) => {
            if (isOk) {
                showAppAlert('Alert', 'Opened from the confirm callback');
            }
        });

        await waitForElement(container, '#app-confirm-popup');

        await act(async () => {
            clickButton(container, '#app-confirm-popup button.btn-info');
        });

        // The alert opened in the confirm callback must remain on screen, and
        // the confirm that spawned it must be gone.
        await waitForElement(container, '#app-alert-popup');
        expect(container.querySelector('#app-alert-popup')).not.toBeNull();
        expect(container.querySelector('#app-confirm-popup')).toBeNull();
    });

    // The trickier case: two consecutive popups of the SAME type. Closing the
    // first nulls the same slot the second just populated, so without ordering
    // the close correctly the second popup silently vanishes.
    test('a second same-type popup opened while the first closes stays open', async () => {
        await act(async () => {
            root.render(<HandleAlertComp />);
        });

        const firstAlert = showAppAlert('First alert', 'first message');
        firstAlert.then(() => {
            showAppAlert('Second alert', 'second message');
        });

        await waitForText(container, '#app-alert-popup', 'First alert');

        await act(async () => {
            clickButton(container, '#app-alert-popup button.btn-info');
        });

        // The second alert must replace the first, not disappear.
        await waitForText(container, '#app-alert-popup', 'Second alert');
        expect(
            container.querySelector('#app-alert-popup')?.textContent,
        ).toContain('Second alert');
    });
});
