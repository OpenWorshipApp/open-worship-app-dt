import { describe, expect, test } from 'vitest';

import {
    toIsStayAwake,
    toStayAwakeTimerDelay,
    toStayAwakeUntil,
    toStayAwakeValueForMinutes,
} from './stayAwakeProtocol';

const NOW = 1_800_000_000_000;

describe('stayAwakeProtocol', () => {
    test('on until switched off: anything but false or a timed choice', () => {
        expect(toIsStayAwake(null, NOW)).toBe(true);
        expect(toIsStayAwake('true', NOW)).toBe(true);
        expect(toIsStayAwake('', NOW)).toBe(true);
        expect(toIsStayAwake('soon', NOW)).toBe(true);
        expect(toIsStayAwake('false', NOW)).toBe(false);
    });

    test('a timed choice is on until its moment and off from then', () => {
        expect(toIsStayAwake(`${NOW + 1}`, NOW)).toBe(true);
        expect(toIsStayAwake(`${NOW}`, NOW)).toBe(false);
        expect(toIsStayAwake(`${NOW - 60_000}`, NOW)).toBe(false);
    });

    test('only digits are read as a moment', () => {
        expect(toStayAwakeUntil(`${NOW}`)).toBe(NOW);
        expect(toStayAwakeUntil(null)).toBeNull();
        expect(toStayAwakeUntil('true')).toBeNull();
        expect(toStayAwakeUntil('false')).toBeNull();
        expect(toStayAwakeUntil('')).toBeNull();
        expect(toStayAwakeUntil('-5')).toBeNull();
        expect(toStayAwakeUntil('1.5')).toBeNull();
        expect(toStayAwakeUntil(' 15')).toBeNull();
    });

    test('a length of time is written as the moment it ends', () => {
        const value = toStayAwakeValueForMinutes(30, NOW);
        expect(value).toBe(`${NOW + 30 * 60_000}`);
        expect(toStayAwakeUntil(value)).toBe(NOW + 1_800_000);
        expect(toIsStayAwake(value, NOW + 1_799_999)).toBe(true);
        expect(toIsStayAwake(value, NOW + 1_800_000)).toBe(false);
    });

    test('a timer waits until the moment, never below 0 or past what it holds', () => {
        expect(toStayAwakeTimerDelay(NOW + 5000, NOW)).toBe(5000);
        expect(toStayAwakeTimerDelay(NOW - 5000, NOW)).toBe(0);
        expect(toStayAwakeTimerDelay(NOW + 100 * 86_400_000, NOW)).toBe(
            2 ** 31 - 1,
        );
    });
});
