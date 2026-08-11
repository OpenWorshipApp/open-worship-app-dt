import { useCallback, useState } from 'react';

import BibleInfoPopupComp from './BibleInfoPopupComp';
import { tran } from '../lang/langHelpers';

// The button itself does no I/O. It renders on every pane that is still in the
// book/chapter picking state, so the bible info is only read once the popup is
// actually mounted by a click.
export default function BibleInfoButtonComp({
    bibleKey,
}: Readonly<{ bibleKey: string }>) {
    const [isShowing, setIsShowing] = useState(false);
    const handleShowing = useCallback(() => {
        setIsShowing(true);
    }, []);
    const handleClosing = useCallback(() => {
        setIsShowing(false);
    }, []);
    const title = tran('Bible Information');
    return (
        <>
            <button
                className="btn btn-sm btn-outline-info"
                type="button"
                title={title}
                aria-label={title}
                onClick={handleShowing}
            >
                <i className="bi bi-info-circle" />
            </button>
            {isShowing ? (
                <BibleInfoPopupComp bibleKey={bibleKey} close={handleClosing} />
            ) : null}
        </>
    );
}
