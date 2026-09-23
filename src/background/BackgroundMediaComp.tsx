import { useRef } from 'react';
import type { ReactNode, MouseEvent } from 'react';

import FileListHandlerComp from '../others/FileListHandlerComp';
import { useScreenBackgroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import type FileSource from '../helper/FileSource';
import type { DragTypeEnum } from '../helper/DragInf';
import { useGenDirSourceReload } from '../helper/dirSourceHelpers';
import {
    getMimetypeExtensions,
    type MimetypeNameType,
} from '../server/fileHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import type { OptionalPromise } from '../helper/typeHelpers';
import type DirSource from '../helper/DirSource';
import { useStateSettingNumber } from '../helper/settingHelpers';
import { useZoomingRegistering } from '../others/AppRangeComp';
import BackgroundMediaItemComp from './BackgroundMediaItemComp';
import type { RenderChildType } from './backgroundHelpers';
import { backgroundTypeMapper } from './backgroundHelpers';
import BackgroundFooterComp, { defaultRangeSize } from './BackgroundFooterComp';
import type { BackgroundViewModeType } from './BackgroundViewModeComp';
import { useBackgroundViewModeSetting } from './BackgroundViewModeComp';
import VirtualGridComp from '../virtual-list/VirtualGridComp';

// `.image-thumbnail`/`.video-thumbnail` carry `margin: 2px`, so a tile takes
// its own width plus 4. The two height figures are only a FIRST GUESS -- the
// grid measures a real row and corrects itself, which is what keeps the name
// footer's line box right in Khmer and French.
const THUMBNAIL_MARGIN = 4;
const THUMBNAIL_EXTRA_HEIGHT = 44;
const LIST_VIEW_ROW_HEIGHT = 30;

// Module level so the memoised tile sees the same function every render.
function genNoExtraItemContextMenuItems(_filePath: string) {
    return [];
}

export function useThumbnailWidthSetting() {
    const [thumbnailWidth, setThumbnailWidth] = useStateSettingNumber(
        'bg-thumbnail-width',
        defaultRangeSize.size,
    );
    return [thumbnailWidth, setThumbnailWidth] as const;
}

type PropsType = {
    shouldHideFooter?: boolean;
    extraHeaderChild?: ReactNode;
    rendChild: RenderChildType;
    extraBodyChild?: ReactNode;
    dragType: DragTypeEnum;
    extraMimetypeNames?: MimetypeNameType[];
    onClick?: (event: any, fileSource: FileSource) => void;
    defaultFolderName?: string;
    dirSourceSettingName: string;
    noDraggable?: boolean;
    isNameOnTop?: boolean;
    contextMenuItems?: ContextMenuItemType[];
    genContextMenuItems?: (
        dirSource: DirSource,
        event?: MouseEvent<HTMLElement>,
    ) => OptionalPromise<ContextMenuItemType[]>;
    sortFilePaths?: (filePaths: string[]) => string[];
    genExtraItemContextMenuItems?: (filePath: string) => ContextMenuItemType[];
    /**
     * Off for a list whose tiles are not all one height or must stay mounted:
     * the Audios tab grows a row into an `<audio controls>` when it is
     * activated, and unmounting it while it plays would stop the sound.
     */
    isVirtualizationEnabled?: boolean;
};

const handleBodyRendering = (
    props: PropsType,
    thumbnailWidth: number,
    viewMode: BackgroundViewModeType,
    filePaths: string[],
) => {
    const {
        extraHeaderChild,
        rendChild,
        dragType,
        onClick,
        noDraggable = false,
        isNameOnTop = false,
        sortFilePaths = (filePaths) => {
            return filePaths.sort((a, b) => a.localeCompare(b));
        },
        genExtraItemContextMenuItems = genNoExtraItemContextMenuItems,
    } = props;
    const isListView = viewMode === 'list';
    const thumbnailHeight = Math.round((thumbnailWidth * 9) / 16);
    const newFilePaths = sortFilePaths(filePaths);
    const renderItem = (filePath: string) => {
        return (
            <BackgroundMediaItemComp
                key={filePath}
                rendChild={rendChild}
                genExtraItemContextMenuItems={genExtraItemContextMenuItems}
                dragType={dragType}
                onClick={onClick}
                noDraggable={noDraggable}
                isNameOnTop={isNameOnTop}
                thumbnailWidth={thumbnailWidth}
                thumbnailHeight={thumbnailHeight}
                filePath={filePath}
                viewMode={viewMode}
            />
        );
    };
    return (
        <div className="w-100">
            {extraHeaderChild ? <>{extraHeaderChild}</> : null}
            {/* Only the rows on screen are mounted: a folder of a thousand
                backgrounds costs what a screenful costs, and -- the part that
                is not just tidiness -- a video tile that is never mounted
                never spawns a media player. */}
            <VirtualGridComp
                isEnabled={props.isVirtualizationEnabled ?? true}
                items={newFilePaths}
                renderItem={renderItem}
                itemWidth={thumbnailWidth + THUMBNAIL_MARGIN}
                columnCount={isListView ? 1 : undefined}
                estimateRowHeight={
                    isListView
                        ? LIST_VIEW_ROW_HEIGHT
                        : thumbnailHeight + THUMBNAIL_EXTRA_HEIGHT
                }
                overscan={3}
                rowClassName="d-flex"
            />
        </div>
    );
};

export default function BackgroundMediaComp(props: Readonly<PropsType>) {
    const [thumbnailWidth, setThumbnailWidth] = useThumbnailWidthSetting();
    const [viewMode, setViewMode] = useBackgroundViewModeSetting(
        props.dirSourceSettingName,
    );
    const backgroundType = backgroundTypeMapper[props.dragType];
    const dirSource = useGenDirSourceReload(props.dirSourceSettingName);

    useScreenBackgroundManagerEvents(['update']);

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
                        className={`app-background-${backgroundType}`}
                        mimetypeName={backgroundType}
                        extraMimetypeNames={props.extraMimetypeNames}
                        defaultFolderName={props.defaultFolderName}
                        dirSource={dirSource}
                        bodyHandler={handleBodyRendering.bind(
                            null,
                            props,
                            thumbnailWidth,
                            viewMode,
                        )}
                        contextMenuItems={props.contextMenuItems}
                        genContextMenuItems={props.genContextMenuItems}
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
                    />
                )}
                {props.extraBodyChild ? <>{props.extraBodyChild}</> : null}
            </div>
            {props.shouldHideFooter ? null : (
                <BackgroundFooterComp
                    thumbnailWidth={thumbnailWidth}
                    setThumbnailWidth={setThumbnailWidth}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                />
            )}
        </div>
    );
}
