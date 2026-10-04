import { describe, expect, test } from 'vitest';

import {
    checkIsSameTimerExceptTiming,
    describeCountdown,
    describeStopwatch,
    genCountdownTiming,
    genStopwatchTiming,
    getCountdownState,
    getStopwatchState,
    toCountdownMillisecondToNextChange,
    toCountdownShownSecond,
    toPausedCountdownData,
    toPausedStopwatchData,
    toResetCountdownData,
    toResetStopwatchData,
    toStartedCountdownData,
    toStartedStopwatchData,
    toTimerClockText,
} from './timerStateHelpers';

const NOW = new Date('2026-10-04T10:00:00.000Z').getTime();

describe('countdown state', () => {
    test('goes up stopped on its full length unless it auto-starts', () => {
        const stopped = genCountdownTiming(90, false, NOW);
        expect(stopped).toEqual({
            dateTime: new Date(NOW + 90_000),
            durationMillisecond: 90_000,
            pausedMillisecond: 90_000,
        });
        expect(getCountdownState(stopped)).toBe('not-started');

        const running = genCountdownTiming(90, true, NOW);
        expect(running.pausedMillisecond).toBeUndefined();
        expect(getCountdownState(running)).toBe('running');
    });

    test('a countdown to a date & time has no controls', () => {
        expect(getCountdownState({ dateTime: new Date(NOW) })).toBe('fixed');
        const fixed = { dateTime: new Date(NOW + 5_000) };
        expect(toResetCountdownData(fixed, NOW)).toBe(fixed);
    });

    test('start, pause, resume and reset keep the reading where it was', () => {
        const stopped = genCountdownTiming(60, false, NOW);
        const started = toStartedCountdownData(stopped, NOW + 10_000);
        expect(started.dateTime).toEqual(new Date(NOW + 70_000));
        expect('pausedMillisecond' in started).toBe(false);

        const paused = toPausedCountdownData(started, NOW + 25_000);
        expect(paused.pausedMillisecond).toBe(45_000);
        expect(getCountdownState(paused)).toBe('paused');

        const resumed = toStartedCountdownData(paused, NOW + 100_000);
        expect(resumed.dateTime).toEqual(new Date(NOW + 145_000));

        const reset = toResetCountdownData(resumed, NOW + 120_000);
        expect(reset.pausedMillisecond).toBe(60_000);
        expect(getCountdownState(reset)).toBe('not-started');

        // A press that does not apply hands the same datum back.
        expect(toPausedCountdownData(paused, NOW)).toBe(paused);
        expect(toStartedCountdownData(started, NOW)).toBe(started);
    });

    test('a pause in the overtime holds a negative reading', () => {
        const started = toStartedCountdownData(
            genCountdownTiming(5, false, NOW),
            NOW,
        );
        expect(
            toPausedCountdownData(started, NOW + 8_000).pausedMillisecond,
        ).toBe(-3_000);
    });

    test('rounds up while counting down and down once over', () => {
        expect(toCountdownShownSecond(300_000)).toEqual({
            isOver: false,
            second: 300,
        });
        expect(toCountdownShownSecond(299_001)).toEqual({
            isOver: false,
            second: 300,
        });
        expect(toCountdownShownSecond(1)).toEqual({ isOver: false, second: 1 });
        expect(toCountdownShownSecond(0)).toEqual({ isOver: true, second: 0 });
        expect(toCountdownShownSecond(-999)).toEqual({
            isOver: true,
            second: 0,
        });
        expect(toCountdownShownSecond(-1_000)).toEqual({
            isOver: true,
            second: 1,
        });
    });

    test('waits exactly until the shown second changes', () => {
        expect(toCountdownMillisecondToNextChange(5_000)).toBe(1_000);
        expect(toCountdownMillisecondToNextChange(4_500)).toBe(500);
        expect(toCountdownMillisecondToNextChange(0)).toBe(1_000);
        expect(toCountdownMillisecondToNextChange(-250)).toBe(750);
    });

    test('says what the wall reads', () => {
        expect(
            describeCountdown(genCountdownTiming(300, false, NOW), NOW),
        ).toBe('countdown of 00:05:00, shown but not started');
        const paused = toPausedCountdownData(
            toStartedCountdownData(genCountdownTiming(300, false, NOW), NOW),
            NOW + 108_000,
        );
        expect(describeCountdown(paused, NOW)).toBe(
            'countdown paused at 00:03:12',
        );
        const overPaused = { ...paused, pausedMillisecond: -83_000 };
        expect(describeCountdown(overPaused, NOW)).toBe(
            'countdown paused at +00:01:23',
        );
        const target = new Date(NOW - 60_000);
        expect(describeCountdown({ dateTime: target }, NOW)).toBe(
            `countdown to ${target.toLocaleTimeString()} ` +
                '(time is up, now counting the time over)',
        );
        expect(describeCountdown({ dateTime: new Date('x') }, NOW)).toBe(
            'countdown',
        );
    });
});

