import './BackgroundAudiosComp.scss';

import { useCallback, useState } from 'react';

import FileSource from '../helper/FileSource';
import BackgroundMediaComp from './BackgroundMediaComp';
import { DragTypeEnum } from '../helper/DragInf';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import {
    checkAudioPlaying,
    showAudioPlayingToast,
} from '../helper/mediaControlHelpers';
import { tran } from '../lang/langHelpers';
import { toWidgetLabel } from '../others/labelIconHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type DirSource from '../helper/DirSource';
import { handleError } from '../helper/errorHelpers';
import {
    showProgressBar,
    hideProgressBar,
} from '../progress-bar/progressBarHelpers';
import { fsMove, getTempPath } from '../server/fileHelpers';
import {
    genDownloadContextMenuItems,
    toDownloadFailureMessage,
} from './downloadHelper';
import { downloadVideoOrAudio } from '../server/appHelpers';
import VaryAppDocumentAudiosComp from './VaryAppDocumentAudiosComp';
import { genAudioBodyChild } from './AudioBodyComp';
import { useAppDocumentAudioData } from './backgroundHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import { checkIsExtraBinMissingError } from '../helper/extra-bin/extraBinErrors';
import { useBackgroundSessions } from './backgroundSessionHelpers';

async function genAudioDownloadContextMenuItems(dirSource: DirSource) {
    const title = tran('Download From URL');
    const download = async (audioUrl: string) => {
        try {
            showSimpleToast(
                title,
                `Downloading audio from "${audioUrl}", please wait...`,
            );
            showProgressBar(audioUrl);
            // See BackgroundVideosComp: stage in the OS temp dir rather than the
            // hardcoded getDefaultDataDir().
            const { filePath, fileFullName } = await downloadVideoOrAudio(
                audioUrl,
                getTempPath(),
                false,
            );
            const destFileSource = FileSource.getInstance(
                dirSource.dirPath,
                fileFullName,
            );
            // Never overwrite: the file name comes from the remote page title,
            // so a collision with an existing audio is not something the user
            // can predict. Deleting it here silently destroyed the original —
            // `genNextFilePath` suffixes instead, matching the video flow.
            const downloadedFilePath = await destFileSource.genNextFilePath();
            await fsMove(filePath, downloadedFilePath);
            showSimpleToast(
                title,
                `Audio downloaded successfully, file path: "${downloadedFilePath}"`,
            );
        } catch (error) {
            // See BackgroundVideosComp: the guard's dialog is the message.
            if (checkIsExtraBinMissingError(error)) {
                return;
            }
            handleError(error);
            showSimpleToast(
                title,
                toDownloadFailureMessage(
                    tran('Error occurred during downloading audio'),
                    error,
                ),
            );
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
        const target = event.target as HTMLElement | null;
        // Scrubbing, the volume and the repeat icon belong to the player, not
        // to the row: without this, dragging a paused track's scrubber folded
        // the row shut under the mouse.
        if (target?.closest('audio') != null) {
            return;
        }
        // The ROW, whatever inside it was clicked. This walked up exactly ONE
        // parent, so a click on the name line looked for the marker inside
        // the name line and found nothing -- the row simply did not open --
        // while a click on the row's own padding searched the whole grid row
        // and could reach the NEIGHBOUR's marker.
        const rowElement = target?.closest('[data-file-item-file-src]');
        if (!(rowElement instanceof HTMLElement)) {
            return;
        }
        // check is audio playing
        const audioElement = rowElement.querySelector('audio');
        if (audioElement && !audioElement.paused) {
            showAudioPlayingToast();
            return;
        }
        const childElement = rowElement.querySelector('[data-file-path]');
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
    // No `autoPlayPrefix`: this tab plays a track, it does not advance one, so
    // its rail is the session chips alone.
    const session = useBackgroundSessions({
        target: 'background-audio',
        dirSourceSettingName: dirSourceSettingNames.BACKGROUND_AUDIO,
        // Switching session remounts the list, and an `<audio>` that is
        // unmounted stops -- the very hazard this tab already refuses to be
        // CLOSED for. Said in a toast rather than by greying the chips out: a
        // control that stops working with no explanation reads as a broken
        // app, and the track is usually about to end anyway.
        checkCanChangeSession: () => {
            if (!checkAudioPlaying()) {
                return true;
            }
            showSimpleToast(
                tran('Audio playing'),
                tran('Please stop the audio before switching session.'),
            );
            return false;
        },
    });
    const mainElement = (
        <BackgroundMediaComp
            // Keyed by session so switching re-reads that session's own folder
            // instead of keeping the last one's list on screen.
            key={session.activeId}
            topBarChild={session.element}
            rendChild={genAudioBodyChild.bind(null, activeMap)}
            defaultFolderName={defaultDataDirNames.BACKGROUND_AUDIO}
            dragType={DragTypeEnum.BACKGROUND_AUDIO}
            extraMimetypeNames={['video']}
            onClick={handleItemClicking}
            dirSourceSettingName={session.dirSourceSettingName}
            isNameOnTop={true}
            // ONE track per row. An activated row grows a real
            // `<audio controls>`, and Chromium strips the scrubber, the clock
            // and the volume out of a narrow one -- which is what a second
            // column left behind.
            isSingleColumn
            genContextMenuItems={genAudioDownloadContextMenuItems}
            shouldHideFooter
            // An activated row grows an `<audio controls>`, so these rows are
            // not all one height -- and unmounting one while it plays would
            // stop the sound.
            isVirtualizationEnabled={false}
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
                    ...toWidgetLabel('Background'),
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
                    ...toWidgetLabel('Background Audio'),
                },
            ]}
        />
    );
}
