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
    return (
        <div
            id="mask"
            ref={(div) => {
                if (div !== null && screenMaskManager !== undefined) {
                    screenMaskManager.div = div;
                }
            }}
        />
    );
}
