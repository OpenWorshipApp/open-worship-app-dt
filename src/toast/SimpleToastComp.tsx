import { tran } from '../lang/langHelpers';

export type SimpleToastType = {
    title: string;
    message: string;
    timeout?: number;
};

export default function SimpleToastComp({
    onClose,
    toast,
    onMouseOver,
    onMouseOut,
}: Readonly<{
    onClose: () => void;
    toast: SimpleToastType;
    onMouseOver: () => void;
    onMouseOut: () => void;
}>) {
    return (
        <div
            className="toast show fade"
            onMouseOver={onMouseOver}
            onMouseOut={onMouseOut}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
        >
            <div className="toast-header">
                <strong className="me-auto">{toast.title}</strong>
                <button
                    type="button"
                    className="btn-close"
                    data-bs-dismiss="toast"
                    aria-label={tran('Close')}
                    onClick={onClose}
                />
            </div>
            <div
                className="toast-body app-selectable-text"
                dangerouslySetInnerHTML={{
                    __html: toast.message,
                }}
            />
        </div>
    );
}
