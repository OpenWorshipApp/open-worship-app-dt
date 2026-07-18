import { useRef } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import {
    useScreenManagerContext,
    useScreenManagerEvents,
} from './managers/screenManagerHooks';

export default function ScreenVaryAppDocumentComp() {
    const screenManager = useScreenManagerContext();
    const { screenVaryAppDocumentManager } = screenManager;
    const screenVaryAppDocumentManagerRef = useAppCurrentRef(
        screenVaryAppDocumentManager,
    );
    useScreenManagerEvents(['refresh'], screenManager, () => {
        const isPlaying =
            screenVaryAppDocumentManagerRef.current.checkIsMediaPlaying();
        if (isPlaying) {
            return;
        }
        screenVaryAppDocumentManagerRef.current.render();
    });
    const div = useRef<HTMLDivElement>(null);
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
