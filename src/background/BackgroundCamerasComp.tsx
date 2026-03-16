import { useCallback } from 'react';

import { useCameraInfoList } from '../helper/cameraHelpers';
import { useThumbnailWidthSetting } from './BackgroundMediaComp';
import { handleCtrlWheel } from '../others/AppRangeComp';
import BackgroundCameraItemComp from './BackgroundCameraItemComp';
import BackgroundFooterComp, { defaultRangeSize } from './BackgroundFooterComp';
import { useScreenBackgroundManagerEvents } from '../_screen/managers/screenEventHelpers';

export default function BackgroundCamerasComp() {
    useScreenBackgroundManagerEvents(['update']);
    const [thumbnailWidth, setThumbnailWidth] = useThumbnailWidthSetting();
    const cameraInfoList = useCameraInfoList();
    const thumbnailHeight = Math.round((thumbnailWidth * 9) / 16);
    const handleWheel = useCallback(
        (event: any) => {
            handleCtrlWheel({
                event,
                value: thumbnailWidth,
                setValue: setThumbnailWidth,
                defaultSize: defaultRangeSize,
            });
        },
        [thumbnailWidth, setThumbnailWidth],
    );
    return (
        <div
            className="card w-100 h-100 app-zero-border-radius"
            onWheel={handleWheel}
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
            <BackgroundFooterComp
                thumbnailWidth={thumbnailWidth}
                setThumbnailWidth={setThumbnailWidth}
            />
        </div>
    );
}
