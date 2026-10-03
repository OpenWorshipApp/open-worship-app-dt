import './ScreenForegroundComp.scss';

import { useAppCurrentRef } from '../helper/appHooks';

import {
    useScreenManagerContext,
    useScreenManagerEvents,
} from './managers/screenManagerHooks';

/**
 * One of the screen's two foreground roots. The one mounted with `isBehind`
 * sits between the background and the slide and holds the overlays whose
 * Properties say so; the other is the ordinary layer over everything. They are
 * the same element with the same no-stacking-context style, so an overlay
 * blends with the background in either -- see `ForegroundLayerDataType`.
 */
export default function ScreenForegroundComp({
    isBehind = false,
}: Readonly<{ isBehind?: boolean }>) {
    const screenManager = useScreenManagerContext();
    const { screenForegroundManager } = screenManager;
    const screenForegroundManagerRef = useAppCurrentRef(
        screenForegroundManager,
    );
    const isBehindRef = useAppCurrentRef(isBehind);
    useScreenManagerEvents(['refresh'], screenManager, () => {
        screenForegroundManagerRef.current.render(isBehindRef.current);
    });
    return (
        <div
            id={isBehind ? 'foreground-behind' : 'foreground'}
            ref={(div) => {
                if (div === null) {
                    return;
                }
                if (isBehind) {
                    screenForegroundManager.rootContainerBehind = div;
                } else {
                    screenForegroundManager.rootContainer = div;
                }
            }}
            style={screenForegroundManager.containerStyle}
        />
    );
}
