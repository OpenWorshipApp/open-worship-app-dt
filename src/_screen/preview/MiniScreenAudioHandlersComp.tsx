import { SyntheticEvent, useMemo, useState } from 'react';

import { tran } from '../../lang/langHelpers';
import {
    handleAudioPlaying,
    handleAudioPausing,
    handleAudioEnding,
} from '../../helper/audioControlHelpers';
import { useScreenManagerContext } from '../managers/screenManagerHooks';
import ScreenManager from '../managers/ScreenManager';
import type ScreenBackgroundManager from '../managers/ScreenBackgroundManager';

async function handleAudioTimeUpdating(
    videoID: string,
    screenManager: ScreenManager,
    event: SyntheticEvent<HTMLAudioElement>,
) {
    const audioElement = event.currentTarget;
    const currentTime = audioElement.currentTime;
    const groupScreenManagers =
        await ScreenManager.getGroupScreenManagers(screenManager);
    groupScreenManagers.push(screenManager);
    groupScreenManagers.forEach((screenManager: any) => {
        const screenBackgroundManager =
            screenManager.screenBackgroundManager as ScreenBackgroundManager;
        screenBackgroundManager.sendSyncVideoTime(videoID, audioElement, true);
        screenBackgroundManager.setVideoCurrentTime({
            videoID,
            videoTime: currentTime,
            timestamp: Date.now(),
            isFromAudio: true,
        });
    });
}

export default function MiniScreenAudioHandlersComp({
    src,
    videoID,
}: Readonly<{
    src: string;
    videoID: string;
}>) {
    const screenManager = useScreenManagerContext();
    const [isRepeating, setIsRepeating] = useState(true);
    const fileFullName = useMemo(() => {
        const decodeSrc = decodeURIComponent(src);
        return decodeSrc.split('/').pop() || decodeSrc;
    }, [src]);
    return (
        <div className="w-100">
            <hr className="w-100" />
            <div className="w-100 app-ellipsis-left overflow-hidden">
                {fileFullName}
            </div>
            <div className="d-flex align-items-center w-100 my-2">
                <audio
                    className="flex-fill"
                    data-video-id={videoID}
                    controls
                    onPlay={handleAudioPlaying}
                    onPause={handleAudioPausing}
                    onEnded={handleAudioEnding.bind(null, isRepeating)}
                    onTimeUpdate={handleAudioTimeUpdating.bind(
                        null,
                        videoID,
                        screenManager,
                    )}
                >
                    <source src={src} />
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
