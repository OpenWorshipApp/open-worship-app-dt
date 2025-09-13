import { useRef, useState } from 'react';
import { useAppEffectAsync } from '../helper/debuggerHelpers';
import LoadingComp from '../others/LoadingComp';
import ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import { getCameraAndShowMedia } from '../_screen/screenForegroundHelpers';
import {
    getScreenForegroundManagerInstances,
    getForegroundShowingScreenIdDataList,
    getScreenForegroundManagerByDropped,
} from './foregroundHelpers';
import ScreensRendererComp from './ScreensRendererComp';
import { useScreenForegroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import { genTimeoutAttempt } from '../helper/helpers';
import { useForegroundPropsSetting } from './propertiesSettingHelpers';
import { ForegroundCameraDataType } from '../_screen/screenTypeHelpers';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import { dragStore } from '../helper/dragHelpers';

type CameraInfoType = {
    deviceId: string;
    groupId: string;
    label: string;
};

function RenderCameraInfoComp({
    cameraInfo,
    width,
    genStyle,
}: Readonly<{
    cameraInfo: CameraInfoType;
    width: number;
    genStyle: () => React.CSSProperties;
}>) {
    const containerRef = useRef<HTMLDivElement>(null);
    useAppEffectAsync(async () => {
        if (containerRef.current === null) {
            return;
        }
        await getCameraAndShowMedia({
            id: cameraInfo.deviceId,
            parentContainer: containerRef.current,
            width,
        });
    }, [containerRef.current]);
    const handleShowing = (event: any, isForceChoosing = false) => {
        ScreenForegroundManager.addCameraData(
            event,
            {
                id: cameraInfo.deviceId,
                extraStyle: genStyle(),
            },
            isForceChoosing,
        );
    };
    const handleContextMenuOpening = (event: any) => {
        handleShowing(event, true);
    };
    const handleByDropped = (event: any) => {
        const screenForegroundManager =
            getScreenForegroundManagerByDropped(event);
        if (screenForegroundManager === null) {
            return;
        }
        screenForegroundManager.addCameraData({
            id: cameraInfo.deviceId,
            extraStyle: genStyle(),
        });
    };
    return (
        <div className="card m-2" style={{ width: `${width}px` }}>
            <div className="card-header app-ellipsis" title={cameraInfo.label}>
                {cameraInfo.label}
            </div>
            <div
                className={
                    'card-body w-100 p-0 app-overflow-hidden' +
                    ' app-caught-hover-pointer'
                }
                // TODO: implement drag and drop
                onClick={handleShowing}
                onContextMenu={handleContextMenuOpening}
                ref={containerRef}
                draggable
                onDragStart={() => {
                    dragStore.onDropped = handleByDropped;
                }}
            >
                <LoadingComp />
            </div>
        </div>
    );
}

function getAllShowingScreenIdDataList() {
    const showingScreenIdDataList = getForegroundShowingScreenIdDataList(
        ({ cameraDataList }) => {
            return cameraDataList.length > 0;
        },
    ).reduce(
        (acc, [screenId, { cameraDataList }]) => {
            return acc.concat(
                cameraDataList.map((data) => {
                    return [screenId, data];
                }),
            );
        },
        [] as [number, ForegroundCameraDataType][],
    );
    return showingScreenIdDataList;
}

const attemptTimeout = genTimeoutAttempt(500);
function refreshAllCameras(
    showingScreenIdDataList: [number, ForegroundCameraDataType][],
    extraStyle: React.CSSProperties,
) {
    attemptTimeout(() => {
        showingScreenIdDataList.forEach(([screenId, data]) => {
            getScreenForegroundManagerInstances(
                screenId,
                (screenForegroundManager) => {
                    screenForegroundManager.removeCameraData(data);
                    screenForegroundManager.addCameraData({
                        ...data,
                        extraStyle,
                    });
                },
            );
        });
    });
}

function handleCameraHiding(screenId: number, data: ForegroundCameraDataType) {
    getScreenForegroundManagerInstances(screenId, (screenForegroundManager) => {
        screenForegroundManager.removeCameraData(data);
    });
}

function ForegroundCameraItemComp({
    cameraInfo,
}: Readonly<{
    cameraInfo: CameraInfoType;
}>) {
    useScreenForegroundManagerEvents(['update']);
    const showingScreenIdDataList = getAllShowingScreenIdDataList().filter(
        ([, data]) => data.id === cameraInfo.deviceId,
    );
    const { genStyle, element: propsSetting } = useForegroundPropsSetting({
        prefix: 'camera-' + cameraInfo.deviceId,
        onChange: (extraStyle) => {
            refreshAllCameras(showingScreenIdDataList, extraStyle);
        },
    });
    return (
        <div className="app-border-white-round p-2">
            {propsSetting}
            <hr />
            <div className="d-flex flex-wrap">
                <RenderCameraInfoComp
                    cameraInfo={cameraInfo}
                    width={300}
                    genStyle={genStyle}
                />
            </div>
            <hr />
            <ScreensRendererComp
                showingScreenIdDataList={showingScreenIdDataList}
                buttonText="`Hide Camera"
                genTitle={(data) => {
                    return `Camera: ${data.id}`;
                }}
                handleForegroundHiding={handleCameraHiding}
                isMini={false}
            />
        </div>
    );
}

function RenderShownMiniComp() {
    useScreenForegroundManagerEvents(['update']);
    const allShowingScreenIdDataList = getAllShowingScreenIdDataList();
    return (
        <ScreensRendererComp
            showingScreenIdDataList={allShowingScreenIdDataList}
            buttonText="`Hide Camera"
            genTitle={(data) => {
                return `Camera: ${data.id}`;
            }}
            handleForegroundHiding={handleCameraHiding}
            isMini
        />
    );
}

export default function ForegroundCameraComp() {
    const [cameraInfoList, setCameraInfoList] = useState<CameraInfoType[]>([]);
    useAppEffectAsync(
        async (contextMethods) => {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameraList: CameraInfoType[] = [];
            for (const device of devices) {
                if (device.kind === 'videoinput') {
                    cameraList.push(device);
                }
            }
            contextMethods.setCameraInfoList(cameraList);
        },
        [],
        { setCameraInfoList },
    );

    return (
        <ForegroundLayoutComp
            target="camera"
            fullChildHeaders={<h4>`Camera Show</h4>}
            childHeadersOnHidden={<RenderShownMiniComp />}
        >
            <div className="d-flex">
                {cameraInfoList.map((cameraInfo) => {
                    return (
                        <ForegroundCameraItemComp
                            key={cameraInfo.deviceId}
                            cameraInfo={cameraInfo}
                        />
                    );
                })}
            </div>
        </ForegroundLayoutComp>
    );
}
