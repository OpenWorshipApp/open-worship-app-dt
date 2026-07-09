import { useCallback, useState } from 'react';

import { tran } from '../../lang/langHelpers';
import {
    handleAudioPlaying,
    handleAudioPausing,
    handleAudioEnding,
} from '../../helper/audioControlHelpers';
import { useScreenManagerContext } from '../managers/screenManagerHooks';
import { useAppCurrentRef } from '../../helper/appHooks';

export default function MiniScreenAudioHandlersComp({
    src,
    videoId,
}: Readonly<{
    src: string;
    videoId: string;
}>) {
    const screenManager = useScreenManagerContext();
    const [isRepeating, setIsRepeating] = useState(true);
    const decodeSrc = decodeURIComponent(src);
    const fileFullName = decodeSrc.split('/').pop() || decodeSrc;
    const screenManagerRef = useAppCurrentRef(screenManager);
    const videoIdRef = useAppCurrentRef(videoId);
    const handleTimeUpdate = useCallback((event: any) => {
        const { screenBackgroundManager } = screenManagerRef.current;
        screenBackgroundManager.setBackgroundVideoCurrentTimeForce(
            videoIdRef.current,
            event.currentTarget.currentTime,
            false,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isRepeatingRef = useAppCurrentRef(isRepeating);
    const handleToggleRepeating = useCallback(() => {
        setIsRepeating(!isRepeatingRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="w-100">
            <hr className="w-100" />
            <div className="w-100 app-ellipsis-left overflow-hidden">
                {fileFullName}
            </div>
            <div className="d-flex align-items-center w-100 my-2">
                <audio
                    className="flex-fill"
                    data-video-id={videoId}
                    controls
                    onPlay={handleAudioPlaying}
                    onPause={handleAudioPausing}
                    onEnded={handleAudioEnding.bind(null, isRepeating)}
                    onTimeUpdate={handleTimeUpdate}
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
                        onClick={handleToggleRepeating}
                    />
                </div>
            </div>
        </div>
    );
}
