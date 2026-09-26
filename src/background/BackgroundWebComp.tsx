import './BackgroundWebComp.scss';

import type { ReactNode } from 'react';
import { useCallback, useRef } from 'react';
import { useState } from 'react';

import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import { useGenDirSourceReload } from '../helper/dirSourceHelpers';
import type DirSource from '../helper/DirSource';
import BackgroundFooterComp, { defaultRangeSize } from './BackgroundFooterComp';
import { tran } from '../lang/langHelpers';
import { useZoomingRegistering } from '../others/AppRangeComp';
import { useThumbnailWidthSetting } from './BackgroundMediaComp';
import BackgroundAutoPlayComp from './BackgroundAutoPlayComp';
import { genBackgroundLayerMarker } from './backgroundHelpers';
import {
    type BackgroundWebUrlItemData,
    type BackgroundWebUrlSource,
    createBackgroundWebUrlSourceList,
    getBackgroundWebUrlItemList,
    promptBackgroundWebUrlSource,
    setBackgroundWebUrlItemList,
} from './backgroundWebUrlHelpers';
import { genBackgroundWebContextMenuItems } from './backgroundWebHelpers';
import { useScreenBackgroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import FileListHandlerComp from '../others/FileListHandlerComp';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import { getMimetypeExtensions } from '../server/fileHelpers';
import { basicRenderBody } from './BackgroundWebChildComp';
import { useBackgroundViewModeSetting } from './BackgroundViewModeComp';
import { useBackgroundSessions } from './backgroundSessionHelpers';

/**
 * The tab's own card rather than `BackgroundMediaComp`'s: half its tiles are
 * saved URLs rather than files. Those URLs are deliberately NOT part of a
 * folder session -- a link lives in no folder, so it is shown in every one.
 */
function RenderWebListComp({
    dirSourceSettingName,
    autoPlayPrefix,
    topBarChild,
}: Readonly<{
    dirSourceSettingName: string;
    autoPlayPrefix?: string;
    topBarChild: ReactNode;
}>) {
    const [thumbnailWidth, setThumbnailWidth] = useThumbnailWidthSetting();
    const [viewMode, setViewMode] =
        useBackgroundViewModeSetting(dirSourceSettingName);
    const [urlItems, setUrlItems] = useState<BackgroundWebUrlItemData[]>(() => {
        return getBackgroundWebUrlItemList();
    });
    const urlSources = createBackgroundWebUrlSourceList(urlItems);
    const dirSource = useGenDirSourceReload(dirSourceSettingName);

    useScreenBackgroundManagerEvents(['update']);
    useAppEffect(() => {
        setBackgroundWebUrlItemList(urlItems);
    }, [urlItems]);

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
                    cancelButtonLabel: 'No',
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
    const handleUrlColorNoteChange = useCallback(() => {
        setUrlItems((itemList) => {
            return [...itemList];
        });
    }, []);
    const getAddUrlContextMenuItem = useCallback((): ContextMenuItemType => {
        return {
            childBefore: genContextMenuItemIcon('link-45deg'),
            menuElement: tran('Add URL'),
            onSelect: () => {
                void handleUrlAdding();
            },
        };
    }, [handleUrlAdding]);
    const genWebContextMenuItems = useCallback(
        (dirSource: DirSource) => {
            return genBackgroundWebContextMenuItems(dirSource, [
                getAddUrlContextMenuItem(),
            ]);
        },
        [getAddUrlContextMenuItem],
    );
    const genWebContextMenuItemsRef = useAppCurrentRef(genWebContextMenuItems);
    const handleContextMenuItemsGenerating = useCallback(
        async (dirSource: DirSource) => {
            return genWebContextMenuItemsRef.current(dirSource);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    // What this layer is showing: it marks the tiles, and empty means there is
    // no show to control, so no strip -- an empty one would be a band across
    // the top of the grid paying for a control that is not there.
    const layerMarker = genBackgroundLayerMarker('web');
    const hasAutoPlay = layerMarker !== '';

    const renderBody = basicRenderBody.bind(
        null,
        urlSources,
        thumbnailWidth,
        handleUrlRemoving,
        handleUrlColorNoteChange,
        viewMode,
        layerMarker,
    );

    const containerRef = useRef<HTMLDivElement | null>(null);
    useZoomingRegistering(containerRef, {
        value: thumbnailWidth,
        setValue: setThumbnailWidth,
        defaultSize: defaultRangeSize,
    });

    return (
        <div
            className={
                'card w-100 h-100 app-zero-border-radius' +
                ' background-has-media-bar'
            }
            ref={containerRef}
        >
            <div className="background-media-bar d-flex align-items-center px-1">
                {topBarChild}
                {/* The same slide show the Images and Videos tabs carry. This
                    tab walks its own order, because half its tiles are saved
                    URLs rather than files -- see
                    `genBackgroundWebDisplayedSrcList`. */}
                {hasAutoPlay && autoPlayPrefix !== undefined ? (
                    <BackgroundAutoPlayComp
                        prefix={autoPlayPrefix}
                        backgroundType="web"
                        dirSourceSettingName={dirSourceSettingName}
                    />
                ) : null}
            </div>
            <div className="card-body">
                {dirSource === null ? null : (
                    <FileListHandlerComp
                        className="app-background-web"
                        mimetypeName="web"
                        defaultFolderName={defaultDataDirNames.BACKGROUND_WEB}
                        dirSource={dirSource}
                        bodyHandler={renderBody}
                        disableColorNoteGrouping
                        genContextMenuItems={handleContextMenuItemsGenerating}
                        fileSelectionOption={{
                            windowTitle: 'Select web files',
                            dirPath: dirSource.dirPath,
                            extensions: getMimetypeExtensions('web'),
                        }}
                    />
                )}
            </div>
            <BackgroundFooterComp
                thumbnailWidth={thumbnailWidth}
                setThumbnailWidth={setThumbnailWidth}
                viewMode={viewMode}
                setViewMode={setViewMode}
            />
        </div>
    );
}

export default function BackgroundWebComp() {
    const session = useBackgroundSessions({
        target: 'background-web',
        dirSourceSettingName: dirSourceSettingNames.BACKGROUND_WEB,
        autoPlayPrefix: 'background-web',
    });
    return (
        <RenderWebListComp
            // Keyed by session so switching re-reads that session's own
            // folder instead of keeping the last one's list on screen.
            key={session.activeId}
            topBarChild={session.element}
            dirSourceSettingName={session.dirSourceSettingName}
            autoPlayPrefix={session.autoPlayPrefix}
        />
    );
}
