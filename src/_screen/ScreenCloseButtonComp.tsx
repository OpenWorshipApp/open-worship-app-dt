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
