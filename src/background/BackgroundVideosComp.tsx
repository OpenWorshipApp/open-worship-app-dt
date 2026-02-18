import './BackgroundVideosComp.scss';

import type { ReactElement } from 'react';
import { createRef, useState } from 'react';

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
import { tran } from '../lang/langHelpers';
import {
    showProgressBar,
    hideProgressBar,
} from '../progress-bar/progressBarHelpers';
import { downloadVideoOrAudio } from '../server/appHelpers';
import { fsCheckFileExist, fsMove } from '../server/fileHelpers';
import { getDefaultDataDir } from '../setting/directory-setting/directoryHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type DirSource from '../helper/DirSource';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import {
    getIsFadingAtTheEndSetting,
    methodMapIsFadingAtTheEnd,
    setIsFadingAtTheEndSetting,
} from './videoBackgroundHelpers';
import RenderBackgroundScreenIds from './RenderBackgroundScreenIds';
import { notifyBackgroundMediaAdded } from './backgroundHelpers';

const onToggledFadingAtTheEnd: Record<
    string,
    (isFadingAtTheEnd: boolean) => void
> = {};

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
        onToggledFadingAtTheEnd[fileSource.src] = (
            isFadingAtTheEnd: boolean,
        ) => {
            setIsFadingAtTheEnd(isFadingAtTheEnd);
        };
        return () => {
            delete onToggledFadingAtTheEnd[fileSource.src];
        };
    }, []);
    useAppEffect(() => {
        methodMapIsFadingAtTheEnd[filePath] = setIsFadingAtTheEnd;
        return () => {
            delete methodMapIsFadingAtTheEnd[filePath];
        };
    }, [filePath]);
    const vRef = createRef<HTMLVideoElement>();
    return (
        <div
            className="card-body app-overflow-hidden app-blank-bg"
            data-video-file-name={fileSource.name}
            style={{
                height: `${height}px`,
                overflow: 'hidden',
                borderRadius: '5px 5px 0px 0px',
            }}
            onMouseEnter={() => {
                vRef.current?.play();
            }}
            onMouseLeave={() => {
                vRef.current?.pause();
            }}
        >
            <RenderBackgroundScreenIds
                screenIds={selectedBackgroundSrcList.map(([key]) => {
                    return Number.parseInt(key);
                })}
            />
            <video
                className="w-100 h-100"
                ref={vRef}
                loop
                muted
                src={fileSource.src}
                style={{
                    objectFit: 'cover',
                    objectPosition: 'center center',
                    pointerEvents: 'none',
                }}
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
                            ' Use *.loop.[extension] file to disable fading.'
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
            const defaultPath = getDefaultDataDir();
            const { filePath, fileFullName } = await downloadVideoOrAudio(
                videoUrl,
                defaultPath,
                true,
            );
            const destFileSource = FileSource.getInstance(
                dirSource.dirPath,
                fileFullName,
            );
            let i = 0;
            const downloadedFilePath = destFileSource.filePath;
            while (await fsCheckFileExist(downloadedFilePath)) {
                i++;
                destFileSource.name = destFileSource.name + ` (${i})`;
            }
            await fsMove(filePath, downloadedFilePath);
            showSimpleToast(
                title,
                `Video downloaded successfully, file path: "${downloadedFilePath}"`,
            );
            notifyBackgroundMediaAdded('video', destFileSource.name);
        } catch (error) {
            handleError(error);
            showSimpleToast(title, 'Error occurred during downloading video');
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
            menuElement: tran('Toggle Fading at End'),
            title: tran('Toggle is video should fade at the end'),
            onSelect: () => {
                const fileSource = FileSource.getInstance(filePath);
                let isFadingAtTheEnd = getIsFadingAtTheEndSetting(
                    fileSource.src,
                );
                isFadingAtTheEnd = !isFadingAtTheEnd;
                setIsFadingAtTheEndSetting(fileSource.src, isFadingAtTheEnd);
                onToggledFadingAtTheEnd[fileSource.src]?.(isFadingAtTheEnd);
            },
        },
    ];
}

export default function BackgroundVideosComp() {
    const handleItemsAdding = async (
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
    };
    return (
        <BackgroundMediaComp
            defaultFolderName={defaultDataDirNames.BACKGROUND_VIDEO}
            dragType={DragTypeEnum.BACKGROUND_VIDEO}
            rendChild={rendChild}
            dirSourceSettingName={dirSourceSettingNames.BACKGROUND_VIDEO}
            genContextMenuItems={genVideoDownloadContextMenuItems}
            onItemsAdding={handleItemsAdding}
            genExtraItemContextMenuItems={genExtraItemContextMenuItems}
        />
    );
}
