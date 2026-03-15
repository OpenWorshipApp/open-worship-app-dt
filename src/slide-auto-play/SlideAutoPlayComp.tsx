import './SlideAutoPlayComp.scss';

import { ChangeEvent, useCallback, type CSSProperties } from 'react';

import {
    useStateSettingBoolean,
    useStateSettingNumber,
} from '../helper/settingHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';

export type NextDataType = {
    isNext: boolean;
    isRandom: boolean;
    nextSeconds: number;
};

function PlayingIconComp({
    onNext,
    setIsPlaying,
    timerSeconds,
}: Readonly<{
    onNext: (data: NextDataType) => void;
    setIsPlaying: (isPlaying: boolean) => void;
    timerSeconds: number;
}>) {
    const handleStopPlaying = useCallback(() => {
        setIsPlaying(false);
    }, [setIsPlaying]);
    useAppEffect(() => {
        if (timerSeconds <= 0) {
            return;
        }
        const timerId = setInterval(() => {
            onNext({
                isNext: true,
                isRandom: false,
                nextSeconds: timerSeconds,
            });
        }, timerSeconds * 1000);
        return () => {
            clearInterval(timerId);
        };
    }, [onNext, timerSeconds]);
    return (
        <button className="btn btn-sm btn-primary" onClick={handleStopPlaying}>
            <i className="bi bi-pause-circle-fill" />
        </button>
    );
}

function PlayerComp({
    onNext,
    prefix,
    timerSeconds,
}: Readonly<{
    onNext: (data: NextDataType) => void;
    prefix: string;
    timerSeconds: number;
}>) {
    const [isPlaying, setIsPlaying] = useStateSettingBoolean(
        `${prefix}-slide-auto-play-playing`,
        false,
    );
    const handleStartPlaying = useCallback(() => {
        setIsPlaying(true);
    }, [setIsPlaying]);
    if (!isPlaying) {
        return (
            <button
                className="btn btn-sm btn-outline-primary"
                onClick={handleStartPlaying}
            >
                <i className="bi bi-play" />
            </button>
        );
    }
    return (
        <PlayingIconComp
            setIsPlaying={setIsPlaying}
            timerSeconds={timerSeconds}
            onNext={onNext}
        />
    );
}

export default function SlideAutoPlayComp({
    onNext,
    prefix,
    style,
}: Readonly<{
    onNext: (data: NextDataType) => void;
    prefix: string;
    style?: CSSProperties;
}>) {
    const [isShowing, setIsShowing] = useStateSettingBoolean(
        `${prefix}-slide-auto-play-show`,
        false,
    );
    const [timerSeconds, setTimerSeconds] = useStateSettingNumber(
        `${prefix}-slide-auto-play-timer-seconds`,
        5,
    );
    const handleShowAutoPlay = useCallback(() => {
        setIsShowing(true);
    }, [setIsShowing]);
    const handleHideAutoPlay = useCallback(() => {
        setIsShowing(false);
    }, [setIsShowing]);
    const handleTimerChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setTimerSeconds(
                Math.max(0, Number.parseInt(event.target.value) || 0),
            );
        },
        [setTimerSeconds],
    );
    if (!isShowing) {
        return (
            <i
                className={
                    'slide-auto-play-icon bi bi-stopwatch-fill' +
                    ' app-caught-hover-pointer'
                }
                onClick={handleShowAutoPlay}
                style={style}
            />
        );
    }
    return (
        <div
            className="slide-auto-play show d-flex align-items-center"
            style={style}
        >
            <div className="p-2">
                <i
                    className="bi bi-x-lg app-caught-hover-pointer"
                    style={{ color: 'red' }}
                    onClick={handleHideAutoPlay}
                />
            </div>
            <div className="mx-2">
                <PlayerComp
                    prefix={prefix}
                    timerSeconds={timerSeconds}
                    onNext={onNext}
                />
            </div>
            <div className="input-group" style={{ width: '120px' }}>
                <div className="input-group-text">M:</div>
                <input
                    className="form-control form-control-sm"
                    type="number"
                    value={timerSeconds}
                    onChange={handleTimerChange}
                    min="0"
                />
            </div>
        </div>
    );
}
