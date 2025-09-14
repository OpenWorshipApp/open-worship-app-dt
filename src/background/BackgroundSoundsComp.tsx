import './BackgroundSoundsComp.scss';

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
    getSoundRepeatSettingName,
} from './audioBackgroundHelpers';
import { useMemo, useState } from 'react';
import { showSimpleToast } from '../toast/toastHelpers';
import { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import DirSource from '../helper/DirSource';
import { handleError } from '../helper/errorHelpers';
import {
    showProgressBar,
    hideProgressBar,
} from '../progress-bar/progressBarHelpers';
import { fsCheckFileExist, fsDeleteFile, fsMove } from '../server/fileHelpers';
import { getDefaultDataDir } from '../setting/directory-setting/directoryHelpers';
import { genDownloadContextMenuItems } from './downloadHelper';
import { downloadVideoOrAudio } from '../server/appHelpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';

function RendBodyComp({
    filePath,
}: Readonly<{
    filePath: string;
    selectedBackgroundSrcList: [string, BackgroundSrcType][];
}>) {
    const fileSource = FileSource.getInstance(filePath);
    const settingName = useMemo(() => {
        return getSoundRepeatSettingName(fileSource.src);
    }, [fileSource.src]);
    const [isRepeating, setIsRepeating] = useStateSettingBoolean(
        settingName,
        false,
    );
    return (
        <div className="w-100" data-file-path={filePath}>
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
                        title="`Repeat this audio"
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
        return (
            <div data-file-path={filePath} style={{ display: 'none' }}></div>
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
    return genDownloadContextMenuItems(
        {
            title: '`Download From URL',
            subTitle: 'Audio URL:',
        },
        dirSource,
        async (audioUrl) => {
            try {
                showSimpleToast(
                    '`Download From URL',
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
                if (await fsCheckFileExist(destFileSource.filePath)) {
                    await fsDeleteFile(destFileSource.filePath);
                }
                await fsMove(filePath, destFileSource.filePath);
                showSimpleToast(
                    '`Download From URL',
                    `Audio downloaded successfully, file path: "${destFileSource.filePath}"`,
                );
            } catch (error) {
                handleError(error);
                showSimpleToast(
                    '`Download From URL',
                    'Error occurred during downloading video',
                );
            } finally {
                hideProgressBar(audioUrl);
            }
        },
    );
}

export default function BackgroundSoundsComp() {
    const [activeMap, setActiveMap] = useState<{ [key: string]: boolean }>({});
    const handleItemClicking = (event: any) => {
        const target = event.target;
        const parentElement = target.parentElement;
        // check is audio playing
        const audioElement = parentElement.querySelector('audio');
        if (audioElement && !audioElement.paused) {
            showSimpleToast(
                'Audio playing',
                'Please stop the audio before leaving the page.',
            );
            return;
        }
        const childElement = parentElement.querySelector('[data-file-path]');
        if (!childElement) {
            return;
        }
        const filePath = childElement.getAttribute('data-file-path');
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
            defaultFolderName={defaultDataDirNames.BACKGROUND_SOUND}
            dragType={DragTypeEnum.BACKGROUND_SOUND}
            onClick={handleItemClicking}
            dirSourceSettingName={dirSourceSettingNames.BACKGROUND_SOUND}
            noDraggable={true}
            isNameOnTop={true}
            genContextMenuItems={genAudioDownloadContextMenuItems}
            onItemsAdding={handleItemsAdding}
            shouldHideFooter
        />
    );
}
