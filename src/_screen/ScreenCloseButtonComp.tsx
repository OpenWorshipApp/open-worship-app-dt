import './ScreenCloseButtonComp.scss';

import { useScreenManagerBaseContext } from './managers/screenManagerHooks';

export default function ScreenCloseButtonComp() {
    const screenManagerBase = useScreenManagerBaseContext();
    return (
        <button
            id="close"
            style={{
                borderRadius: '0 0 0 1em',
            }}
            onClick={() => {
                screenManagerBase.hide();
            }}
        >
            ❌
        </button>
    );
}
