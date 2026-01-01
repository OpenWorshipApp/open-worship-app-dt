import {
    genCommonMenu,
    genShowOnScreensContextMenu,
    genTrashContextMenu,
} from '../others/FileItemHandlerComp';
import FileSource from '../helper/FileSource';
import { DragTypeEnum } from '../helper/DragInf';
import ItemColorNoteComp from '../others/ItemColorNoteComp';
import { handleDragStart } from '../helper/dragHelpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import {
    genBackgroundMediaItemData,
    RenderChildType,
} from './backgroundHelpers';

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
    const fileSource = FileSource.getInstance(filePath);
    const {
        selectedCN,
        title,
        handleSelecting,
        backgroundType,
        isInScreen,
        selectedBackgroundSrcList,
    } = genBackgroundMediaItemData(
        fileSource.fullName,
        fileSource.src,
        dragType,
    );
    return (
        <div
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
