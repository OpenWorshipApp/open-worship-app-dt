import './BackgroundVideosComp.scss';

import { useCallback, type CSSProperties, type ReactElement } from 'react';
import { useMemo, useRef, useState } from 'react';

import FileSource from '../helper/FileSource';
import BackgroundMediaComp from './BackgroundMediaComp';
import { DragTypeEnum } from '../helper/DragInf';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import type { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import {
    genDownloadContextMenuItems,
    toDownloadFailureMessage,
} from './downloadHelper';
import { handleError } from '../helper/errorHelpers';
import {
    playMediaElement,
    releaseMediaElementWhenDetached,
} from '../helper/mediaHelpers';
import { useVideoPoster } from './videoPosterHelpers';
import { tran } from '../lang/langHelpers';
import {
    showProgressBar,
    hideProgressBar,
} from '../progress-bar/progressBarHelpers';
import { downloadVideoOrAudio, timeToTimeString } from '../server/appHelpers';
import { fsMove, getTempPath } from '../server/fileHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type DirSource from '../helper/DirSource';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import {
    getIsFadingAtTheEndSetting,
    methodMapIsFadingAtTheEnd,
    setIsFadingAtTheEndSetting,
} from './videoBackgroundHelpers';
import RenderBackgroundScreenIdsComp from './RenderBackgroundScreenIdsComp';
import { checkIsExtraBinMissingError } from '../helper/extra-bin/extraBinErrors';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';

// Long enough that dragging the mouse across a grid of tiles starts no
// players, short enough that the video answers the mouse.
const HOVER_PLAY_DELAY = 120;

const MEDIA_STYLE: CSSProperties = {
    objectFit: 'cover',
    objectPosition: 'center center',
    pointerEvents: 'none',
};

