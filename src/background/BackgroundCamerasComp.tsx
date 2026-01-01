import { useMemo } from 'react';

import { useCameraInfoList } from '../helper/cameraHelpers';
import {
    defaultRangeSize,
    useThumbnailWidthSetting,
} from './BackgroundMediaComp';
import AppRangeComp, { handleCtrlWheel } from '../others/AppRangeComp';
import BackgroundCameraItemComp from './BackgroundCameraItemComp';

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
                        <BackgroundCameraItemComp
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
