import './BackgroundAudiosComp.scss';

import { useCallback, useState } from 'react';

import FileSource from '../helper/FileSource';
import BackgroundMediaComp from './BackgroundMediaComp';
import { DragTypeEnum } from '../helper/DragInf';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import { showAudioPlayingToast } from '../helper/mediaControlHelpers';
import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
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
import VaryAppDocumentAudiosComp from './VaryAppDocumentAudiosComp';
import { genAudioBodyChild } from './AudioBodyComp';
import { useAppDocumentAudioData } from './backgroundHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';

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
    const handleItemClicking = useCallback((event: any) => {
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
    }, []);
    const handleItemsAdding = useCallback(
        async (
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
        },
        [],
    );
    const mainElement = (
        <BackgroundMediaComp
            rendChild={genAudioBodyChild.bind(null, activeMap)}
            defaultFolderName={defaultDataDirNames.BACKGROUND_AUDIO}
            dragType={DragTypeEnum.BACKGROUND_AUDIO}
            extraMimetypeNames={['video']}
            onClick={handleItemClicking}
            dirSourceSettingName={dirSourceSettingNames.BACKGROUND_AUDIO}
            noDraggable={true}
            isNameOnTop={true}
            genContextMenuItems={genAudioDownloadContextMenuItems}
            onItemsAdding={handleItemsAdding}
            shouldHideFooter
        />
    );

    const appDocumentAudioData = useAppDocumentAudioData();

    if (appDocumentAudioData === null) {
        return mainElement;
    }

    return (
        <ResizeActorComp
            flexSizeName={'flex-size-background'}
            isHorizontal={false}
            isDisableQuickResize
            flexSizeDefault={{
                v1: ['3'],
                v2: ['1'],
            }}
            dataInput={[
                {
                    children: {
                        render: () => {
                            return mainElement;
                        },
                    },
                    key: 'v1',
                    widgetName: 'Background',
                },
                {
                    children: {
                        render: () => {
                            return (
                                <VaryAppDocumentAudiosComp
                                    appDocumentAudioData={appDocumentAudioData}
                                />
                            );
                        },
                    },
                    key: 'v2',
                    widgetName: 'Background Audio',
                },
            ]}
        />
    );
}
