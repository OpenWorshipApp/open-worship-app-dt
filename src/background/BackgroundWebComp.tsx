import './BackgroundWebComp.scss';

import { useCallback, useRef } from 'react';
import { useState } from 'react';

import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
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

export default function BackgroundWebComp() {
    const [thumbnailWidth, setThumbnailWidth] = useThumbnailWidthSetting();
    const [urlItems, setUrlItems] = useState<BackgroundWebUrlItemData[]>(() => {
        return getBackgroundWebUrlItemList();
    });
    const urlSources = createBackgroundWebUrlSourceList(urlItems);
    const dirSource = useGenDirSourceReload(
        dirSourceSettingNames.BACKGROUND_WEB,
    );

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
    const dirSourceRef = useAppCurrentRef(dirSource);
    const genWebContextMenuItemsRef = useAppCurrentRef(genWebContextMenuItems);
    const handleItemsAdding = useCallback(
        (defaultContextMenuItems: ContextMenuItemType[], event: any) => {
            if (dirSourceRef.current === null) {
                return;
            }
            showAppContextMenu(event, [
                ...defaultContextMenuItems,
                ...genWebContextMenuItemsRef.current(dirSourceRef.current),
            ]);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleContextMenuItemsGenerating = useCallback(
        async (dirSource: DirSource) => {
            return genWebContextMenuItemsRef.current(dirSource);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const renderBody = basicRenderBody.bind(
        null,
        urlSources,
        thumbnailWidth,
        handleUrlRemoving,
        handleUrlColorNoteChange,
    );

    const containerRef = useRef<HTMLDivElement | null>(null);
    useZoomingRegistering(containerRef, {
        value: thumbnailWidth,
        setValue: setThumbnailWidth,
        defaultSize: defaultRangeSize,
    });

    return (
        <div
            className="card w-100 h-100 app-zero-border-radius"
            ref={containerRef}
        >
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
                        onItemsAdding={handleItemsAdding}
                    />
                )}
            </div>
            <BackgroundFooterComp
                thumbnailWidth={thumbnailWidth}
                setThumbnailWidth={setThumbnailWidth}
            />
        </div>
    );
}
