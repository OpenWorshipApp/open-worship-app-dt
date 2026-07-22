import { useAppCurrentRef } from '../helper/appHooks';

import {
    useScreenManagerContext,
    useScreenManagerEvents,
} from './managers/screenManagerHooks';

export default function ScreenFocusComp() {
    const screenManager = useScreenManagerContext();
    const { screenFocusManager } = screenManager;
    const screenFocusManagerRef = useAppCurrentRef(screenFocusManager);
    useScreenManagerEvents(['refresh'], screenManager, () => {
        screenFocusManagerRef.current.render();
    });
    return (
        <div
            id="focus"
            ref={(div) => {
                if (div !== null) {
                    screenFocusManager.div = div;
                }
            }}
        />
    );
}
