import type { CSSProperties, ReactElement } from 'react';

export function closeAlert() {
    popupWidgetManager.openConfirm?.(null);
    popupWidgetManager.openInput?.(null);
    popupWidgetManager.openAlert?.(null);
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
    const openConfirm = popupWidgetManager.openConfirm;
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
