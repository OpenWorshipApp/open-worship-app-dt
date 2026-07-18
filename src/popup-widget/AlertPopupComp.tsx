import './popupWidget.scss';
import './AlertPopupComp.scss';

import { sanitizeHtml } from '../helper/sanitizeHelpers';
import PrimitiveModalComp from '../app-modal/PrimitiveModalComp';
import HeaderAlertPopupComp from './HeaderAlertPopupComp';
import type { PopupAlertDataType } from './popupWidgetHelpers';
import { closeAlert } from './popupWidgetHelpers';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import { tran } from '../lang/langHelpers';

export default function AlertPopupComp({
    alertData,
}: Readonly<{
    alertData: PopupAlertDataType;
}>) {
    const handClose = () => {
        alertData.onClose();
        closeAlert();
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
