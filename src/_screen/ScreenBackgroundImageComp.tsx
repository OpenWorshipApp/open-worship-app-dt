import { useScreenBackgroundManagerEvents } from './managers/screenEventHelpers';
import { useScreenManagerContext } from './managers/screenManagerHooks';
import { calMediaSizes } from './screenHelpers';
import type { BackgroundSrcType } from './screenTypeHelpers';

export default function ScreenBackgroundImageComp({
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
        backgroundSrc.scaleType,
    );
    return (
        <img
            src={backgroundSrc.src}
            alt="background"
            style={{
                width: `${width}px`,
                height: `${height}px`,
                transform: `translate(${offsetH}px, ${offsetV}px)`,
            }}
        />
    );
}
