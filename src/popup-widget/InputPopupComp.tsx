import './InputPopupComp.scss';

import { useCallback } from 'react';
import PrimitiveModalComp from '../app-modal/PrimitiveModalComp';
import HeaderAlertPopupComp from './HeaderAlertPopupComp';
import type { InputDataType } from './popupWidgetHelpers';
import { closeAlert } from './popupWidgetHelpers';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

export default function ConfirmPopupComp({
    inputData,
}: Readonly<{
    inputData: InputDataType;
}>) {
    const inputDataRef = useAppCurrentRef(inputData);
    const handleClosing = useCallback(() => {
        inputDataRef.current.onConfirm(false);
        closeAlert();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleOkClicking = useCallback(() => {
        inputDataRef.current.onConfirm(true);
        closeAlert();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useKeyboardRegistering(
        [{ key: 'Escape' }],
        (event) => {
            if (inputData.escToCancel ?? true) {
                event.preventDefault();
                handleClosing();
            }
        },
        [inputData],
    );
    useKeyboardRegistering(
        [{ key: 'Enter' }],
        () => {
            if (inputData.enterToOk ?? true) {
                handleOkClicking();
            }
        },
        [inputData],
    );
    return (
        <PrimitiveModalComp>
            <div
                id="app-input-popup"
                className="shadow card"
                style={inputData.extraStyles}
            >
                <HeaderAlertPopupComp
                    header={
                        <div className="app-ellipsis" title={inputData.title}>
                            <i className="bi bi-exclamation-circle" />
                            {inputData.title}
                        </div>
                    }
                    onClose={handleClosing}
                />
                <div className="card-body d-flex flex-column w-100 h-100">
                    <div
                        className="w-100"
                        style={{
                            maxHeight: '500px',
                            overflow: 'auto',
                        }}
                    >
                        {inputData.body}
                    </div>
                </div>
                <div className="card-footer btn-group float-end">
                    <button
                        className="btn btn-sm"
                        type="button"
                        onClick={handleClosing}
                    >
                        {tran('Cancel')}
                    </button>
                    <button
                        className="btn btn-sm btn-info"
                        type="button"
                        onClick={handleOkClicking}
                    >
                        {tran('Ok')}
                    </button>
                </div>
            </div>
        </PrimitiveModalComp>
    );
}
