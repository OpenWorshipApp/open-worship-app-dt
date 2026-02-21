import { useMemo } from 'react';
import { useScreenBackgroundManagerEvents } from './managers/screenEventHelpers';
import { useScreenManagerContext } from './managers/screenManagerHooks';
import { calMediaSizes } from './screenHelpers';
import type { BackgroundSrcType } from './screenTypeHelpers';
import appProvider from '../server/appProvider';

export default function ScreenBackgroundVideoComp({
    backgroundSrc,
}: Readonly<{
    backgroundSrc: BackgroundSrcType;
}>) {
    const screenManager = useScreenManagerContext();
    const { screenBackgroundManager } = screenManager;
    useScreenBackgroundManagerEvents(['update'], screenBackgroundManager);
    const { width, height, offsetH, offsetV } = calMediaSizes(
        {
            parentWidth: screenManager.width,
            parentHeight: screenManager.height,
        },
        backgroundSrc,
    );
    const videoId = useMemo(() => {
        const md5 = appProvider.systemUtils.generateMD5(backgroundSrc.src);
        return `video-${md5}`;
    }, [backgroundSrc.src]);
    return (
        <video
            id={videoId}
            src={backgroundSrc.src}
            style={{
                width: `${width}px`,
                height: `${height}px`,
                transform: `translate(${offsetH}px, ${offsetV}px)`,
            }}
            autoPlay
            loop
            muted
            playsInline
        />
    );
}
