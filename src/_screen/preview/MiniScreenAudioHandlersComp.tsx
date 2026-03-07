import { useMemo, useState } from 'react';

import { tran } from '../../lang/langHelpers';
import {
    handleAudioPlaying,
    handleAudioPausing,
    handleAudioEnding,
} from '../../helper/audioControlHelpers';
import { useScreenManagerContext } from '../managers/screenManagerHooks';

export default function MiniScreenAudioHandlersComp({
    src,
    videoId,
}: Readonly<{
    src: string;
    videoId: string;
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
                    data-video-id={videoId}
                    controls
                    onPlay={handleAudioPlaying}
                    onPause={handleAudioPausing}
                    onEnded={handleAudioEnding.bind(null, isRepeating)}
                    onTimeUpdate={(event) => {
                        const { screenBackgroundManager } = screenManager;
                        screenBackgroundManager.setBackgroundVideoCurrentTimeForce(
                            videoId,
                            event.currentTarget.currentTime,
                            false,
                        );
                    }}
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
