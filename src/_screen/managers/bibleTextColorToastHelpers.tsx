import { useState } from 'react';

import { tran } from '../../lang/langHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';

// Long enough to reach the button; the toast also holds while hovered.
const UNDO_TOAST_TIMEOUT = 10e3;

function TextColorChangedToastComp({
    onUndo,
}: Readonly<{ onUndo: () => void }>) {
    const [isUndone, setIsUndone] = useState(false);
    return (
        <div className="d-flex align-items-center gap-2">
            <span>
                {tran(
                    'The text color was changed so it stays visible on the new background color.',
                )}
            </span>
            <button
                type="button"
                className="btn btn-sm btn-outline-info flex-shrink-0"
                disabled={isUndone}
                onClick={() => {
                    setIsUndone(true);
                    onUndo();
                }}
            >
                {tran('Undo')}
            </button>
        </div>
    );
}

/**
 * Says the Bible text colour was switched for contrast, with an Undo -- and
 * asks nothing. It used to be a blocking Yes/No: walking a run sheet onto a
 * colour line stopped the run on that question in the middle of a service, and
 * the answer left the keyboard on the page body, so the next press of the run
 * key went nowhere.
 */
export function showBibleTextColorChangedToast(onUndo: () => void) {
    showSimpleToast(
        tran('Background and Color'),
        <TextColorChangedToastComp onUndo={onUndo} />,
        UNDO_TOAST_TIMEOUT,
    );
}
