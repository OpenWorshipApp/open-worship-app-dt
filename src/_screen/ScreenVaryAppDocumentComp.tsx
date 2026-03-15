import { useRef } from 'react';

import { useAppEffect } from '../helper/debuggerHelpers';
import {
    useScreenManagerContext,
    useScreenManagerEvents,
} from './managers/screenManagerHooks';

export default function ScreenSlideComp() {
    const screenManager = useScreenManagerContext();
    useScreenManagerEvents(['refresh'], screenManager, () => {
        screenManager.screenVaryAppDocumentManager.render();
    });
    const div = useRef<HTMLDivElement>(null);
    const { screenVaryAppDocumentManager } = screenManager;
    useAppEffect(() => {
        if (div.current) {
            screenVaryAppDocumentManager.div = div.current;
        }
    }, [screenVaryAppDocumentManager, div.current]);
    return (
        <div
            id="slide"
            ref={div}
            style={screenVaryAppDocumentManager.containerStyle}
        />
    );
}
