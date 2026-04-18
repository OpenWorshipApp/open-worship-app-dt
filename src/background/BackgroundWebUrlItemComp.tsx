import { useCallback, type ReactElement } from 'react';
import { useState } from 'react';

import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import { handleDragStart } from '../helper/dragHelpers';
import type { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import RenderBackgroundScreenIds from './RenderBackgroundScreenIds';
import { tran } from '../lang/langHelpers';
import { genBackgroundMediaItemData } from './backgroundHelpers';
import RenderBackgroundWebIframeComp, {
    BackgroundWebPlaceHolderComp,
} from './RenderBackgroundWebIframeComp';
import { type BackgroundWebUrlSource } from './backgroundWebUrlHelpers';
import { useWebCapturing } from '../helper/domHelpers';
import { genShowOnScreensContextMenu } from '../others/FileItemHandlerComp';
import ItemColorNoteComp from '../others/ItemColorNoteComp';
import { copyToClipboard } from '../server/appHelpers';

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

function RenderUrlChildComp({
    urlSource,
    selectedBackgroundSrcList,
    width,
    height,
    extraChild,
}: Readonly<{
    urlSource: BackgroundWebUrlSource;
    selectedBackgroundSrcList: [string, BackgroundSrcType][];
    width: number;
    height: number;
    extraChild?: ReactElement;
}>) {
    const [isPlaying, setIsPlaying] = useState(false);
    const imageData = useWebCapturing(urlSource);
    const handleMouseOver = useCallback(() => {
        setIsPlaying(true);
    }, []);
    const handleMouseOut = useCallback(() => {
        setIsPlaying(false);
    }, []);
    return (
        <div
            className="card-body app-blank-bg"
            title={urlSource.fullName}
            style={{
                height: `${height}px`,
                overflow: 'hidden',
                borderRadius: '5px 5px 0px 0px',
                position: 'relative',
            }}
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
        >
            <RenderBackgroundScreenIds
                screenIds={selectedBackgroundSrcList.map(([key]) => {
                    return Number.parseInt(key);
                })}
            />
            {isPlaying ? (
                <RenderBackgroundWebIframeComp
                    src={urlSource}
                    width={width}
                    height={height}
                />
            ) : (
                <BackgroundWebPlaceHolderComp
                    height={height}
                    imageData={imageData}
                />
            )}
            <small
                className="badge rounded-pill text-bg-info"
                style={{
                    position: 'absolute',
                    left: '4px',
                    bottom: '4px',
                    zIndex: 1,
                }}
            >
                URL
            </small>
            {extraChild}
        </div>
    );
}

export default function BackgroundWebUrlItemComp({
    urlSource,
    thumbnailWidth,
    thumbnailHeight,
    onRemove,
    onColorNoteChange,
}: Readonly<{
    urlSource: BackgroundWebUrlSource;
    thumbnailWidth: number;
    thumbnailHeight: number;
    onRemove: (urlSource: BackgroundWebUrlSource) => Promise<void>;
    onColorNoteChange?: () => void;
}>) {
    const {
        selectedCN,
        title,
        handleSelecting,
        backgroundType,
        isInScreen,
        selectedBackgroundSrcList,
    } = genBackgroundMediaItemData(
        urlSource.fullName,
        urlSource.src,
        DragTypeEnum.BACKGROUND_WEB,
    );
    const handleContextMenuOpening = useCallback(
        (event: any) => {
            const contextMenuItems: ContextMenuItemType[] = [
                {
                    menuElement: tran('Copy URL to Clipboard'),
                    onSelect: () => {
                        copyToClipboard(urlSource.src);
                    },
                },
                ...genShowOnScreensContextMenu((event) => {
                    handleSelecting(event, true);
                }),
                ...(isInScreen
                    ? []
                    : [
                          {
                              menuElement: tran('Remove URL'),
                              onSelect: () => {
                                  void onRemove(urlSource);
                              },
                          },
                      ]),
            ];
            showAppContextMenu(event, contextMenuItems);
        },
        [handleSelecting, isInScreen, onRemove, urlSource],
    );
    const handleClicking = useCallback(
        (event: any) => {
            handleSelecting(event);
        },
        [handleSelecting],
    );
    const handleMediaDragStart = useCallback(
        (event: any) => {
            handleDragStart(event, urlSource, DragTypeEnum.BACKGROUND_WEB);
        },
        [urlSource],
    );
    return (
        <div
            className={`${backgroundType}-thumbnail card ${selectedCN}`}
            title={title}
            style={{
                width: `${thumbnailWidth}px`,
            }}
            data-file-item-file-src={urlSource.src}
            draggable
            onDragStart={handleMediaDragStart}
            onContextMenu={handleContextMenuOpening}
            onClick={handleClicking}
        >
            <RenderUrlChildComp
                urlSource={urlSource}
                selectedBackgroundSrcList={selectedBackgroundSrcList}
                width={thumbnailWidth}
                height={thumbnailHeight}
                extraChild={
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                        }}
                    >
                        <ItemColorNoteComp
                            item={urlSource}
                            onChange={onColorNoteChange}
                        />
                    </div>
                }
            />
            {genFileNameElement(urlSource.name)}
        </div>
    );
}
