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
    confirmButtonLabel?: string;
};

export type InputDataType = {
    title: string;
    body: ReactElement;
    onConfirm: (isOk: boolean) => void;
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

export function showAppConfirm(
    title: string,
    body: string,
    options?: {
        escToCancel?: boolean;
        enterToOk?: boolean;
        extraStyles?: CSSProperties;
        confirmButtonLabel?: string;
    },
) {
    const { openConfirm } = popupWidgetManager;
    if (openConfirm === null) {
        return Promise.resolve(false);
    }
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
}

export function showAppInput(
    title: string,
    body: ReactElement,
    options?: {
        escToCancel?: boolean;
        enterToOk?: boolean;
        extraStyles?: CSSProperties;
    },
) {
    const openInput = popupWidgetManager.openInput;
    if (openInput === null) {
        return Promise.resolve(false);
    }
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
}

export function showAppAlert(title: string, message: string) {
    const openAlert = popupWidgetManager.openAlert;
    if (openAlert === null) {
        return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
        openAlert({
            title,
            message,
            onClose: () => {
                resolve();
            },
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
