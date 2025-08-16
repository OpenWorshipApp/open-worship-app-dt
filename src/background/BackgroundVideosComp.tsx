import './BackgroundVideosComp.scss';

import { createRef } from 'react';

import { RenderScreenIds } from './BackgroundComp';
import FileSource from '../helper/FileSource';
import BackgroundMediaComp from './BackgroundMediaComp';
import { DragTypeEnum } from '../helper/DragInf';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import VideoHeaderSettingComp from './VideoHeaderSettingComp';
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

function rendChild(
    filePath: string,
    selectedBackgroundSrcList: [string, BackgroundSrcType][],
) {
    return (
        <RendBody
            filePath={filePath}
            selectedBackgroundSrcList={selectedBackgroundSrcList}
        />
    );
}

function RendBody({
    filePath,
    selectedBackgroundSrcList,
}: Readonly<{
    filePath: string;
    selectedBackgroundSrcList: [string, BackgroundSrcType][];
}>) {
    const vRef = createRef<HTMLVideoElement>();
    const fileSource = FileSource.getInstance(filePath);
    return (
        <div
            className="card-body"
            onMouseEnter={() => {
                vRef.current?.play();
            }}
            onMouseLeave={() => {
                if (vRef.current) {
                    vRef.current.pause();
                    vRef.current.currentTime = 0;
                }
            }}
        >
            <RenderScreenIds
                screenIds={selectedBackgroundSrcList.map(([key]) => {
                    return parseInt(key);
                })}
            />
            <video ref={vRef} loop muted src={fileSource.src} />
        </div>
    );
}

async function genVideoDownloadContextMenuItems(dirSource: DirSource) {
    return genDownloadContextMenuItems(
        {
            title: '`Download From URL',
            subTitle: 'Video URL:',
        },
        dirSource,
        async (videoUrl) => {
            try {
                showSimpleToast(
                    '`Download From URL',
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
                    '`Download From URL',
                    `Video downloaded successfully, file path: "${destFileSource.filePath}"`,
                );
            } catch (error) {
                handleError(error);
                showSimpleToast(
                    '`Download From URL',
                    'Error occurred during downloading video',
                );
            } finally {
                hideProgressBar(videoUrl);
            }
        },
    );
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
            extraHeaderChild={<VideoHeaderSettingComp />}
            defaultFolderName={defaultDataDirNames.BACKGROUND_VIDEO}
            dragType={DragTypeEnum.BACKGROUND_VIDEO}
            rendChild={rendChild}
            dirSourceSettingName={dirSourceSettingNames.BACKGROUND_VIDEO}
            genContextMenuItems={genVideoDownloadContextMenuItems}
            onItemsAdding={handleItemsAdding}
        />
    );
}
