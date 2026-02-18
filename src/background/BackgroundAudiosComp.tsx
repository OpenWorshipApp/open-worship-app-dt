import './BackgroundAudiosComp.scss';

import { useMemo, useState } from 'react';

import FileSource from '../helper/FileSource';
import BackgroundMediaComp from './BackgroundMediaComp';
import { DragTypeEnum } from '../helper/DragInf';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import {
    handleAudioPlaying,
    handleAudioPausing,
    handleAudioEnding,
    getAudioRepeatSettingName,
    showAudioPlayingToast,
} from './audioBackgroundHelpers';
import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import type DirSource from '../helper/DirSource';
import { handleError } from '../helper/errorHelpers';
import {
    showProgressBar,
    hideProgressBar,
} from '../progress-bar/progressBarHelpers';
import { fsCheckFileExist, fsDeleteFile, fsMove } from '../server/fileHelpers';
import { getDefaultDataDir } from '../setting/directory-setting/directoryHelpers';
import { genDownloadContextMenuItems } from './downloadHelper';
import { downloadVideoOrAudio } from '../server/appHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { notifyBackgroundMediaAdded } from './backgroundHelpers';

function RendBodyComp({
    filePath,
}: Readonly<{
    filePath: string;
    selectedBackgroundSrcList: [string, BackgroundSrcType][];
}>) {
    const fileSource = FileSource.getInstance(filePath);
    const settingName = useMemo(() => {
        return getAudioRepeatSettingName(fileSource.src);
    }, [fileSource.src]);
    const [isRepeating, setIsRepeating] = useStateSettingBoolean(
        settingName,
        false,
    );
    return (
        <div
            className="w-100"
            data-file-path={filePath}
            data-audio-file-name={fileSource.name}
        >
            <div className="d-flex align-items-center w-100 my-2">
                <audio
                    className="flex-fill"
                    data-repeat-setting-name={settingName}
                    controls
                    onPlay={handleAudioPlaying}
                    onPause={handleAudioPausing}
                    onEnded={handleAudioEnding}
                >
                    <source src={fileSource.src} />
                    <track kind="captions" />
                    Browser does not support audio.
                </audio>
                <div>
                    <i
                        className="bi bi-repeat-1 p-1"
                        title={tran('Repeat this audio')}
                        style={{
                            fontSize: '1.5rem',
                            opacity: isRepeating ? 1 : 0.5,
                            color: isRepeating ? 'green' : 'inherit',
                        }}
                        onClick={() => {
                            setIsRepeating(!isRepeating);
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

function rendChild(
    activeMap: { [key: string]: boolean },
    filePath: string,
    selectedBackgroundSrcList: [string, BackgroundSrcType][],
) {
    if (!activeMap[filePath]) {
        const fileSource = FileSource.getInstance(filePath);
        return (
            <div
                data-file-path={filePath}
                style={{ display: 'none' }}
                data-audio-file-name={fileSource.name}
            />
        );
    }
    return (
        <RendBodyComp
            filePath={filePath}
            selectedBackgroundSrcList={selectedBackgroundSrcList}
        />
    );
}

async function genAudioDownloadContextMenuItems(dirSource: DirSource) {
    const title = tran('Download From URL');
    const download = async (audioUrl: string) => {
        try {
            showSimpleToast(
                title,
                `Downloading audio from "${audioUrl}", please wait...`,
            );
            showProgressBar(audioUrl);
            const defaultPath = getDefaultDataDir();
            const { filePath, fileFullName } = await downloadVideoOrAudio(
                audioUrl,
                defaultPath,
                false,
            );
            const destFileSource = FileSource.getInstance(
                dirSource.dirPath,
                fileFullName,
            );
            const downloadedFilePath = destFileSource.filePath;
            if (await fsCheckFileExist(downloadedFilePath)) {
                await fsDeleteFile(downloadedFilePath);
            }
            await fsMove(filePath, downloadedFilePath);
            showSimpleToast(
                title,
                `Audio downloaded successfully, file path: "${downloadedFilePath}"`,
            );
            notifyBackgroundMediaAdded('audio', destFileSource.name);
        } catch (error) {
            handleError(error);
            showSimpleToast(title, 'Error occurred during downloading audio');
        } finally {
            hideProgressBar(audioUrl);
        }
    };
    return genDownloadContextMenuItems(
        {
            title,
            subTitle: 'Audio URL:',
        },
        dirSource,
        download,
        'audios',
    );
}

export default function BackgroundAudiosComp() {
    const [activeMap, setActiveMap] = useState<{ [key: string]: boolean }>({});
    const handleItemClicking = (event: any) => {
        const target = event.target;
        const parentElement = target.parentElement;
        // check is audio playing
        const audioElement = parentElement.querySelector('audio');
        if (audioElement && !audioElement.paused) {
            showAudioPlayingToast();
            return;
        }
        const childElement = parentElement.querySelector('[data-file-path]');
        if (childElement instanceof HTMLDivElement === false) {
            return;
        }
        const filePath = childElement.dataset.filePath;
        if (filePath === undefined) {
            return;
        }
        setActiveMap((preActiveMap) => {
            return {
                ...preActiveMap,
                [filePath]: !preActiveMap[filePath],
            };
        });
    };
    const handleItemsAdding = async (
        dirSource: DirSource,
        defaultContextMenuItems: ContextMenuItemType[],
        event: any,
    ) => {
        const contextMenuItems =
            await genAudioDownloadContextMenuItems(dirSource);
        showAppContextMenu(event, [
            ...defaultContextMenuItems,
            ...contextMenuItems,
        ]);
    };
    return (
        <BackgroundMediaComp
            rendChild={rendChild.bind(null, activeMap)}
            defaultFolderName={defaultDataDirNames.BACKGROUND_AUDIO}
            dragType={DragTypeEnum.BACKGROUND_AUDIO}
            onClick={handleItemClicking}
            dirSourceSettingName={dirSourceSettingNames.BACKGROUND_AUDIO}
            noDraggable={true}
            isNameOnTop={true}
            genContextMenuItems={genAudioDownloadContextMenuItems}
            onItemsAdding={handleItemsAdding}
            shouldHideFooter
        />
    );
}
