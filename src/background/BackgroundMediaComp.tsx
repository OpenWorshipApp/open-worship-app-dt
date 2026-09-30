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
import type {
    GenMediaItemDataType,
    RenderChildType,
} from './backgroundHelpers';
import {
    backgroundTypeMapper,
    genBackgroundLayerMarker,
} from './backgroundHelpers';
import BackgroundFooterComp, { defaultRangeSize } from './BackgroundFooterComp';
import type { BackgroundViewModeType } from './BackgroundViewModeComp';
import { useBackgroundViewModeSetting } from './BackgroundViewModeComp';
import VirtualGridComp from '../virtual-list/VirtualGridComp';
import BackgroundAutoPlayComp from './BackgroundAutoPlayComp';

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

/**
 * The order a media grid draws its files in, unless the list carries one of
 * its own or the operator has picked a sort.
 *
 * Exported because the foreground slide shows have to advance through the
 * files in the order the operator is LOOKING at them -- see
 * `toDisplayedFilePaths`. Copied before sorting: the array handed in is React
 * state (and, in a colour-grouped list, a memoised group), and
 * `Array.prototype.sort` reorders in place.
 */
export function sortMediaFilePaths(filePaths: string[]) {
    return [...filePaths].sort((filePath1, filePath2) => {
        return filePath1.localeCompare(filePath2);
    });
}

export function useThumbnailWidthSetting() {
    const [thumbnailWidth, setThumbnailWidth] = useStateSettingNumber(
        'bg-thumbnail-width',
        defaultRangeSize.size,
    );
    return [thumbnailWidth, setThumbnailWidth] as const;
}

type PropsType = {
    /**
     * Run a slide show over this list, under this settings prefix. Only the
     * lists whose items can BE a background carry one -- there is nothing for
     * a show to advance through on Colors or Cameras.
     */
    autoPlayPrefix?: string;
    /**
     * A strip pinned above everything else in the card -- the folder-session
     * chips. Not `extraHeaderChild`, which the file list draws INSIDE its
     * body: an empty folder renders no body at all, and an empty session is
     * exactly when the way back to another one has to be on screen.
     */
    topBarChild?: ReactNode;
    shouldHideFooter?: boolean;
    extraHeaderChild?: ReactNode;
    rendChild: RenderChildType;
    extraBodyChild?: ReactNode;
    dragType: DragTypeEnum;
    extraMimetypeNames?: MimetypeNameType[];
    onClick?: (event: any, fileSource: FileSource) => void;
    defaultFolderName?: string;
    dirSourceSettingName: string;
    /** See `NoDirSelectedComp`: hides the Settings route on the empty state. */
    isDirSettingRouteHidden?: boolean;
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
    /**
     * One item per row whatever the panel's width. For a list whose rows are
     * CONTROLS rather than pictures: the Audios tab grows a row into a real
     * `<audio controls>`, and Chromium drops the scrubber, the clock and the
     * volume from one much under ~250px, leaving a stub with a play button.
     * Its tiles ask for `width: 100%` for that reason, but a row holds
     * `columnCount` of them and that count is worked out from the SHARED
     * thumbnail-size slider against the panel's width -- so dragging the
     * slider, or the split, silently turned the audio players into stubs.
     */
    isSingleColumn?: boolean;
    /**
     * Which LAYER the tiles belong to -- see `BackgroundMediaItemComp`. Left
     * out it is the background.
     */
    genItemData?: GenMediaItemDataType;
    /**
     * Re-read the layer on ITS own event instead of the background's, so a
     * foreground widget's tiles light up when a foreground item goes up.
     */
    useLayerEvents?: () => void;
    /**
     * What this grid's layer is showing, for the tiles' `memo`. The BACKGROUND
     * layer by default, which is what every Background tab wants; a foreground
     * panel reads its own.
     */
    genLayerMarker?: () => string;
};

