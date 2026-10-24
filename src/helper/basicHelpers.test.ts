import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    sanitizeCssValue,
    escapeHtmlText,
    sanitizeHtml,
    sanitizeSlideHtml,
} from './sanitizeHelpers';
import { genThrottleAttempt, genTimeoutAttempt } from './timeoutHelpers';

describe('sanitizeHelpers', () => {
    test.each([sanitizeHtml, sanitizeSlideHtml])(
        'imports safely in Node but refuses HTML without a DOM: %s',
        (sanitize) => {
            expect(sanitize('')).toBe('');
            expect(() => sanitize('<img onerror="unsafe()">')).toThrow(
                'HTML sanitization requires a DOM',
            );
        },
    );

    test('escapes plain text before composing markup', () => {
        expect(escapeHtmlText('<b>"Text" & more</b>')).toBe(
            '&lt;b&gt;&quot;Text&quot; &amp; more&lt;/b&gt;',
        );
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

    test('a throttle runs the first call at once', () => {
        const callback = vi.fn();
        const attempt = genThrottleAttempt(80);

        attempt(callback);

        expect(callback).toHaveBeenCalledTimes(1);
        vi.runAllTimers();
        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('a throttle collapses a burst into its last call, run as the window closes', () => {
        const first = vi.fn();
        const second = vi.fn();
        const third = vi.fn();
        const attempt = genThrottleAttempt(80);

        attempt(first);
        vi.advanceTimersByTime(20);
        attempt(second);
        vi.advanceTimersByTime(20);
        attempt(third);
        expect(first).toHaveBeenCalledTimes(1);
        expect(third).not.toHaveBeenCalled();

        vi.advanceTimersByTime(40);
        expect(second).not.toHaveBeenCalled();
        expect(third).toHaveBeenCalledTimes(1);
    });

    test('a throttle keeps following a drag that outlasts one window', () => {
        const callback = vi.fn();
        const attempt = genThrottleAttempt(80);

        // A call every 16ms for half a second, as a slider fires them.
        for (let i = 0; i < 31; i++) {
            attempt(callback);
            vi.advanceTimersByTime(16);
        }
        vi.runAllTimers();

        // Once at the start, once per window after it: followed, not flooded.
        expect(callback.mock.calls.length).toBeGreaterThanOrEqual(6);
        expect(callback.mock.calls.length).toBeLessThanOrEqual(8);
    });

    test('a throttle that went quiet runs the next call at once again', () => {
        const callback = vi.fn();
        const attempt = genThrottleAttempt(80);

        attempt(callback);
        vi.advanceTimersByTime(81);
        attempt(callback);

        expect(callback).toHaveBeenCalledTimes(2);
    });
});