describe('stopwatch state', () => {
    test('goes up on zero unless it auto-starts, and keeps its reading', () => {
        const stopped = genStopwatchTiming(false, NOW);
        expect(getStopwatchState(stopped)).toBe('not-started');
        expect(getStopwatchState(genStopwatchTiming(true, NOW))).toBe(
            'running',
        );
        // A stopwatch saved before pausing existed is running.
        expect(getStopwatchState({ dateTime: new Date(NOW) })).toBe('running');

        const started = toStartedStopwatchData(stopped, NOW + 5_000);
        expect(started.dateTime).toEqual(new Date(NOW + 5_000));
        const paused = toPausedStopwatchData(started, NOW + 65_000);
        expect(paused.pausedMillisecond).toBe(60_000);
        expect(getStopwatchState(paused)).toBe('paused');
        const resumed = toStartedStopwatchData(paused, NOW + 100_000);
        expect(resumed.dateTime).toEqual(new Date(NOW + 40_000));
        const reset = toResetStopwatchData(resumed, NOW + 120_000);
        expect(reset.pausedMillisecond).toBe(0);
        expect(getStopwatchState(reset)).toBe('not-started');
    });

    test('says what the wall reads', () => {
        expect(describeStopwatch(genStopwatchTiming(false, NOW), NOW)).toBe(
            'stopwatch at 00:00:00, shown but not started',
        );
        expect(
            describeStopwatch(
                { dateTime: new Date(NOW), pausedMillisecond: 65_000 },
                NOW,
            ),
        ).toBe('stopwatch paused at 00:01:05');
        expect(
            describeStopwatch({ dateTime: new Date(NOW - 3_600_000) }, NOW),
        ).toBe('stopwatch at 01:00:00, running');
    });
});

describe('shared', () => {
    test('a timing-only change is the same clock; anything else is not', () => {
        const data = {
            id: 'a',
            extraStyle: { color: 'red' },
            ...genCountdownTiming(60, false, NOW),
        };
        expect(
            checkIsSameTimerExceptTiming(
                data,
                toStartedCountdownData(data, NOW),
            ),
        ).toBe(true);
        expect(
            checkIsSameTimerExceptTiming(data, {
                ...data,
                extraStyle: { color: 'blue' },
            }),
        ).toBe(false);
        expect(
            checkIsSameTimerExceptTiming(data, {
                ...data,
                durationMillisecond: 120_000,
            }),
        ).toBe(false);
        expect(
            checkIsSameTimerExceptTiming(data, { ...data, isBehind: true }),
        ).toBe(false);
    });

    test('writes the digits with no days dropped', () => {
        expect(toTimerClockText(0)).toBe('00:00:00');
        expect(toTimerClockText(3_725)).toBe('01:02:05');
        expect(toTimerClockText(-5)).toBe('00:00:00');
    });
});
