import { useMemo } from 'react';
import FileSource from '../helper/FileSource';
import { getDefaultScreenDisplay } from '../_screen/managers/screenHelpers';

export default function RenderBackgroundWebIframeComp({
    fileSource,
    width,
    height,
}: Readonly<{
    fileSource: FileSource;
    width: number;
    height: number;
}>) {
    const { scale, actualWidth, actualHeight } = useMemo(() => {
        const display = getDefaultScreenDisplay();
        const scale = Math.max(
            width / display.bounds.width,
            height / display.bounds.height,
        );
        return {
            scale,
            actualWidth: display.bounds.width,
            actualHeight: display.bounds.height,
        };
    }, [height]);
    return (
        <iframe
            src={fileSource.src}
            title={fileSource.fullName}
            style={{
                pointerEvents: 'none',
                colorScheme: 'normal',
                border: 'none',
                backgroundColor: 'transparent',
                width: `${actualWidth}px`,
                height: `${actualHeight}px`,
                overflow: 'hidden',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
            }}
        />
    );
}
