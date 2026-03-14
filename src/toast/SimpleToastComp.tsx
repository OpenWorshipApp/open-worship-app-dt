import { JSX } from 'react';

import { tran } from '../lang/langHelpers';

export type SimpleToastType = {
    title: string;
    message: string | JSX.Element;
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
    const { title, message } = toast;
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
                <strong className="me-auto">{title}</strong>
                <button
                    type="button"
                    className="btn-close"
                    data-bs-dismiss="toast"
                    aria-label={tran('Close')}
                    onClick={onClose}
                />
            </div>
            {typeof message === 'string' ? (
                <div
                    className="toast-body app-selectable-text"
                    dangerouslySetInnerHTML={{
                        __html: message,
                    }}
                />
            ) : (
                <div className="toast-body app-selectable-text">{message}</div>
            )}
        </div>
    );
}
