import './popupWidget.scss';
import './AlertPopupComp.scss';

import { sanitizeHtml } from '../helper/sanitizeHelpers';
import PrimitiveModalComp from '../app-modal/PrimitiveModalComp';
import HeaderAlertPopupComp from './HeaderAlertPopupComp';
import {
    popupWidgetManager,
    type PopupAlertDataType,
} from './popupWidgetHelpers';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import { tran } from '../lang/langHelpers';

export default function AlertPopupComp({
    alertData,
}: Readonly<{
    alertData: PopupAlertDataType;
}>) {
    const handClose = () => {
        // Close first, then run the callback: the callback may open the next
        // popup (even of the same type), and it must win the slot rather than
        // being torn down by this popup's own async close.
        popupWidgetManager.openAlert?.(null);
        alertData.onClose();
    };
    useKeyboardRegistering(
        [{ key: 'Escape' }, { key: 'Enter' }],
        (event) => {
            event.preventDefault();
            handClose();
        },
        [alertData],
    );
    return (
        <PrimitiveModalComp>
            <div id="app-alert-popup" className="app-popup-widget card">
                <HeaderAlertPopupComp
                    title={alertData.title}
                    header={
                        <>
                            <i className="app-popup-header-icon icon-info bi bi-info-circle-fill" />
                            {alertData.title}
                        </>
                    }
                    onClose={handClose}
                />
                <div
                    className="app-popup-body app-selectable-text"
                    dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(alertData.message),
                    }}
                />
                <div className="app-popup-footer">
                    <button
                        className="btn btn-info"
                        type="button"
                        onClick={handClose}
                    >
                        <i className="bi bi-check-lg" />
                        {tran('Ok')}
                    </button>
                </div>
            </div>
        </PrimitiveModalComp>
    );
}
