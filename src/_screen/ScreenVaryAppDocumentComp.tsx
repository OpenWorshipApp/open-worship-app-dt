import { useRef, type CSSProperties } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import {
    useScreenManagerContext,
    useScreenManagerEvents,
} from './managers/screenManagerHooks';

// The slide stays in the document -- its media keep playing, with sound, and
// stay drivable -- but the browser skips its style, layout and paint, and it
// takes no pointer. Used by a mini preview whose rendering is turned off.
const UNPAINTED_STYLE: CSSProperties = {
    contentVisibility: 'hidden',
    visibility: 'hidden',
    pointerEvents: 'none',
};

export default function ScreenVaryAppDocumentComp({
    isUnpainted = false,
}: Readonly<{ isUnpainted?: boolean }>) {
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
    const containerStyle = screenVaryAppDocumentManager.containerStyle;
    return (
        <div
            id="slide"
            ref={div}
            style={
                isUnpainted
                    ? { ...containerStyle, ...UNPAINTED_STYLE }
                    : containerStyle
            }
        />
    );
}
