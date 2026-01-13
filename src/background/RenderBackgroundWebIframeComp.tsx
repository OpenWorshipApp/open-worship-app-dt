import { useMemo } from 'react';
import FileSource from '../helper/FileSource';
import { getDefaultScreenDisplay } from '../_screen/managers/screenHelpers';

export function BackgroundWebPlaceHolderComp({
    height,
}: Readonly<{ height: number }>) {
    return (
        <div className="w-100 h-100 d-flex justify-content-center align-items-center">
            <i
                className="bi bi-filetype-html"
                style={{
                    fontSize: `${Math.floor(height / 2)}px`,
                }}
            />
        </div>
    );
}

export default function RenderBackgroundWebIframeComp({
    fileSource,
    width,
    height,
    targetWidth,
    targetHeight,
}: Readonly<{
    fileSource: FileSource;
    width: number;
    height: number;
    targetWidth?: number;
    targetHeight?: number;
}>) {
    const { scale, actualWidth, actualHeight } = useMemo(() => {
        const display = getDefaultScreenDisplay();
        targetWidth = targetWidth ?? display.bounds.width;
        targetHeight = targetHeight ?? display.bounds.height;
        const scale = Math.max(width / targetWidth, height / targetHeight);
        return {
            scale,
            actualWidth: targetWidth,
            actualHeight: targetHeight,
        };
    }, [targetWidth, width, height, targetHeight]);
    return (
        <iframe
            sandbox="allow-scripts"
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