const handleBodyRendering = (
    props: PropsType,
    thumbnailWidth: number,
    viewMode: BackgroundViewModeType,
    // Worked out ONCE by the card, not per tile: what changes it is a layer
    // event, and every mounted tile needs the same answer.
    layerMarker: string,
    filePaths: string[],
) => {
    const {
        extraHeaderChild,
        rendChild,
        dragType,
        onClick,
        noDraggable = false,
        isNameOnTop = false,
        sortFilePaths = sortMediaFilePaths,
        genExtraItemContextMenuItems = genNoExtraItemContextMenuItems,
    } = props;
    const isListView = viewMode === 'list';
    const isOneColumn = isListView || props.isSingleColumn === true;
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
                genItemData={props.genItemData}
                layerMarker={layerMarker}
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
                columnCount={isOneColumn ? 1 : undefined}
                estimateRowHeight={
                    isListView
                        ? LIST_VIEW_ROW_HEIGHT
                        : thumbnailHeight + THUMBNAIL_EXTRA_HEIGHT
                }
                // A forced single column is as wide as the PANEL, so the
                // row must not be capped at one thumbnail's width and
                // centred. Left as it was for list view, which is a column of
                // thumbnail-width rows on purpose.
                itemWidth={
                    props.isSingleColumn === true
                        ? 0
                        : thumbnailWidth + THUMBNAIL_MARGIN
                }
                overscan={3}
                rowClassName="d-flex"
            />
        </div>
    );
};

function useBackgroundEvents() {
    useScreenBackgroundManagerEvents(['update']);
}

export default function BackgroundMediaComp(props: Readonly<PropsType>) {
    const [thumbnailWidth, setThumbnailWidth] = useThumbnailWidthSetting();
    const [viewMode, setViewMode] = useBackgroundViewModeSetting(
        props.dirSourceSettingName,
    );
    const backgroundType = backgroundTypeMapper[props.dragType];
    const dirSource = useGenDirSourceReload(props.dirSourceSettingName);
    // What this layer is showing: empty means nothing of this kind is on a
    // screen. It marks the tiles AND decides whether there is a slide show to
    // offer at all.
    const layerMarker =
        props.genLayerMarker?.() ?? genBackgroundLayerMarker(backgroundType);
    const hasAutoPlay =
        props.autoPlayPrefix !== undefined && layerMarker !== '';
    // ONE strip, not one per control: the session chips and the slide show sit
    // side by side on it. Two stacked rows were tried and cost a whole row of
    // pictures in a panel that is often 200px tall.
    const hasMediaBar = props.topBarChild !== undefined || hasAutoPlay;

    // The tiles show which screens hold them, so the grid re-reads whenever
    // that layer changes. Only the rows on screen are mounted, so the cost is
    // a screenful whatever the folder holds.
    useBackgroundEvents();
    props.useLayerEvents?.();

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
                (hasMediaBar ? ' background-has-media-bar' : '')
            }
            ref={containerRef}
        >
            {/* At the TOP of the list, where the foreground panels keep their
                own: it is not in the auto-hiding footer (a countdown that has
                to be found with the mouse before it can be read is not a
                countdown), and opening the show's rules pushes the grid DOWN,
                which is the only direction with room to give. */}
            {/* The slide show is drawn only once this list has something on a
                screen: a show cannot start from nothing. Decided HERE rather
                than by the control rendering null inside a wrapper that
                stays: the wrapper kept the row whatever it held. */}
            {hasMediaBar ? (
                <div className="background-media-bar d-flex align-items-center px-1">
                    {props.topBarChild}
                    {hasAutoPlay && props.autoPlayPrefix !== undefined ? (
                        <BackgroundAutoPlayComp
                            prefix={props.autoPlayPrefix}
                            backgroundType={backgroundType}
                            dirSourceSettingName={props.dirSourceSettingName}
                        />
                    ) : null}
                </div>
            ) : null}
            <div className="card-body">
                {dirSource === null ? null : (
                    <FileListHandlerComp
                        className={`app-background-${backgroundType}`}
                        mimetypeName={backgroundType}
                        extraMimetypeNames={props.extraMimetypeNames}
                        defaultFolderName={props.defaultFolderName}
                        isDirSettingRouteHidden={props.isDirSettingRouteHidden}
                        dirSource={dirSource}
                        bodyHandler={handleBodyRendering.bind(
                            null,
                            props,
                            thumbnailWidth,
                            viewMode,
                            layerMarker,
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
