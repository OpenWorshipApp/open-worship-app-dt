// @vitest-environment jsdom

import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import TimingController from './TimingController';

function createTimeContainer(isWithAmPm = false) {
    const container = document.createElement('div');
    container.innerHTML =
        '<div id="hour"></div><div id="minute"></div><div id="second"></div>' +
        (isWithAmPm ? '<div id="ampm"></div>' : '');
    return container;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-12T10:11:12.000Z'));
});

afterEach(() => {
    vi.useRealTimers();
});

test('formats time as 12 hour am/pm by default', () => {
    const timing = new TimingController(createTimeContainer(true), 12);

    expect(timing.hourStr).toBe('10');
    expect(timing.minuteStr).toBe('11');
    expect(timing.secondStr).toBe('12');
    expect(timing.divHour.textContent).toBe('10');
    expect(timing.divAmPm?.textContent).toBe('PM');
});

test('formats time as 24 hour when enabled', () => {
    const timing = new TimingController(createTimeContainer(), 12, true);

    expect(timing.hourStr).toBe('22');
    expect(timing.divHour.textContent).toBe('22');
    expect(timing.divAmPm).toBeNull();
});

test('formats time as 12 hour with am/pm period', () => {
    const pmTiming = new TimingController(createTimeContainer(true), 12, false);
    expect(pmTiming.hourStr).toBe('10');
    expect(pmTiming.periodStr).toBe('PM');
    expect(pmTiming.divAmPm?.textContent).toBe('PM');

    const midnightTiming = new TimingController(
        createTimeContainer(true),
        -10,
        false,
    );
    expect(midnightTiming.hourStr).toBe('12');
    expect(midnightTiming.periodStr).toBe('AM');

    const noonTiming = new TimingController(
        createTimeContainer(true),
        2,
        false,
    );
    expect(noonTiming.hourStr).toBe('12');
    expect(noonTiming.periodStr).toBe('PM');

    pmTiming.stop();
    expect(pmTiming.divAmPm?.textContent).toBe('');
});

test('ticks once a second on the second, never per animation frame, until paused', () => {
    const frameSpy = vi.spyOn(globalThis, 'requestAnimationFrame');
    const timing = new TimingController(createTimeContainer(), 12, true);
    timing.start();
    expect(timing.divSecond.textContent).toBe('12');
    // A second later, the digits moved by one; nothing asked for frames.
    vi.advanceTimersByTime(1_020);
    expect(timing.divSecond.textContent).toBe('13');
    vi.advanceTimersByTime(1_000);
    expect(timing.divSecond.textContent).toBe('14');
    expect(frameSpy).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    timing.pause();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5_000);
    expect(timing.divSecond.textContent).toBe('14');
    frameSpy.mockRestore();
});
