import { useMemo } from 'react';

import type FileSource from '../helper/FileSource';
import { getDefaultScreenDisplay } from '../_screen/managers/screenHelpers';

type BackgroundWebIframeSourceType = Pick<FileSource, 'src' | 'fullName'>;

export function BackgroundWebPlaceHolderComp({
    height,
    imageData,
}: Readonly<{ height: number; imageData?: string | null }>) {
    if (imageData) {
        return (
            <img
                src={imageData}
                alt="web preview"
                style={{
                    width: '100%',
                    height: `${height}px`,
                    objectFit: 'cover',
                }}
            />
        );
    }
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
    src,
    width,
    height,
    targetWidth,
    targetHeight,
}: Readonly<{
    src: BackgroundWebIframeSourceType;
    width: number;
    height: number;
    targetWidth?: number;
    targetHeight?: number;
}>) {
    const { scale, actualWidth, actualHeight } = useMemo(() => {
        const display = getDefaultScreenDisplay();
        const effectiveWidth = targetWidth ?? display.bounds.width;
        const effectiveHeight = targetHeight ?? display.bounds.height;
        const scale = Math.max(
            width / effectiveWidth,
            height / effectiveHeight,
        );
        return {
            scale,
            actualWidth: effectiveWidth,
            actualHeight: effectiveHeight,
        };
    }, [targetWidth, width, height, targetHeight]);
    return (
        <iframe
            sandbox="allow-scripts"
            src={src.src}
            title={src.fullName}
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
