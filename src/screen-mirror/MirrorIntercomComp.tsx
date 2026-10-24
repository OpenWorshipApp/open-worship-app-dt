import { useMemo, useState } from 'react';

import { useAppEffect } from '../helper/appHooks';

import { tran } from '../lang/langHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import type { MirrorIntercomState } from '../../electron/screenMirrorProtocol';

export type IntercomChangeType = {
    mic?: boolean;
    speaker?: boolean;
    volume?: number;
};

// One connection's talk-back: this computer's microphone to the other side,
// the other side's microphone on this computer's speaker (with its volume),
// and -- where it applies -- whether this computer's cameras are offered.
// Each side controls only its own microphone and speaker; the other side's
// microphone being on is shown on the speaker.
export default function MirrorIntercomComp({
    intercom,
    busy,
    onChange,
    camera,
    isSpeakerShown = true,
}: Readonly<{
    intercom: MirrorIntercomState;
    busy: boolean;
    onChange: (change: IntercomChangeType) => Promise<unknown> | void;
    camera?: { isShared: boolean; onToggle: () => void };
    // A media player cannot answer: no speaker for it.
    isSpeakerShown?: boolean;
}>) {
    // The value being dragged, kept until the state says the new volume --
    // dropped earlier, the slider jumps back on the way.
    const [volume, setVolume] = useState<number | null>(null);
    useAppEffect(() => {
        setVolume(null);
    }, [intercom.volume]);
    // A drag sends one volume a moment after it stops, not one a pixel.
    const attemptVolume = useMemo(() => genTimeoutAttempt(150), []);
    const shownVolume = Math.round((volume ?? intercom.volume) * 100);
    return (
        <div className="app-mirror-intercom d-flex align-items-center gap-1 flex-wrap">
            <button
                type="button"
                className={`btn btn-sm ${
                    intercom.mic ? 'btn-danger' : 'btn-outline-secondary'
                }`}
                aria-pressed={intercom.mic}
                title={
                    intercom.mic
                        ? tran('Stop sending my microphone')
                        : tran('Send my microphone')
                }
                aria-label={tran('Send my microphone')}
                disabled={busy}
                onClick={() => {
                    void onChange({ mic: !intercom.mic });
                }}
            >
                <i
                    className={`bi ${intercom.mic ? 'bi-mic-fill' : 'bi-mic-mute'}`}
                    aria-hidden
                />
            </button>
            {isSpeakerShown ? (
                <>
                    <button
                        type="button"
                        className={`btn btn-sm position-relative ${
                            intercom.speaker
                                ? 'btn-primary'
                                : 'btn-outline-secondary'
                        }`}
                        aria-pressed={intercom.speaker}
                        title={
                            intercom.remoteMic
                                ? tran('Their microphone is on')
                                : tran('Play their microphone')
                        }
                        aria-label={tran('Play their microphone')}
                        disabled={busy}
                        onClick={() => {
                            void onChange({ speaker: !intercom.speaker });
                        }}
                    >
                        <i
                            className={`bi ${
                                intercom.speaker
                                    ? 'bi-volume-up-fill'
                                    : 'bi-volume-mute'
                            }`}
                            aria-hidden
                        />
                        {intercom.remoteMic ? (
                            <span
                                className="position-absolute top-0 start-100 translate-middle p-1 bg-success rounded-circle"
                                aria-hidden
                            />
                        ) : null}
                    </button>
                    {intercom.speaker ? (
                        <input
                            type="range"
                            className="form-range app-mirror-intercom-volume"
                            min={0}
                            max={100}
                            step={1}
                            value={shownVolume}
                            aria-label={tran('Speaker volume')}
                            title={`${shownVolume}%`}
                            onChange={(event) => {
                                const value = Number(event.target.value) / 100;
                                setVolume(value);
                                attemptVolume(() => {
                                    void onChange({ volume: value });
                                });
                            }}
                        />
                    ) : null}
                </>
            ) : null}
            {camera !== undefined ? (
                <button
                    type="button"
                    className={`btn btn-sm ${
                        camera.isShared
                            ? 'btn-primary'
                            : 'btn-outline-secondary'
                    }`}
                    aria-pressed={camera.isShared}
                    title={
                        camera.isShared
                            ? tran('Stop sharing my cameras')
                            : tran('Share my cameras')
                    }
                    aria-label={tran('Share my cameras')}
                    disabled={busy}
                    onClick={camera.onToggle}
                >
                    <i
                        className={`bi ${
                            camera.isShared
                                ? 'bi-camera-video-fill'
                                : 'bi-camera-video-off'
                        }`}
                        aria-hidden
                    />
                </button>
            ) : null}
        </div>
    );
}
