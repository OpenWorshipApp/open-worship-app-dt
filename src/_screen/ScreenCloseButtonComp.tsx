import './ScreenCloseButtonComp.scss';

import { useCallback } from 'react';

import { useScreenManagerBaseContext } from './managers/screenManagerHooks';
import { useAppCurrentRef } from '../helper/appHooks';

export default function ScreenCloseButtonComp() {
    const screenManagerBase = useScreenManagerBaseContext();
    const screenManagerBaseRef = useAppCurrentRef(screenManagerBase);
    const handleHiding = useCallback(() => {
        screenManagerBaseRef.current.hide();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <button
            id="close"
            style={{
                borderRadius: '0 0 0 1em',
            }}
            onClick={handleHiding}
        >
            ❌
        </button>
    );
}
