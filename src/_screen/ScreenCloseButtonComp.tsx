import './ScreenCloseButtonComp.scss';

import { useCallback } from 'react';

import { useOptionalScreenManagerBaseContext } from './managers/screenManagerHooks';
import { useAppCurrentRef } from '../helper/appHooks';

export default function ScreenCloseButtonComp({
    isForceShowing,
}: {
    isForceShowing?: boolean;
}) {
    const screenManagerBase = useOptionalScreenManagerBaseContext();
    const screenManagerBaseRef = useAppCurrentRef(screenManagerBase);
    const handleHiding = useCallback(() => {
        const screenManagerBase = screenManagerBaseRef.current;
        if (screenManagerBase === null) {
            globalThis.close();
            return;
        }
        screenManagerBase.hide();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <button
            id="close"
            // Named in words: a screen reader used to announce "❌". Plain
            // English rather than `tran()` on purpose -- this renders in the
            // screen window, which loads its language data only AFTER its first
            // render, and a `tran()` that runs before then throws in dev: the
            // projector would go blank for the sake of a button's name.
            title="Hide this screen"
            aria-label="Hide this screen"
            style={{
                borderRadius: '0 0 0 1em',
                ...(isForceShowing ? { opacity: 1 } : {}),
            }}
            onClick={handleHiding}
        >
            ❌
        </button>
    );
}
