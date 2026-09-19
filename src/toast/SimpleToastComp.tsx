import { type JSX, useCallback, useRef } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { sanitizeHtml } from '../helper/sanitizeHelpers';
import { tran } from '../lang/langHelpers';

export type SimpleToastType = {
    title: string;
    message: string | JSX.Element;
    timeout?: number;
};

export const DEFAULT_TOAST_TIMEOUT = 4e3;
export const MOUSE_LEAVING_TOAST_TIMEOUT = 2e3;

export default function SimpleToastComp({
    onClose,
    toast,
}: Readonly<{
    onClose: () => void;
    toast: SimpleToastType;
}>) {
    const { title, message } = toast;
    // Each toast owns its own timer, otherwise a newer toast would dismiss
    // the older ones that are still stacked on screen.
    const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onCloseRef = useAppCurrentRef(onClose);
    const clearTimer = useCallback(() => {
        if (timeoutIdRef.current !== null) {
            clearTimeout(timeoutIdRef.current);
            timeoutIdRef.current = null;
        }
    }, []);
    const initTimeout = useCallback(
        (timer: number) => {
            clearTimer();
            timeoutIdRef.current = setTimeout(() => {
                timeoutIdRef.current = null;
                onCloseRef.current();
            }, timer);
        },
        [clearTimer, onCloseRef],
    );
    const initTimeoutRef = useAppCurrentRef(initTimeout);
    useAppEffect(() => {
        initTimeoutRef.current(toast.timeout ?? DEFAULT_TOAST_TIMEOUT);
        return clearTimer;
    }, []);
    const handleMouseEntering = useCallback(() => {
        clearTimer();
    }, [clearTimer]);
    const handleMouseLeaving = useCallback(() => {
        initTimeoutRef.current(MOUSE_LEAVING_TOAST_TIMEOUT);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className="toast show fade"
            onMouseOver={handleMouseEntering}
            onMouseOut={handleMouseLeaving}
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
                        __html: sanitizeHtml(message),
                    }}
                />
            ) : (
                <div className="toast-body app-selectable-text">{message}</div>
            )}
        </div>
    );
}
