import { useCallback, useRef, useState } from 'react';

import { tran } from '../../lang/langHelpers';
import {
    handleAudioPlaying,
    handleAudioPausing,
    handleAudioEnding,
} from '../../helper/mediaControlHelpers';
import {
    useScreenManagerContext,
    useScreenManagerEvents,
} from '../managers/screenManagerHooks';
import { useAppCurrentRef, useAppEffect } from '../../helper/appHooks';
import { checkIsSoundHere } from '../screenSoundHelpers';
import { pressElementLikeButton } from '../../helper/helpers';

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
    const audioRef = useRef<HTMLAudioElement>(null);
    // A screen on a virtual display plays this sound on its own page (it is
    // what the display streams): this copy stays silent and tells the page
    // whether it is playing and how loud.
    const sendSound = useCallback(() => {
        const audio = audioRef.current;
        const manager = screenManagerRef.current;
        if (audio === null || checkIsSoundHere(manager)) {
            return;
        }
        if (!audio.muted) {
            audio.muted = true;
        }
        manager.screenBackgroundManager.sendSyncVideoSound(
            videoIdRef.current,
            !audio.paused,
            audio.volume,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useScreenManagerEvents(['display-id'], screenManager);
    const isSoundHere = checkIsSoundHere(screenManager);
    useAppEffect(() => {
        const audio = audioRef.current;
        if (audio === null) {
            return;
        }
        audio.muted = !isSoundHere;
        if (!isSoundHere) {
            sendSound();
        }
    }, [isSoundHere]);
    const handleTimeUpdate = useCallback((event: any) => {
        const { screenBackgroundManager } = screenManagerRef.current;
        screenBackgroundManager.setBackgroundVideoCurrentTimeForce(
            videoIdRef.current,
            event.currentTarget.currentTime,
            false,
        );
        // A page that loads mid-song learns it from the next tick.
        sendSound();
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
                <bdi>{fileFullName}</bdi>
            </div>
            <div className="d-flex align-items-center w-100 my-2">
                <audio
                    ref={audioRef}
                    className="flex-fill"
                    data-video-id={videoId}
                    controls
                    onPlay={(event) => {
                        handleAudioPlaying(event);
                        sendSound();
                    }}
                    onPause={(event) => {
                        handleAudioPausing(event);
                        sendSound();
                    }}
                    onEnded={handleAudioEnding.bind(null, isRepeating)}
                    onTimeUpdate={handleTimeUpdate}
                    onVolumeChange={sendSound}
                >
                    <source src={src} />
                    <track kind="captions" />
                    {tran('Browser does not support audio.')}
                </audio>
                <div>
                    {/* The name carries the track, because the Background
                        Audio panel has a control with this same title and
                        "Repeat this audio" twice over tells neither a person
                        nor anything matching by words which one it means. */}
                    <i
                        className="bi bi-repeat-1 p-1"
                        role="button"
                        tabIndex={0}
                        title={`${tran('Repeat this audio')}: ${fileFullName}`}
                        aria-label={`${tran('Repeat this audio')}: ${fileFullName}`}
                        aria-pressed={isRepeating}
                        style={{
                            fontSize: '1.5rem',
                            opacity: isRepeating ? 1 : 0.5,
                            color: isRepeating ? 'green' : 'inherit',
                        }}
                        onClick={handleToggleRepeating}
                        onKeyDown={pressElementLikeButton}
                    />
                </div>
            </div>
        </div>
    );
}
