import './AlertPopupComp.scss';

import PrimitiveModalComp from '../app-modal/PrimitiveModalComp';
import HeaderAlertPopupComp from './HeaderAlertPopupComp';
import { PopupAlertDataType, closeAlert } from './popupWidgetHelpers';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';

export default function AlertPopupComp({
    data,
}: Readonly<{
    data: PopupAlertDataType;
}>) {
    const handClose = () => {
        data.onClose();
        closeAlert();
    };
    useKeyboardRegistering(
        [{ key: 'Escape' }],
        (event) => {
            event.preventDefault();
            handClose();
        },
        [data],
    );
    return (
        <PrimitiveModalComp>
            <div id="app-alert-popup" className="shadow card">
                <HeaderAlertPopupComp
                    header={
                        <>
                            <i className="bi bi-exclamation-circle" />
                            {data.title}
                        </>
                    }
                    onClose={handClose}
                />
                <div className="card-body d-flex flex-column">
                    <div
                        className="p-2 flex-fill app-selectable-text"
                        dangerouslySetInnerHTML={{
                            __html: data.message,
                        }}
                    />
                </div>
            </div>
        </PrimitiveModalComp>
    );
}
