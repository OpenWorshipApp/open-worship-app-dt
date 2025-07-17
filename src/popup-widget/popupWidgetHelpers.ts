import { ReactElement } from 'react';

export function closeAlert() {
    popupWidgetManager.openConfirm?.(null);
    popupWidgetManager.openInput?.(null);
    popupWidgetManager.openAlert?.(null);
}

export type ConfirmDataType = {
    title: string;
    question: string;
    onConfirm: (isOk: boolean) => void;
};

export type InputDataType = {
    title: string;
    body: ReactElement;
    onConfirm: (isOk: boolean) => void;
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

export function showAppConfirm(title: string, message: string) {
    const openConfirm = popupWidgetManager.openConfirm;
    if (openConfirm === null) {
        return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
        openConfirm({
            title,
            question: message,
            onConfirm: (isOk) => {
                resolve(isOk);
            },
        });
    });
}

export function showAppInput(title: string, body: ReactElement) {
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
