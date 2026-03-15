import { useCallback } from 'react';
import type { ReactNode } from 'react';

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
                style={{
                    transform: 'translate(0, -90%)',
                }}
            />
        </div>
    );
}
