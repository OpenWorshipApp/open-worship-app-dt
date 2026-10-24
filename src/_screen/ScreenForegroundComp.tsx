import './ScreenForegroundComp.scss';

import { useCallback } from 'react';

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
    // Stable on purpose: a ref callback that is new on every render is
    // cleaned up and re-attached on every render, and the event hook above
    // re-renders this on each refresh -- every widget would be torn down and
    // rebuilt each time.
    const assignRootContainer = useCallback(
        (div: HTMLDivElement | null) => {
            if (div === null) {
                return;
            }
            if (isBehind) {
                screenForegroundManager.rootContainerBehind = div;
            } else {
                screenForegroundManager.rootContainer = div;
            }
            return () => {
                screenForegroundManager.releaseRootContainer(div, isBehind);
            };
        },
        [screenForegroundManager, isBehind],
    );
    return (
        <div
            id={isBehind ? 'foreground-behind' : 'foreground'}
            ref={assignRootContainer}
            style={screenForegroundManager.containerStyle}
        />
    );
}
