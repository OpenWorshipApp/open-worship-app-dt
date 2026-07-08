import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { tran } from '../lang/langHelpers';

export default function HeaderAlertPopupComp({
    header,
    onClose,
}: Readonly<{
    header: ReactNode;
    onClose: () => void;
}>) {
    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);
    return (
        <div className="card-header text-center w-100">
            <div>{header}</div>
            <button
                className="btn-close float-end"
                type="button"
                onClick={handleClose}
                aria-label={tran('Close')}
                title={tran('Close')}
                style={{
                    transform: 'translate(0, -90%)',
                }}
            />
        </div>
    );
}
