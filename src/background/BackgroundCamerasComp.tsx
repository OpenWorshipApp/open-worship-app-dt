import { useMemo, useRef } from 'react';

import { CameraInfoType, useCameraInfoList } from '../helper/cameraHelpers';
import { useAppEffectAsync } from '../helper/debuggerHelpers';
import LoadingComp from '../others/LoadingComp';
import { getCameraAndShowMedia } from '../_screen/screenForegroundHelpers';
import {
    defaultRangeSize,
    useThumbnailWidthSetting,
} from './BackgroundMediaComp';
import AppRangeComp, { handleCtrlWheel } from '../others/AppRangeComp';

function RenderCameraInfoComp({
    cameraInfo,
    width,
    height,
}: Readonly<{
    cameraInfo: CameraInfoType;
    width: number;
    height: number;
}>) {
    const containerRef = useRef<HTMLDivElement>(null);
    useAppEffectAsync(async () => {
        if (containerRef.current === null) {
            return;
        }
        return await getCameraAndShowMedia({
            id: cameraInfo.deviceId,
            parentContainer: containerRef.current,
            width,
            height,
            extraStyle: {
                borderBottomLeftRadius: 'var(--bs-border-radius)',
                borderBottomRightRadius: 'var(--bs-border-radius)',
            },
        });
    }, [containerRef.current, width]);
    return (
        <div
            className="card"
            style={{
                width: `${width}px`,
                height: `${height + 40}px`,
                margin: '2px',
            }}
        >
            <div
                className="card-header w-100 app-ellipsis"
                title={cameraInfo.label}
            >
                {cameraInfo.label}
            </div>
            <div
                className={
                    'card-body w-100 p-0 app-overflow-hidden' +
                    ' app-caught-hover-pointer'
                }
                style={{
                    height: `${height}px`,
                }}
                ref={containerRef}
            >
                <LoadingComp />
            </div>
        </div>
    );
}

export default function BackgroundCamerasComp() {
    const [thumbnailWidth, setThumbnailWidth] = useThumbnailWidthSetting();
    const cameraInfoList = useCameraInfoList();
    const thumbnailHeight = useMemo(() => {
        const thumbnailHeight = Math.round((thumbnailWidth * 9) / 16);
        return thumbnailHeight;
    }, [thumbnailWidth]);
    return (
        <div
            className="card w-100 h-100 app-zero-border-radius"
            onWheel={(event) => {
                handleCtrlWheel({
                    event,
                    value: thumbnailWidth,
                    setValue: setThumbnailWidth,
                    defaultSize: defaultRangeSize,
                });
            }}
        >
            <div className="card-body d-flex flex-wrap">
                {cameraInfoList.map((cameraInfo) => {
                    return (
                        <RenderCameraInfoComp
                            key={cameraInfo.deviceId}
                            cameraInfo={cameraInfo}
                            width={thumbnailWidth}
                            height={thumbnailHeight}
                        />
                    );
                })}
            </div>
            <div className="card-footer d-flex p-0">
                <div className="flex-fill" />
                <div>
                    <AppRangeComp
                        value={thumbnailWidth}
                        title="Thumbnail Size"
                        setValue={setThumbnailWidth}
                        defaultSize={defaultRangeSize}
                    />
                </div>
            </div>
        </div>
    );
}
