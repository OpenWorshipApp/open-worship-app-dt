import { ReactNode, ReactElement, useMemo } from 'react';

import {
    genCommonMenu,
    genShowOnScreensContextMenu,
    genTrashContextMenu,
} from '../others/FileItemHandlerComp';
import ScreenBackgroundManager from '../_screen/managers/ScreenBackgroundManager';
import FileSource from '../helper/FileSource';
import { DragTypeEnum } from '../helper/DragInf';
import ItemColorNoteComp from '../others/ItemColorNoteComp';
import { handleDragStart } from '../helper/dragHelpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import { HIGHLIGHT_SELECTED_CLASSNAME } from '../helper/helpers';

export type RenderChildType = (
    filePath: string,
    selectedBackgroundSrcList: [string, BackgroundSrcType][],
    height: number,
    extraChild?: ReactElement,
) => ReactNode;

export const backgroundTypeMapper: any = {
    [DragTypeEnum.BACKGROUND_IMAGE]: 'image',
    [DragTypeEnum.BACKGROUND_VIDEO]: 'video',
    [DragTypeEnum.BACKGROUND_AUDIO]: 'audio',
};

function genFileNameElement(fileName: string) {
    return (
        <div className="card-footer">
            <p
                className="app-ellipsis-left card-text"
                style={{
                    fontSize: '14px',
                }}
            >
                {fileName}
            </p>
        </div>
    );
}

function useBackgroundMediaItemData(filePath: string, dragType: DragTypeEnum) {
    const fileSource = FileSource.getInstance(filePath);
    const backgroundType = backgroundTypeMapper[dragType];
    const selectedBackgroundSrcList =
        ScreenBackgroundManager.getSelectBackgroundSrcList(
            fileSource.src,
            backgroundType,
        );
    const isInScreen = selectedBackgroundSrcList.length > 0;
    const selectedCN = isInScreen
        ? `${HIGHLIGHT_SELECTED_CLASSNAME} animation`
        : '';
    const title = useMemo(() => {
        const screenKeys = selectedBackgroundSrcList.map(([key]) => key);
        const title =
            `${filePath}` +
            (isInScreen ? ` \nShow in presents:${screenKeys.join(',')}` : '');
        return title;
    }, [filePath, isInScreen, selectedBackgroundSrcList]);
    const handleSelecting = (event: any, isForceChoosing = false) => {
        ScreenBackgroundManager.handleBackgroundSelecting(
            event,
            backgroundType,
            { src: fileSource.src },
            isForceChoosing,
        );
    };
    return {
        fileSource,
        selectedCN,
        title,
        handleSelecting,
        backgroundType,
        isInScreen,
        selectedBackgroundSrcList,
    };
}

export default function BackgroundMediaItemComp({
    rendChild,
    genExtraItemContextMenuItems,
    dragType,
    onClick,
    noDraggable,
    isNameOnTop,
    thumbnailWidth,
    thumbnailHeight,
    filePath,
}: Readonly<{
    rendChild: RenderChildType;
    genExtraItemContextMenuItems: (filePath: string) => ContextMenuItemType[];
    dragType: DragTypeEnum;
    onClick: ((event: any, fileSource: FileSource) => void) | undefined;
    noDraggable: boolean;
    isNameOnTop: boolean;
    thumbnailWidth: number;
    thumbnailHeight: number;
    filePath: string;
}>) {
    const {
        fileSource,
        selectedCN,
        title,
        handleSelecting,
        backgroundType,
        isInScreen,
        selectedBackgroundSrcList,
    } = useBackgroundMediaItemData(filePath, dragType);
    return (
        <div
            key={fileSource.fullName}
            className={`${backgroundType}-thumbnail card ${selectedCN}`}
            title={title}
            style={{
                width: `${thumbnailWidth}px`,
            }}
            draggable={!noDraggable}
            onDragStart={(event) => {
                handleDragStart(event, fileSource, dragType);
            }}
            onContextMenu={(event) => {
                showAppContextMenu(event as any, [
                    ...genCommonMenu(filePath),
                    ...genShowOnScreensContextMenu((event) => {
                        handleSelecting(event, true);
                    }),
                    ...genExtraItemContextMenuItems(filePath),
                    ...(isInScreen
                        ? []
                        : genTrashContextMenu(fileSource.filePath)),
                ]);
            }}
            onClick={(event) => {
                if (onClick) {
                    onClick(event, fileSource);
                } else {
                    handleSelecting(event);
                }
            }}
        >
            {isNameOnTop && (
                <div className="app-ellipsis-left pe-4">
                    {fileSource.fullName}
                </div>
            )}
            {rendChild(
                filePath,
                selectedBackgroundSrcList,
                thumbnailHeight,
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                    }}
                >
                    <ItemColorNoteComp item={fileSource} />
                </div>,
            )}
            {isNameOnTop ? null : genFileNameElement(fileSource.name)}
        </div>
    );
}
