import { useState } from 'react';

import { tran } from '../../lang/langHelpers';
import { useToastClose } from '../../toast/toastCloseContext';

/**
 * The body of the "Screen Manager is locked" refusal. It carries its own
 * Unlock: the toast opens in the top-right corner, which on the Presenter is
 * exactly where the first mini screen's lock icon sits, so the message telling
 * the operator to unlock used to cover the one control that does it for the
 * toast's whole life. Pressing it also closes the toast: left up, it went on
 * saying "locked" over the controls it covers while the mouse rested on it.
 */
export default function ScreenLockedToastMessageComp({
    onUnlock,
}: Readonly<{
    onUnlock: () => void;
}>) {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const closeToast = useToastClose();
    return (
        <div className="d-flex align-items-center gap-2 flex-wrap">
            <span>{tran('Unlock the screen to change what it shows')}</span>
            <button
                type="button"
                className="btn btn-sm btn-outline-success"
                disabled={isUnlocked}
                onClick={() => {
                    setIsUnlocked(true);
                    onUnlock();
                    closeToast();
                }}
            >
                <i className="bi bi-unlock me-1" />
                {tran('Unlock')}
            </button>
        </div>
    );
}
