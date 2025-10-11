import './ConfirmPopupComp.scss';

import PrimitiveModalComp from '../app-modal/PrimitiveModalComp';
import HeaderAlertPopupComp from './HeaderAlertPopupComp';
import { closeAlert, ConfirmDataType } from './popupWidgetHelpers';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';

export default function ConfirmPopupComp({
    data,
}: Readonly<{
    data: ConfirmDataType;
}>) {
    const handleClosing = () => {
        data.onConfirm(false);
        closeAlert();
    };
    const handleOkClicking = () => {
        data.onConfirm(true);
        closeAlert();
    };
    useKeyboardRegistering(
        [{ key: 'Escape' }],
        (event) => {
            if (data.escToCancel ?? true) {
                event.preventDefault();
                handleClosing();
            }
        },
        [data],
    );
    useKeyboardRegistering(
        [{ key: 'Enter' }],
        () => {
            if (data.enterToOk ?? true) {
                handleOkClicking();
            }
        },
        [data],
    );
    return (
        <PrimitiveModalComp>
            <div id="app-confirm-popup" className="shadow card">
                <HeaderAlertPopupComp
                    header={
                        <div className="app-ellipsis" title={data.title}>
                            <i className="bi bi-exclamation-circle" />
                            {data.title}
                        </div>
                    }
                    onClose={handleClosing}
                />
                <div className="card-body d-flex flex-column">
                    <div
                        className="p-2 flex-fill app-selectable-text"
                        dangerouslySetInnerHTML={{
                            __html: data.question,
                        }}
                    />
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
                            Ok
                        </button>
                    </div>
                </div>
            </div>
        </PrimitiveModalComp>
    );
}