// At rest a tile draws a PICTURE of the video's first frame, not the video:
// a `<video>` is a whole media player -- decoder, demuxer, frame pool, ~8 MB
// of it -- and a folder holds hundreds. The player is created for the one
// tile under the mouse, which is the only one that plays, and handed straight
// back when the mouse leaves or the tile scrolls away.
//
// Handing it back has to be explicit: taking the element out of the document
// does NOT free it (the renderer still counted 13k DOM nodes for videos
// scrolled past until a forced collection here), and Chromium refuses to
// create any more once a frame holds 1000.
function VideoTilePreviewComp({
    src,
    isHovering,
    onDurationRead,
}: Readonly<{
    src: string;
    isHovering: boolean;
    onDurationRead: (duration: number) => void;
}>) {
    const posterDataUrl = useVideoPoster(src);
    const handleVideoRef = useCallback((element: HTMLVideoElement | null) => {
        if (element === null) {
            return;
        }
        playMediaElement(element);
        // React 19 runs a ref callback's return value as its cleanup, which is
        // the one place that knows the element is on its way out.
        return () => {
            releaseMediaElementWhenDetached(element);
        };
    }, []);
    const onDurationReadRef = useAppCurrentRef(onDurationRead);
    const handleMetadataLoaded = useCallback((event: any) => {
        const { duration } = event.currentTarget as HTMLVideoElement;
        if (!Number.isNaN(duration)) {
            onDurationReadRef.current(duration);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (isHovering) {
        return (
            <video
                className="w-100 h-100"
                ref={handleVideoRef}
                loop
                muted
                autoPlay
                preload="auto"
                poster={posterDataUrl ?? undefined}
                src={src}
                style={MEDIA_STYLE}
                onLoadedMetadata={handleMetadataLoaded}
            />
        );
    }
    if (posterDataUrl === null) {
        // Its own frame is still being read; the tile keeps its blank card
        // rather than flashing something that is not this video.
        return null;
    }
    return (
        <img
            className="w-100 h-100"
            src={posterDataUrl}
            alt=""
            draggable={false}
            style={MEDIA_STYLE}
        />
    );
}

function RendBodyComp({
    filePath,
    selectedBackgroundSrcList,
    height,
    extraChild,
}: Readonly<{
    filePath: string;
    selectedBackgroundSrcList: [string, BackgroundSrcType][];
    height: number;
    extraChild?: ReactElement;
}>) {
    const fileSource = FileSource.getInstance(filePath);
    const [isFadingAtTheEnd, setIsFadingAtTheEnd] = useState(
        getIsFadingAtTheEndSetting(fileSource.src),
    );
    useAppEffect(() => {
        // Keyed by `src` to match `setIsFadingAtTheEndSetting` callers.
        methodMapIsFadingAtTheEnd[fileSource.src] = setIsFadingAtTheEnd;
        return () => {
            delete methodMapIsFadingAtTheEnd[fileSource.src];
        };
    }, [fileSource]);
    const rootRef = useRef<HTMLDivElement>(null);
    const fileSourceRef = useAppCurrentRef(fileSource);
    const [isHovering, setIsHovering] = useState(false);
    // Moving the mouse ACROSS a grid must not build and tear down a player per
    // tile it passes over. Per tile: a leave cancels only its own pending
    // enter.
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
    const handleDurationRead = useCallback((duration: number) => {
        const element = rootRef.current;
        if (element === null || element.title) {
            return;
        }
        element.title =
            `${fileSourceRef.current.fullName}\n` +
            `(${timeToTimeString(duration)})`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            ref={rootRef}
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
                onDurationRead={handleDurationRead}
            />
            <div
                className="position-absolute mx-1 text-white"
                style={{
                    top: 0,
                    right: 20,
                }}
            >
                {isFadingAtTheEnd ? (
                    <i
                        className="bi bi-shadows"
                        title={
                            tran(
                                'Video will fade at the end while screen rendering.',
                            ) +
                            ' Use *.loop.[extension] file to force auto fading.'
                        }
                    />
                ) : null}
            </div>
            {extraChild}
        </div>
    );
}

function rendChild(
    filePath: string,
    selectedBackgroundSrcList: [string, BackgroundSrcType][],
    _width: number,
    height: number,
    extraChild?: ReactElement,
) {
    return (
        <RendBodyComp
            filePath={filePath}
            selectedBackgroundSrcList={selectedBackgroundSrcList}
            height={height}
            extraChild={extraChild}
        />
    );
}

async function genVideoDownloadContextMenuItems(dirSource: DirSource) {
    const title = tran('Download From URL');
    const download = async (videoUrl: string) => {
        try {
            showSimpleToast(
                title,
                `Downloading video from "${videoUrl}", please wait...`,
            );
            showProgressBar(videoUrl);
            // Stage in the OS temp dir, not `getDefaultDataDir()`: that one is
            // hardcoded to Desktop/open-worship-data, so it ignored both the
            // dev data-dir override and any relocated media dir — spuriously
            // creating/filling a directory the user may not even use.
            const { filePath, fileFullName } = await downloadVideoOrAudio(
                videoUrl,
                getTempPath(),
                true,
            );
            const destFileSource = FileSource.getInstance(
                dirSource.dirPath,
                fileFullName,
            );
            const downloadedFilePath = await destFileSource.genNextFilePath();
            await fsMove(filePath, downloadedFilePath);
            showSimpleToast(
                title,
                `Video downloaded successfully, file path: "${downloadedFilePath}"`,
            );
        } catch (error) {
            // The media pack guard already put a dialog in front of the user;
            // a "download failed" toast on top of the "No" they just gave is
            // noise.
            if (checkIsExtraBinMissingError(error)) {
                return;
            }
            handleError(error);
            showSimpleToast(
                title,
                toDownloadFailureMessage(
                    tran('Error occurred during downloading video'),
                    error,
                ),
            );
        } finally {
            hideProgressBar(videoUrl);
        }
    };
    return genDownloadContextMenuItems(
        {
            title,
            subTitle: 'Video URL:',
        },
        dirSource,
        download,
        'videos',
    );
}

function genExtraItemContextMenuItems(filePath: string) {
    return [
        {
            childBefore: genContextMenuItemIcon('magic'),
            menuElement: tran('Toggle Fading at End'),
            title: tran('Toggle is video should fade at the end'),
            onSelect: () => {
                const fileSource = FileSource.getInstance(filePath);
                let isFadingAtTheEnd = getIsFadingAtTheEndSetting(
                    fileSource.src,
                );
                isFadingAtTheEnd = !isFadingAtTheEnd;
                setIsFadingAtTheEndSetting(fileSource.src, isFadingAtTheEnd);
            },
        },
    ];
}

export default function BackgroundVideosComp() {
    return (
        <BackgroundMediaComp
            defaultFolderName={defaultDataDirNames.BACKGROUND_VIDEO}
            dragType={DragTypeEnum.BACKGROUND_VIDEO}
            rendChild={rendChild}
            dirSourceSettingName={dirSourceSettingNames.BACKGROUND_VIDEO}
            genContextMenuItems={genVideoDownloadContextMenuItems}
            genExtraItemContextMenuItems={genExtraItemContextMenuItems}
        />
    );
}
