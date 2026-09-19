import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { sanitizeCssValue, sanitizeHtml } from './sanitizeHelpers';
import { genTimeoutAttempt } from './timeoutHelpers';

describe('sanitizeHelpers', () => {
    test('sanitizeHtml returns the original markup', () => {
        const dirty = '<div onclick="alert(1)">Hello</div>';

        expect(sanitizeHtml(dirty)).toBe(dirty);
    });

    test('sanitizeCssValue strips CSS-breaking characters', () => {
        expect(sanitizeCssValue('10px; color:{red} "x" \\<tag>')).toBe(
            '10px color:red x tag',
        );
    });
});

describe('timeoutHelpers', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('runs the callback after the timeout when scheduled normally', () => {
        const callback = vi.fn();
        const attempt = genTimeoutAttempt(1000);

        attempt(callback);
        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(999);
        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('debounces older scheduled callbacks', () => {
        const first = vi.fn();
        const second = vi.fn();
        const attempt = genTimeoutAttempt(1000);

        attempt(first);
        vi.advanceTimersByTime(250);
        attempt(second);
        vi.advanceTimersByTime(1000);

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    test('runs immediately when requested', () => {
        const callback = vi.fn();
        const attempt = genTimeoutAttempt(1000);

        attempt(callback, true);

        expect(callback).toHaveBeenCalledTimes(1);
        vi.runAllTimers();
        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('can bypass waiting when enough time has elapsed', () => {
        const immediate = vi.fn();
        const delayed = vi.fn();
        const attempt = genTimeoutAttempt(1000, false);

        attempt(immediate);
        expect(immediate).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(500);
        attempt(delayed);
        expect(delayed).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);
        expect(delayed).toHaveBeenCalledTimes(1);
    });
});
