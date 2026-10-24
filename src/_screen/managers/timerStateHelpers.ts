import { checkAreObjectsEqual } from '../../server/comparisonHelpers';
import type {
    ForegroundCountdownDataType,
    ForegroundStopwatchDataType,
} from '../screenTypeHelpers';

/**
 * The Start / Pause / Resume / Reset rules of the countdown and the stopwatch,
 * worked out in ONE place for every reader: the screen's own clocks
 * (`CountdownController`, `StopwatchController`), the panels' control row, a
 * run-sheet row replayed onto a screen and the assistant.
 *
 * The state lives in the screen DATUM, never in a window: the screen window
 * and every mini preview draw the same clock from the same saved datum, so a
 * pause pressed in the presenter has to be something all of them read.
 *
 * - running: no `pausedMillisecond`, and `dateTime` is the moment that moves
 *   the reading -- the zero a countdown reaches, the zero a stopwatch counts
 *   from.
 * - stopped (shown but not started, or paused): `pausedMillisecond` is the
 *   reading itself, and nothing ticks at all.
 *
 * Only a DURATION countdown (`durationMillisecond`) has controls; one to a
 * date & time always runs -- pausing "until 10:30" would move 10:30. A datum
 * saved before any of this carries no `pausedMillisecond` and so reads as
 * running, which is what it was.
 */
export type TimerStateType = 'fixed' | 'not-started' | 'running' | 'paused';

type TimerTimingType = {
    dateTime: Date;
    pausedMillisecond?: number;
};
type CountdownTimingType = TimerTimingType &
    Pick<ForegroundCountdownDataType, 'durationMillisecond'>;
type StopwatchTimingType = TimerTimingType &
    Pick<ForegroundStopwatchDataType, 'dateTime'>;

export function checkIsTimerStopped(data: TimerTimingType) {
    return typeof data.pausedMillisecond === 'number';
}

function checkIsValidDate(dateTime: unknown) {
    return dateTime instanceof Date && Number.isFinite(dateTime.getTime());
}

function withoutPause<T extends TimerTimingType>(data: T): T {
    const newData = { ...data };
    delete newData.pausedMillisecond;
    return newData;
}

/**
 * Whether two data are the SAME clock with only its timing moved -- a start,
 * a pause, a resume, a reset. Such a change is applied to the clock already
 * on the screen (`ScreenForegroundManager.compareAndRender`) rather than by
 * taking it down and putting a new one up, which would fade it out and back
 * in on the wall at every press.
 */
export function checkIsSameTimerExceptTiming(oldData: object, newData: object) {
    const toRest = (data: object) => {
        const rest: Record<string, unknown> = { ...data };
        delete rest.dateTime;
        delete rest.pausedMillisecond;
        return rest;
    };
    return checkAreObjectsEqual(toRest(oldData), toRest(newData));
}

/** `01:02:03` -- the digits as the screen shows them, with no sign. */
export function toTimerClockText(totalSecond: number) {
    const second = Math.max(0, Math.floor(totalSecond));
    return [
        Math.floor(second / 3600),
        Math.floor((second % 3600) / 60),
        second % 60,
    ]
        .map((value) => {
            return value.toString().padStart(2, '0');
        })
        .join(':');
}

// ---------------------------------------------------------------- countdown

/** What a countdown reads now, in milliseconds; negative once it is over. */
export function toCountdownRemainingMillisecond(
    data: TimerTimingType,
    now = Date.now(),
) {
    if (checkIsTimerStopped(data)) {
        return data.pausedMillisecond as number;
    }
    return data.dateTime.getTime() - now;
}

export function getCountdownState(data: CountdownTimingType): TimerStateType {
    if (typeof data.durationMillisecond !== 'number') {
        return 'fixed';
    }
    if (!checkIsTimerStopped(data)) {
        return 'running';
    }
    return data.pausedMillisecond === data.durationMillisecond
        ? 'not-started'
        : 'paused';
}

/**
 * The timing part of a new duration countdown: stopped on its full length,
 * or already running when `isAutoStart`.
 */
export function genCountdownTiming(
    durationSecond: number,
    isAutoStart: boolean,
    now = Date.now(),
): CountdownTimingType {
    const durationMillisecond = Math.max(0, Math.round(durationSecond)) * 1000;
    const timing: CountdownTimingType = {
        dateTime: new Date(now + durationMillisecond),
        durationMillisecond,
    };
    if (!isAutoStart) {
        timing.pausedMillisecond = durationMillisecond;
    }
    return timing;
}

/** Start a countdown not started yet, or resume a paused one. */
export function toStartedCountdownData<T extends CountdownTimingType>(
    data: T,
    now = Date.now(),
): T {
    if (!checkIsTimerStopped(data)) {
        return data;
    }
    return {
        ...withoutPause(data),
        dateTime: new Date(now + (data.pausedMillisecond as number)),
    };
}

export function toPausedCountdownData<T extends CountdownTimingType>(
    data: T,
    now = Date.now(),
): T {
    if (checkIsTimerStopped(data)) {
        return data;
    }
    return {
        ...data,
        pausedMillisecond: toCountdownRemainingMillisecond(data, now),
    };
}

