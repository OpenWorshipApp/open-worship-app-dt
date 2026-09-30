import './foregroundWidgets.scss';

import type { CSSProperties, ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { useScreenForegroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import type {
    BackgroundSrcType,
    ForegroundDataType,
    ForegroundImageDataType,
    ForegroundVideoDataType,
    ForegroundWebDataType,
} from '../_screen/screenTypeHelpers';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import { DragTypeEnum } from '../helper/DragInf';
import type { MimetypeNameType } from '../server/fileHelpers';
import FileSource from '../helper/FileSource';
import { HIGHLIGHT_SELECTED_CLASSNAME } from '../helper/helpers';
import { dragStore, handleDragStart } from '../helper/dragHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { FilePathLoadedContext } from '../helper/dirSourceHelpers';
import BackgroundMediaComp, {
    sortMediaFilePaths,
} from '../background/BackgroundMediaComp';
import type { MediaItemDataType } from '../background/backgroundHelpers';
import { backgroundTypeMapper } from '../background/backgroundHelpers';
import RenderBackgroundScreenIdsComp from '../background/RenderBackgroundScreenIdsComp';
import VideoTilePreviewComp, {
    HOVER_PLAY_DELAY,
} from '../background/VideoTilePreviewComp';
import { RenderWebChildComp } from '../background/BackgroundWebChildComp';
import SlideAutoPlayComp, {
    type NextDataType,
} from '../slide-auto-play/SlideAutoPlayComp';
import { toDisplayedFilePaths } from '../others/fileListFilterHelpers';
import type { SlideAutoPlayOptionsType } from '../slide-auto-play/slideAutoPlayHelpers';
import {
    checkIsSlideAutoPlaying,
    genNextDelaySeconds,
    notifySlideAutoPlayStateChanged,
    readSlideAutoPlayOptions,
    setIsSlideAutoPlaying,
    toNextIndex,
} from '../slide-auto-play/slideAutoPlayHelpers';
import { getVideoDurationSeconds } from '../helper/videoDurationHelpers';
import ForegroundSoundControlComp, {
    getForegroundSoundData,
} from './ForegroundSoundControlComp';
import {
    FOREGROUND_AUTO_PLAY_KEY_PREFIX,
    toForegroundAutoPlayPrefix,
} from './foregroundAutoPlayPrefix';
import {
    getForegroundShowingScreenIdDataList,
    getScreenForegroundManagerByDropped,
    getScreenForegroundManagerInstances,
} from './foregroundHelpers';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import { useForegroundPropsSetting } from './propertiesSettingHelpers';
import ScreensRendererComp from './ScreensRendererComp';
import { genForegroundDragInf } from './foregroundDragHelpers';
import MediaSessionsComp, {
    readSessions,
    toSessionSuffix,
    useMediaSessionAutoPlayRefresh,
    useMediaSessions,
} from '../media-sessions/MediaSessionsComp';
import { genForegroundPropsSettingNames } from './foregroundSessionHelpers';
import {
    applyAutoPlayRunners,
    getRunningAutoPlayKeys,
} from '../slide-auto-play/autoPlayRunnerHelpers';
import DirSource from '../helper/DirSource';

import { useAppEffect } from '../helper/appHooks';
import {
    genForegroundExtraStyle,
    getForegroundTransition,
    getForegroundWidthScale,
} from './propertiesSettingHelpers';

/**
 * Video Show and Image Show put a FILE on the foreground layer, above the
 * background and the slide.
 *
 * They are built on the SAME windowed grid as the Background tabs
 * (`BackgroundMediaComp`), aimed at `#foreground` through its `genItemData`
 * seam: only the rows on screen are mounted, a video tile draws a cached
 * poster frame until the mouse is on it, and the widget keeps ONE Properties
 * panel rather than one per file. A folder of a thousand overlays costs what a
 * screenful costs -- which is the whole point on the machines this app runs on.
 *
 * A click shows that file and a second click takes it off, the way a
 * background tile toggles. Several overlays at once come from several
 * **sessions**: each session is its own folder, its own Properties and its own
 * slide show, and each owns exactly one item on the screen -- so a snow
 * overlay and a logo are two sessions of Image Show, not two clicks.
 *
 * The two kinds are the same widget with a different tile and a different list
 * on the manager, so the lifecycle is written once and the differences live in
 * `FOREGROUND_MEDIA_CONFIG_MAP`.
 */
export const foregroundMediaKindList = ['video', 'image', 'web'] as const;
export type ForegroundMediaKindType = (typeof foregroundMediaKindList)[number];

type ForegroundMediaDataType = (
    ForegroundVideoDataType | ForegroundImageDataType | ForegroundWebDataType
) & { [key: string]: any };

type ForegroundMediaConfigType = {
    kind: ForegroundMediaKindType;
    titleKey: string;
    hideLabelKey: string;
    dirSourceSettingName: string;
    defaultFolderName: string;
    dragType: DragTypeEnum;
    mimetypeName: MimetypeNameType;
    /**
     * Anything the kind needs on its datum beyond the file and the session --
     * a web overlay is sized in SCREEN fractions rather than by the element's
     * own CSS width, so it carries its scales.
     */
    genExtraData?: (getWidthScale: () => number) => object;
    pickDataList: (
        foregroundData: ForegroundDataType,
    ) => ForegroundMediaDataType[];
    /**
     * Put this one up for ONE session: the entry that session already had is
     * replaced, every other session's is left alone.
     */
    present: (
        manager: ScreenForegroundManager,
        data: ForegroundMediaDataType,
    ) => void;
    setList: (
        manager: ScreenForegroundManager,
        dataList: ForegroundMediaDataType[],
    ) => void;
    add: (
        manager: ScreenForegroundManager,
        data: ForegroundMediaDataType,
    ) => void;
    remove: (
        manager: ScreenForegroundManager,
        data: ForegroundMediaDataType,
    ) => void;
};

function toPresentedList(
    currentList: ForegroundMediaDataType[],
    data: ForegroundMediaDataType,
) {
    // One item per session: the session's previous file steps aside, the other
    // sessions' stay exactly where they are.
    const withoutOwn = currentList.filter((item) => {
        return (item.id ?? '') !== (data.id ?? '');
    });
    return [...withoutOwn, data];
}

function RenderVideoTileComp({
    filePath,
    height,
    selectedBackgroundSrcList,
    extraChild,
}: Readonly<{
    filePath: string;
    height: number;
    selectedBackgroundSrcList: [string, BackgroundSrcType][];
    extraChild?: ReactElement;
}>) {
    const fileSource = FileSource.getInstance(filePath);
    const [isHovering, setIsHovering] = useState(false);
    // Per tile, so a mouse dragged ACROSS the grid starts no player on the
    // cards it merely passes over; a leave cancels only its own pending enter.
    const attemptHover = useMemo(() => {
        return genTimeoutAttempt(HOVER_PLAY_DELAY);
    }, []);
    const handleMouseEnter = useCallback(() => {
        attemptHover(() => {
            setIsHovering(true);
        });
    }, [attemptHover]);
    const handleMouseLeave = useCallback(() => {
        attemptHover(() => {
            setIsHovering(false);
        }, true);
    }, [attemptHover]);
    return (
        <div
            className="card-body app-overflow-hidden app-blank-bg"
            style={{
                height: `${height}px`,
                overflow: 'hidden',
                borderRadius: '5px 5px 0px 0px',
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <RenderBackgroundScreenIdsComp
                screenIds={selectedBackgroundSrcList.map(([key]) => {
                    return Number.parseInt(key);
                })}
            />
            <VideoTilePreviewComp
                src={fileSource.src}
                isHovering={isHovering}
            />
            {extraChild}
        </div>
    );
}

function renderVideoTile(
    filePath: string,
    selectedBackgroundSrcList: [string, BackgroundSrcType][],
    _width: number,
    height: number,
    extraChild?: ReactElement,
) {
    return (
        <RenderVideoTileComp
            filePath={filePath}
            height={height}
            selectedBackgroundSrcList={selectedBackgroundSrcList}
            extraChild={extraChild}
        />
    );
}

function renderImageTile(
    filePath: string,
    selectedBackgroundSrcList: [string, BackgroundSrcType][],
    _width: number,
    height: number,
    extraChild?: ReactElement,
) {
    const fileSource = FileSource.getInstance(filePath);
    return (
        <div
            className="card-body app-blank-bg"
            style={{
                height: `${height}px`,
                overflow: 'hidden',
                borderRadius: '5px 5px 0px 0px',
            }}
        >
            <RenderBackgroundScreenIdsComp
                screenIds={selectedBackgroundSrcList.map(([key]) => {
                    return Number.parseInt(key);
                })}
            />
            <img
                // The grid's overscan rows are mounted but off screen; these
                // keep their pictures from being fetched and decoded until
                // they scroll in.
                loading="lazy"
                decoding="async"
                src={fileSource.src}
                className="w-100 h-100 card-img-top"
                alt={fileSource.name}
                style={{
                    objectFit: 'cover',
                    objectPosition: 'center center',
                    pointerEvents: 'none',
                }}
            />
            {extraChild}
        </div>
    );
}

const FOREGROUND_MEDIA_CONFIG_MAP: Record<
    ForegroundMediaKindType,
    ForegroundMediaConfigType
> = {
    web: {
        kind: 'web',
        titleKey: 'Web Show',
        hideLabelKey: 'Hide Web',
        // The same folder the Background Webs tab lists: a page put up is the
        // same page whichever layer it lands on.
        dirSourceSettingName: dirSourceSettingNames.BACKGROUND_WEB,
        defaultFolderName: defaultDataDirNames.BACKGROUND_WEB,
        dragType: DragTypeEnum.BACKGROUND_WEB,
        mimetypeName: 'web',
        // A web overlay is drawn at a fraction of the SCREEN and the page is
        // scaled into it, so the width the Properties panel sets travels on
        // the datum rather than as a CSS width.
        genExtraData: (getWidthScale) => {
            const widthScale = getWidthScale() / 100;
            return { widthScale, heightScale: (widthScale * 9) / 16 };
        },
        pickDataList: (foregroundData) => {
            return foregroundData.webDataList;
        },
        present: (manager, data) => {
            manager.setWebDataList(
                toPresentedList(
                    manager.foregroundData.webDataList,
                    data,
                ) as ForegroundWebDataType[],
            );
        },
        setList: (manager, dataList) => {
            manager.setWebDataList(dataList as ForegroundWebDataType[]);
        },
        add: (manager, data) => {
            manager.addWebData(data as ForegroundWebDataType);
        },
        remove: (manager, data) => {
            manager.removeWebData(data as ForegroundWebDataType);
        },
    },
    video: {
        kind: 'video',
        titleKey: 'Video Show',
        hideLabelKey: 'Hide Video',
        dirSourceSettingName: dirSourceSettingNames.FOREGROUND_VIDEO,
        defaultFolderName: defaultDataDirNames.FOREGROUND_VIDEO,
        dragType: DragTypeEnum.BACKGROUND_VIDEO,
        mimetypeName: 'video',
        pickDataList: (foregroundData) => {
            return foregroundData.videoDataList;
        },
        present: (manager, data) => {
            manager.setVideoDataList(
                toPresentedList(manager.foregroundData.videoDataList, data),
            );
        },
        setList: (manager, dataList) => {
            manager.setVideoDataList(dataList);
        },
        add: (manager, data) => {
            manager.addVideoData(data);
        },
        remove: (manager, data) => {
            manager.removeVideoData(data);
        },
    },
    image: {
        kind: 'image',
        titleKey: 'Image Show',
        hideLabelKey: 'Hide Image',
        dirSourceSettingName: dirSourceSettingNames.FOREGROUND_IMAGE,
        defaultFolderName: defaultDataDirNames.FOREGROUND_IMAGE,
        dragType: DragTypeEnum.BACKGROUND_IMAGE,
        mimetypeName: 'image',
        pickDataList: (foregroundData) => {
            return foregroundData.imageDataList;
        },
        present: (manager, data) => {
            manager.setImageDataList(
                toPresentedList(manager.foregroundData.imageDataList, data),
            );
        },
        setList: (manager, dataList) => {
            manager.setImageDataList(dataList);
        },
        add: (manager, data) => {
            manager.addImageData(data);
        },
        remove: (manager, data) => {
            manager.removeImageData(data);
        },
    },
};

function renderWebTile(
    filePath: string,
    selectedBackgroundSrcList: [string, BackgroundSrcType][],
    width: number,
    height: number,
    extraChild?: ReactElement,
) {
    return (
        <RenderWebChildComp
            fileOrUrlSource={FileSource.getInstance(filePath)}
            selectedBackgroundSrcList={selectedBackgroundSrcList}
            width={width}
            height={height}
            extraChild={extraChild}
        />
    );
}

const RENDER_TILE_MAP = {
    video: renderVideoTile,
    image: renderImageTile,
    web: renderWebTile,
};

function getAllShowingScreenIdDataList(config: ForegroundMediaConfigType) {
    return getForegroundShowingScreenIdDataList((foregroundData) => {
        return config.pickDataList(foregroundData).length > 0;
    }).reduce(
        (acc, [screenId, foregroundData]) => {
            return acc.concat(
                config.pickDataList(foregroundData).map((data) => {
                    return [screenId, data];
                }),
            );
        },
        [] as [number, ForegroundMediaDataType][],
    );
}

function handleMediaHiding(
    config: ForegroundMediaConfigType,
    screenId: number,
    data: ForegroundMediaDataType,
) {
    getScreenForegroundManagerInstances(screenId, (screenForegroundManager) => {
        config.remove(screenForegroundManager, data);
    });
}

function refreshAllMedia(
    config: ForegroundMediaConfigType,
    showingScreenIdDataList: [number, ForegroundMediaDataType][],
    extraStyle: CSSProperties,
) {
    for (const [screenId, data] of showingScreenIdDataList) {
        getScreenForegroundManagerInstances(
            screenId,
            (screenForegroundManager) => {
                config.present(screenForegroundManager, {
                    ...data,
                    extraStyle,
                });
            },
        );
    }
}

/**
 * Every setting one session of this widget owns, so removing it leaves nothing
 * behind. The FIRST session writes the widget's own un-suffixed keys, which is
 * why it can never be removed.
 */
function genSessionSettingNames(
    config: ForegroundMediaConfigType,
    sessionId: string,
) {
    const suffix = toSessionSuffix(sessionId);
    return [
        // Shared with the text and timer widgets: a Properties key listed
        // in one place and not the other is a file left in the data folder
        // for a session that is gone, which is how the decoration key was
        // being missed here.
        ...genForegroundPropsSettingNames(`${config.kind}-show${suffix}`),
        `${config.dirSourceSettingName}${suffix}`,
    ];
}

function genMediaTitle(data: ForegroundMediaDataType) {
    return FileSource.getInstance(data.filePath).fullName;
}

function presentOnScreens(
    config: ForegroundMediaConfigType,
    data: ForegroundMediaDataType,
    event: any,
    isForceChoosing: boolean,
) {
    ScreenForegroundManager.setData(
        event,
        (screenForegroundManager) => {
            config.present(screenForegroundManager, data);
        },
        isForceChoosing,
    );
}

/**
 * One datum for the foreground layer: the file, which session owns it, the
 * style the Properties panel is on, and whatever else the kind needs.
 */
function genMediaData(
    config: ForegroundMediaConfigType,
    sessionId: string,
    genStyle: () => CSSProperties,
    getWidthScale: () => number,
    filePath: string,
): ForegroundMediaDataType {
    return {
        filePath,
        id: sessionId,
        extraStyle: genStyle(),
        // Read here rather than threaded down from the panel: this runs when
        // an item is PRESENTED, never while the grid draws, so it is one
        // cached setting read per press instead of one per tile -- and it is
        // the current answer even when the panel is not mounted, which is how
        // a slide show running behind a closed panel gets it too.
        transitionEffect: getForegroundTransition(
            toSessionPrefix(config.kind, sessionId),
        ),
        ...(config.kind === 'video'
            ? getForegroundSoundData(toSessionPrefix(config.kind, sessionId))
            : {}),
        ...(config.genExtraData?.(getWidthScale) ?? {}),
    };
}

/** What ONE session of this widget has up, across every screen. */
function getSessionShowingList(
    config: ForegroundMediaConfigType,
    sessionId: string,
) {
    return getAllShowingScreenIdDataList(config).filter(([, data]) => {
        return (data.id ?? '') === sessionId;
    });
}

/**
 * The FOREGROUND answer to the windowed grid's "which layer am I on" question
 * -- the same shape `genBackgroundMediaItemDataByFilePath` gives, read off
 * `ScreenForegroundManager` instead.
 */
/**
 * The foreground twin of `genBackgroundLayerMarker`: what THIS session has on
 * screens. Its tiles happened to redraw anyway, because `genItemData` is bound
 * afresh on every render and that alone defeats their `memo` -- an accident,
 * not a decision, and one a later clean-up would quietly take away.
 */
function genForegroundLayerMarker(
    config: ForegroundMediaConfigType,
    sessionId: string,
) {
    return getSessionShowingList(config, sessionId)
        .map(([screenId, data]) => {
            return `${screenId}:${data.filePath}`;
        })
        .join('|');
}

function genForegroundItemData(
    config: ForegroundMediaConfigType,
    sessionId: string,
    genStyle: () => CSSProperties,
    getWidthScale: () => number,
    filePath: string,
    dragType: DragTypeEnum,
): MediaItemDataType {
    const backgroundType = backgroundTypeMapper[dragType];
    const fileSource = FileSource.getInstance(filePath);
    const showingList = getSessionShowingList(config, sessionId).filter(
        ([, data]) => {
            return data.filePath === filePath;
        },
    );
    const screenIds = showingList.map(([screenId]) => {
        return screenId;
    });
    const isInScreen = screenIds.length > 0;
    const genData = () => {
        return genMediaData(
            config,
            sessionId,
            genStyle,
            getWidthScale,
            filePath,
        );
    };
    return {
        backgroundType,
        isInScreen,
        selectedCN: isInScreen
            ? `${HIGHLIGHT_SELECTED_CLASSNAME} animation`
            : '',
        title:
            fileSource.fullName +
            (isInScreen ? ` \nShow in presents:${screenIds.join(',')}` : ''),
        selectedBackgroundSrcList: screenIds.map((screenId) => {
            return [
                `${screenId}`,
                { type: backgroundType, src: fileSource.src },
            ];
        }) as [string, BackgroundSrcType][],
        handleSelecting: (event: any, isForceChoosing = false) => {
            // A second click on the one already up takes it off, the same
            // toggle a background tile has.
            if (isInScreen && !isForceChoosing) {
                for (const [screenId, data] of showingList) {
                    handleMediaHiding(config, screenId, data);
                }
                return;
            }
            presentOnScreens(config, genData(), event, isForceChoosing);
        },
        handleDragStart: (event: any) => {
            dragStore.onDropped = (droppedEvent: any) => {
                const screenForegroundManager =
                    getScreenForegroundManagerByDropped(droppedEvent);
                if (screenForegroundManager === null) {
                    return;
                }
                config.add(screenForegroundManager, genData());
            };
            handleDragStart(event, genForegroundDragInf(config.kind, genData));
        },
    };
}

/**
 * Walks the session's folder on a timer, on the foreground layer: every screen holding one of these files moves to the next
 * one, staggered so several screens do not re-render in the same frame.
 *
 * "Next" is the next TILE IN THE GRID, not the next entry the filesystem
 * happens to hand back -- the two are not the same list, and walking the raw
 * one made the show jump over the file sitting right beside the one that was
 * up (`toDisplayedFilePaths`).
 */
function handleNextItemSelecting(
    config: ForegroundMediaConfigType,
    sessionId: string,
    genStyle: () => CSSProperties,
    getWidthScale: () => number,
    filePaths: string[],
    isNext: boolean,
    options: SlideAutoPlayOptionsType,
) {
    const orderedFilePaths = toDisplayedFilePaths(
        `${config.dirSourceSettingName}${toSessionSuffix(sessionId)}`,
        filePaths,
        sortMediaFilePaths,
    );
    if (orderedFilePaths.length === 0) {
        return [];
    }
    const foundList = getSessionShowingList(config, sessionId)
        .map(([screenId, data]) => {
            const index = orderedFilePaths.indexOf(data.filePath);
            if (index === -1) {
                return null;
            }
            const nextIndex = toNextIndex(index, orderedFilePaths.length, {
                isNext,
                step: options.step,
                repeatKind: options.repeatKind,
            });
            // `null` is "no repeat" having walked off the end. The screen
            // keeps what it is holding -- a show that ran out leaves the last
            // item up, it does not blank the projector.
            if (nextIndex === null) {
                return null;
            }
            return { screenId, filePath: orderedFilePaths[nextIndex] };
        })
        .filter((item) => {
            return item !== null;
        });
    for (let i = 0; i < foundList.length; i++) {
        const { screenId, filePath } = foundList[i];
        setTimeout(() => {
            getScreenForegroundManagerInstances(
                screenId,
                (screenForegroundManager) => {
                    config.present(
                        screenForegroundManager,
                        genMediaData(
                            config,
                            sessionId,
                            genStyle,
                            getWidthScale,
                            filePath,
                        ),
                    );
                },
            );
        }, i * 100);
    }
    return foundList.map(({ filePath }) => {
        return filePath;
    });
}

/**
 * The settings namespace this widget's session list lives under. The session
 * module is shared with the Background tabs, so the kind alone is not enough:
 * `image` is both Image Show and the Background Images tab.
 */
function toSessionTarget(kind: ForegroundMediaKindType) {
    return `foreground-${kind}`;
}

function toSessionPrefix(kind: ForegroundMediaKindType, sessionId: string) {
    return `${kind}-show${toSessionSuffix(sessionId)}`;
}

function toAutoPlayPrefix(kind: ForegroundMediaKindType, sessionId: string) {
    return toForegroundAutoPlayPrefix(kind, toSessionSuffix(sessionId));
}

/**
 * One session's slide show, run with NOTHING rendered: the folder is read off
 * disk, the style off the settings. Answers false once the session has nothing
 * on screen, which is what stops a show after a Clear Foreground.
 */
async function tickSession(
    config: ForegroundMediaConfigType,
    sessionId: string,
) {
    if (getSessionShowingList(config, sessionId).length === 0) {
        return false;
    }
    const dirSource = await DirSource.getInstance(
        `${config.dirSourceSettingName}${toSessionSuffix(sessionId)}`,
    );
    const filePaths = await dirSource.getFilePaths(config.mimetypeName);
    if (filePaths === null || filePaths === undefined || !filePaths.length) {
        return false;
    }
    const prefix = toSessionPrefix(config.kind, sessionId);
    const movedFilePaths = handleNextItemSelecting(
        config,
        sessionId,
        () => {
            return genForegroundExtraStyle(prefix, {
                isFontSize: false,
                isGeometry: true,
                isCommonStyle: false,
                isBlendMode: true,
            });
        },
        () => {
            return getForegroundWidthScale(prefix);
        },
        filePaths,
        true,
        readSlideAutoPlayOptions(toAutoPlayPrefix(config.kind, sessionId)),
    );
    // Nothing moved, so there is nothing left to move to -- "no repeat" ran
    // off the end of the folder and the show is over.
    return movedFilePaths.length > 0;
}

/**
 * How long this session rests on what it is showing now.
 *
 * "Wait until the video ends" is the clip's OWN length rather than an `ended`
 * listener, because the element playing it lives in the screen's window --
 * one per screen, plus the mini preview -- and a two-screen show would have
 * two of them racing to advance. A clip whose length cannot be read (a file
 * still being written, a stick pulled out) falls back to the seconds box
 * rather than stalling the show for good.
 */
async function getSessionDelaySeconds(
    config: ForegroundMediaConfigType,
    sessionId: string,
    options: SlideAutoPlayOptionsType,
) {
    if (!(config.kind === 'video' && options.isUntilMediaEnd)) {
        return genNextDelaySeconds(options);
    }
    const showingList = getSessionShowingList(config, sessionId);
    const filePath = showingList[0]?.[1]?.filePath;
    if (filePath === undefined) {
        return genNextDelaySeconds(options);
    }
    const durationSeconds = await getVideoDurationSeconds(
        FileSource.getInstance(filePath).src,
    );
    if (durationSeconds === null) {
        return genNextDelaySeconds(options);
    }
    return durationSeconds;
}

/**
 * Starts or stops a timer for every session of every media widget that is
 * playing and has something up -- read from the SETTINGS, so a session whose
 * panel is not rendered keeps its show running.
 */
function syncAutoPlayRunners() {
    const runners = [];
    for (const kind of foregroundMediaKindList) {
        const config = FOREGROUND_MEDIA_CONFIG_MAP[kind];
        for (const session of readSessions(toSessionTarget(kind))) {
            const autoPlayPrefix = toAutoPlayPrefix(kind, session.id);
            const options = readSlideAutoPlayOptions(autoPlayPrefix);
            const isUntilMediaEnd = kind === 'video' && options.isUntilMediaEnd;
            if (
                !checkIsSlideAutoPlaying(autoPlayPrefix) ||
                // Waiting for the clip to finish needs no seconds at all, so
                // an empty seconds box must not stop that show from running.
                !(
                    options.seconds > 0 ||
                    options.maxSeconds > 0 ||
                    isUntilMediaEnd
                ) ||
                getSessionShowingList(config, session.id).length === 0
            ) {
                continue;
            }
            runners.push({
                // The show's own settings prefix, so the countdown beside it
                // reads the same key whichever clock is driving.
                key: autoPlayPrefix,
                // Everything that decides HOW it waits. What is deliberately
                // NOT in here is the file on screen: a clip changing must not
                // reset the countdown, only the rules changing may.
                signature: [
                    options.seconds,
                    options.maxSeconds,
                    options.repeatKind,
                    options.step,
                    isUntilMediaEnd,
                ].join(':'),
                getDelaySeconds: () => {
                    return getSessionDelaySeconds(config, session.id, options);
                },
                tick: () => {
                    return tickSession(config, session.id);
                },
                onEnded: () => {
                    setIsSlideAutoPlaying(autoPlayPrefix, false);
                    notifySlideAutoPlayStateChanged();
                },
            });
        }
    }
    // Only the foreground's own shows: the background lists reconcile their
    // timers from their own panels and must not be stopped from here.
    applyAutoPlayRunners(runners, (key) => {
        return key.startsWith(FOREGROUND_AUTO_PLAY_KEY_PREFIX);
    });
}

function useForegroundLayerEvents() {
    useScreenForegroundManagerEvents(['update']);
}

export default function ForegroundMediaComp({
    kind,
}: Readonly<{ kind: ForegroundMediaKindType }>) {
    const config = FOREGROUND_MEDIA_CONFIG_MAP[kind];
    useScreenForegroundManagerEvents(['update']);
    const [filePaths, setFilePaths] = useState<string[] | null>(null);
    const {
        sessions,
        activeId,
        setActiveId,
        addSession,
        renameSession,
        removeSession,
    } = useMediaSessions(toSessionTarget(kind));
    const suffix = toSessionSuffix(activeId);
    // One session owns one item, so what THIS session has up is what its
    // Properties and its slide show act on.
    const showingScreenIdDataList = getSessionShowingList(config, activeId);
    // Per-instance: one timer per widget -- a shared module timer would drop
    // Video Show's refresh when Image Show is adjusted within 500ms.
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const showingRef = useAppCurrentRef(showingScreenIdDataList);
    const configRef = useAppCurrentRef(config);
    // A clip already on a screen keeps playing muted until it is re-presented,
    // so turning the sound on has to push it back out -- the same thing a
    // style change does, and debounced for the same reason (a volume slider
    // fires per pixel dragged).
    const attemptSoundTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const handleSoundChange = useCallback(() => {
        attemptSoundTimeout(() => {
            const currentConfig = configRef.current;
            for (const [screenId, data] of showingRef.current) {
                getScreenForegroundManagerInstances(
                    screenId,
                    (screenForegroundManager) => {
                        currentConfig.present(screenForegroundManager, {
                            ...data,
                            ...getForegroundSoundData(
                                toSessionPrefix(
                                    currentConfig.kind,
                                    (data.id ?? '') as string,
                                ),
                            ),
                        });
                    },
                );
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const {
        genStyle,
        getWidthScale,
        element: propsSetting,
    } = useForegroundPropsSetting({
        // ONE panel for the session, not one per file: every control here
        // reads a setting, and `appLocalStorage` reads a FILE per key.
        prefix: `${kind}-show${suffix}`,
        // A clip or a picture has no text in it, so the font and colour cards
        // would only be in the way; the blend mode is the point of the widget.
        isCommonStyle: false,
        isBlendMode: true,
        isTransition: true,
        extraControls:
            kind === 'video' ? (
                <ForegroundSoundControlComp
                    prefix={`${kind}-show${suffix}`}
                    onChange={handleSoundChange}
                />
            ) : undefined,
        onChange: (extraStyle) => {
            attemptTimeout(() => {
                refreshAllMedia(config, showingRef.current, extraStyle);
            });
        },
    });
    // Every render reconciles the module-level timers: pressing Play, adding
    // an item and clearing one all land here, and a show whose panel is not
    // rendered keeps the timer it already has.
    useAppEffect(() => {
        syncAutoPlayRunners();
    }, [kind, activeId, showingScreenIdDataList.length]);
    // Read once per render for the whole strip rather than per session: a
    // widget has a handful of sessions, and this walks the screen instances.
    useMediaSessionAutoPlayRefresh();
    const runningAutoPlayKeys = getRunningAutoPlayKeys();
    const genSessionState = (sessionId: string) => {
        const isOnScreen = getSessionShowingList(config, sessionId).length > 0;
        return {
            isOnScreen,
            // ANDed with what is on screen, and that is not belt and braces.
            // A show stops itself INSIDE the timer -- the tick answers false
            // once its session has nothing left to advance -- and a module
            // map changing is not a render, so a Clear Foreground left the ▶
            // drawn on a session whose show had already ended. The two are
            // one fact: `syncAutoPlayRunners` starts a runner only for a
            // session that has something up.
            isAutoPlaying:
                isOnScreen &&
                runningAutoPlayKeys.includes(toAutoPlayPrefix(kind, sessionId)),
        };
    };
    const removeSessionRef = useAppCurrentRef(removeSession);
    const handleSessionRemoving = useCallback((sessionId: string) => {
        // Take that session's overlay OFF the screens first. A session is the
        // only thing that knows which entry belongs to it, so once it is gone
        // its picture sits on the projector with nothing left to hide it --
        // the widget's own Hide button follows the ACTIVE session, and the
        // only way back was Clear Foreground, which takes everything else
        // down with it.
        for (const [screenId, data] of getSessionShowingList(
            config,
            sessionId,
        )) {
            handleMediaHiding(config, screenId, data);
        }
        removeSessionRef.current(sessionId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const genStyleRef = useAppCurrentRef(genStyle);
    const getWidthScaleRef = useAppCurrentRef(getWidthScale);
    const filePathsRef = useAppCurrentRef(filePaths);
    const activeIdRef = useAppCurrentRef(activeId);
    const handleNext = useCallback((data: NextDataType) => {
        const currentFilePaths = filePathsRef.current;
        if (currentFilePaths === null || currentFilePaths.length === 0) {
            return;
        }
        handleNextItemSelecting(
            config,
            activeIdRef.current,
            genStyleRef.current,
            getWidthScaleRef.current,
            currentFilePaths,
            data.isNext,
            data.options,
        );
        // The list is deliberately NOT scrolled to follow the show. A reveal
        // re-CENTRES the row every tick, and this panel is one the operator
        // browses -- a grid that jumps back every five seconds while they are
        // hunting for the next picture is worse than not knowing at a glance
        // which file is up. The live tile still carries its highlight when it
        // is in view, and the screen badge in the bar names it on hover.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <ForegroundLayoutComp
            target={kind}
            // The PANEL is the one scroll container, so the bar below sticks
            // to the top of it. This body adds none of its own: a nested one
            // capped the file grid at its own height and left dead space
            // under it for the rest of the panel.
            extraBodyClassName="foreground-media-body"
        >
            <div className="foreground-media-bar d-flex align-items-center flex-wrap gap-2">
                <MediaSessionsComp
                    target={toSessionTarget(kind)}
                    sessions={sessions}
                    activeId={activeId}
                    onChoose={setActiveId}
                    onAdd={addSession}
                    onRename={renameSession}
                    onRemove={handleSessionRemoving}
                    genRemovedSettingNames={genSessionSettingNames.bind(
                        null,
                        config,
                    )}
                    genSessionState={genSessionState}
                />
                {propsSetting}
                {showingScreenIdDataList.length > 0 ? (
                    // Up here with the rest of the sticky row, not at the
                    // bottom of the list: what is ON A SCREEN, how to take it
                    // off and whether a show is advancing are the controls an
                    // operator reaches for fastest, and down there the
                    // slide-show bar floated over the last row of files.
                    <>
                        <SlideAutoPlayComp
                            // Same reason as the Properties panel: its play
                            // state and interval are read once per mount.
                            key={activeId}
                            prefix={toAutoPlayPrefix(kind, activeId)}
                            onNext={handleNext}
                            isTimerExternal
                            isInline
                            canUntilMediaEnd={kind === 'video'}
                            onStateChange={syncAutoPlayRunners}
                        />
                        <ScreensRendererComp
                            showingScreenIdDataList={showingScreenIdDataList}
                            buttonText={tran(config.hideLabelKey)}
                            genTitle={genMediaTitle}
                            handleForegroundHiding={handleMediaHiding.bind(
                                null,
                                config,
                            )}
                            isMini
                        />
                    </>
                ) : null}
            </div>
            <div className="foreground-media-list d-flex flex-column">
                <FilePathLoadedContext
                    value={{
                        onLoaded: setFilePaths,
                    }}
                >
                    <BackgroundMediaComp
                        // Keyed by session so switching re-reads that
                        // session's own folder instead of keeping the last
                        // one's list on screen.
                        key={activeId}
                        dragType={config.dragType}
                        rendChild={RENDER_TILE_MAP[kind]}
                        dirSourceSettingName={`${config.dirSourceSettingName}${suffix}`}
                        defaultFolderName={config.defaultFolderName}
                        // A session's folder is not on the Path Settings
                        // page, and this panel is a control surface used
                        // minutes before a service: the way to a folder is
                        // the picker in the row above, not another window.
                        isDirSettingRouteHidden
                        genItemData={genForegroundItemData.bind(
                            null,
                            config,
                            activeId,
                            genStyle,
                            getWidthScale,
                        )}
                        genLayerMarker={genForegroundLayerMarker.bind(
                            null,
                            config,
                            activeId,
                        )}
                        useLayerEvents={useForegroundLayerEvents}
                    />
                </FilePathLoadedContext>
            </div>
        </ForegroundLayoutComp>
    );
}
