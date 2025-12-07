import { ReactNode, MouseEvent, ReactElement } from 'react';

import FileListHandlerComp from '../others/FileListHandlerComp';
import {
    genCommonMenu,
    genShowOnScreensContextMenu,
    genTrashContextMenu,
} from '../others/FileItemHandlerComp';
import ScreenBackgroundManager from '../_screen/managers/ScreenBackgroundManager';
import { useScreenBackgroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import FileSource from '../helper/FileSource';
import { DragTypeEnum } from '../helper/DragInf';
import ItemColorNoteComp from '../others/ItemColorNoteComp';
import { handleDragStart } from '../helper/dragHelpers';
import { useGenDirSource } from '../helper/dirSourceHelpers';
import { getMimetypeExtensions } from '../server/fileHelpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import { OptionalPromise } from '../helper/typeHelpers';
import DirSource from '../helper/DirSource';
import { useStateSettingNumber } from '../helper/settingHelpers';
import AppRangeComp, { handleCtrlWheel } from '../others/AppRangeComp';
import { HIGHLIGHT_SELECTED_CLASSNAME } from '../helper/helpers';

export type RenderChildType = (
    filePath: string,
    selectedBackgroundSrcList: [string, BackgroundSrcType][],
    height: number,
    extraChild?: ReactElement,
) => ReactNode;

const backgroundTypeMapper: any = {
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

function genBody(
    rendChild: RenderChildType,
    genExtraItemContextMenuItems: (filePath: string) => ContextMenuItemType[],
    dragType: DragTypeEnum,
    onClick: ((event: any, fileSource: FileSource) => void) | undefined,
    noDraggable: boolean,
    isNameOnTop: boolean,
    thumbnailWidth: number,
    thumbnailHeight: number,
    filePath: string,
) {
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
    const screenKeys = selectedBackgroundSrcList.map(([key]) => key);
    const title =
        `${filePath}` +
        (isInScreen ? ` \nShow in presents:${screenKeys.join(',')}` : '');
    const handleSelecting = (event: any, isForceChoosing = false) => {
        ScreenBackgroundManager.handleBackgroundSelecting(
            event,
            backgroundType,
            { src: fileSource.src },
            isForceChoosing,
        );
    };
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

export const defaultRangeSize = {
    size: 100,
    min: 50,
    max: 500,
    step: 10,
};

export default function BackgroundMediaComp({
    shouldHideFooter,
    extraHeaderChild,
    rendChild,
    dragType,
    onClick,
    defaultFolderName,
    dirSourceSettingName,
    noDraggable = false,
    isNameOnTop = false,
    contextMenuItems,
    genContextMenuItems,
    sortFilePaths = (filePaths) => {
        return filePaths.sort((a, b) => a.localeCompare(b));
    },
    onItemsAdding,
    genExtraItemContextMenuItems = (_filePath: string) => [],
}: Readonly<{
    shouldHideFooter?: boolean;
    extraHeaderChild?: ReactNode;
    rendChild: RenderChildType;
    dragType: DragTypeEnum;
    onClick?: (event: any, fileSource: FileSource) => void;
    defaultFolderName?: string;
    dirSourceSettingName: string;
    noDraggable?: boolean;
    isNameOnTop?: boolean;
    contextMenuItems?: ContextMenuItemType[];
    genContextMenuItems?: (
        dirSource: DirSource,
        event: MouseEvent<HTMLElement>,
    ) => OptionalPromise<ContextMenuItemType[]>;
    sortFilePaths?: (filePaths: string[]) => string[];
    onItemsAdding?: (
        dirSource: DirSource,
        contextMenuItems: ContextMenuItemType[],
        event: any,
    ) => void;
    genExtraItemContextMenuItems?: (filePath: string) => ContextMenuItemType[];
}>) {
    const [thumbnailWidth, setThumbnailWidth] = useStateSettingNumber(
        'bg-thumbnail-width',
        100,
    );
    const backgroundType = backgroundTypeMapper[dragType];
    const dirSource = useGenDirSource(dirSourceSettingName);
    const handleBodyRendering = (filePaths: string[]) => {
        const thumbnailHeight = Math.round((thumbnailWidth * 9) / 16);
        const newFilePaths = sortFilePaths(filePaths);
        const genBodyWithChild = genBody.bind(
            null,
            rendChild,
            genExtraItemContextMenuItems,
            dragType,
            onClick,
            noDraggable,
            isNameOnTop,
            thumbnailWidth,
            thumbnailHeight,
        );
        return (
            <div>
                {extraHeaderChild ? <>{extraHeaderChild}</> : null}
                <div className="d-flex justify-content-start flex-wrap">
                    {newFilePaths.map(genBodyWithChild)}
                </div>
            </div>
        );
    };
    useScreenBackgroundManagerEvents(['update']);
    if (dirSource === null) {
        return null;
    }
    return (
        <div
            className="w-100 h-100 card app-zero-border-radius"
            onWheel={(event) => {
                handleCtrlWheel({
                    event,
                    value: thumbnailWidth,
                    setValue: setThumbnailWidth,
                    defaultSize: defaultRangeSize,
                });
            }}
        >
            <div className="card-body">
                <FileListHandlerComp
                    className={`app-background-${backgroundType}`}
                    mimetypeName={backgroundType}
                    defaultFolderName={defaultFolderName}
                    dirSource={dirSource}
                    bodyHandler={handleBodyRendering}
                    contextMenuItems={contextMenuItems}
                    genContextMenuItems={genContextMenuItems}
                    fileSelectionOption={
                        backgroundType === 'color'
                            ? undefined
                            : {
                                  windowTitle: `Select ${backgroundType} files`,
                                  dirPath: dirSource.dirPath,
                                  extensions:
                                      getMimetypeExtensions(backgroundType),
                              }
                    }
                    onItemsAdding={
                        onItemsAdding
                            ? onItemsAdding.bind(null, dirSource)
                            : undefined
                    }
                />
            </div>
            {shouldHideFooter ? null : (
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
            )}
        </div>
    );
}
