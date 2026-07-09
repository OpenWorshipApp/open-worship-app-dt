import { useCallback } from 'react';

import {
    genCommonMenu,
    genShowOnScreensContextMenu,
    genTrashContextMenu,
} from '../others/FileItemHandlerComp';
import FileSource from '../helper/FileSource';
import type { DragTypeEnum } from '../helper/DragInf';
import ItemColorNoteComp from '../others/ItemColorNoteComp';
import { handleDragStart } from '../helper/dragHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import type { RenderChildType } from './backgroundHelpers';
import { genBackgroundMediaItemData } from './backgroundHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

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
    const fileSourceRef = useAppCurrentRef(fileSource);
    const dragTypeRef = useAppCurrentRef(dragType);
    const handleMediaDragStart = useCallback((event: any) => {
        handleDragStart(event, fileSourceRef.current, dragTypeRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const filePathRef = useAppCurrentRef(filePath);
    const handleSelectingRef = useAppCurrentRef(handleSelecting);
    const genExtraItemContextMenuItemsRef = useAppCurrentRef(
        genExtraItemContextMenuItems,
    );
    const isInScreenRef = useAppCurrentRef(isInScreen);
    const handleContextMenuOpening = useCallback((event: any) => {
        showAppContextMenu(event, [
            ...genCommonMenu(filePathRef.current),
            ...genShowOnScreensContextMenu((event) => {
                handleSelectingRef.current(event, true);
            }),
            ...genExtraItemContextMenuItemsRef.current(filePathRef.current),
            ...(isInScreenRef.current
                ? []
                : genTrashContextMenu(filePathRef.current)),
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const onClickRef = useAppCurrentRef(onClick);
    const handleClicking = useCallback((event: any) => {
        if (onClickRef.current) {
            onClickRef.current(event, fileSourceRef.current);
        } else {
            handleSelectingRef.current(event);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className={`${backgroundType}-thumbnail card ${selectedCN}`}
            title={title}
            style={{
                width: `${thumbnailWidth}px`,
            }}
            data-file-item-file-src={fileSource.src}
            draggable={!noDraggable}
            onDragStart={handleMediaDragStart}
            onContextMenu={handleContextMenuOpening}
            onClick={handleClicking}
        >
            {isNameOnTop && (
                <div className="app-ellipsis-left pe-4">
                    {fileSource.fullName}
                </div>
            )}
            {rendChild(
                filePath,
                selectedBackgroundSrcList,
                thumbnailWidth,
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
