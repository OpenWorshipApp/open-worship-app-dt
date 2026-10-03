import type { CSSProperties, ReactElement } from 'react';
import appProvider from '../server/appProvider';

type LockedPopupType = 'confirm' | 'input' | 'alert';

const lockedPopup: { current: LockedPopupType | null } = {
    current: null,
};

async function attemptUnlocking(newType: LockedPopupType) {
    while (lockedPopup.current !== newType) {
        if (lockedPopup.current === null) {
            return;
        }
        await new Promise((resolve) => {
            setTimeout(resolve, 1000);
        });
    }
    lockedPopup.current = null;
}

export async function attemptLocking(
    newType: LockedPopupType,
    isUnlock: boolean,
) {
    if (isUnlock) {
        return await attemptUnlocking(newType);
    }
    while (lockedPopup.current !== null) {
        await new Promise((resolve) => {
            setTimeout(resolve, 1000);
        });
    }
    lockedPopup.current = newType;
}

export type ConfirmDataType = {
    title: string;
    body: string | ReactElement;
    onConfirm: (isOk: boolean) => void;
    escToCancel?: boolean;
    enterToOk?: boolean;
    extraStyles?: CSSProperties;
    cancelButtonLabel?: string;
    confirmButtonLabel?: string;
};

export type InputDataType = {
    title: string;
    body: ReactElement;
    onConfirm: (isOk: boolean) => void;
    canConfirm?: () => boolean;
    escToCancel?: boolean;
    enterToOk?: boolean;
    extraStyles?: CSSProperties;
};

export type PopupAlertDataType = {
    title: string;
    message: string;
    onClose: () => void;
};

export const popupWidgetManager: {
    openConfirm: ((_: ConfirmDataType | null) => void) | null;
    openInput: ((_: InputDataType | null) => void) | null;
    openAlert: ((_: PopupAlertDataType | null) => void) | null;
} = {
    openConfirm: null,
    openInput: null,
    openAlert: null,
};

/**
 * A popup takes the keyboard while it is open; give it back to whatever held it
 * when the popup closes. Without this a question asked in the middle of a run
 * left focus on the page body, and the run sheet's player -- whose keys answer
 * only while focus is inside it -- dropped the operator's next press. Only when
 * nothing else has claimed focus by then: an answer that moves the caret into a
 * field of its own keeps it there.
 */
function returnFocusAfter<T>(openPopup: () => Promise<T>): Promise<T> {
    // Read BEFORE the popup opens: a host that mounts it synchronously has
    // already moved focus by the time the promise exists.
    const previousElement =
        typeof document === 'undefined' ? null : document.activeElement;
    const promise = openPopup();
    if (
        !(previousElement instanceof HTMLElement) ||
        previousElement === document.body
    ) {
        return promise;
    }
    return promise.then((result) => {
        // After the popup has unmounted, which happens after it resolves.
        setTimeout(() => {
            const activeElement = document.activeElement;
            if (
                previousElement.isConnected &&
                (activeElement === null || activeElement === document.body)
            ) {
                previousElement.focus({ preventScroll: true });
            }
        }, 0);
        return result;
    });
}

export function showAppConfirm(
    title: string,
    body: string,
    options?: {
        escToCancel?: boolean;
        enterToOk?: boolean;
        extraStyles?: CSSProperties;
        cancelButtonLabel?: string;
        confirmButtonLabel?: string;
    },
) {
    const { openConfirm } = popupWidgetManager;
    if (openConfirm === null) {
        return Promise.resolve(false);
    }
    return returnFocusAfter(() => {
        return new Promise<boolean>((resolve) => {
            openConfirm({
                title,
                body,
                onConfirm: (isOk) => {
                    resolve(isOk);
                },
                ...options,
            });
        });
    });
}

export function showAppInput(
    title: string,
    body: ReactElement,
    options?: {
        canConfirm?: () => boolean;
        escToCancel?: boolean;
        enterToOk?: boolean;
        extraStyles?: CSSProperties;
    },
) {
    const openInput = popupWidgetManager.openInput;
    if (openInput === null) {
        return Promise.resolve(false);
    }
    return returnFocusAfter(() => {
        return new Promise<boolean>((resolve) => {
            openInput({
                title,
                body,
                onConfirm: (isOk) => {
                    resolve(isOk);
                },
                ...options,
            });
        });
    });
}

export function showAppAlert(title: string, message: string) {
    const openAlert = popupWidgetManager.openAlert;
    if (openAlert === null) {
        return Promise.resolve();
    }
    return returnFocusAfter(() => {
        return new Promise<void>((resolve) => {
            openAlert({
                title,
                message,
                onClose: () => {
                    resolve();
                },
            });
        });
    });
}

if (appProvider.systemUtils.isDev) {
    (globalThis as any).tryPopup = async () => {
        await showAppConfirm(
            '1: Confirm Title',
            'Are you sure you want to proceed?',
            {
                escToCancel: true,
                enterToOk: true,
                extraStyles: { color: 'blue' },
                confirmButtonLabel: 'Yes, proceed',
            },
        );
        await showAppAlert('2: Alert Title', 'This is an alert message.');
        await showAppAlert('3: Alert Title', 'This is an alert message.');
        await showAppConfirm(
            '4: Confirm Title',
            'Are you sure you want to proceed?',
            {
                escToCancel: true,
                enterToOk: true,
                extraStyles: { color: 'blue' },
                confirmButtonLabel: 'Yes, proceed',
            },
        );
        await showAppAlert('5: Alert Title', 'This is an alert message.');
    };
}
