import { useState, useMemo, useCallback } from 'react';

import ScreenVaryAppDocumentManager from '../../_screen/managers/ScreenVaryAppDocumentManager';
import { checkIsAppDocumentItemOnScreen } from '../../app-document-list/appDocumentHelpers';
import type { VaryAppDocumentItemType } from '../../app-document-list/appDocumentTypeHelpers';
import RenderBackgroundWebIframeComp from '../../background/RenderBackgroundWebIframeComp';
import RenderCameraVideoComp from '../../background/RenderCameraVideoComp';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { useAppEffect } from '../../helper/debuggerHelpers';
import type { DroppedDataType } from '../../helper/DragInf';
import { DragTypeEnum } from '../../helper/DragInf';
import {
    getColorNoteFilePathSetting,
    setColorNoteFilePathSetting,
} from '../../helper/FileSourceMetaManager';
import {
    HIGHLIGHT_SELECTED_CLASSNAME,
    genTimeoutAttempt,
} from '../../helper/helpers';
import { chooseColorNote } from '../../others/ItemColorNoteComp';
import appProvider from '../../server/appProvider';
import BackgroundRenderOnHoverComp from './BackgroundRenderOnHoverComp';

const CAMERA_BACKGROUND_SRC = '/assets/background-camera.png';
const WEB_BACKGROUND_SRC = '/assets/background-web.png';
const BROKEN_IMAGE_SRC = '/assets/broken-image.png';
const BROKEN_VIDEO_SRC = '/assets/broken-video.mp4';

export function genAttachBackgroundComponent(
    droppedData: DroppedDataType | null | undefined,
) {
    if (droppedData === null || droppedData === undefined) {
        return null;
    }
    if (droppedData.type === DragTypeEnum.BACKGROUND_COLOR) {
        return (
            <div
                className="w-100 h-100"
                style={{ backgroundColor: droppedData.item }}
            />
        );
    }
    if (droppedData.type === DragTypeEnum.BACKGROUND_CAMERA) {
        return (
            <BackgroundRenderOnHoverComp
                src={CAMERA_BACKGROUND_SRC}
                genChildren={({ width }) => {
                    return (
                        <RenderCameraVideoComp
                            deviceId={droppedData.item.src}
                            width={width}
                        />
                    );
                }}
            />
        );
    }
    if (droppedData.type === DragTypeEnum.BACKGROUND_WEB) {
        return (
            <BackgroundRenderOnHoverComp
                src={WEB_BACKGROUND_SRC}
                genChildren={({ width, height }) => {
                    return (
                        <RenderBackgroundWebIframeComp
                            fileSource={droppedData.item}
                            width={width}
                            height={height}
                        />
                    );
                }}
            />
        );
    }
    if (droppedData.type === DragTypeEnum.BACKGROUND_IMAGE) {
        const src = droppedData.item.src;
        return (
            <img
                className="w-100 h-100"
                alt={src}
                src={src}
                onError={(event) => {
                    if (!event.currentTarget.src.endsWith(BROKEN_IMAGE_SRC)) {
                        event.currentTarget.src = BROKEN_IMAGE_SRC;
                    }
                }}
            />
        );
    }
    if (droppedData.type === DragTypeEnum.BACKGROUND_VIDEO) {
        return (
            <video
                className="w-100 h-100"
                style={{
                    objectFit: 'cover',
                    objectPosition: 'center center',
                }}
                onMouseEnter={(event) => {
                    event.currentTarget.play();
                }}
                onMouseLeave={(event) => {
                    event.currentTarget.pause();
                }}
                loop
                muted
                src={droppedData.item.src}
                onError={(event) => {
                    if (!event.currentTarget.src.endsWith(BROKEN_VIDEO_SRC)) {
                        event.currentTarget.src = BROKEN_VIDEO_SRC;
                    }
                }}
            />
        );
    }
    return null;
}

export function toClassNameHighlight(
    varyAppDocumentItem: VaryAppDocumentItemType,
    selectedVaryAppDocumentItem?: VaryAppDocumentItemType | null,
) {
    const activeClassname =
        appProvider.isPageAppDocumentEditor &&
        selectedVaryAppDocumentItem &&
        varyAppDocumentItem.checkIsSame(selectedVaryAppDocumentItem)
            ? 'active'
            : '';
    const isOnScreen = checkIsAppDocumentItemOnScreen(varyAppDocumentItem);
    const presenterClassname =
        appProvider.isPageAppDocumentEditor || !isOnScreen
            ? ''
            : `${HIGHLIGHT_SELECTED_CLASSNAME} animation`;
    return {
        selectedList: ScreenVaryAppDocumentManager.getDataList(
            varyAppDocumentItem.filePath,
            varyAppDocumentItem.id,
        ),
        activeCN: activeClassname,
        presenterCN: presenterClassname,
    };
}

export function useScale(item: VaryAppDocumentItemType, thumbnailSize: number) {
    const [targetDiv, setTargetDiv] = useState<HTMLDivElement | null>(null);
    const [width, setWidth] = useState(0);

    useAppEffect(() => {
        setWidth(targetDiv?.clientWidth ?? 0);
    }, [targetDiv, thumbnailSize]);

    const scale = useMemo(() => {
        return width / item.width;
    }, [width, item]);

    const resizeAttemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);

    const listenParentSizing = useCallback(
        (parentDiv: HTMLElement | null) => {
            if (parentDiv !== null) {
                const resizeObserver = new ResizeObserver(() => {
                    resizeAttemptTimeout(() => {
                        const newWidth = targetDiv?.clientWidth ?? 0;
                        setWidth(newWidth);
                    });
                });
                resizeObserver.observe(parentDiv);
                return () => {
                    resizeObserver.disconnect();
                };
            }
        },
        [resizeAttemptTimeout, targetDiv],
    );

    const handleSetTargetDiv = useCallback(
        (div: HTMLDivElement | null) => {
            setTargetDiv(div);
            return listenParentSizing(div?.parentElement ?? null);
        },
        [listenParentSizing],
    );

    const handleSetParentDiv = useCallback(
        (parentDiv: HTMLDivElement | null) => {
            if (parentDiv === null) {
                setTargetDiv(null);
            } else {
                setTargetDiv(parentDiv.parentElement as HTMLDivElement);
            }
            return listenParentSizing(parentDiv);
        },
        [listenParentSizing],
    );

    return {
        width,
        scale,
        setTargetDiv: handleSetTargetDiv,
        setParentDiv: handleSetParentDiv,
    };
}

export function genChooseColorNoteOption(
    filePath: string,
    id: number,
): ContextMenuItemType[] {
    const colorCode = getColorNoteFilePathSetting(filePath, id);
    return [
        {
            menuElement: 'Choose Color',
            childBefore: (
                <i
                    className="bi bi-record-circle px-1"
                    style={{ color: colorCode || undefined }}
                />
            ),
            onSelect: (event) => {
                chooseColorNote(
                    colorCode,
                    (newColorCode) => {
                        setColorNoteFilePathSetting(filePath, id, newColorCode);
                        ScreenVaryAppDocumentManager.fireUpdateEvent();
                    },
                    event,
                );
            },
        },
    ];
}
