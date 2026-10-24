import { useCallback } from 'react';

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
    // Stable, so a re-render (each refresh event) does not detach and
    // re-attach the spotlight; the cleanup runs only on unmount.
    const assignDiv = useCallback(
        (div: HTMLDivElement | null) => {
            if (div === null) {
                return;
            }
            screenFocusManager.div = div;
            return () => {
                screenFocusManager.releaseDiv(div);
            };
        },
        [screenFocusManager],
    );
    return <div id="focus" ref={assignDiv} />;
}
