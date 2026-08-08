import './BackgroundVideosComp.scss';

import { useCallback, type ReactElement, type RefObject } from 'react';
import { useRef, useState } from 'react';

import FileSource from '../helper/FileSource';
import BackgroundMediaComp from './BackgroundMediaComp';
import { DragTypeEnum } from '../helper/DragInf';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import type { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import { genDownloadContextMenuItems } from './downloadHelper';
import { handleError } from '../helper/errorHelpers';
import { playMediaElement } from '../helper/mediaHelpers';
import { tran } from '../lang/langHelpers';
import {
    showProgressBar,
    hideProgressBar,
} from '../progress-bar/progressBarHelpers';
import { downloadVideoOrAudio, timeToTimeString } from '../server/appHelpers';
import { fsMove, getTempPath } from '../server/fileHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type DirSource from '../helper/DirSource';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import {
    getIsFadingAtTheEndSetting,
    methodMapIsFadingAtTheEnd,
    setIsFadingAtTheEndSetting,
} from './videoBackgroundHelpers';
import RenderBackgroundScreenIdsComp from './RenderBackgroundScreenIdsComp';

// Mounting every <video> in the folder at once spawns dozens of demuxers,
// which kills low-spec machines. Render a same-size placeholder and only
// mount the <video> once the tile first becomes visible.
function LazyMountVideoComp({
    videoRef,
    src,
}: Readonly<{
    videoRef: RefObject<HTMLVideoElement | null>;
    src: string;
}>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVideoMounted, setIsVideoMounted] = useState(false);
    useAppEffect(() => {
        const container = containerRef.current;
        if (isVideoMounted || container === null) {
            return;
        }
        const observer = new IntersectionObserver((entries) => {
            if (
                entries.some((entry) => {
                    return entry.isIntersecting;
                })
            ) {
                setIsVideoMounted(true);
            }
        });
        observer.observe(container);
        return () => {
            observer.disconnect();
        };
    }, [isVideoMounted]);
    return (
        <div ref={containerRef} className="w-100 h-100">
            {isVideoMounted ? (
                <video
                    className="w-100 h-100"
                    ref={videoRef}
                    loop
                    muted
                    preload="metadata"
                    src={src}
                    style={{
                        objectFit: 'cover',
                        objectPosition: 'center center',
                        pointerEvents: 'none',
                    }}
                />
            ) : null}
        </div>
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
    const vRef = useRef<HTMLVideoElement>(null);
    const fileSourceRef = useAppCurrentRef(fileSource);
    const handleMouseEnter = useCallback((event: any) => {
        if (vRef.current === null) {
            return;
        }
        playMediaElement(vRef.current);
        const currentTarget = event.currentTarget as HTMLDivElement;
        if (!Number.isNaN(vRef.current.duration) && !currentTarget.title) {
            currentTarget.title =
                `${fileSourceRef.current.fullName}\n` +
                `(${timeToTimeString(vRef.current.duration)})`;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleMouseLeave = useCallback(() => {
        vRef.current?.pause();
    }, []);
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
            <LazyMountVideoComp videoRef={vRef} src={fileSource.src} />
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
            handleError(error);
            showSimpleToast(
                title,
                tran('Error occurred during downloading video'),
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
    const handleItemsAdding = useCallback(
        async (
            dirSource: DirSource,
            defaultContextMenuItems: ContextMenuItemType[],
            event: any,
        ) => {
            const contextMenuItems =
                await genVideoDownloadContextMenuItems(dirSource);
            showAppContextMenu(event, [
                ...defaultContextMenuItems,
                ...contextMenuItems,
            ]);
        },
        [],
    );
    return (
        <BackgroundMediaComp
            defaultFolderName={defaultDataDirNames.BACKGROUND_VIDEO}
            dragType={DragTypeEnum.BACKGROUND_VIDEO}
            rendChild={rendChild}
            dirSourceSettingName={dirSourceSettingNames.BACKGROUND_VIDEO}
            genContextMenuItems={genVideoDownloadContextMenuItems}
            onItemsAdding={handleItemsAdding}
            genExtraItemContextMenuItems={genExtraItemContextMenuItems}
            itemFillingClassname="video-thumbnail"
        />
    );
}
