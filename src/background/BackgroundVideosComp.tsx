import './BackgroundVideosComp.scss';

import { createRef, ReactElement, useState } from 'react';

import FileSource from '../helper/FileSource';
import BackgroundMediaComp from './BackgroundMediaComp';
import { DragTypeEnum } from '../helper/DragInf';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import { genDownloadContextMenuItems } from './downloadHelper';
import { handleError } from '../helper/errorHelpers';
import {
    showProgressBar,
    hideProgressBar,
} from '../progress-bar/progressBarHelpers';
import { downloadVideoOrAudio } from '../server/appHelpers';
import { fsCheckFileExist, fsDeleteFile, fsMove } from '../server/fileHelpers';
import { getDefaultDataDir } from '../setting/directory-setting/directoryHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import DirSource from '../helper/DirSource';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import {
    getIsFadingAtTheEndSetting,
    methodMapIsFadingAtTheEnd,
    setIsFadingAtTheEndSetting,
} from './videoBackgroundHelpers';
import RenderBackgroundScreenIds from './RenderBackgroundScreenIds';

function rendChild(
    filePath: string,
    selectedBackgroundSrcList: [string, BackgroundSrcType][],
    height: number,
    extraChild?: ReactElement,
) {
    return (
        <RendBody
            filePath={filePath}
            selectedBackgroundSrcList={selectedBackgroundSrcList}
            height={height}
            extraChild={extraChild}
        />
    );
}

function RendBody({
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
        methodMapIsFadingAtTheEnd[filePath] = setIsFadingAtTheEnd;
        return () => {
            delete methodMapIsFadingAtTheEnd[filePath];
        };
    }, [filePath]);
    const vRef = createRef<HTMLVideoElement>();
    return (
        <div
            className="card-body app-overflow-hidden app-blank-bg"
            style={{ height: `${height}px`, overflow: 'hidden' }}
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
                        title="`Video will fade at the end while screen rendering"
                    />
                ) : null}
            </div>
            {extraChild}
        </div>
    );
}

async function genVideoDownloadContextMenuItems(dirSource: DirSource) {
    const title = '`Download From URL';
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
            );
            const destFileSource = FileSource.getInstance(
                dirSource.dirPath,
                fileFullName,
            );
            if (await fsCheckFileExist(destFileSource.filePath)) {
                await fsDeleteFile(destFileSource.filePath);
            }
            await fsMove(filePath, destFileSource.filePath);
            showSimpleToast(
                title,
                `Video downloaded successfully, file path: "${destFileSource.filePath}"`,
            );
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
            menuElement: '`Toggle Fading at End`',
            title: '`Toggle is video should fade at the end',
            onSelect: () => {
                const fileSource = FileSource.getInstance(filePath);
                const isFadingAtTheEnd = getIsFadingAtTheEndSetting(
                    fileSource.src,
                );
                setIsFadingAtTheEndSetting(fileSource.src, !isFadingAtTheEnd);
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
