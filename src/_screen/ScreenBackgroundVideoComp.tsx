import { useScreenBackgroundManagerEvents } from './managers/screenEventHelpers';
import { useScreenManagerContext } from './managers/screenManagerHooks';
import { BackgroundSrcType, calMediaSizes } from './screenHelpers';

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
    return (
        <video
            src={backgroundSrc.src}
            style={{
                width: `${width}px`,
                height: `${height}px`,
                transform: `translate(-${offsetH}px, -${offsetV}px)`,
            }}
            autoPlay
            loop
            muted
            playsInline
        />
    );
}
