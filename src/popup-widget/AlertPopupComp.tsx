import './AlertPopupComp.scss';

import PrimitiveModalComp from '../app-modal/PrimitiveModalComp';
import HeaderAlertPopupComp from './HeaderAlertPopupComp';
import { PopupAlertDataType, closeAlert } from './popupWidgetHelpers';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';

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
        [{ key: 'Escape' }],
        (event) => {
            event.preventDefault();
            handClose();
        },
        [alertData],
    );
    return (
        <PrimitiveModalComp>
            <div id="app-alert-popup" className="shadow card">
                <HeaderAlertPopupComp
                    header={
                        <>
                            <i className="bi bi-exclamation-circle" />
                            {alertData.title}
                        </>
                    }
                    onClose={handClose}
                />
                <div className="card-body d-flex flex-column">
                    <div
                        className="p-2 flex-fill app-selectable-text"
                        dangerouslySetInnerHTML={{
                            __html: alertData.message,
                        }}
                    />
                </div>
            </div>
        </PrimitiveModalComp>
    );
}
