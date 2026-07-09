import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

export default function HeaderAlertPopupComp({
    header,
    onClose,
}: Readonly<{
    header: ReactNode;
    onClose: () => void;
}>) {
    const onCloseRef = useAppCurrentRef(onClose);
    const handleClose = useCallback(() => {
        onCloseRef.current();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
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
