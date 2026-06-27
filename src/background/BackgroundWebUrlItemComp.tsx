import { useCallback } from 'react';

import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import { handleDragStart } from '../helper/dragHelpers';
import { tran } from '../lang/langHelpers';
import { genBackgroundMediaItemData } from './backgroundHelpers';
import { type BackgroundWebUrlSource } from './backgroundWebUrlHelpers';
import { genShowOnScreensContextMenu } from '../others/FileItemHandlerComp';
import ItemColorNoteComp from '../others/ItemColorNoteComp';
import { copyToClipboard } from '../server/appHelpers';
import { RenderWebChildComp } from './BackgroundWebChildComp';

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
    onColorNoteChange: () => void;
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
            <RenderWebChildComp
                fileOrUrlSource={urlSource}
                selectedBackgroundSrcList={selectedBackgroundSrcList}
                width={thumbnailWidth}
                height={thumbnailHeight}
                isUrl
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
