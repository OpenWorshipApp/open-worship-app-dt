import './popupWidget.scss';
import './InputPopupComp.scss';

import { useCallback } from 'react';
import PrimitiveModalComp from '../app-modal/PrimitiveModalComp';
import HeaderAlertPopupComp from './HeaderAlertPopupComp';
import { popupWidgetManager, type InputDataType } from './popupWidgetHelpers';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

export default function InputPopupComp({
    inputData,
}: Readonly<{
    inputData: InputDataType;
}>) {
    const inputDataRef = useAppCurrentRef(inputData);
    const handleClosing = useCallback(() => {
        // Close first, then run the callback (see AlertPopupComp): a callback
        // that opens the next popup must win the slot over this async close.
        popupWidgetManager.openInput?.(null);
        inputDataRef.current.onConfirm(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleOkClicking = useCallback(() => {
        popupWidgetManager.openInput?.(null);
        inputDataRef.current.onConfirm(true);
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
                className="app-popup-widget card"
                style={inputData.extraStyles}
            >
                <HeaderAlertPopupComp
                    title={inputData.title}
                    header={
                        <>
                            <i className="app-popup-header-icon icon-input bi bi-input-cursor-text" />
                            {inputData.title}
                        </>
                    }
                    onClose={handleClosing}
                />
                <div className="app-popup-body">{inputData.body}</div>
                <div className="app-popup-footer">
                    <button
                        className="btn"
                        type="button"
                        onClick={handleClosing}
                    >
                        <i className="bi bi-x-lg" />
                        {tran('Cancel')}
                    </button>
                    <button
                        className="btn btn-info"
                        type="button"
                        onClick={handleOkClicking}
                    >
                        <i className="bi bi-check-lg" />
                        {tran('Ok')}
                    </button>
                </div>
            </div>
        </PrimitiveModalComp>
    );
}
