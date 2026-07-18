import './popupWidget.scss';
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
                className="app-popup-widget card"
                style={confirmData.extraStyles}
            >
                <HeaderAlertPopupComp
                    title={confirmData.title}
                    header={
                        <>
                            <i className="app-popup-header-icon icon-question bi bi-question-circle-fill" />
                            {confirmData.title}
                        </>
                    }
                    onClose={handleClosing}
                />
                {typeof confirmData.body === 'string' ? (
                    <div
                        className="app-popup-body app-selectable-text"
                        dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(confirmData.body),
                        }}
                    />
                ) : (
                    <div className="app-popup-body">{confirmData.body}</div>
                )}
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
                        {tran(confirmData.confirmButtonLabel ?? 'Ok')}
                    </button>
                </div>
            </div>
        </PrimitiveModalComp>
    );
}
