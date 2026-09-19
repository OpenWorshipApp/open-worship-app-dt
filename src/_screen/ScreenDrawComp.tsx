import { useAppCurrentRef } from '../helper/appHooks';

import {
    useScreenManagerContext,
    useScreenManagerEvents,
} from './managers/screenManagerHooks';

export default function ScreenDrawComp() {
    const screenManager = useScreenManagerContext();
    const { screenDrawManager } = screenManager;
    const screenDrawManagerRef = useAppCurrentRef(screenDrawManager);
    useScreenManagerEvents(['refresh'], screenManager, () => {
        screenDrawManagerRef.current.render();
    });
    return (
        <div
            id="draw"
            ref={(div) => {
                if (div === null) {
                    return;
                }
                screenDrawManager.div = div;
                return () => {
                    // release the detached DOM + supersampled canvas on
                    // unmount — the setter detaches listeners for us.
                    // Guarded on `div` still being the one we attached: a
                    // remount can install the replacement first (see
                    // releaseDiv).
                    screenDrawManager.releaseDiv(div);
                };
            }}
        />
    );
}
