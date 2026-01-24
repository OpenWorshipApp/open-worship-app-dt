import { lazy, useState, useCallback, useMemo } from 'react';

import type {
    PopupAlertDataType,
    ConfirmDataType,
    InputDataType,
} from './popupWidgetHelpers';
import { popupWidgetManager } from './popupWidgetHelpers';
import AppSuspenseComp from '../others/AppSuspenseComp';

const LazyConfirmPopupComp = lazy(() => {
    return import('./ConfirmPopupComp');
});
const LazyInputPopupComp = lazy(() => {
    return import('./InputPopupComp');
});
const LazyAlertPopupComp = lazy(() => {
    return import('./AlertPopupComp');
});

export type AlertType = 'confirm' | null;

export default function HandleAlertComp() {
    const [confirmData, setConfirmData] = useState<ConfirmDataType | null>(
        null,
    );
    const [inputData, setInputData] = useState<InputDataType | null>(null);
    const [alertData, setAlertData] = useState<PopupAlertDataType | null>(null);

    popupWidgetManager.openConfirm = useCallback(
        (newConfirmData: ConfirmDataType | null) => {
            setConfirmData(newConfirmData);
        },
        [],
    );

    popupWidgetManager.openInput = useCallback(
        (newInputData: InputDataType | null) => {
            setInputData(newInputData);
        },
        [],
    );

    popupWidgetManager.openAlert = useCallback(
        (newAlertData: PopupAlertDataType | null) => {
            setAlertData(newAlertData);
        },
        [],
    );

    const confirmComponent = useMemo(() => {
        if (confirmData === null) return null;
        return (
            <AppSuspenseComp>
                <LazyConfirmPopupComp confirmData={confirmData} />
            </AppSuspenseComp>
        );
    }, [confirmData]);

    const inputComponent = useMemo(() => {
        if (inputData === null) return null;
        return (
            <AppSuspenseComp>
                <LazyInputPopupComp inputData={inputData} />
            </AppSuspenseComp>
        );
    }, [inputData]);

    const alertComponent = useMemo(() => {
        if (alertData === null) return null;
        return (
            <AppSuspenseComp>
                <LazyAlertPopupComp alertData={alertData} />
            </AppSuspenseComp>
        );
    }, [alertData]);

    return (
        <>
            {confirmComponent}
            {inputComponent}
            {alertComponent}
        </>
    );
}
