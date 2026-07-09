import './ConfirmPopupComp.scss';

import { useCallback } from 'react';
import { sanitizeHtml } from '../helper/sanitizeHelpers';
import PrimitiveModalComp from '../app-modal/PrimitiveModalComp';
import HeaderAlertPopupComp from './HeaderAlertPopupComp';
import type { ConfirmDataType } from './popupWidgetHelpers';
import { closeAlert } from './popupWidgetHelpers';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

export default function ConfirmPopupComp({
    confirmData,
}: Readonly<{
    confirmData: ConfirmDataType;
}>) {
    const confirmDataRef = useAppCurrentRef(confirmData);
    const handleClosing = useCallback(() => {
        confirmDataRef.current.onConfirm(false);
        closeAlert();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleOkClicking = useCallback(() => {
        confirmDataRef.current.onConfirm(true);
        closeAlert();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
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
                                __html: sanitizeHtml(confirmData.body),
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
                            {tran('Cancel')}
                        </button>
                        <button
                            className="btn btn-sm btn-info"
                            type="button"
                            onClick={handleOkClicking}
                        >
                            {tran(confirmData.confirmButtonLabel ?? 'Ok')}
                        </button>
                    </div>
                </div>
            </div>
        </PrimitiveModalComp>
    );
}
