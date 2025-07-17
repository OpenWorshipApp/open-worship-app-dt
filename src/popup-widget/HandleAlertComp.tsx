import { lazy, useState } from 'react';

import {
    PopupAlertDataType,
    popupWidgetManager,
    ConfirmDataType,
    InputDataType,
} from './popupWidgetHelpers';
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

    popupWidgetManager.openConfirm = (newConfirmData) => {
        setConfirmData(newConfirmData);
    };
    popupWidgetManager.openInput = (newInputData) => {
        setInputData(newInputData);
    };
    popupWidgetManager.openAlert = (newAlertData) => {
        setAlertData(newAlertData);
    };
    return (
        <>
            {confirmData !== null && (
                <AppSuspenseComp>
                    <LazyConfirmPopupComp data={confirmData} />
                </AppSuspenseComp>
            )}
            {inputData !== null && (
                <AppSuspenseComp>
                    <LazyInputPopupComp data={inputData} />
                </AppSuspenseComp>
            )}
            {alertData !== null && (
                <AppSuspenseComp>
                    <LazyAlertPopupComp data={alertData} />
                </AppSuspenseComp>
            )}
        </>
    );
}
