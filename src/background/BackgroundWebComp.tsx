import './BackgroundWebComp.scss';

import { useCallback, type ReactElement } from 'react';
import { useMemo, useState } from 'react';

import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import { useAppEffect } from '../helper/debuggerHelpers';
import { useGenDirSourceReload } from '../helper/dirSourceHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import type { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import type DirSource from '../helper/DirSource';
import RenderBackgroundScreenIds from './RenderBackgroundScreenIds';
import BackgroundFooterComp, { defaultRangeSize } from './BackgroundFooterComp';
import BackgroundMediaItemComp from './BackgroundMediaItemComp';
import FileSource from '../helper/FileSource';
import { tran } from '../lang/langHelpers';
import FillingFlexCenterComp from '../others/FillingFlexCenterComp';
import { handleCtrlWheel } from '../others/AppRangeComp';
import { useThumbnailWidthSetting } from './BackgroundMediaComp';
import RenderBackgroundWebIframeComp, {
    BackgroundWebPlaceHolderComp,
} from './RenderBackgroundWebIframeComp';
import {
    type BackgroundWebUrlItemData,
    type BackgroundWebUrlSource,
    createBackgroundWebUrlSourceList,
    getBackgroundWebUrlItemList,
    promptBackgroundWebUrlSource,
    setBackgroundWebUrlItemList,
} from './backgroundWebUrlHelpers';
import {
    genBackgroundWebContextMenuItems,
    genBackgroundWebExtraItemContextMenuItems,
} from './backgroundWebHelpers';
import { useWebCapturing } from '../helper/domHelpers';
import { useScreenBackgroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import FileListHandlerComp from '../others/FileListHandlerComp';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import { getMimetypeExtensions } from '../server/fileHelpers';
import BackgroundWebUrlItemComp from './BackgroundWebUrlItemComp';

function RenderChildComp({
    filePath,
    selectedBackgroundSrcList,
    width,
    height,
    extraChild,
}: Readonly<{
    filePath: string;
    selectedBackgroundSrcList: [string, BackgroundSrcType][];
    width: number;
    height: number;
    extraChild?: ReactElement;
}>) {
    const [isPlaying, setIsPlaying] = useState(false);
    const fileSource = FileSource.getInstance(filePath);
    const imageData = useWebCapturing(fileSource);
    const handleMouseOver = useCallback(() => {
        setIsPlaying(true);
    }, []);
    const handleMouseOut = useCallback(() => {
        setIsPlaying(false);
    }, []);
    return (
        <div
            className="card-body app-blank-bg"
            title={fileSource.fullName}
            style={{
                height: `${height}px`,
                overflow: 'hidden',
                borderRadius: '5px 5px 0px 0px',
            }}
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
        >
            <RenderBackgroundScreenIds
                screenIds={selectedBackgroundSrcList.map(([key]) => {
                    return Number.parseInt(key);
                })}
            />
            <RenderBackgroundScreenIds
                screenIds={selectedBackgroundSrcList.map(([key]) => {
                    return Number.parseInt(key);
                })}
            />
            {isPlaying ? (
                <RenderBackgroundWebIframeComp
                    src={fileSource}
                    width={width}
                    height={height}
                />
            ) : (
                <BackgroundWebPlaceHolderComp
                    height={height}
                    imageData={imageData}
                />
            )}
            {extraChild}
        </div>
    );
}

function rendChild(
    filePath: string,
    selectedBackgroundSrcList: [string, BackgroundSrcType][],
    width: number,
    height: number,
    extraChild?: ReactElement,
) {
    return (
        <RenderChildComp
            filePath={filePath}
            selectedBackgroundSrcList={selectedBackgroundSrcList}
            width={width}
            height={height}
            extraChild={extraChild}
        />
    );
}

function basicRenderBody(
    urlSources: BackgroundWebUrlSource[],
    thumbnailWidth: number,
    handleUrlRemoving: (urlSource: BackgroundWebUrlSource) => Promise<void>,
    filePaths: string[],
) {
    const thumbnailHeight = Math.round((thumbnailWidth * 9) / 16);
    const sortedFilePaths = [...filePaths].sort((a, b) => {
        return a.localeCompare(b);
    });
    const sortedUrlSources = [...urlSources].sort((a, b) => {
        return a.fullName.localeCompare(b.fullName);
    });
    return (
        <div className="w-100">
            <div className="d-flex justify-content-center flex-wrap">
                {sortedFilePaths.map((filePath) => {
                    return (
                        <BackgroundMediaItemComp
                            key={filePath}
                            rendChild={rendChild}
                            genExtraItemContextMenuItems={
                                genBackgroundWebExtraItemContextMenuItems
                            }
                            dragType={DragTypeEnum.BACKGROUND_WEB}
                            onClick={undefined}
                            noDraggable={false}
                            isNameOnTop={false}
                            thumbnailWidth={thumbnailWidth}
                            thumbnailHeight={thumbnailHeight}
                            filePath={filePath}
                        />
                    );
                })}
                {sortedUrlSources.map((urlSource) => {
                    return (
                        <BackgroundWebUrlItemComp
                            key={urlSource.id}
                            urlSource={urlSource}
                            thumbnailWidth={thumbnailWidth}
                            thumbnailHeight={thumbnailHeight}
                            onRemove={handleUrlRemoving}
                        />
                    );
                })}
                <FillingFlexCenterComp
                    width={thumbnailWidth}
                    className="web-thumbnail"
                />
            </div>
        </div>
    );
}

export default function BackgroundWebComp() {
    const [thumbnailWidth, setThumbnailWidth] = useThumbnailWidthSetting();
    const [urlItems, setUrlItems] = useState<BackgroundWebUrlItemData[]>(() => {
        return getBackgroundWebUrlItemList();
    });
    const urlSources = useMemo(() => {
        return createBackgroundWebUrlSourceList(urlItems);
    }, [urlItems]);
    const dirSource = useGenDirSourceReload(
        dirSourceSettingNames.BACKGROUND_WEB,
    );

    useScreenBackgroundManagerEvents(['update']);
    useAppEffect(() => {
        setBackgroundWebUrlItemList(urlItems);
    }, [urlItems]);

    const handleWheel = useCallback(
        (event: any) => {
            handleCtrlWheel({
                event,
                value: thumbnailWidth,
                setValue: setThumbnailWidth,
                defaultSize: defaultRangeSize,
            });
        },
        [thumbnailWidth, setThumbnailWidth],
    );
    const handleUrlAdding = useCallback(async () => {
        const urlSource = await promptBackgroundWebUrlSource(
            urlItems.map((item) => item.src),
        );
        if (urlSource === null) {
            return;
        }
        setUrlItems((itemList) => {
            return [...itemList, urlSource.toData()];
        });
    }, [urlItems]);
    const handleUrlRemoving = useCallback(
        async (urlSource: BackgroundWebUrlSource) => {
            const isOk = await showAppConfirm(
                tran('Remove URL'),
                `Remove "${urlSource.fullName}"?`,
                {
                    confirmButtonLabel: 'Yes',
                },
            );
            if (!isOk) {
                return;
            }
            setUrlItems((itemList) => {
                return itemList.filter((item) => {
                    return item.id !== urlSource.id;
                });
            });
        },
        [],
    );
    const getAddUrlContextMenuItem = useCallback((): ContextMenuItemType => {
        return {
            menuElement: tran('Add URL'),
            onSelect: () => {
                void handleUrlAdding();
            },
        };
    }, [handleUrlAdding]);
    const handleItemsAdding = useCallback(
        (defaultContextMenuItems: ContextMenuItemType[], event: any) => {
            showAppContextMenu(event, [
                ...defaultContextMenuItems,
                getAddUrlContextMenuItem(),
            ]);
        },
        [getAddUrlContextMenuItem],
    );
    const handleContextMenuItemsGenerating = useCallback(
        async (dirSource: DirSource) => {
            const contextMenuItems =
                genBackgroundWebContextMenuItems(dirSource);
            return [...contextMenuItems, getAddUrlContextMenuItem()];
        },
        [getAddUrlContextMenuItem],
    );
    if (dirSource === null) {
        return null;
    }
    const renderBody = basicRenderBody.bind(
        null,
        urlSources,
        thumbnailWidth,
        handleUrlRemoving,
    );
    return (
        <div
            className="card w-100 h-100 app-zero-border-radius"
            onWheel={handleWheel}
        >
            <div className="card-body">
                <FileListHandlerComp
                    className="app-background-web"
                    mimetypeName="web"
                    defaultFolderName={defaultDataDirNames.BACKGROUND_WEB}
                    dirSource={dirSource}
                    bodyHandler={renderBody}
                    genContextMenuItems={handleContextMenuItemsGenerating}
                    fileSelectionOption={{
                        windowTitle: 'Select web files',
                        dirPath: dirSource.dirPath,
                        extensions: getMimetypeExtensions('web'),
                    }}
                    onItemsAdding={handleItemsAdding}
                />
            </div>
            <BackgroundFooterComp
                thumbnailWidth={thumbnailWidth}
                setThumbnailWidth={setThumbnailWidth}
            />
        </div>
    );
}
