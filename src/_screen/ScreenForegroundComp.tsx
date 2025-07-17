import './ScreenForegroundComp.scss';

import {
    useScreenManagerContext,
    useScreenManagerEvents,
} from './managers/screenManagerHooks';

export default function ScreenForegroundComp() {
    const screenManager = useScreenManagerContext();
    useScreenManagerEvents(['refresh'], screenManager, () => {
        screenManager.screenForegroundManager.render();
    });
    const { screenForegroundManager } = screenManager;
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
