import { useCallback, useId, type ChangeEvent } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import type { TimerStateType } from '../_screen/managers/timerStateHelpers';

/**
 * Whether the countdown or stopwatch starts counting the moment it is shown.
 * Off, it goes up stopped -- on its full length, or on zero -- and waits for
 * Start, so it can be put up ahead of time and started on the cue.
 */
export function ForegroundAutoStartSwitchComp({
    isAutoStart,
    setIsAutoStart,
}: Readonly<{
    isAutoStart: boolean;
    setIsAutoStart: (isAutoStart: boolean) => void;
}>) {
    const id = useId();
    const setIsAutoStartRef = useAppCurrentRef(setIsAutoStart);
    const handleChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setIsAutoStartRef.current(event.target.checked);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <label
            className="fg-field"
            htmlFor={id}
            title={tran('Start counting as soon as it is shown')}
        >
            <input
                className="form-check-input app-caught-hover-pointer mt-0"
                type="checkbox"
                role="switch"
                id={id}
                checked={isAutoStart}
                onChange={handleChange}
            />
            <span className="fg-field-name">{tran('Auto-start')}</span>
        </label>
    );
}

/**
 * Start / Pause / Resume / Reset for what THIS session has on the screens.
 * The screen itself shows no pause sign -- the audience sees only the digits
 * -- so the word beside the buttons is the one place that says which state
 * the clock is in.
 */
export default function ForegroundTimerControlsComp({
    state,
    resetTitle,
    onStart,
    onPause,
    onReset,
}: Readonly<{
    state: Exclude<TimerStateType, 'fixed'>;
    resetTitle: string;
    onStart: () => void;
    onPause: () => void;
    onReset: () => void;
}>) {
    const stateText =
        state === 'running'
            ? tran('Running')
            : state === 'paused'
              ? tran('Paused')
              : tran('Not started');
    const stateClassName =
        state === 'running'
            ? 'text-success'
            : state === 'paused'
              ? 'text-warning'
              : 'text-secondary';
    return (
        <div className="fg-actions">
            {state === 'running' ? (
                <button
                    type="button"
                    className="btn btn-warning"
                    title={tran('Pause counting')}
                    onClick={onPause}
                >
                    <i className="bi bi-pause-fill" /> {tran('Pause')}
                </button>
            ) : (
                <button
                    type="button"
                    className="btn btn-success"
                    title={
                        state === 'paused'
                            ? tran('Resume counting')
                            : tran('Start counting')
                    }
                    onClick={onStart}
                >
                    <i className="bi bi-play-fill" />{' '}
                    {state === 'paused' ? tran('Resume') : tran('Start')}
                </button>
            )}
            <button
                type="button"
                className="fg-quiet-btn"
                title={resetTitle}
                onClick={onReset}
                disabled={state === 'not-started'}
            >
                <i className="bi bi-arrow-counterclockwise" />
                <span>{tran('Reset')}</span>
            </button>
            <span className={`fg-field-name ${stateClassName}`}>
                {stateText}
            </span>
        </div>
    );
}
