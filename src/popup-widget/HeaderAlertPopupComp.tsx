import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

export default function HeaderAlertPopupComp({
    header,
    title,
    onClose,
}: Readonly<{
    header: ReactNode;
    title?: string;
    onClose: () => void;
}>) {
    const onCloseRef = useAppCurrentRef(onClose);
    const handleClose = useCallback(() => {
        onCloseRef.current();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="app-popup-header card-header">
            <div className="app-popup-header-title app-ellipsis" title={title}>
                {header}
            </div>
            <button
                className="app-popup-close btn-close"
                type="button"
                onClick={handleClose}
                aria-label={tran('Close')}
                title={tran('Close')}
            />
        </div>
    );
}