/** Back to the full length, stopped -- Start runs it again. */
export function toResetCountdownData<T extends CountdownTimingType>(
    data: T,
    now = Date.now(),
): T {
    if (typeof data.durationMillisecond !== 'number') {
        return data;
    }
    return {
        ...data,
        dateTime: new Date(now + data.durationMillisecond),
        pausedMillisecond: data.durationMillisecond,
    };
}

/**
 * The whole seconds a countdown shows, and whether it is over. Counting down
 * it rounds UP, so a five-minute countdown reads `00:05:00` for its whole
 * first second and `00:00:00` arrives exactly when the time is up; over, it
 * rounds DOWN, so that zero stays one second before `+00:00:01`.
 */
export function toCountdownShownSecond(remainingMillisecond: number) {
    if (remainingMillisecond > 0) {
        return {
            isOver: false,
            second: Math.ceil(remainingMillisecond / 1000),
        };
    }
    return {
        isOver: true,
        second: Math.floor(Math.abs(remainingMillisecond) / 1000),
    };
}

/**
 * How long until a RUNNING countdown's digits next read differently: down,
 * they change as the time left reaches a whole second; over, as the overtime
 * passes one.
 */
export function toCountdownMillisecondToNextChange(
    remainingMillisecond: number,
) {
    if (remainingMillisecond > 0) {
        return remainingMillisecond % 1000 || 1000;
    }
    return 1000 - (Math.abs(remainingMillisecond) % 1000);
}

/** The words the assistant is given: what the wall reads, not just "one". */
export function describeCountdown(data: CountdownTimingType, now = Date.now()) {
    const isValid = checkIsValidDate(data.dateTime);
    const remaining =
        checkIsTimerStopped(data) || isValid
            ? toCountdownRemainingMillisecond(data, now)
            : 0;
    const { isOver, second } = toCountdownShownSecond(remaining);
    const shown = `${isOver && second > 0 ? '+' : ''}${toTimerClockText(second)}`;
    switch (getCountdownState(data)) {
        case 'not-started':
            return `countdown of ${shown}, shown but not started`;
        case 'paused':
            return `countdown paused at ${shown}`;
        default: {
            if (!isValid) {
                return 'countdown';
            }
            const target = ` to ${data.dateTime.toLocaleTimeString()}`;
            return isOver
                ? `countdown${target} (time is up, now counting the time over)`
                : `countdown${target}`;
        }
    }
}

// ---------------------------------------------------------------- stopwatch

/** How long a stopwatch has counted, in milliseconds. */
export function toStopwatchElapsedMillisecond(
    data: StopwatchTimingType,
    now = Date.now(),
) {
    if (checkIsTimerStopped(data)) {
        return Math.max(0, data.pausedMillisecond as number);
    }
    return Math.max(0, now - data.dateTime.getTime());
}

export function getStopwatchState(data: StopwatchTimingType): TimerStateType {
    if (!checkIsTimerStopped(data)) {
        return 'running';
    }
    return data.pausedMillisecond === 0 ? 'not-started' : 'paused';
}

/** A new stopwatch: stopped on zero, or already running when `isAutoStart`. */
export function genStopwatchTiming(
    isAutoStart: boolean,
    now = Date.now(),
): StopwatchTimingType {
    const timing: StopwatchTimingType = { dateTime: new Date(now) };
    if (!isAutoStart) {
        timing.pausedMillisecond = 0;
    }
    return timing;
}

export function toStartedStopwatchData<T extends StopwatchTimingType>(
    data: T,
    now = Date.now(),
): T {
    if (!checkIsTimerStopped(data)) {
        return data;
    }
    return {
        ...withoutPause(data),
        dateTime: new Date(now - (data.pausedMillisecond as number)),
    };
}

export function toPausedStopwatchData<T extends StopwatchTimingType>(
    data: T,
    now = Date.now(),
): T {
    if (checkIsTimerStopped(data)) {
        return data;
    }
    return {
        ...data,
        pausedMillisecond: toStopwatchElapsedMillisecond(data, now),
    };
}

/** Back to zero, stopped -- Start runs it again. */
export function toResetStopwatchData<T extends StopwatchTimingType>(
    data: T,
    now = Date.now(),
): T {
    return { ...data, dateTime: new Date(now), pausedMillisecond: 0 };
}

/** How long until a RUNNING stopwatch's digits next read differently. */
export function toStopwatchMillisecondToNextChange(elapsedMillisecond: number) {
    return 1000 - (elapsedMillisecond % 1000);
}

export function describeStopwatch(data: StopwatchTimingType, now = Date.now()) {
    const state = getStopwatchState(data);
    if (state === 'running' && !checkIsValidDate(data.dateTime)) {
        return 'stopwatch';
    }
    const shown = toTimerClockText(
        Math.floor(toStopwatchElapsedMillisecond(data, now) / 1000),
    );
    switch (state) {
        case 'not-started':
            return 'stopwatch at 00:00:00, shown but not started';
        case 'paused':
            return `stopwatch paused at ${shown}`;
        default:
            return `stopwatch at ${shown}, running`;
    }
}
