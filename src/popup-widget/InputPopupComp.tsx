import './InputPopupComp.scss';

import PrimitiveModalComp from '../app-modal/PrimitiveModalComp';
import HeaderAlertPopupComp from './HeaderAlertPopupComp';
import type { InputDataType } from './popupWidgetHelpers';
import { closeAlert } from './popupWidgetHelpers';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import { tran } from '../lang/langHelpers';

export default function ConfirmPopupComp({
    inputData,
}: Readonly<{
    inputData: InputDataType;
}>) {
    const handleClosing = () => {
        inputData.onConfirm(false);
        closeAlert();
    };
    const handleOkClicking = () => {
        inputData.onConfirm(true);
        closeAlert();
    };
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
                        {tran('OK')}
                    </button>
                </div>
            </div>
        </PrimitiveModalComp>
    );
}
