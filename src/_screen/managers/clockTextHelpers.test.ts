// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';

import { setClockDataset, setClockText } from './clockTextHelpers';
import CountdownController from './CountdownController';
import StopwatchController from './StopwatchController';
import {
    genCountdownTiming,
    genStopwatchTiming,
    toPausedCountdownData,
    toPausedStopwatchData,
    toResetCountdownData,
    toResetStopwatchData,
    toStartedCountdownData,
    toStartedStopwatchData,
} from './timerStateHelpers';

describe('setClockText', () => {
    test('leaves an unchanged digit group untouched and writes a changed one', () => {
        const div = document.createElement('div');
        const textNode = document.createTextNode('05');
        div.appendChild(textNode);

        setClockText(div, '05');
        // The same node: nothing was replaced, so nothing re-laid out.
        expect(div.firstChild).toBe(textNode);

        setClockText(div, '04');
        expect(div.textContent).toBe('04');
        expect(div.firstChild).not.toBe(textNode);
    });

    test('tolerates a group the widget does not have', () => {
        expect(() => {
            setClockText(null, 'PM');
        }).not.toThrow();
    });
});

describe('setClockDataset', () => {
    test('writes the attribute only when its value changes', () => {
        const div = document.createElement('div');
        const records: MutationRecord[] = [];
        const observer = new MutationObserver((list) => {
            records.push(...list);
        });
        observer.observe(div, { attributes: true });

        setClockDataset(div, 'timeDiff', '3');
        setClockDataset(div, 'timeDiff', '3');
        setClockDataset(div, 'timeDiff', '2');
        records.push(...observer.takeRecords());
        observer.disconnect();

        expect(div.dataset.timeDiff).toBe('2');
        expect(records).toHaveLength(2);
    });
});

// Attached, and one at a time: jsdom's selector engine hangs on the
// controller's child-combinator query against a detached node, and two
// attached containers would share the `#hour`/`#minute`/`#second` ids (see
// `screenInfrastructure.test.tsx`).
function genAttachedContainer() {
    document.body.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'foreground-countdown-container';
    container.innerHTML =
        '<div><span id="sign"></span><div id="hour"></div>' +
        '<div id="minute"></div><div id="second"></div></div>';
    document.body.appendChild(container);
    return container;
}

function readClock(controller: CountdownController | StopwatchController) {
    const sign =
        controller instanceof CountdownController
            ? (controller.divSign?.textContent ?? '')
            : '';
    return (
        sign +
        [
            controller.divHour.textContent,
            controller.divMinute.textContent,
            controller.divSecond.textContent,
        ].join(':')
    );
}

