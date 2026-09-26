import { memo, useCallback } from 'react';

import {
    genCommonMenu,
    genShowOnScreensContextMenu,
    genTrashContextMenu,
} from '../others/FileItemHandlerComp';
import FileSource from '../helper/FileSource';
import type { DragTypeEnum } from '../helper/DragInf';
import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import ItemColorNoteComp from '../others/ItemColorNoteComp';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import type {
    GenMediaItemDataType,
    RenderChildType,
} from './backgroundHelpers';
import { genBackgroundMediaItemDataByFilePath } from './backgroundHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import BackgroundListItemComp from './BackgroundListItemComp';
import type { BackgroundViewModeType } from './BackgroundViewModeComp';

function genFileNameElement(fileName: string) {
    return (
        <div className="card-footer">
            <p
                className="app-ellipsis-left card-text"
                style={{
                    fontSize: '14px',
                }}
            >
                {/* `app-ellipsis-left` is `direction: rtl` so a long name
                    keeps its END. That also makes the line RTL for the bidi
                    algorithm, which REORDERS a name whose runs are not all
                    one direction: `1_cv` was drawn as `cv_1` because the
                    neutral `_` between the digits and the letters took the
                    line's direction. `bdi` isolates the name and takes its
                    direction from its own first strong character, so the
                    order is right while the ellipsis stays on the left. */}
                <bdi>{fileName}</bdi>
            </p>
        </div>
    );
}

function BackgroundMediaItemComp({
    rendChild,
    genExtraItemContextMenuItems,
    dragType,
    onClick,
    noDraggable,
    isNameOnTop,
    thumbnailWidth,
    thumbnailHeight,
    filePath,
    viewMode = 'thumbnail',
    genItemData = genBackgroundMediaItemDataByFilePath,
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
    viewMode?: BackgroundViewModeType;
    /**
     * Which LAYER this tile belongs to. Left out it is the background, which
     * is what every Background tab wants; the Foreground panel's media widgets
     * pass their own so this same windowed grid drives `#foreground`.
     */
    genItemData?: GenMediaItemDataType;
    /**
     * Deliberately NOT read in this body. It is here so `memo` can see that
     * the layer changed: whether this file is on a screen is read from the
     * screen managers below, which no prop ever carried, so without it React
     * skipped the redraw and the grid went on marking the PREVIOUS item.
     */
    layerMarker?: string;
}>) {
    const fileSource = FileSource.getInstance(filePath);
    const {
        selectedCN,
        title,
        handleSelecting,
        handleDragStart,
        backgroundType,
        isInScreen,
        selectedBackgroundSrcList,
    } = genItemData(filePath, dragType);
    const fileSourceRef = useAppCurrentRef(fileSource);
    const handleDragStartRef = useAppCurrentRef(handleDragStart);
    const handleMediaDragStart = useCallback((event: any) => {
        // An audio row holds a real <audio controls>; dragging its scrubber or
        // volume slider must stay a scrub, not start a file drag.
        if (event.target?.closest?.('audio') !== null) {
            event.preventDefault();
            return;
        }
        handleDragStartRef.current(event);
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
    if (viewMode === 'list') {
        return (
            <BackgroundListItemComp
                backgroundType={backgroundType}
                name={fileSource.fullName}
                title={title}
                selectedCN={selectedCN}
                src={fileSource.src}
                isDraggable={!noDraggable}
                selectedBackgroundSrcList={selectedBackgroundSrcList}
                onDragStart={handleMediaDragStart}
                onContextMenu={handleContextMenuOpening}
                onClick={handleClicking}
                colorNoteChild={<ItemColorNoteComp item={fileSource} />}
            />
        );
    }
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
                    <bdi>{fileSource.fullName}</bdi>
                </div>
            )}
            {rendChild(
                filePath,
                selectedBackgroundSrcList,
                thumbnailWidth,
                thumbnailHeight,
                <div
                    className="d-flex align-items-start"
                    style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        zIndex: 2,
                    }}
                >
                    <ContextMenuDotsButtonComp
                        onOpening={handleContextMenuOpening}
                    />
                    <ItemColorNoteComp item={fileSource} />
                </div>,
            )}
            {isNameOnTop ? null : genFileNameElement(fileSource.name)}
        </div>
    );
}

// Memoised: the windowed grid re-renders every mounted tile each time the
// scroll crosses a row, and a tile's props do not change when it does.
export default memo(BackgroundMediaItemComp);
