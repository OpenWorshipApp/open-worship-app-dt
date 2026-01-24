import './ConfirmPopupComp.scss';

import PrimitiveModalComp from '../app-modal/PrimitiveModalComp';
import HeaderAlertPopupComp from './HeaderAlertPopupComp';
import type { ConfirmDataType } from './popupWidgetHelpers';
import { closeAlert } from './popupWidgetHelpers';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';

export default function ConfirmPopupComp({
    confirmData,
}: Readonly<{
    confirmData: ConfirmDataType;
}>) {
    const handleClosing = () => {
        confirmData.onConfirm(false);
        closeAlert();
    };
    const handleOkClicking = () => {
        confirmData.onConfirm(true);
        closeAlert();
    };
    useKeyboardRegistering(
        [{ key: 'Escape' }],
        (event) => {
            if (confirmData.escToCancel ?? true) {
                event.preventDefault();
                handleClosing();
            }
        },
        [confirmData],
    );
    useKeyboardRegistering(
        [{ key: 'Enter' }],
        () => {
            if (confirmData.enterToOk ?? true) {
                handleOkClicking();
            }
        },
        [confirmData],
    );
    return (
        <PrimitiveModalComp>
            <div
                id="app-confirm-popup"
                className="shadow card"
                style={confirmData.extraStyles}
            >
                <HeaderAlertPopupComp
                    header={
                        <div className="app-ellipsis" title={confirmData.title}>
                            <i className="bi bi-exclamation-circle" />
                            {confirmData.title}
                        </div>
                    }
                    onClose={handleClosing}
                />
                <div className="card-body d-flex flex-column">
                    {typeof confirmData.body === 'string' ? (
                        <div
                            className="p-2 flex-fill app-selectable-text"
                            dangerouslySetInnerHTML={{
                                __html: confirmData.body,
                            }}
                        />
                    ) : (
                        <>{confirmData.body}</>
                    )}
                    <div className="btn-group float-end">
                        <button
                            className="btn btn-sm"
                            type="button"
                            onClick={handleClosing}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-sm btn-info"
                            type="button"
                            onClick={handleOkClicking}
                        >
                            {confirmData.confirmButtonLabel ?? 'OK'}
                        </button>
                    </div>
                </div>
            </div>
        </PrimitiveModalComp>
    );
}
