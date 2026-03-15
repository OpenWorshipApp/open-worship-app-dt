import './ScreenCloseButtonComp.scss';

import { useCallback } from 'react';

import { useScreenManagerBaseContext } from './managers/screenManagerHooks';

export default function ScreenCloseButtonComp() {
    const screenManagerBase = useScreenManagerBaseContext();
    const handleHiding = useCallback(() => {
        screenManagerBase.hide();
    }, [screenManagerBase]);
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
