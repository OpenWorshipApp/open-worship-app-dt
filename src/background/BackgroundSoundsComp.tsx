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
    showProgressBard,
    hideProgressBard,
} from '../progress-bar/progressBarHelpers';
import { fsCheckFileExist, fsDeleteFile, fsMove } from '../server/fileHelpers';
import { getDefaultDataDir } from '../setting/directory-setting/directoryHelpers';
import { genContextMenuItems } from './downloadHelper';
import { downloadVideoOrAudio } from '../server/appHelpers';

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
        <div className="card-body" data-file-path={filePath}>
            <div className="d-flex justify-content-center align-items-center h-100">
                <audio
                    data-repeat-setting-name={settingName}
                    controls
                    onPlay={handleAudioPlaying}
                    onPause={handleAudioPausing}
                    onEnded={handleAudioEnding}
                >
                    <source src={fileSource.src} />
                    <track kind="captions" />
                    Your browser does not support the audio element.
                </audio>
                <div className="">
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
    return genContextMenuItems(
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
                showProgressBard(audioUrl);
                const defaultPath = getDefaultDataDir();
                const audioFilePath = await downloadVideoOrAudio(
                    audioUrl,
                    defaultPath,
                    false,
                );
                if (audioFilePath === null) {
                    showSimpleToast(
                        '`Download From URL',
                        'Cannot download audio, please check the URL again',
                    );
                    return;
                }
                const sourceFileSource = FileSource.getInstance(audioFilePath);
                const destFileSource = FileSource.getInstance(
                    dirSource.dirPath,
                    sourceFileSource.fullName,
                );
                if (await fsCheckFileExist(destFileSource.filePath)) {
                    await fsDeleteFile(destFileSource.filePath);
                }
                await fsMove(audioFilePath, destFileSource.filePath);
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
                hideProgressBard(audioUrl);
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
        />
    );
}
