import { CameraInfoType } from '../helper/cameraHelpers';
import ScreenBackgroundManager from '../_screen/managers/ScreenBackgroundManager';
import { genShowOnScreensContextMenu } from '../others/FileItemHandlerComp';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import {
    cameraDragSerialize,
    genBackgroundMediaItemData,
} from './backgroundHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import RenderBackgroundScreenIds from './RenderBackgroundScreenIds';
import { handleDragStart } from '../helper/dragHelpers';
import RenderCameraVideoComp from './RenderCameraVideoComp';

const TITLE_HEIGHT = 30;

export default function BackgroundCameraItemComp({
    cameraInfo,
    width,
    height,
}: Readonly<{
    cameraInfo: CameraInfoType;
    width: number;
    height: number;
}>) {
    const {
        selectedCN,
        title,
        handleSelecting,
        backgroundType,
        selectedBackgroundSrcList,
    } = genBackgroundMediaItemData(
        cameraInfo.label,
        cameraInfo.deviceId,
        DragTypeEnum.BACKGROUND_CAMERA,
    );
    return (
        <div
            className={`${backgroundType}-thumbnail card ${selectedCN}`}
            title={title}
            style={{
                width: `${width}px`,
                height: `${height + TITLE_HEIGHT}px`,
                margin: '2px',
            }}
            draggable
            onDragStart={(event) => {
                handleDragStart(event, {
                    dragSerialize: () => {
                        return cameraDragSerialize(cameraInfo);
                    },
                });
            }}
            onContextMenu={(event) => {
                showAppContextMenu(event as any, [
                    ...genShowOnScreensContextMenu((event) => {
                        handleSelecting(event, true);
                    }),
                ]);
            }}
            onClick={(event) => {
                ScreenBackgroundManager.handleBackgroundSelecting(
                    event,
                    'camera',
                    { src: cameraInfo.deviceId },
                    false,
                );
            }}
        >
            <div
                className="card-header w-100 app-ellipsis p-0 px-1"
                style={{
                    height: `${TITLE_HEIGHT}px`,
                }}
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
            >
                <RenderBackgroundScreenIds
                    screenIds={selectedBackgroundSrcList.map(([key]) => {
                        return Number.parseInt(key);
                    })}
                />
                <RenderCameraVideoComp
                    deviceId={cameraInfo.deviceId}
                    width={width}
                />
            </div>
        </div>
    );
}
