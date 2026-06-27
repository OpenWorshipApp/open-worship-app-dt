import { useMemo } from 'react';

import { getDefaultScreenDisplay } from '../_screen/managers/screenHelpers';

type BackgroundWebIframeSourceType = {
    src: string;
    fullName: string;
};

export function BackgroundWebPlaceHolderComp({
    height,
    imageData,
    isPlaying,
    isUrl = false,
}: Readonly<{
    height: number;
    imageData?: string | null;
    isPlaying: boolean;
    isUrl?: boolean;
}>) {
    return (
        <div className="w-100 h-100 d-flex justify-content-center align-items-center">
            {imageData ? (
                <>
                    <img
                        src={imageData}
                        alt="web preview"
                        style={{
                            width: '100%',
                            height: `${height}px`,
                            objectFit: 'cover',
                        }}
                    />
                    {isUrl && !isPlaying ? (
                        <small
                            className="badge rounded-pill text-bg-info"
                            style={{
                                position: 'absolute',
                                left: '4px',
                                top: '4px',
                                zIndex: 1,
                            }}
                        >
                            URL
                        </small>
                    ) : null}
                </>
            ) : (
                <i
                    className={
                        'bi ' + (isUrl ? 'bi-globe' : 'bi-filetype-html')
                    }
                    style={{
                        fontSize: `${Math.floor(height / 2)}px`,
                    }}
                />
            )}
        </div>
    );
}

export default function RenderBackgroundWebIframeComp({
    iframeSource,
    width,
    height,
    targetWidth,
    targetHeight,
}: Readonly<{
    iframeSource: BackgroundWebIframeSourceType;
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
            src={iframeSource.src}
            title={iframeSource.fullName}
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
                position: 'absolute',
                top: 0,
                left: 0,
            }}
        />
    );
}
