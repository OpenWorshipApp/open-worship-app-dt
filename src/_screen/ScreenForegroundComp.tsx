import { useAppCurrentRef } from '../helper/appHooks';
import './ScreenForegroundComp.scss';

import {
    useScreenManagerContext,
    useScreenManagerEvents,
} from './managers/screenManagerHooks';

export default function ScreenForegroundComp() {
    const screenManager = useScreenManagerContext();
    const { screenForegroundManager } = screenManager;
    const screenForegroundManagerRef = useAppCurrentRef(
        screenForegroundManager,
    );
    useScreenManagerEvents(['refresh'], screenManager, () => {
        screenForegroundManagerRef.current.render();
    });
    return (
        <div
            id="foreground"
            ref={(div) => {
                if (div !== null) {
                    screenForegroundManager.div = div;
                }
            }}
            style={screenForegroundManager.containerStyle}
        />
    );
}
