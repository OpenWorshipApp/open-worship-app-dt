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

export type RenderChildType = (
    filePath: string,
    selectedBackgroundSrcList: [string, BackgroundSrcType][],
) => React.ReactNode;

const backgroundTypeMapper: any = {
    [DragTypeEnum.BACKGROUND_IMAGE]: 'image',
    [DragTypeEnum.BACKGROUND_VIDEO]: 'video',
    [DragTypeEnum.BACKGROUND_SOUND]: 'sound',
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
    dragType: DragTypeEnum,
    onClick: ((event: any, fileSource: FileSource) => void) | undefined,
    noDraggable: boolean,
    isNameOnTop: boolean,
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
    const selectedCN = isInScreen ? 'app-highlight-selected animation' : '';
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
                    ...(isInScreen
                        ? []
                        : genTrashContextMenu(fileSource.filePath)),
                ]);
            }}
            onClick={(event) => {
                if (onClick !== undefined) {
                    onClick(event, fileSource);
                } else {
                    handleSelecting(event);
                }
            }}
        >
            {!isNameOnTop ? null : (
                <div className="app-ellipsis-left pe-4">
                    {fileSource.fullName}
                </div>
            )}
            {rendChild(filePath, selectedBackgroundSrcList)}
            <div
                style={{
                    position: 'absolute',
                    right: 0,
                }}
            >
                <ItemColorNoteComp item={fileSource} />
            </div>
            {isNameOnTop ? null : genFileNameElement(fileSource.name)}
        </div>
    );
}

export default function BackgroundMediaComp({
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
}: Readonly<{
    extraHeaderChild?: React.ReactNode;
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
        event: React.MouseEvent<HTMLElement>,
    ) => OptionalPromise<ContextMenuItemType[]>;
    sortFilePaths?: (filePaths: string[]) => string[];
    onItemsAdding?: (
        dirSource: DirSource,
        contextMenuItems: ContextMenuItemType[],
        event: any,
    ) => void;
}>) {
    const backgroundType = backgroundTypeMapper[dragType];
    const dirSource = useGenDirSource(dirSourceSettingName);
    const handleBodyRendering = (filePaths: string[]) => {
        const newFilePaths = sortFilePaths(filePaths);
        const genBodyWithChild = genBody.bind(
            null,
            rendChild,
            dragType,
            onClick,
            noDraggable,
            isNameOnTop,
        );
        return (
            <div className="">
                {extraHeaderChild !== undefined ? (
                    <>{extraHeaderChild}</>
                ) : null}
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
                          extensions: getMimetypeExtensions(backgroundType),
                      }
            }
            onItemsAdding={
                onItemsAdding !== undefined
                    ? onItemsAdding.bind(null, dirSource)
                    : undefined
            }
        />
    );
}
