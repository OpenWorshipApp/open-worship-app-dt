import { useCallback } from 'react';

import { useAppCurrentRef } from '../helper/appHooks';

import {
    useScreenManagerContext,
    useScreenManagerEvents,
} from './managers/screenManagerHooks';

export default function ScreenMaskComp() {
    const screenManager = useScreenManagerContext();
    // Optional throughout: the preview smoke tests mount these layers against a
    // hand-built screen manager that carries only the managers the test is
    // about, and a layer that throws on a missing one takes the whole render
    // down with it (the previewer footer guards its managers the same way).
    const { screenMaskManager } = screenManager;
    const screenMaskManagerRef = useAppCurrentRef(screenMaskManager);
    useScreenManagerEvents(['refresh'], screenManager, () => {
        screenMaskManagerRef.current?.render();
    });
    // Stable, so a re-render (each refresh event) does not detach and
    // re-attach the mask; the cleanup runs only on unmount.
    const assignDiv = useCallback(
        (div: HTMLDivElement | null) => {
            if (div === null || screenMaskManager === undefined) {
                return;
            }
            screenMaskManager.div = div;
            return () => {
                screenMaskManager.releaseDiv(div);
            };
        },
        [screenMaskManager],
    );
    return <div id="mask" ref={assignDiv} />;
}
