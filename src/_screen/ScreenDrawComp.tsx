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
                if (div !== null) {
                    screenDrawManager.div = div;
                }
            }}
        />
    );
}