describe('CountdownController', () => {
    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    test('marks the box in whole seconds and "0" once the time is up', () => {
        const running = CountdownController.init(
            genAttachedContainer(),
            new Date(Date.now() + 90_500),
        );
        expect(running.divBox.dataset.timeDiff).toBe('91');
        // Rounded UP while counting down.
        expect(readClock(running)).toBe('00:01:31');

        const done = CountdownController.init(
            genAttachedContainer(),
            new Date(Date.now() - 1000),
        );
        expect(done.divBox.dataset.timeDiff).toBe('0');
    });

    test('counts the time over behind a "+" once the target has passed', () => {
        const over = CountdownController.init(
            genAttachedContainer(),
            new Date(Date.now() - 83_500),
        );
        // Rounded DOWN once over.
        expect(readClock(over)).toBe('+00:01:23');
        expect(over.divBox.dataset.timeDiff).toBe('0');

        over.stop();
        expect(readClock(over)).toBe('00:00:00');
    });

    test('ticks on the second, through zero into the overtime, until disposed', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-03T10:00:00.000Z'));
        const controller = CountdownController.init(
            genAttachedContainer(),
            new Date(Date.now() + 2_000),
        );
        controller.start();
        expect(readClock(controller)).toBe('00:00:02');
        // Each tick lands 20 ms past the boundary it waits for.
        vi.advanceTimersByTime(1_020);
        expect(readClock(controller)).toBe('00:00:01');
        expect(controller.divBox.dataset.timeDiff).toBe('1');
        // Zero arrives exactly when the time is up, flashing, with no sign...
        vi.advanceTimersByTime(1_000);
        expect(readClock(controller)).toBe('00:00:00');
        expect(controller.divBox.dataset.timeDiff).toBe('0');
        // ...and stays one second before the first second over.
        vi.advanceTimersByTime(1_000);
        expect(readClock(controller)).toBe('+00:00:01');
        vi.advanceTimersByTime(1_000);
        expect(readClock(controller)).toBe('+00:00:02');
        vi.advanceTimersByTime(60_000);
        expect(readClock(controller)).toBe('+00:01:02');
        expect(controller.divBox.dataset.timeDiff).toBe('0');
        // One timer at a time, never a pile of them.
        expect(vi.getTimerCount()).toBe(1);

        controller.dispose();
        vi.advanceTimersByTime(5_000);
        expect(readClock(controller)).toBe('+00:01:02');
        expect(vi.getTimerCount()).toBe(0);
    });

    test('shown not started, it reads its full length and does not tick', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-03T10:00:00.000Z'));
        const data = genCountdownTiming(300, false);
        const controller = CountdownController.init(
            genAttachedContainer(),
            data,
        );
        controller.start();
        expect(readClock(controller)).toBe('00:05:00');
        expect(vi.getTimerCount()).toBe(0);
        vi.advanceTimersByTime(10_000);
        expect(readClock(controller)).toBe('00:05:00');

        // Start, pause and reset are applied to the clock already up.
        const started = toStartedCountdownData(data);
        controller.update(started);
        expect(readClock(controller)).toBe('00:05:00');
        vi.advanceTimersByTime(1_020);
        expect(readClock(controller)).toBe('00:04:59');

        vi.advanceTimersByTime(2_000);
        const paused = toPausedCountdownData(started);
        controller.update(paused);
        expect(readClock(controller)).toBe('00:04:57');
        expect(vi.getTimerCount()).toBe(0);
        vi.advanceTimersByTime(30_000);
        expect(readClock(controller)).toBe('00:04:57');

        controller.update(toStartedCountdownData(paused));
        vi.advanceTimersByTime(1_000);
        expect(readClock(controller)).toBe('00:04:56');

        controller.update(toResetCountdownData(controller.timing));
        expect(readClock(controller)).toBe('00:05:00');
        expect(vi.getTimerCount()).toBe(0);
    });

    test('a pause in the overtime holds the overtime', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-03T10:00:00.000Z'));
        const running = toStartedCountdownData(genCountdownTiming(1, false));
        const controller = CountdownController.init(
            genAttachedContainer(),
            running,
        );
        controller.start();
        vi.advanceTimersByTime(4_500);
        expect(readClock(controller)).toBe('+00:00:03');
        controller.update(toPausedCountdownData(running));
        vi.advanceTimersByTime(10_000);
        expect(readClock(controller)).toBe('+00:00:03');
        expect(controller.divBox.dataset.timeDiff).toBe('0');
    });

    test('shows zeros and never ticks for an unreadable target', () => {
        vi.useFakeTimers();
        const controller = CountdownController.init(
            genAttachedContainer(),
            new Date('not a date'),
        );
        controller.start();
        expect(readClock(controller)).toBe('00:00:00');
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('StopwatchController', () => {
    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    test('counts up on the second, and stops, resumes and resets in place', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-03T10:00:00.000Z'));
        const data = genStopwatchTiming(false);
        const controller = StopwatchController.init(
            genAttachedContainer(),
            data,
        );
        controller.start();
        expect(readClock(controller)).toBe('00:00:00');
        expect(vi.getTimerCount()).toBe(0);

        const started = toStartedStopwatchData(data);
        controller.update(started);
        vi.advanceTimersByTime(61_020);
        expect(readClock(controller)).toBe('00:01:01');
        expect(vi.getTimerCount()).toBe(1);

        const paused = toPausedStopwatchData(started);
        controller.update(paused);
        vi.advanceTimersByTime(10_000);
        expect(readClock(controller)).toBe('00:01:01');
        expect(vi.getTimerCount()).toBe(0);

        controller.update(toStartedStopwatchData(paused));
        vi.advanceTimersByTime(1_000);
        expect(readClock(controller)).toBe('00:01:02');

        controller.update(toResetStopwatchData(controller.timing));
        expect(readClock(controller)).toBe('00:00:00');
        expect(vi.getTimerCount()).toBe(0);
    });

    test('a stopwatch saved before pausing existed runs from its date', () => {
        const controller = StopwatchController.init(
            genAttachedContainer(),
            new Date(Date.now() - 3_725_400),
        );
        expect(readClock(controller)).toBe('01:02:05');
    });
});
